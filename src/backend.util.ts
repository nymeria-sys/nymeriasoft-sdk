/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocumentNode } from "graphql";
import { toPascalCase } from "./utils";
import { ApolloClient, NormalizedCacheObject, gql } from "@apollo/client/core";
import NymeriaSoftSDK from "./nymeria.soft.sdk";

export interface iFindQuery {
  table: string;
  where?: Record<string, unknown>;
  order?: [{ direction: "ASC" | "DESC"; field: string }];
  pagination?: { limit: number; page: number };
  select?: string[] | string;
  fields?: string;
  type: "find" | "findOne" | "browse";
}

export interface iUpdateQuery {
  table: string;
  where: Record<string, unknown>;
  value: Record<string, unknown>;
  transaction?: boolean;
}

export interface iDeleteQuery {
  table: string;
  where: Record<string, unknown>;
  transaction?: boolean;
}

export interface iCreateQuery {
  table: string;
  value: Record<string, unknown>;
  select: string[] | string;
  transaction?: boolean;
}

export default class BackendUtil {
  constructor(
    private apollo: ApolloClient<NormalizedCacheObject>,
    private sdk: NymeriaSoftSDK
  ) {}

  private getErrorsByCode(code: any) {
    switch (code) {
      case "MISSING_MANDATORY_FIELDS":
        return `Mandatory fields were not filled:  %fields%`;

      default:
        return `Unknow error code: ${code}`;
    }
  }

  private handleError(error: any) {
    if (error.graphQLErrors) {
      error.graphQLErrors.forEach((err: any) => {
        let errorMessages = this.getErrorsByCode(err.extensions.code);
        Object.keys(err.extensions).forEach((field: any) => {
          errorMessages = errorMessages.replace(
            `%${field}%`,
            err.extensions[field]
          );
        });
        this.sdk.logger.error(errorMessages, { error: err });
      });
    } else {
      this.sdk.logger.error(error);
    }
  }

  query({
    query,
    variables,
  }: {
    query: DocumentNode;
    variables: Record<string, unknown>;
  }) {
    this.apollo.query({ query, variables });

    return this.apollo.query({ query, variables }).catch((error: any) => {
      this.handleError(error);
      throw error;
    });
  }

  mutation<T>({
    mutation,
    variables,
    context,
  }: {
    mutation: DocumentNode;
    variables: Record<string, unknown>;
    context?: Record<string, unknown>;
  }) {
    return this.apollo
      .mutate<T>({ mutation, variables, context })
      .catch((error: any) => {
        this.handleError(error);
        throw error;
      });
  }

  private findQueryFactory(queries: iFindQuery[]) {
    // parse selects
    for (const query of queries) {
      if (typeof query.select === "string") {
        query.select = query.select.split(/,|\n/).map((item) => item.trim());
      }
      if (!query.where) query.where = {};
    }

    const query = gql`query FindQuery(${queries
      .map(
        (value, index) => `$data${index}: ${toPascalCase(value.table)}Query!`
      )
      .join(", ")}) {
      ${queries
        .map(
          (value, index) =>
            `${value.type}${toPascalCase(value.table)}(data: $data${index}) {
              ${
                value.fields
                  ? value.fields
                  : (value.select as string[]).join("\n")
              }
            }`
        )
        .join("\n")}
      }`;

    const variables: any = {};

    const queryReturnKeys = queries.map(
      (value) => `${value.type}${toPascalCase(value.table)}`
    );

    for (const query of queries) {
      variables[`data${queries.indexOf(query)}`] = {
        ...(query.order
          ? {
              order: query.order,
            }
          : {}),
        ...(query.pagination
          ? {
              pagination: query.pagination,
            }
          : {}),
        ...(query.where
          ? {
              where: query.where,
            }
          : {}),
      };
    }

    return { query, variables, queryReturnKeys };
  }

  find(queries: iFindQuery[]) {
    const { query, variables, queryReturnKeys } =
      this.findQueryFactory(queries);
    return this.query({ query, variables }).then((result: any) => {
      const data: any = result.data;
      return queryReturnKeys.map((key) => data[key]);
    });
  }

  update({ table, where, value, transaction }: iUpdateQuery): Promise<{
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
  }> {
    const tableName = toPascalCase(table);
    const operationName = `update${tableName}`;
    const mutation = gql`
      mutation Update${tableName}($data: ${tableName}Update!) {
        ${transaction ? "transaction" : ""} 
        ${operationName}(data: $data) {
          inserted_count
          updated_count
          deleted_count
        }
        ${transaction ? "commit" : ""} 
      }
    `;

    const variables = {
      data: {
        where,
        value,
      },
    };

    return this.mutation({ mutation, variables }).then((result: any) => {
      const data: any = result.data;
      return data[operationName];
    });
  }

  create({
    table,
    select,
    value,
    transaction,
  }: iCreateQuery): Promise<Record<string, unknown>> {
    const tableName = toPascalCase(table);
    const operationName = `create${tableName}`;
    if (typeof select === "string") {
      select = select.split(/,|\n/).map((item) => item.trim());
    }
    const mutation = gql`
      mutation Create${tableName}($data: ${tableName}Input!) {
        ${transaction ? "transaction" : ""} 
        ${operationName}(data: $data) {
          ${(select as string[]).join("\n")}
        }
        ${transaction ? "commit" : ""} 
      }
    `;

    const variables = {
      data: value,
    };

    return this.mutation({ mutation, variables }).then((result: any) => {
      const data: any = result.data;
      return data[operationName];
    });
  }

  delete({ table, where, transaction }: iDeleteQuery): Promise<{
    deleted_count: number;
  }> {
    const tableName = toPascalCase(table);
    const operationName = `delete${tableName}`;
    const mutation = gql`
      mutation Delete${tableName}($data: ${tableName}DeleteQuery!) {
        ${transaction ? "transaction" : ""} 
        ${operationName}(data: $data) {
          deleted_count
        }
        ${transaction ? "commit" : ""} 
      }
    `;

    const variables = {
      data: {
        where,
      },
    };

    return this.mutation({ mutation, variables }).then((result: any) => {
      const data: any = result.data;
      return data[operationName];
    });
  }
}
