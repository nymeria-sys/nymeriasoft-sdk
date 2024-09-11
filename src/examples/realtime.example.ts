import "dotenv/config";
import NymeriaSoftSDK from "../nymeria.soft.sdk";
import { CredentialFileStore } from "../cred.file.store";
import { join } from "path";

const authorize_file_path = join(process.cwd(), ".session", "credetials.json");
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

sdk
  .revalidateTokenIfNecessary()
  .then(() => {
    const realtime = sdk.initRealtime();

    realtime.addEventListener("error", (err) => {
      console.log("error", err);
    });
    realtime.addEventListener("open", () => {
      console.log("connection opened");
      realtime.send('{"action": "ping"}');
    });
    realtime.addEventListener("message", function message(msg) {
      const data = msg.data;
      const msg_raw = JSON.parse(data);
      console.log(data);
      if (msg_raw.action === "pong") {
        console.log("pong");
      }
    });
  })
  .catch((err) => {
    console.error(err);
  });
