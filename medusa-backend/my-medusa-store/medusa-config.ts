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
    {
      // Attach Stripe as a provider to the existing payment module
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
    {
      // Shirtplatform print-on-demand API client
      resolve: "./src/modules/shirtplatform",
    },
    {
      // Newsletter subscriber module
      resolve: "./src/modules/newsletter",
    },
  ],
})
