export const PROFILE_COMPLETION_FIELDS = [
  { key: "profilePhotoUrl", label: "Profile photo" },
  { key: "phoneNumber", label: "Phone number" },
  { key: "address", label: "Address" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "maritalStatus", label: "Marital status" },
  { key: "emergencyContactName", label: "Emergency contact name" },
  { key: "emergencyContactPhone", label: "Emergency contact phone" },
] as const;

export type ProfileCompletionKey = (typeof PROFILE_COMPLETION_FIELDS)[number]["key"];

export type ProfileCompletionInput = Partial<
  Record<ProfileCompletionKey, string | Date | null | undefined>
>;

function fieldIsFilled(key: ProfileCompletionKey, value: string | Date | null | undefined): boolean {
  if (key === "dateOfBirth") {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    return typeof value === "string" && value.trim().length > 0;
  }
  return typeof value === "string" && value.trim().length > 0;
}

export function getProfileCompletion(input: ProfileCompletionInput) {
  const missingFields = PROFILE_COMPLETION_FIELDS.filter(
    (field) => !fieldIsFilled(field.key, input[field.key])
  ).map((field) => field.label);

  const filled = PROFILE_COMPLETION_FIELDS.length - missingFields.length;
  const percent = Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);

  return {
    percent,
    missingFields,
    complete: missingFields.length === 0,
  };
}
