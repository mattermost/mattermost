// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {Provider} from 'react-redux';

import {IntlProvider} from 'react-intl';

import mockStore from 'tests/test_store';
import {GlobalState} from '@mattermost/types/store';
import {DeepPartial} from '@mattermost/types/utilities';

export const renderWithIntl = (component: React.ReactNode | React.ReactNodeArray, locale = 'en') => {
    return render(<IntlProvider locale={locale}>{component}</IntlProvider>);
};

export const renderWithIntlAndStore = (component: React.ReactNode | React.ReactNodeArray, initialState: DeepPartial<GlobalState>, locale = 'en') => {
    const store = mockStore(initialState);
    return render(
        <IntlProvider locale={locale}>
            <Provider store={store}>
                {component}
            </Provider>
        </IntlProvider>,
    );
};
