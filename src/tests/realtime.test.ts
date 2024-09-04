import "dotenv/config";
import NymeriaSoftSDK from "../nymeria.soft.sdk";
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

  it("check realtime connection", async () => {
    await sdk.revalidateTokenIfNecessary();
    const realtime = sdk.initRealtime();
    const connection_openned = jest.fn();
    const connection_error = jest.fn();
    const pong_message = jest.fn();
    realtime.addEventListener("error", (err) => {
      console.log("error", err);
      connection_error();
    });
    realtime.addEventListener("open", () => {
      connection_openned();
      realtime.send('{"action": "ping"}');
    });
    realtime.addEventListener("message", function message(msg) {
      const data = msg.data;
      const msg_raw = JSON.parse(data);

      if (msg_raw.action === "pong") {
        pong_message();
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 15000));
    expect(connection_openned).toHaveBeenCalledTimes(1);
    expect(connection_error).toHaveBeenCalledTimes(0);
    expect(pong_message).toHaveBeenCalledTimes(1);
    realtime.close();
  });
});
