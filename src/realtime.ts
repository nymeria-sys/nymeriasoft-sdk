import NymeriaSoftSDK from "./nymeria.soft.sdk";
import WebSocket, { ClientOptions } from "ws";
import ReconnectingWebSocket, { Options } from "reconnecting-websocket";
import { type UrlProvider } from "reconnecting-websocket";
const wsFactory = (options: ClientOptions) =>
  class WsOptions extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols, options);
    }
  };

export class KeepAliveWs extends ReconnectingWebSocket {
  constructor(
    url: UrlProvider,
    protocols?: string | string[],
    options: Options = {}
  ) {
    const { connectionTimeout = 4000 } = options;
    const opts = {
      ...options,
      connectionTimeout: connectionTimeout + 1000, // give WS time to disconnect without throwing
      WebSocket: wsFactory({ handshakeTimeout: connectionTimeout }), // PASS CUSTOM ARGUMENTS HERE
    };

    super(url, protocols, opts);
  }
}

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
    maxRetries: 10000,
    ...reconnect_opts,
  };

  const rws = new KeepAliveWs(
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
