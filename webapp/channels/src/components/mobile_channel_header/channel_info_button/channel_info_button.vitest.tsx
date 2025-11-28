// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelInfoButton from './channel_info_button';

describe('components/ChannelHeaderMobile/ChannelInfoButton', () => {
    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
        }),
        actions: {
            showChannelInfo: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelInfoButton {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
