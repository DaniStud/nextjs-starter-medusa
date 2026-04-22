const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * Build the Content-Security-Policy header value.
 * Needs to allow Stripe's domains for PaymentElement (iframes, scripts, API calls).
 */
function buildCSP() {
  const backendUrl = process.env.MEDUSA_BACKEND_URL || ""

  const directives = [
    "default-src 'self'",
    // Stripe.js + m.stripe.network (Stripe fraud detection). 'unsafe-inline' is required
    // because Next.js injects inline hydration scripts that cannot be hashed ahead of time.
    // 'unsafe-eval' is needed in development for Next.js Turbopack/HMR.
    `script-src 'self' https://js.stripe.com https://m.stripe.network 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    // Stripe PaymentElement injects inline styles for its UI
    "style-src 'self' 'unsafe-inline'",
    // Stripe's card/payment iframes + MobilePay redirect
    "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://m.stripe.com https://*.mobilepay.dk",
    // API calls: Stripe payment confirmation + Medusa backend (client-side SDK calls)
    [
      "connect-src 'self'",
      "https://api.stripe.com",
      "https://errors.stripe.com",
      "https://m.stripe.network",
      backendUrl,
    ]
      .filter(Boolean)
      .join(" "),
    // Images: same-origin + Stripe card brand logos + flag icons (react-country-flag)
    "img-src 'self' data: blob: https://*.stripe.com https://cdn.jsdelivr.net",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
  ]

  return directives.join("; ")
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCSP(),
          },
        ],
      },
    ]
  },
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "s3.eu-central-1.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
