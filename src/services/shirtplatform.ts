import { TransactionBaseService } from "@medusajs/medusa";
import { ICacheService } from "@medusajs/types";

// Define the dependencies Medusa will inject
type InjectedDependencies = {
  cacheService: ICacheService;
};

class ShirtplatformService extends TransactionBaseService {
  protected readonly cacheService_: ICacheService;
  
  // Environment Variables
  protected readonly apiUrl = process.env.SHIRTPLATFORM_API_URL;
  protected readonly username = process.env.SHIRTPLATFORM_USERNAME;
  protected readonly password = process.env.SHIRTPLATFORM_PASSWORD;
  public readonly accountId = process.env.SHIRTPLATFORM_ACCOUNT_ID;
  public readonly shopId = process.env.SHIRTPLATFORM_SHOP_ID;

  constructor({ cacheService }: InjectedDependencies) {
    super(arguments[0]);
    this.cacheService_ = cacheService;
  }

  /**
   * Retrieves the active auth token from Redis, or generates a new one.
   */
  async getToken(): Promise<string> {
    const cacheKey = "shirtplatform_auth_token";
    
    // 1. Check if we already have a valid token in Redis
    const cachedToken = await this.cacheService_.get<string>(cacheKey);
    if (cachedToken) {
      return cachedToken;
    }

    // 2. If no token, generate Basic Auth credentials
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString("base64");

    // 3. Call the API to authenticate
    const response = await fetch(`${this.apiUrl}/auth`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Shirtplatform Auth Failed: ${response.status} ${response.statusText}`);
    }

    // 4. Extract the x-auth-token from the response headers
    const token = response.headers.get("x-auth-token");
    if (!token) {
      throw new Error("Shirtplatform API did not return an x-auth-token header");
    }

    // 5. Cache the token for 12 hours (API sessions usually expire after 24h)
    await this.cacheService_.set(cacheKey, token, 60 * 60 * 12);

    return token;
  }

  /**
   * A wrapper for fetching data from the API that automatically injects the token.
   */
  async request(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<any> {
    const token = await this.getToken();
    
    const headers = {
      ...options.headers,
      "x-auth-token": token,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers
    });

    // Handle Expired Token (401 Unauthorized)
    if (response.status === 401 && !isRetry) {
      // Clear the invalid token from cache
      await this.cacheService_.invalidate("shirtplatform_auth_token");
      // Try the exact same request one more time (it will generate a new token)
      return this.request(endpoint, options, true);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shirtplatform API Error (${response.status}): ${errorText}`);
    }

    // Return the parsed JSON
    return await response.json();
  }
}

export default ShirtplatformService;