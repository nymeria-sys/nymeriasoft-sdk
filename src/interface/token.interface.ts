export interface Application {
  oauth_client_id: string;
  sys_scope_id: string;
}

export interface Client {
  id: string;
  clientId: string;
  clientSecret: string;
  grants: string[];
  redirectUris: string[];
  sys_scope_id: string;
  [key: string]: string | number | string[];
}

export interface User {
  username: string;
  first_name: string;
  second_name: string;
  email: string;
  scope_id: string;
  id: string;
  oauth_credential_id: string;
  issued_timestamp: number;
  refresh_token_lifespan: number;
  access_token_lifespan: number;
  [key: string]: string | number | string[];
}

export interface TokenData {
  username: string;
  first_name: string;
  second_name: string;
  email: string;
  scope_id: string;
  application: Application;
  token_type: string;
  auth_type: string;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
  client: Client;
  user: User;
}
