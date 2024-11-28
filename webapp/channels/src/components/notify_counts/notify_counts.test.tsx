// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';

import NotifyCounts from './';

describe('components/notify_counts', () => {
    test('should show unread mention count', () => {
        const {container} = renderWithContext(
            <NotifyCounts
                unreadMentionCount={22}
                isUnread={true}
            />,
            {
                entities: {
                    general: {
                        config: {},
                    },
                },
            }
        );

        expect(screen.getByText('22')).toBeInTheDocument();
        expect(screen.getByText('22')).toHaveClass('badge-notify');
    });

    test('should show unread messages', () => {
        const {container} = renderWithContext(
            <NotifyCounts
                unreadMentionCount={0}
                isUnread={true}
            />,
            {
                entities: {
                    general: {
                        config: {},
                    },
                },
            }
        );

        expect(screen.getByText('•')).toBeInTheDocument();
        expect(screen.getByText('•')).toHaveClass('badge-notify');
    });

    test('should not show unread indicator', () => {
        const {container} = renderWithContext(
            <NotifyCounts
                unreadMentionCount={0}
                isUnread={false}
            />,
            {
                entities: {
                    general: {
                        config: {},
                    },
                },
            }
        );

        expect(screen.queryByText('•')).not.toBeInTheDocument();
        expect(screen.queryByText('22')).not.toBeInTheDocument();
    });
});
