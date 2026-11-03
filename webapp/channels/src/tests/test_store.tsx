// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';
import type {IntlShape} from 'react-intl';
import {Provider} from 'react-redux';
import type {AnyAction} from 'redux';
import configureStore from 'redux-mock-store';
import {withExtraArgument as thunkWithExtraArgument} from 'redux-thunk';
import type {ThunkDispatch} from 'redux-thunk';

import type {DeepPartial} from '@mattermost/types/utilities';

import type {GlobalState} from 'types/store';

import {defaultIntl} from './helpers/intl-test-helper';

export default function testConfigureStore<State extends GlobalState>(initialState?: DeepPartial<State>) {
    return configureStore<State, ThunkDispatch<State, Record<string, never>, AnyAction>>([
        thunkWithExtraArgument({loaders: {}}),
    ])(initialState as State);
}

// These are named rather than inferred so that the type of mockStore stays portable. Spreading
// IntlShape inline makes TypeScript name types from react-intl's nested copy of @formatjs/intl.
export type IntlWrapperProps = {children: React.ReactNode} & React.ComponentProps<typeof IntlProvider>;

export function mockStore<State extends GlobalState>(initialState?: DeepPartial<State>, intl: IntlShape = defaultIntl) {
    const store = testConfigureStore(initialState);
    const wrappingComponentProps: IntlShape = {...intl};
    return {
        store,
        mountOptions: intl ? {
            wrappingComponent: ({children, ...props}: IntlWrapperProps) => (
                <IntlProvider {...props}>
                    <Provider store={store}>
                        {children}
                    </Provider>
                </IntlProvider>
            ),
            wrappingComponentProps,
        } : {
            wrappingComponent: Provider,
            wrappingComponentProps: {store},
        },
    };
}
