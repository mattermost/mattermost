// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import {renderHook} from '@testing-library/react-hooks';
import userEvent from '@testing-library/user-event';
import type {History} from 'history';
import {createBrowserHistory} from 'history';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';
import type {Reducer} from 'redux';

import type {DeepPartial} from '@mattermost/types/utilities';

import configureStore from 'store';
import globalStore from 'stores/redux_store';

import WebSocketClient from 'client/web_websocket_client';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import mockStore from 'tests/test_store';
import {WebSocketContext} from 'utils/use_websocket';

import type {GlobalState} from 'types/store';
export * from '@testing-library/react';
export {userEvent};

export type FullContextOptions = {
    intlMessages?: Record<string, string>;
    locale?: string;
    useMockedStore?: boolean;
    pluginReducers?: string[];
    history?: History<unknown>;
}

export const renderWithContext = (
    component: React.ReactElement,
    initialState: DeepPartial<GlobalState> = {},
    partialOptions?: FullContextOptions,
) => {
    const options = {
        intlMessages: partialOptions?.intlMessages,
        locale: partialOptions?.locale ?? 'en',
        useMockedStore: partialOptions?.useMockedStore ?? false,
    };

    const testStore = configureOrMockStore(initialState, options.useMockedStore, partialOptions?.pluginReducers);

    // Store these in an object so that they can be maintained through rerenders
    const renderState = {
        component,
        history: partialOptions?.history ?? createBrowserHistory(),
        options,
        store: testStore,
    };

    replaceGlobalStore(() => renderState.store);

    const results = render(component, {
        wrapper: ({children}) => {
            // Every time this is called, these values should be updated from `renderState`
            return <Providers {...renderState}>{children}</Providers>;
        },
    });

    return {
        ...results,
        rerender: (newComponent: React.ReactElement) => {
            renderState.component = newComponent;

            results.rerender(renderState.component);
        },

        /**
         * Rerenders the component after replacing the entire store state with the provided one.
         */
        replaceStoreState: (newInitialState: DeepPartial<GlobalState>) => {
            renderState.store = configureOrMockStore(newInitialState, renderState.options.useMockedStore, partialOptions?.pluginReducers);

            results.rerender(renderState.component);
        },

        /**
         * Rerenders the component after merging the current store state with the provided one.
         */
        updateStoreState: (stateDiff: DeepPartial<GlobalState>) => {
            const newInitialState = mergeObjects(renderState.store.getState(), stateDiff);
            renderState.store = configureOrMockStore(newInitialState, renderState.options.useMockedStore, partialOptions?.pluginReducers);

            results.rerender(renderState.component);
        },
    };
};

export const renderHookWithContext = <TProps, TResult>(
    callback: (props: TProps) => TResult,
    initialState: DeepPartial<GlobalState> = {},
    partialOptions?: FullContextOptions,
) => {
    const options = {
        intlMessages: partialOptions?.intlMessages,
        locale: partialOptions?.locale ?? 'en',
        useMockedStore: partialOptions?.useMockedStore ?? false,
    };

    const testStore = configureOrMockStore(initialState, options.useMockedStore, partialOptions?.pluginReducers);

    // Store these in an object so that they can be maintained through rerenders
    const renderState = {
        callback,
        history: partialOptions?.history ?? createBrowserHistory(),
        options,
        store: testStore,
    };
    replaceGlobalStore(() => renderState.store);

    const results = renderHook(callback, {
        wrapper: ({children}) => {
            // Every time this is called, these values should be updated from `renderState`
            return <Providers {...renderState}>{children}</Providers>;
        },
    });

    return {
        ...results,

        /**
         * Rerenders the component after replacing the entire store state with the provided one.
         */
        replaceStoreState: (newInitialState: DeepPartial<GlobalState>) => {
            renderState.store = configureOrMockStore(newInitialState, renderState.options.useMockedStore, partialOptions?.pluginReducers);

            results.rerender();
        },
    };
};

function configureOrMockStore<T>(initialState: DeepPartial<T>, useMockedStore: boolean, extraReducersKeys?: string[]) {
    let testReducers;
    if (extraReducersKeys) {
        const newReducers: Record<string, Reducer> = {};
        extraReducersKeys.forEach((v) => {
            newReducers[v] = (state = null) => state;
        });

        testReducers = newReducers;
    }

    let testStore = configureStore(initialState, testReducers);
    if (useMockedStore) {
        testStore = mockStore(testStore.getState());
    }
    return testStore;
}

function replaceGlobalStore(getStore: () => any) {
    jest.spyOn(globalStore, 'dispatch').mockImplementation((...args) => getStore().dispatch(...args));
    jest.spyOn(globalStore, 'getState').mockImplementation(() => getStore().getState());
    jest.spyOn(globalStore, 'replaceReducer').mockImplementation((...args) => getStore().replaceReducer(...args));
    jest.spyOn(globalStore, '@@observable' as any).mockImplementation((...args: any[]) => getStore()['@@observable'](...args));

    // This may stop working if getStore starts to return new results
    jest.spyOn(globalStore, 'subscribe').mockImplementation((...args) => getStore().subscribe(...args));
}

type Opts = {
    intlMessages: Record<string, string> | undefined;
    locale: string;
    useMockedStore: boolean;
}

type RenderStateProps = {children: React.ReactNode; store: any; history: History<unknown>; options: Opts}

// This should wrap the component in roughly the same providers used in App and RootProvider
const Providers = ({children, store, history, options}: RenderStateProps) => {
    return (
        <Provider store={store}>
            <Router history={history}>
                <IntlProvider
                    locale={options.locale}
                    messages={options.intlMessages}
                >
                    <WebSocketContext.Provider value={WebSocketClient}>
                        {children}
                    </WebSocketContext.Provider>
                </IntlProvider>
            </Router>
        </Provider>
    );
};
