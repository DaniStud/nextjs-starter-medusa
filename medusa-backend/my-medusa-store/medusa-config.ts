import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:8000,https://localhost:8000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:7001,https://localhost:7001",
      authCors: process.env.AUTH_CORS || "http://localhost:7001,https://localhost:7001",
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
    }
  },
  modules: [
    // Stripe payment — uncomment and add STRIPE_API_KEY to .env to enable
    ...(process.env.STRIPE_API_KEY
      ? [
          {
            key: "payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_API_KEY,
                  },
                },
              ],
            },
          },
        ]
      : []),
    {
      // Shirtplatform print-on-demand API client
      resolve: "./src/modules/shirtplatform",
    },
    {
      // Newsletter subscriber module
      resolve: "./src/modules/newsletter",
    },
    // File storage — Hetzner Object Storage (S3-compatible)
    ...(process.env.FILE_S3_ACCESS_KEY_ID
      ? [
          {
            key: "file" as const,
            resolve: "@medusajs/file-s3",
            options: {
              file_url: process.env.FILE_S3_FILE_URL,
              access_key_id: process.env.FILE_S3_ACCESS_KEY_ID,
              secret_access_key: process.env.FILE_S3_SECRET_ACCESS_KEY,
              region: process.env.FILE_S3_REGION || "eu-central-1",
              bucket: process.env.FILE_S3_BUCKET,
              endpoint: process.env.FILE_S3_ENDPOINT,
              prefix: process.env.FILE_S3_PREFIX,
            },
          },
        ]
      : []),
  ],
})
