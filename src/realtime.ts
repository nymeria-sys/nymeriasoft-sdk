import NymeriaSoftSDK from "./nymeria.soft.sdk";
import WebSocket, { ClientOptions } from "ws";
import ReconnectingWebSocket, { Options } from "reconnecting-websocket";
export default function (
  sdk: NymeriaSoftSDK,
  reconnect_opts?: Partial<Options>,
  opts?: Partial<ClientOptions>
) {
  const store = sdk.getCredentialStore()!;
  const credentials = store.getCredentials();

  if (!credentials) {
    throw new Error("No credentials found");
  }

  if (!opts) {
    opts = {};
  }

  if (!reconnect_opts) {
    reconnect_opts = {};
  }

  const options = {
    WebSocket: WebSocket, // custom WebSocket constructor
    connectionTimeout: 1000,
    maxRetries: 100,
    ...reconnect_opts,
  };

  const rws = new ReconnectingWebSocket(
    sdk.getConfig().realtime_uri!,
    {
      headers: {
        token: `${credentials.accessToken}`,
        instance_uri: `${sdk.getConfig().instance_backend_uri}`,
      },
      ...opts,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    options
  );

  return rws;
}
