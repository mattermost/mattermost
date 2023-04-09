// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {AnyAction} from 'redux';
import thunk, {ThunkDispatch} from 'redux-thunk';
import configureStore from 'redux-mock-store';

import {IntlProvider} from 'react-intl';

import {GlobalState} from 'types/store';

import {defaultIntl} from './helpers/intl-test-helper';

export default function testConfigureStore(initialState = {}) {
    return configureStore<GlobalState, ThunkDispatch<GlobalState, Record<string, never>, AnyAction>>([thunk])(initialState as GlobalState);
}

export function mockStore(initialState = {}, intl = defaultIntl) {
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
