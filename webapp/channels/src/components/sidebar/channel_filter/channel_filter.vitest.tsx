// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import ChannelFilterIntl from 'components/sidebar/channel_filter/channel_filter';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/sidebar/channel_filter', () => {
    const baseProps = {
        unreadFilterEnabled: false,
        hasMultipleTeams: false,
        actions: {
            setUnreadFilterEnabled: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelFilterIntl {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if the unread filter is enabled', () => {
        const props = {
            ...baseProps,
            unreadFilterEnabled: true,
        };

        const {container} = renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
