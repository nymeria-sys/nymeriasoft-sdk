import {
  ApolloClient,
  ApolloClientOptions,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client/core";
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";

import fetch from "cross-fetch";
import NymeriaSoftSDK from "./nymeria.soft.sdk";
import { joinMultiplePaths } from "./utils";

export default (
  sdk: NymeriaSoftSDK,
  options?: Partial<ApolloClientOptions<NormalizedCacheObject>>
) => {
  loadDevMessages();
  loadErrorMessages();
  if (!options) {
    options = {};
  }
  const store = sdk.getCredentialStore()!;
  const config = sdk.getConfig()!;
  const { logger } = sdk;

  const renewAccessToken = async (refreshToken: string) => {
    const response = await fetch(
      `${joinMultiplePaths(
        config.instance_backend_uri!,
        config.refresh_token_path!
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: refreshToken }),
      }
    );

    if (!response.ok) {
      if (response.status === 403) {
        logger.warn(
          "Your refresh token is expired. Clearing credentials. You need to login again."
        );
        store.clearCredentials();
      }
      throw new Error("Failed to renew access token");
    }

    const data = await response.json();
    store.updateCredentials({
      accessToken: data.access_token,
    });
    return data.access_token;
  };

  const saveFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit | undefined
  ) => {
    let response = await fetch(input, init);

    if (response.status === 401) {
      try {
        const refresh_token = store.getCredentials()?.refreshToken;
        if (!refresh_token) {
          throw new Error("No refresh token available");
        }

        logger.debug("Renewing access token");
        const newAccessToken = await renewAccessToken(refresh_token);
        const headers = new Headers(init?.headers || {});
        headers.set("Authorization", `Bearer ${newAccessToken}`);
        logger.debug("Renewing ok. Retrying request");

        response = await fetch(input, { ...init, headers });
      } catch (error) {
        logger.error("Failed to renew access token", error);
        return response;
      }
    }

    return response;
  };

  const http = new HttpLink({
    uri: `${joinMultiplePaths(
      config.instance_backend_uri!,
      config.graphql_api_path!
    )}`,
    fetch: saveFetch,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modifyFilters = (operation: any) => {
    const filters = operation.variables?.filter?.filters;
    if (filters) {
      for (const key in filters) {
        if (Array.isArray(filters[key])) {
          filters[key] = filters[key][0];
        }
      }
    }
  };

  const middleware = new ApolloLink((operation, forward) => {
    const token = store?.getCredentials()?.accessToken;
    if (token) {
      operation.setContext({
        headers: {
          Authorization: `Bearer ${token}`,
          "apollo-require-preflight": "true",
        },
      });
    }

    modifyFilters(operation);
    return forward(operation);
  });

  const link = ApolloLink.from([middleware, http]);

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: "no-cache",
      },
    },
    ...options,
  });
};
