// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SendButton from './send_button';

const scheduledPostsEnabled = {
    entities: {
        general: {
            config: {
                ScheduledPosts: 'true',
            },
            license: {
                IsLicensed: 'true',
            },
        },
    },
};

describe('SendButton', () => {
    const baseProps = {
        handleSubmit: jest.fn(),
        disabled: false,
        channelId: 'channelId',
        testId: 'center.post_create.send',
    };

    it('disables the schedule chevron when a scheduling blocked reason is given, and leaves the send button enabled', () => {
        renderWithContext(
            <SendButton
                {...baseProps}
                schedulingBlockedReason='Cannot schedule'
            />,
            scheduledPostsEnabled,
        );

        expect(screen.getByRole('button', {name: 'Schedule message'})).toBeDisabled();
        expect(screen.getByTestId('center.post_create.send--button')).toBeEnabled();
    });

    it('leaves the schedule chevron enabled without a scheduling blocked reason', () => {
        renderWithContext(
            <SendButton {...baseProps}/>,
            scheduledPostsEnabled,
        );

        expect(screen.getByRole('button', {name: 'Schedule message'})).toBeEnabled();
        expect(screen.getByTestId('center.post_create.send--button')).toBeEnabled();
    });
});
