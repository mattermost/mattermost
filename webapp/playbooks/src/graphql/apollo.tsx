// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    ApolloClient,
    ApolloProvider,
    HttpLink,
    InMemoryCache,
    NormalizedCacheObject,
} from '@apollo/client';

import {Client4} from 'mattermost-redux/client';
import {relayStylePagination} from '@apollo/client/utilities';

import {getApiUrl} from 'src/client';

interface ApolloWrapperProps {
    component: React.ReactNode
    client: ApolloClient<NormalizedCacheObject>
}

export const ApolloWrapper = (props: ApolloWrapperProps) => {
    return (
        <ApolloProvider client={props.client}>
            {props.component}
        </ApolloProvider>
    );
};

export function makeGraphqlClient(isDevelopment: boolean) {
    const graphqlFetch = (_: RequestInfo, options: any) => {
        return fetch(`${getApiUrl()}/query`, Client4.getOptions(options));
    };
    const graphqlClient = new ApolloClient({
        link: new HttpLink({fetch: graphqlFetch}),
        connectToDevTools: isDevelopment,
        cache: new InMemoryCache({
            typePolicies: {
                Query: {
                    fields: {
                        runs: relayStylePagination(['teamID', 'sort', 'direction', 'statuses', 'participantOrFollowerID', 'channelID']),
                    },
                },
            },
        }),
    });
    return graphqlClient;
}

