// lib/can.ts

export function can(
  permissions: any,
  module: string,
  action: string
): boolean {
  return Boolean(permissions?.[module]?.[action]);
}
