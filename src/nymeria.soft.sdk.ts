import { NymeriaSoftSDKConfig } from "./types/local.types";
import axios from "axios";
import http from "http";
import url from "url";
import { randomBytes, createHash } from "crypto";
import open from "open";
import { AUTHORIZED_HTML } from "./constants";
import qs from "qs";
import { formatRemainingTime, joinMultiplePaths, utcTimespamp } from "./utils";
import { Token } from "./interface/token.interface";
import {
  ApolloClient,
  ApolloClientOptions,
  gql,
  NormalizedCacheObject,
} from "@apollo/client/core";
import apolloClient from "./apollo.client";
import { Logger } from "pino";
import pinoLocal from "./pino.local";
import BackendUtil from "./backend.util";
import realtimeInitFn from "./realtime";
import { ClientOptions } from "ws";
import ReconnectingWebSocket, { Options } from "reconnecting-websocket";

export default class NymeriaSoftSDK {
  private code_verifier: string | undefined;
  private apollo_client: ApolloClient<NormalizedCacheObject> | undefined;
  private backend: BackendUtil | undefined;
  realtime: ReconnectingWebSocket | undefined;
  logger: Logger<never>;

  constructor(private config: NymeriaSoftSDKConfig) {
    // CLIENT_CREDENTIALS e servico puro (maquina-a-maquina): so o backend
    // importa — frontend/redirect sao formalidades do fluxo interativo.
    if (config.auth_type === "CLIENT_CREDENTIALS") {
      if (!config.instance_backend_uri && !config.instance_fontend_uri) {
        throw new Error("instance_backend_uri is required");
      }
      if (!config.instance_fontend_uri) {
        config.instance_fontend_uri = config.instance_backend_uri as string;
      }
    }
    if (!config.instance_fontend_uri) {
      throw new Error("instance_fontend_uri is required");
    }
    if (!config.client_id) {
      throw new Error("client_id is required");
    }
    if (!config.client_secret) {
      throw new Error("client_secret is required");
    }
    if (!config.auth_type) {
      config.auth_type = "BROWSER";
    }
    if (!config.redirect_uri) {
      config.redirect_uri = `https://${config.instance_fontend_uri}/oauth?state=success`;
    }
    if (
      config.auth_type &&
      !["CONSOLE", "BROWSER", "CLIENT_CREDENTIALS"].includes(config.auth_type)
    ) {
      throw new Error(
        "auth_type must be CONSOLE, BROWSER or CLIENT_CREDENTIALS"
      );
    }

    if (!config.realtime_uri) {
      config.realtime_uri = `wss://realtime-dev.api.nymeriasoft.com.br`;
    }

    if (!config.oauth_authorize_path) {
      this.config.oauth_authorize_path = "oauth/authorize";
    }

    if (!config.oauth_token_path) {
      this.config.oauth_token_path = "api/v1/public/oauth/token";
    }
    if (!config.scope) {
      this.config.scope = "global";
    }

    if (!config.oauth_response_type) {
      this.config.oauth_response_type = "code";
    }

    if (!config.oauth_console_path) {
      this.config.oauth_console_path = "api/v1/public/oauth/auth-code-console";
    }

    if (!config.oauth_callback_port) {
      this.config.oauth_callback_port = 55_88;
    }

    if (!config.instance_backend_uri) {
      this.config.instance_backend_uri = this.config.instance_fontend_uri;
    }

    if (!config.graphql_api_path) {
      this.config.graphql_api_path = "graphql";
    }

    if (!config.refresh_token_path) {
      this.config.refresh_token_path = "api/v1/auth/renew_token";
    }

    this.logger = this.config.logger ?? pinoLocal();
  }

  async init() {}

  async authorize() {
    if (!this.config.store) {
      throw new Error("store is required");
    }
    // Servico: troca client_id+secret pelo par direto (grant
    // client_credentials) — sem navegador, sem pareamento, autocuravel.
    if (this.config.auth_type === "CLIENT_CREDENTIALS") {
      await this.ensureFreshAccessToken();
      this.logger!.info("Authenticated via client_credentials");
      return true;
    }
    if (this.config.store.getCredentials()) {
      this.logger!.info("You're logged in");
      this.hasTokenExpired("REFRESH_TOKEN");
      return true;
    }
    const code = await this.requestAuthorizationCode();
    const token = await this.requestAccessToken(code);
    const { store } = this.config;
    store.saveCredentials(token);

    this.hasTokenExpired("REFRESH_TOKEN");
    return true;
  }

  private static decodeJwt(token: string): {
    exp: number | null;
    data: Record<string, unknown>;
  } {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8")
      );
      return {
        exp: typeof payload.exp === "number" ? payload.exp : null,
        data: payload.data ?? {},
      };
    } catch {
      return { exp: null, data: {} };
    }
  }

  // Cunha o par pelo grant client_credentials. O backend registra a SESSAO
  // (sys_auth_session) — revogar a sessao mata a renovacao e o proximo
  // ensureFreshAccessToken re-autentica com o secret sozinho.
  async requestClientCredentialsToken(): Promise<Token> {
    const url = joinMultiplePaths(
      this.config.instance_backend_uri!,
      this.config.oauth_token_path!
    );
    const result = await axios<{ access_token: string; refresh_token: string }>(
      {
        method: "post",
        url,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({
          grant_type: "client_credentials",
          client_id: this.config.client_id,
          client_secret: this.config.client_secret,
        }),
      }
    );
    const { access_token, refresh_token } = result.data;
    const decoded = NymeriaSoftSDK.decodeJwt(access_token);
    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      client: {
        id: "",
        clientId: this.config.client_id,
        clientSecret: "",
        grants: ["client_credentials"],
        redirectUris: [],
        sys_scope_id: "global",
      },
      user: decoded.data,
    } as unknown as Token;
  }

  // Access token valido AGORA (com margem): usa o cache, senao renova pelo
  // refresh (respeita revogacao de sessao), senao — em CLIENT_CREDENTIALS —
  // re-autentica com o secret. force=true descarta o access em cache.
  async ensureFreshAccessToken(force = false): Promise<string> {
    const store = this.config.store;
    if (!store) {
      throw new Error("store is required");
    }
    const MARGIN_S = 60;
    const now = Math.floor(Date.now() / 1000);
    const creds = store.getCredentials();

    if (creds?.accessToken && !force) {
      const { exp } = NymeriaSoftSDK.decodeJwt(creds.accessToken);
      if (exp && exp - now > MARGIN_S) return creds.accessToken;
    }

    if (creds?.refreshToken) {
      const { exp } = NymeriaSoftSDK.decodeJwt(creds.refreshToken);
      if (exp && exp - now > MARGIN_S) {
        try {
          const response = await axios<{ access_token: string }>({
            method: "post",
            url: joinMultiplePaths(
              this.config.instance_backend_uri!,
              this.config.refresh_token_path!
            ),
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ token: creds.refreshToken }),
          });
          store.updateCredentials({
            accessToken: response.data.access_token,
          });
          return response.data.access_token;
        } catch (error) {
          this.logger.warn(
            "Refresh recusado (sessao revogada/expirada?) — seguindo para re-autenticacao"
          );
        }
      }
    }

    if (this.config.auth_type === "CLIENT_CREDENTIALS") {
      const token = await this.requestClientCredentialsToken();
      store.saveCredentials(token);
      this.logger.info("client_credentials: par renovado (sessao nova)");
      return token.accessToken;
    }

    throw new Error("Session expired — call authorize() again");
  }

  getCredentialStore() {
    return this.config.store;
  }

  getConfig() {
    return this.config;
  }

  async awaitForAuthorizationCodeFromBrowser(resolve: (value: string) => void) {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url!, true);

      if (parsedUrl.pathname === "/callback") {
        const authorizationCode = parsedUrl.query.code;
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(AUTHORIZED_HTML);
        setTimeout(() => {
          resolve(authorizationCode as string);
        }, 2000);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("FAIL");
      }
    });

    server.listen(this.config.oauth_callback_port, () => {
      this.logger.info(
        "Authorization code server started on port " +
          this.config.oauth_callback_port
      );
    });

    return server;
  }

  hasTokenExpired(
    token_type: "REFRESH_TOKEN" | "ACCESS_TOKEN" = "REFRESH_TOKEN"
  ) {
    const { store } = this.config;
    const credentials = store!.getCredentials();
    const current_timestamp = Math.floor(utcTimespamp() / 1000);
    const issued_timestamp = credentials!.user!.issued_timestamp;
    const elapsed_time = current_timestamp - issued_timestamp;
    const token_lifespan =
      token_type === "REFRESH_TOKEN"
        ? credentials!.user!.refresh_token_lifespan
        : credentials!.user!.access_token_lifespan;
    const expiration_timestamp = issued_timestamp + token_lifespan;
    const expired = elapsed_time >= expiration_timestamp;
    const remaining_seconds = expiration_timestamp - current_timestamp;
    if (!expired) {
      const formated_remaining = formatRemainingTime({
        current_timestamp,
        expiration_timestamp,
        seconds: remaining_seconds,
        token_type,
      });
      this.logger.warn(formated_remaining);
    } else {
      this.logger.warn(`${token_type} has expired`);
    }
    return expired;
  }

  //oauth/authorize/:client_id
  async requestAuthorizationCode() {
    return new Promise<string>(async (resolve, reject) => {
      try {
        this.code_verifier = this.getCodeVerifier();
        const code_challenge = this.getCodeChallenge(this.code_verifier);
        const search: Record<string, string> = {
          client_id: this.config.client_id,
          code_challenge: code_challenge,
          code_challenge_method: "S256",
          redirect_uri: this.config.redirect_uri,
          response_type: this.config.oauth_response_type!,
          scope: this.config.scope!,
          authorization_exchange: this.config.auth_type!.toLowerCase(),
        };

        const search_params = new URLSearchParams(search);
        const query_string = search_params.toString();

        const authorize_url = `${this.config.instance_fontend_uri}/${this.config.oauth_authorize_path}?${query_string}`;

        if (this.config.auth_type === "BROWSER") {
          open(authorize_url);

          let await_timeout: NodeJS.Timeout | undefined = undefined;
          const server = await this.awaitForAuthorizationCodeFromBrowser(
            (code: string) => {
              if (await_timeout) {
                clearTimeout(await_timeout);
              }
              server.close();
              resolve(code);
            }
          );
          // timeout
          await_timeout = setTimeout(() => {
            server.close();
            reject(new Error("Timeout error: Authorization code not received"));
          }, 60000 * 10);
        } else {
          console.log(`Please visit ${authorize_url} to authorize the app`);

          try {
            const code = await this.awaitForAuthorizationCodeFromRequest({
              client_id: this.config.client_id,
              redirect_uri: this.config.redirect_uri,
              code_challenge,
            });
            resolve(code);
          } catch (error) {
            reject(error);
          }
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  awaitForAuthorizationCodeFromRequest({
    client_id,
    redirect_uri,
    code_challenge,
  }: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
  }) {
    return new Promise<string>(async (resolve, reject) => {
      let retries = 0;
      const get_code = async () => {
        try {
          const result = await this.getOAuthCodeByConsole({
            client_id,
            redirect_uri,
            code_challenge,
          });
          if (result.code) {
            return resolve(result.code);
          }
          throw new Error("Authorization code not received");
          // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
        } catch (err: any) {
          retries++;
          if (retries >= 20) {
            return reject(
              new Error(
                "Authorization timeout - Failed to get authorization code."
              )
            );
          }
          setTimeout(() => {
            get_code();
          }, 10000);
        }
      };

      get_code();
    });
  }

  getApolloClient(
    apollo_client_override?: Partial<ApolloClientOptions<NormalizedCacheObject>>
  ) {
    if (!this.apollo_client) {
      this.apollo_client = apolloClient(this, apollo_client_override);
    }
    return this.apollo_client;
  }

  getBackend(
    apollo_client_override?: Partial<ApolloClientOptions<NormalizedCacheObject>>
  ) {
    const apollo = this.getApolloClient(apollo_client_override);
    if (!this.backend) {
      this.backend = new BackendUtil(apollo, this);
    }
    return this.backend;
  }

  private getCodeChallenge(codeVerifier: string) {
    return this.base64URLEncode(
      createHash("sha256").update(codeVerifier).digest()
    );
  }
  private getCodeVerifier() {
    return this.base64URLEncode(randomBytes(32));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private base64URLEncode(str: any): string {
    return str
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  async requestAccessToken(code: string) {
    const data = qs.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirect_uri,
      client_id: this.config.client_id,
      client_secret: this.config.client_secret,
      code_verifier: this.code_verifier,
    });

    const token_url = `${joinMultiplePaths(
      this.config.instance_backend_uri!,
      this.config.oauth_token_path!
    )}`;

    const config = {
      method: "post",
      url: token_url,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: data,
    };

    const result = await axios<Token>(config);
    return result.data;
  }

  async getOAuthCodeByConsole({
    client_id,
    redirect_uri,
    code_challenge,
  }: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
  }) {
    const data = JSON.stringify({ client_id, redirect_uri, code_challenge });
    const console_url = `${joinMultiplePaths(
      this.config.instance_backend_uri!,
      this.config.oauth_console_path!
    )}`;
    const config = {
      method: "post",
      url: console_url,
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };

    const result = await axios<{ code: string }>(config);
    return result.data;
  }

  initRealtime(
    reconnect_opts?: Partial<Options>,
    options?: Partial<ClientOptions>
  ) {
    if (!this.realtime) {
      this.realtime = realtimeInitFn(this, reconnect_opts, options);
    }
    return this.realtime;
  }

  async revalidateTokenIfNecessary() {
    const backend = await this.getBackend();
    const query = gql`
      query CurrentUser {
        currentUser {
          id
        }
      }
    `;
    await backend.query({
      query: query,
      variables: {},
    });

    this.logger.info("Token revalidated");
  }
}
