// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createBrowserHistory} from 'history';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';

import {DeepPartial} from '@mattermost/types/utilities';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

import configureStore from 'store';

import mockStore from 'tests/test_store';

import {GlobalState} from 'types/store';

export * from '@testing-library/react';
export {userEvent};

export const renderWithIntl = (component: React.ReactNode | React.ReactNodeArray, locale = 'en') => {
    return render(<IntlProvider locale={locale}>{component}</IntlProvider>);
};

export const renderWithIntlAndStore = (component: React.ReactNode | React.ReactNodeArray, initialState: DeepPartial<GlobalState> = {}, locale = 'en') => {
    // We use a redux-mock-store store for testing, but we set up a real store to ensure the initial state is complete
    const realStore = configureStore(initialState);

    const store = mockStore(realStore.getState());

    return render(
        <IntlProvider locale={locale}>
            <Provider store={store}>
                {component}
            </Provider>
        </IntlProvider>,
    );
};

export const renderWithFullContext = (component: React.ReactNode | React.ReactNodeArray, initialState: DeepPartial<GlobalState> = {}, locale = 'en') => {
    // We use a redux-mock-store store for testing, but we set up a real store to ensure the initial state is complete
    const testState = configureStore(initialState).getState();

    // Store these in an object so that they can be maintained through rerenders
    const renderState = {
        component,
        history: createBrowserHistory(),
        locale,
        state: testState,
        store: mockStore(testState),
    };

    // This should wrap the component in roughly the same providers used in App and RootProvider
    function wrapComponent() {
        // Every time this is called, these values should be updated from `renderState`
        return (
            <Provider store={renderState.store}>
                <Router history={renderState.history}>
                    <IntlProvider
                        locale={renderState.locale}
                    >
                        {renderState.component}
                    </IntlProvider>
                </Router>
            </Provider>
        );
    }

    const results = render(wrapComponent());

    return {
        ...results,
        rerender: (newComponent: React.ReactNode | React.ReactNodeArray) => {
            renderState.component = newComponent;

            results.rerender(wrapComponent());
        },

        /**
         * Rerenders the component after replacing the entire store state with the provided one.
         */
        replaceStoreState: (newInitialState: DeepPartial<GlobalState>) => {
            const newTestState = configureStore(newInitialState).getState();
            renderState.state = newTestState;
            renderState.store = mockStore(newTestState);

            results.rerender(wrapComponent());
        },

        /**
         * Rerenders the component after merging the current store state with the provided one.
         */
        updateStoreState: (stateDiff: DeepPartial<GlobalState>) => {
            const newTestState = mergeObjects(renderState.state, stateDiff);
            renderState.state = newTestState;
            renderState.store = mockStore(newTestState);

            results.rerender(wrapComponent());
        },
    };
};
