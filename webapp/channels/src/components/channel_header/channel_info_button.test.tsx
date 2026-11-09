// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelInfoButton from './channel_info_button';

describe('components/channel_header/ChannelInfoButton', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id'});

    test('should not be active when channel info RHS is closed', () => {
        renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            {
                views: {
                    rhs: {
                        rhsState: null,
                        isSidebarOpen: false,
                    },
                },
            },
        );

        expect(screen.getByLabelText('View Info')).not.toHaveAttribute('data-active');
    });

    test('should pass active when channel info RHS is open', () => {
        renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            {
                views: {
                    rhs: {
                        rhsState: RHSStates.CHANNEL_INFO,
                        isSidebarOpen: true,
                    },
                },
            },
        );

        expect(screen.getByLabelText('Close Info')).toHaveAttribute('data-active', 'true');
    });
});
