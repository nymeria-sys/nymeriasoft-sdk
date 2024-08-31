import { CredentialStore } from "../interface/cred.store.interface";
import { Logger } from "pino";

export type NymeriaSoftSDKConfig = {
  instance_fontend_uri: string;
  instance_backend_uri?: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  auth_type?: "CONSOLE" | "BROWSER";
  oauth_authorize_path?: string;
  oauth_token_path?: string;
  oauth_revoke_path?: string;
  oauth_response_type?: string;
  oauth_callback_port?: number;
  refresh_token_path?: string;
  graphql_api_path?: string;
  logger?: Logger<never>;
  scope?: string;
  store?: CredentialStore;
};
