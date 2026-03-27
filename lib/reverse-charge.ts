import { resolveClientCountryCode } from "./client-country"

type ReverseChargeInput = {
  clientDetails?: {
    country?: string
    address?: string
  }
}

/**
 * Reverse-charge notice: show for Czech clients only; never for Germany.
 * (Simplified rule — can be extended later.)
 */
export function shouldShowReverseChargeNotice(input: ReverseChargeInput): boolean {
  const clientCode = resolveClientCountryCode(input.clientDetails)
  if (clientCode === "DE") {
    return false
  }
  return clientCode === "CZ"
}
