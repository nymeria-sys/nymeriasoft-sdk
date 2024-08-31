import { Token } from "./token.interface";

export interface CredentialStore {
  saveCredentials: (credentials: Token) => void;
  getCredentials: () => Token | undefined;
  updateCredentials: (values: Partial<Token>) => void;
  clearCredentials: () => void;
}
