// lib/can.ts

export function can(
  permissions: any,
  module: string,
  action: string = "view"
): boolean {
  return Boolean(permissions?.[module]?.[action]);
}