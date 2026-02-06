// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import DmListHeader from '../dm_list_header';

const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('DmListHeader', () => {
    // BUG 6: Back button should be removed from DM list header
    // Current implementation HAS a back button with aria-label="Back"
    it('does not render a back button', () => {
        renderWithIntl(
            <DmListHeader
                onBackClick={jest.fn()}
                onNewMessageClick={jest.fn()}
            />,
        );

        // The back button should not exist
        // Current code renders a button with aria-label="Back" - this test will fail
        expect(screen.queryByLabelText('Back')).not.toBeInTheDocument();
    });

    it('renders the title "Direct Messages"', () => {
        renderWithIntl(
            <DmListHeader
                onBackClick={jest.fn()}
                onNewMessageClick={jest.fn()}
            />,
        );

        expect(screen.getByText('Direct Messages')).toBeInTheDocument();
    });

    it('renders the new message button', () => {
        renderWithIntl(
            <DmListHeader
                onBackClick={jest.fn()}
                onNewMessageClick={jest.fn()}
            />,
        );

        expect(screen.getByLabelText('New Message')).toBeInTheDocument();
    });
});
