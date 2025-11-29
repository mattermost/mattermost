// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Vitest-compatible React testing utilities.
 *
 * This provides shared wrapper functions to avoid duplicating IntlProvider,
 * MemoryRouter, etc. setup in every test file.
 */

import {render, renderHook} from '@testing-library/react';
import type {RenderOptions, RenderResult} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {History} from 'history';
import {createBrowserHistory} from 'history';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {MemoryRouter, Router} from 'react-router-dom';
import type {Reducer} from 'redux';
import {vi} from 'vitest';

import type {DeepPartial} from '@mattermost/types/utilities';

import configureStore from 'store';
import globalStore from 'stores/redux_store';

import WebSocketClient from 'client/web_websocket_client';
import defaultMessages from 'i18n/en.json';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import mockStore from 'tests/test_store';
import {WebSocketContext} from 'utils/use_websocket';

import type {GlobalState} from 'types/store';

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react';
export {userEvent};

type IntlWrapperOptions = {
    locale?: string;
    messages?: Record<string, string>;
};

type RouterWrapperOptions = {
    initialEntries?: string[];
};

type WrapperOptions = IntlWrapperOptions & RouterWrapperOptions & Omit<RenderOptions, 'wrapper'>;

/**
 * Renders a component wrapped in IntlProvider.
 * Use this for components that use react-intl (FormattedMessage, useIntl, etc.)
 */
export function renderWithIntl(
    ui: React.ReactElement,
    options: IntlWrapperOptions & Omit<RenderOptions, 'wrapper'> = {},
): RenderResult {
    const {locale = 'en', messages = defaultMessages, ...renderOptions} = options;

    const Wrapper = ({children}: {children: React.ReactNode}) => (
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            {children}
        </IntlProvider>
    );

    return render(ui, {wrapper: Wrapper, ...renderOptions});
}

/**
 * Renders a component wrapped in MemoryRouter.
 * Use this for components that use react-router (Link, useHistory, useLocation, etc.)
 */
export function renderWithRouter(
    ui: React.ReactElement,
    options: RouterWrapperOptions & Omit<RenderOptions, 'wrapper'> = {},
): RenderResult {
    const {initialEntries = ['/'], ...renderOptions} = options;

    const Wrapper = ({children}: {children: React.ReactNode}) => (
        <MemoryRouter initialEntries={initialEntries}>
            {children}
        </MemoryRouter>
    );

    return render(ui, {wrapper: Wrapper, ...renderOptions});
}

/**
 * Renders a component wrapped in both IntlProvider and MemoryRouter.
 * Use this for components that need both i18n and routing.
 */
export function renderWithIntlAndRouter(
    ui: React.ReactElement,
    options: WrapperOptions = {},
): RenderResult {
    const {locale = 'en', messages = defaultMessages, initialEntries = ['/'], ...renderOptions} = options;

    const Wrapper = ({children}: {children: React.ReactNode}) => (
        <IntlProvider
            locale={locale}
            messages={messages}
        >
            <MemoryRouter initialEntries={initialEntries}>
                {children}
            </MemoryRouter>
        </IntlProvider>
    );

    return render(ui, {wrapper: Wrapper, ...renderOptions});
}

// ============================================================================
// Full context rendering (Redux store, Router, Intl, WebSocket)
// This is the Vitest-compatible version of renderWithContext from react_testing_utils.tsx
// ============================================================================

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
        intlMessages: partialOptions?.intlMessages ?? defaultMessages,
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
        store: testStore,
    };
};

export const renderHookWithContext = <TProps, TResult>(
    callback: (props: TProps) => TResult,
    initialState: DeepPartial<GlobalState> = {},
    partialOptions?: FullContextOptions,
) => {
    const options = {
        intlMessages: partialOptions?.intlMessages ?? defaultMessages,
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
    vi.spyOn(globalStore, 'dispatch').mockImplementation((...args) => getStore().dispatch(...args));
    vi.spyOn(globalStore, 'getState').mockImplementation(() => getStore().getState());
    vi.spyOn(globalStore, 'replaceReducer').mockImplementation((...args) => getStore().replaceReducer(...args));

    // Only spy on @@observable if it exists on the globalStore
    if ('@@observable' in globalStore) {
        vi.spyOn(globalStore, '@@observable' as any).mockImplementation((...args: any[]) => getStore()['@@observable'](...args));
    }

    // This may stop working if getStore starts to return new results
    vi.spyOn(globalStore, 'subscribe').mockImplementation((...args) => getStore().subscribe(...args));
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
