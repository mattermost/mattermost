// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import PageOutline from './page_outline';

describe('components/wiki_rhs/PageOutline', () => {
    const renderWithIntl = (component: React.ReactNode) => {
        return render(
            <IntlProvider locale='en'>
                {component}
            </IntlProvider>,
        );
    };

    test('renders empty state when no headings', () => {
        renderWithIntl(<PageOutline/>);

        expect(screen.getByText('No headings in this page')).toBeInTheDocument();
    });

    test('renders with correct class names', () => {
        const {container} = renderWithIntl(<PageOutline/>);

        expect(container.querySelector('.PageOutline')).toBeInTheDocument();
        expect(container.querySelector('.PageOutline__nav')).toBeInTheDocument();
    });
});
