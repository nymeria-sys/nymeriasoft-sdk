import { NsCredentials } from "./nymeria.soft.sdk";

const nsCredentials = new NsCredentials({
  instance_uri: process.env.INSTANCE_URI || "https://",
  client_id: process.env.CLIENT_ID || "test",
  client_secret: process.env.CLIENT_SECRET || "test",
  redirect_uri: process.env.REDIRECT_URI || "https://",
  auth_type: "BROWSER",
});
