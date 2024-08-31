import { CredentialStore } from "./interface/cred.store.interface";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
} from "fs";
import { dirname } from "path";
import { Token } from "./interface/token.interface";
export interface CredentialFileStoreConfig {
  file: string;
}
export class CredentialFileStore implements CredentialStore {
  private credentials: Token | undefined;
  constructor(public config: CredentialFileStoreConfig) {}

  updateCredentials(values: Partial<Token>) {
    if (!this.credentials) {
      return;
    }
    this.credentials = { ...this.credentials, ...values };
    this.saveCredentials(this.credentials);
  }

  private prepareToSaveCredentials() {
    const { file } = this.config;
    // check if file exists
    if (existsSync(file)) {
      return;
    }
    // check if folder exists
    const directory_path = dirname(file);
    if (!existsSync(directory_path)) {
      // create dir sync
      mkdirSync(directory_path, { recursive: true });
    }
  }
  public saveCredentials(credentials: Token) {
    const json_credentials = JSON.stringify(credentials, null, 4);
    this.prepareToSaveCredentials();
    writeFileSync(this.config.file, json_credentials);
    this.credentials = credentials;
  }
  public getCredentials() {
    if (!this.credentials && existsSync(this.config.file)) {
      const file = readFileSync(this.config.file, "utf-8");
      this.credentials = JSON.parse(file);
    }
    return this.credentials;
  }
  public clearCredentials() {
    this.credentials = undefined;
    if (existsSync(this.config.file)) {
      unlinkSync(this.config.file);
    }
  }
}
