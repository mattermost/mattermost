// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';
import {NotificationLevels} from 'utils/constants';

import UnmuteChannelButton from './unmute_channel_button';

describe('components/ChannelHeaderMobile/UnmuteChannelButton', () => {
    const baseProps = {
        user: {
            id: 'user_id',
        },
        channel: {
            id: 'channel_id',
        },
        actions: {
            updateChannelNotifyProps: vi.fn(),
        },
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(<UnmuteChannelButton {...baseProps}/>);

        expect(container).toMatchSnapshot();
    });

    it('should runs updateChannelNotifyProps on click', () => {
        const updateChannelNotifyProps = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                updateChannelNotifyProps,
            },
        };

        renderWithContext(<UnmuteChannelButton {...props}/>);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(updateChannelNotifyProps).toHaveBeenCalledWith(
            props.user.id,
            props.channel.id,
            {mark_unread: NotificationLevels.ALL},
        );
    });
});
