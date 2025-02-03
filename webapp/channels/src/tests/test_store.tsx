// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import type {AnyAction} from 'redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import type {ThunkDispatch} from 'redux-thunk';

import type {DeepPartial} from '@mattermost/types/utilities';

import type {GlobalState} from 'types/store';

import {defaultIntl} from './helpers/intl-test-helper';

export default function testConfigureStore<State extends GlobalState>(initialState?: DeepPartial<State>) {
    return configureStore<State, ThunkDispatch<State, Record<string, never>, AnyAction>>([
        thunk.withExtraArgument({loaders: {}}),
    ])(initialState as State);
}

export function mockStore<State extends GlobalState>(initialState?: DeepPartial<State>, intl = defaultIntl) {
    const store = testConfigureStore(initialState);
    return {
        store,
        mountOptions: intl ? {
            wrappingComponent: ({children, ...props}: {children: React.ReactNode} & React.ComponentProps<typeof IntlProvider>) => (
                <IntlProvider {...props}>
                    <Provider store={store}>
                        {children}
                    </Provider>
                </IntlProvider>
            ),
            wrappingComponentProps: {
                ...intl,
            },
        } : {
            wrappingComponent: Provider,
            wrappingComponentProps: {store},
        },
    };
}
