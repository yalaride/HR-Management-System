# Reads new fingerprint punches from the office device and sends them to the HR listener.
# Run on the same Windows PC that already runs HikCentral Access Control.
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Root "hikvision-bridge.config.ps1"
$StatePath = Join-Path $Root "hikvision-bridge-state.json"

if (-not (Test-Path $ConfigPath)) {
  Write-Error "Missing hikvision-bridge.config.ps1 next to this script."
}
. $ConfigPath

if ([string]::IsNullOrWhiteSpace($DevicePassword) -or [string]::IsNullOrWhiteSpace($HrListenerUrl)) {
  Write-Error "Set DevicePassword and HrListenerUrl in hikvision-bridge.config.ps1."
}

function Get-XmlText {
  param($Node, [string]$Name)
  if (-not $Node) { return "" }
  $found = $Node.SelectSingleNode("*[local-name()='$Name']")
  if ($found) { return [string]$found.InnerText }
  return ""
}

function Convert-AcsResponse {
  param([string]$Raw)
  $trim = $Raw.Trim()
  if ($trim.StartsWith("{") -or $trim.StartsWith("[")) {
    return $trim | ConvertFrom-Json
  }
  if (-not $trim.StartsWith("<")) {
    throw "Device returned an unexpected reply: $($trim.Substring(0, [Math]::Min(180, $trim.Length)))"
  }

  [xml]$xml = $trim
  $status = $xml.SelectSingleNode("//*[local-name()='statusString']")
  $infos = @($xml.SelectNodes("//*[local-name()='Info']"))
  if ($status -and $infos.Count -eq 0) {
    $detail = Get-XmlText $xml.DocumentElement "subStatusCode"
    throw "Device refused the request: $($status.InnerText) $detail"
  }

  $rows = @()
  foreach ($node in $infos) {
    $rows += [pscustomobject]@{
      employeeNoString = Get-XmlText $node "employeeNoString"
      employeeNo = Get-XmlText $node "employeeNo"
      time = Get-XmlText $node "time"
      minor = Get-XmlText $node "minor"
    }
  }
  return [pscustomobject]@{
    AcsEvent = [pscustomobject]@{
      InfoList = $rows
      responseStatusStrg = Get-XmlText $xml.DocumentElement "responseStatusStrg"
    }
  }
}

function Invoke-DeviceRequest {
  param([string]$Url, [string]$Body)

  $bodyFile = Join-Path $env:TEMP "hik-bridge-body.json"
  $outFile = Join-Path $env:TEMP "hik-bridge-out.txt"
  Set-Content -Path $bodyFile -Value $Body -Encoding ASCII

  $code = & curl.exe --digest -sS -u "${DeviceUser}:${DevicePassword}" -H "Content-Type: application/json" -H "Accept: application/json" --data-binary "@$bodyFile" -o $outFile -w "%{http_code}" $Url
  $text = ""
  if (Test-Path $outFile) { $text = Get-Content -Path $outFile -Raw }
  if ($code -ne "200") {
    throw "Device returned HTTP $code. $text"
  }
  return $text
}

function Get-PakistanNow {
  return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::UtcNow, "Pakistan Standard Time")
}

$sent = @{}
if (Test-Path $StatePath) {
  $saved = Get-Content $StatePath -Raw | ConvertFrom-Json
  foreach ($key in @($saved.sent)) {
    if ($key) { $sent[$key] = $true }
  }
}

$now = Get-PakistanNow
$start = $now.AddHours(-1 * [Math]::Max(1, [int]$LookbackHours))
$startText = $start.ToString("yyyy-MM-ddTHH:mm:ssK")
$endText = $now.ToString("yyyy-MM-ddTHH:mm:ssK")
$deviceBase = "http://$DeviceHost/ISAPI/AccessControl/AcsEvent?format=json"

$position = 0
$forwarded = 0
do {
  $query = @{
    AcsEventCond = @{
      searchID = "hr-bridge"
      searchResultPosition = $position
      maxResults = 30
      major = 5
      minor = 0
      startTime = $startText
      endTime = $endText
    }
  } | ConvertTo-Json -Compress

  $raw = Invoke-DeviceRequest -Url $deviceBase -Body $query
  $parsed = Convert-AcsResponse -Raw $raw
  if (-not $parsed.AcsEvent.InfoList) { break }
  $info = @($parsed.AcsEvent.InfoList)

  foreach ($event in $info) {
    $employeeNo = [string]$event.employeeNoString
    if ([string]::IsNullOrWhiteSpace($employeeNo)) { $employeeNo = [string]$event.employeeNo }
    if ([string]::IsNullOrWhiteSpace($employeeNo) -or $employeeNo -eq "0") { continue }

    $when = [string]$event.time
    $key = "$employeeNo|$when"
    if ($sent.ContainsKey($key)) { continue }

    $payload = @{
      eventType = "AccessControllerEvent"
      dateTime = $when
      AccessControllerEvent = @{
        employeeNoString = $employeeNo
        subEventType = $event.minor
      }
    } | ConvertTo-Json -Compress

    Invoke-RestMethod -Method Post -Uri $HrListenerUrl -ContentType "application/json" -Body $payload | Out-Null
    $sent[$key] = $true
    $forwarded++
  }

  $position += $info.Count
  $more = [string]$parsed.AcsEvent.responseStatusStrg -eq "MORE"
} while ($more)

$keys = @($sent.Keys | Select-Object -Last 500)
@{ sent = $keys } | ConvertTo-Json | Set-Content $StatePath -Encoding UTF8
Write-Output "Forwarded $forwarded punch(es)."
