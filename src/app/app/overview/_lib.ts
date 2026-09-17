import { Role } from "@/lib/constants";

export function isOperatorRole(role: Role | string) {
  return ["SUPER_ADMIN", "FOUNDER", "ADMIN", "MARKETING_MANAGER", "CAMPAIGN_MANAGER", "SALES", "FINANCE", "CONTENT"].includes(role);
}

export function isClientRole(role: Role | string) {
  return ["CLIENT_ADMIN", "CLIENT_MEMBER"].includes(role);
}