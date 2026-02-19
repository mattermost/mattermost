// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ChannelNavigator from './channel_navigator';

// Mock child components
jest.mock('../channel_filter', () => () => <div id='mock-channel-filter'/>);

describe('Components/ChannelNavigator', () => {
    const baseProps = {
        showUnreadsCategory: true,
        isQuickSwitcherOpen: false,
        actions: {
            openModal: jest.fn(),
            closeModal: jest.fn(),
        },
    };

    it('should not show BrowserOrAddChannelMenu', () => {
        renderWithContext(<ChannelNavigator {...baseProps}/>);

        // Component renders find channel button instead of BrowserOrAddChannelMenu
        expect(screen.getByRole('button', {name: /find channels/i})).toBeInTheDocument();
        expect(screen.getByText('Find channel')).toBeInTheDocument();

        // Channel filter not shown when showUnreadsCategory is true
        expect(document.querySelector('#mock-channel-filter')).not.toBeInTheDocument();
    });
});
