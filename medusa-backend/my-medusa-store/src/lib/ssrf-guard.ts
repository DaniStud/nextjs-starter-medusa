/**
 * SSRF guard for server-side fetches of caller-supplied image/motive URLs.
 *
 * Admin routes that fetch a motive by URL (composed-preview, products, preview)
 * would otherwise let a caller point the server at arbitrary hosts, including
 * internal/metadata endpoints (169.254.169.254, localhost, private ranges).
 *
 * We only allow the configured object-storage host(s). Add extra hosts via
 * MOTIVE_URL_ALLOWED_HOSTS (comma-separated hostnames) if needed.
 */

function hostFromEnv(value?: string): string | null {
  if (!value) return null
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
    return new URL(withScheme).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function getAllowedMotiveHosts(): string[] {
  const hosts = new Set<string>()
  for (const h of [
    hostFromEnv(process.env.FILE_S3_FILE_URL),
    hostFromEnv(process.env.FILE_S3_ENDPOINT),
  ]) {
    if (h) hosts.add(h)
  }
  const extra = process.env.MOTIVE_URL_ALLOWED_HOSTS
  if (extra) {
    extra
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
      .forEach((h) => hosts.add(h))
  }
  return [...hosts]
}

/**
 * Validates a caller-supplied URL against the object-storage allowlist.
 * Throws with a safe message on any violation. Returns the parsed URL on success.
 */
export function assertAllowedMotiveUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("Invalid motive URL")
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Disallowed URL scheme: ${url.protocol}`)
  }

  const allowed = getAllowedMotiveHosts()
  if (allowed.length === 0) {
    // Fail closed: if no storage host is configured we cannot safely allow
    // arbitrary outbound fetches.
    throw new Error(
      "No allowed motive hosts configured (set FILE_S3_FILE_URL or MOTIVE_URL_ALLOWED_HOSTS)"
    )
  }

  if (!allowed.includes(url.hostname.toLowerCase())) {
    throw new Error(`Motive host not allowed: ${url.hostname}`)
  }

  return url
}
