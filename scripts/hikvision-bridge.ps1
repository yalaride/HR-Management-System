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

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Invoke-DeviceJson {
  param([string]$Url, [string]$Body)

  $request = [Net.HttpWebRequest]::Create($Url)
  $request.Method = "POST"
  $request.Accept = "application/json"
  $request.ContentType = "application/json"
  $request.Timeout = 20000
  $cache = New-Object Net.CredentialCache
  $cache.Add((New-Object Uri($Url)), "Digest", (New-Object Net.NetworkCredential($DeviceUser, $DevicePassword)))
  $request.Credentials = $cache

  $bytes = [Text.Encoding]::UTF8.GetBytes($Body)
  $request.ContentLength = $bytes.Length
  $stream = $request.GetRequestStream()
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Close()

  try {
    $response = $request.GetResponse()
  } catch [Net.WebException] {
    if (-not $_.Exception.Response) { throw }
    $response = $_.Exception.Response
  }

  $reader = New-Object IO.StreamReader($response.GetResponseStream())
  $text = $reader.ReadToEnd()
  $reader.Close()
  $response.Close()
  return $text
}

function Get-PakistanNow {
  return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::UtcNow, "Pakistan Standard Time")
}

$sent = @{}
if (Test-Path $StatePath) {
  $saved = Get-Content $StatePath -Raw | ConvertFrom-Json
  foreach ($key in @($saved.sent)) { $sent[$key] = $true }
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

  $raw = Invoke-DeviceJson -Url $deviceBase -Body $query
  $parsed = $raw | ConvertFrom-Json
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
