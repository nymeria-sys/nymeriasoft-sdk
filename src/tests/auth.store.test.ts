import "dotenv/config";
import NymeriaSoftSDK from "../nymeria.soft.sdk";
import { CredentialFileStore } from "../cred.file.store";
import { join } from "path";
import { existsSync } from "fs";

describe("OAuth authorization", () => {
  jest.setTimeout(60000 * 10);
  const authorize_file_path = join(
    process.cwd(),
    ".session",
    "credetials.json"
  );
  const sdk = new NymeriaSoftSDK({
    instance_fontend_uri: process.env.INSTANCE_FRONTEND_URI || "https://",
    instance_backend_uri: process.env.INSTANCE_BACKEND_URI || "https://",
    client_id: process.env.CLIENT_ID || "test",
    client_secret: process.env.CLIENT_SECRET || "test",
    redirect_uri: process.env.REDIRECT_URI || "https://",
    auth_type: "BROWSER",
    store: new CredentialFileStore({
      file: authorize_file_path,
    }),
  });

  it("Save authorize file", async () => {
    await sdk.authorize();
    const exists_authorize_file = existsSync(authorize_file_path);
    expect(exists_authorize_file).toBeTruthy();
  });

  it("Get credentials from store", async () => {
    const result = sdk.getCredentialStore()!.getCredentials()!;
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(typeof result).toEqual("object");
  });

  it("Update credentials from store", async () => {
    const store = sdk.getCredentialStore()!;
    store.updateCredentials({
      accessToken: "TESTING",
    });
    const result = store.getCredentials()!;
    result.accessToken = "TESTING";
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(typeof result).toEqual("object");
  });

  it("Remove credentials", async () => {
    const store = sdk.getCredentialStore()!;
    store.clearCredentials();
    const exists_authorize_file = existsSync(authorize_file_path);
    expect(exists_authorize_file).toBeFalsy();
    const credentials = store.getCredentials();
    expect(credentials).toBeUndefined();
  });
});
