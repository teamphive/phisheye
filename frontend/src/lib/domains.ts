/**
 * Brings what someone typed into the form the API stores: lower case, without
 * a leading @, www or trailing dot, umlauts as punycode. Null if it is no
 * domain.
 */
export function normalizeDomain(input: string) {
  // Mail addresses never sit on www, whoever types it means the domain itself
  const value = input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "")
  if (!value || /[\s/:@?#]/.test(value)) return null

  let hostname: string
  try {
    hostname = new URL(`http://${value}`).hostname
  } catch {
    return null
  }

  // At least a name and a top level domain, which rules out IP addresses
  const labels = hostname.split(".")
  const topLevel = labels[labels.length - 1]
  if (
    labels.length < 2 ||
    !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(topLevel)
  ) {
    return null
  }

  const validLabels = labels.every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
  )

  return validLabels ? hostname : null
}

/** A domain covers itself and all of its subdomains. */
export function coveredBy(domain: string, parent: string) {
  return domain === parent || domain.endsWith(`.${parent}`)
}
