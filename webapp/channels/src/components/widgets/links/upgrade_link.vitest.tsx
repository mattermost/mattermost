// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import testConfigureStore from 'tests/test_store';
import {render, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import UpgradeLink from './upgrade_link';

// Mock the useOpenSalesLink hook
vi.mock('components/common/hooks/useOpenSalesLink', () => ({
    default: () => [vi.fn()],
}));

const renderWithProviders = (component: React.ReactNode, store = testConfigureStore({})) => {
    return render(
        <IntlProvider
            locale='en'
            messages={{}}
        >
            <Provider store={store}>
                {component}
            </Provider>
        </IntlProvider>,
    );
};

describe('components/widgets/links/UpgradeLink', () => {
    test('should match the snapshot on show', () => {
        const {container} = renderWithProviders(<UpgradeLink/>);
        expect(container).toMatchSnapshot();
    });

    test('should open window when button clicked', () => {
        const store = testConfigureStore({
            entities: {
                general: {},
                cloud: {
                    customer: {},
                },
                users: {
                    profiles: {},
                },
            },
        });

        const {container} = renderWithProviders(<UpgradeLink/>, store);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        fireEvent.click(button);

        expect(container).toMatchSnapshot();
    });
});
