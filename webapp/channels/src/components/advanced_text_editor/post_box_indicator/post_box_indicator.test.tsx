// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostBoxIndicator from './post_box_indicator';

jest.mock('components/advanced_text_editor/use_post_box_indicator');
jest.mock('components/advanced_text_editor/remote_user_hour', () => ({
    __esModule: true,
    default: () => <div>{'remote-user-hour'}</div>,
}));
jest.mock('components/advanced_text_editor/scheduled_post_indicator/scheduled_post_indicator', () => ({
    __esModule: true,
    default: () => null,
}));

const mockedUseTimePostBoxIndicator = jest.mocked(useTimePostBoxIndicator);

describe('PostBoxIndicator', () => {
    const baseHookReturn = {
        showRemoteUserHour: true,
        isScheduledPostEnabled: false,
        currentUserTimesStamp: 1234567890,
        teammateTimezone: {
            useAutomaticTimezone: true,
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
        isDM: true,
        userCurrentTimezone: 'UTC',
        showDndWarning: false,
        teammateId: 'teammate_id',
        teammateDisplayName: 'Teammate',
        isSelfDM: false,
        isBot: false,
    };

    beforeEach(() => {
        mockedUseTimePostBoxIndicator.mockReturnValue(baseHookReturn);
    });

    it('should show remote user hour when teammate is outside working hours', () => {
        renderWithContext(
            <PostBoxIndicator
                channelId='channel_id'
                teammateDisplayName='Teammate'
                location='CENTER'
                postId=''
            />,
        );

        expect(screen.getByText('remote-user-hour')).toBeInTheDocument();
    });

    it('should hide remote user hour when out-of-office notice replaces it', () => {
        renderWithContext(
            <PostBoxIndicator
                channelId='channel_id'
                teammateDisplayName='Teammate'
                location='CENTER'
                postId=''
                hideRemoteUserHour={true}
            />,
        );

        expect(screen.queryByText('remote-user-hour')).not.toBeInTheDocument();
    });
});
