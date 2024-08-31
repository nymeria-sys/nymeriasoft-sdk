import "dotenv/config";
import NymeriaSoftSDK from "../nymeria.soft.sdk";
import { gql } from "@apollo/client/core";
import { CredentialFileStore } from "../cred.file.store";
import { join } from "path";

describe("Backend request", () => {
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

  it("Authorize SDK", async () => {
    const result = await sdk.authorize();
    expect(result).toBeTruthy();
  });

  it("get current user", async () => {
    const backend = await sdk.getBackend();
    const query = gql`
      query CurrentUser {
        currentUser {
          id
          roles {
            id
            name
          }
        }
      }
    `;

    const result = await backend.query({
      query: query,
      variables: {},
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.currentUser).toBeDefined();
    const credentials = sdk.getCredentialStore()!.getCredentials();
    expect(result.data.currentUser.id).toEqual(credentials?.user.id);
  });
});
