import { getRequest } from "@tanstack/react-start/server";
import { createHash } from "crypto";

/**
 * Identificador de origem da requisição, para limitar tentativas.
 *
 * Guarda o hash, nunca o IP. O endereço é dado pessoal sob a LGPD e não temos
 * motivo para retê-lo: só precisamos saber que duas visitas vieram do mesmo
 * lugar. O sal vem do ambiente do servidor — se ele rodar, os contadores
 * zeram, o que é aceitável para janelas curtas.
 */
export function hashDaOrigem(): string | null {
  const request = getRequest();
  const bruto =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip")?.trim() ||
    "";
  if (!bruto) return null;

  const sal = process.env["LEAD_IP_SALT"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createHash("sha256").update(`${bruto}:${sal}`).digest("hex");
}
