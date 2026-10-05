export const DEPARTMENTS = [
  "Engineering",
  "Human Resources",
  "Finance",
  "Operations",
  "Marketing",
  "Administration",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && DEPARTMENTS.includes(value as Department);
}