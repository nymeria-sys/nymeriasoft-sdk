import "dotenv/config";
import NymeriaSoftSDK from "../nymeria.soft.sdk";

describe("OAuth authorization", () => {
  jest.setTimeout(60000 * 10);
  const sdk = new NymeriaSoftSDK({
    instance_fontend_uri: process.env.INSTANCE_FRONTEND_URI || "https://",
    instance_backend_uri: process.env.INSTANCE_BACKEND_URI || "https://",
    client_id: process.env.CLIENT_ID || "test",
    client_secret: process.env.CLIENT_SECRET || "test",
    redirect_uri: process.env.REDIRECT_URI || "https://",
    auth_type: "BROWSER",
  });

  let authorization_code: string = "";
  it("get authorization code", async () => {
    const result = await sdk.requestAuthorizationCode();
    authorization_code = result;
    expect(typeof result).toEqual("string");
  });
  it("get access token", async () => {
    const result = await sdk.requestAccessToken(authorization_code);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(typeof result).toEqual("object");
  });
});
