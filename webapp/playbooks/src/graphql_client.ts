import {ApolloClient, NormalizedCacheObject} from '@apollo/client';

// Global for use in gloablly mounted modals that won't work with react context.
// Don't use this. If you need the client itself use `useApolloClient`.
let playbooksGraphQLClient: ApolloClient<NormalizedCacheObject>;

export const setPlaybooksGraphQLClient = (client: ApolloClient<NormalizedCacheObject>) => {
    playbooksGraphQLClient = client;
};

export const getPlaybooksGraphQLClient = () => {
    return playbooksGraphQLClient;
};
