// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import ChannelNavigator from './channel_navigator';

describe('Components/ChannelNavigator', () => {
    const baseProps = {
        showUnreadsCategory: true,
        isQuickSwitcherOpen: false,
        intl: {} as any,
        actions: {
            openModal: vi.fn(),
            closeModal: vi.fn(),
        },
    };

    test('should not show BrowserOrAddChannelMenu', () => {
        const {container} = renderWithContext(<ChannelNavigator {...baseProps}/>);
        expect(container.querySelector('.AddChannelDropdown')).not.toBeInTheDocument();
    });
});
