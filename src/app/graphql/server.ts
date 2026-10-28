import { createYoga } from "graphql-yoga";
import { schema } from "./schema.js";
import { createGraphQLContext } from "./context.js";
/* eslint-disable @typescript-eslint/no-explicit-any */
export const graphqlHandler = createYoga({
  schema,
  graphqlEndpoint: "/graphql",
  context: (initialContext: any) => createGraphQLContext(initialContext),
  maskedErrors: true,
});
