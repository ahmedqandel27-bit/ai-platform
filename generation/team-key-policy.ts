/**
 * Who may spend the server's shared Higgsfield key (HF_API_KEY).
 * HF_API_KEY_ALLOWED is a comma-separated list of e-mails and/or "@domain"
 * entries, e.g. "@theviralempire.agency, freelancer@gmail.com".
 * Empty or unset → nobody (fail closed): Supabase sign-ups are public by
 * default, so an unrestricted team key would let any stranger spend credits.
 */
export function isAllowedForTeamKey(email: string | null | undefined, allowList: string | undefined): boolean {
  if (!email || !allowList) return false
  const address = email.trim().toLowerCase()
  const at = address.lastIndexOf("@")
  if (at < 1) return false
  const domain = address.slice(at)
  return allowList
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => (entry.startsWith("@") ? entry === domain : entry === address))
}
