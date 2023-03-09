// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import ChannelInfoButton from './channel_info_button';

describe('components/ChannelHeaderMobile/ChannelInfoButton', () => {
    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
        }),
        actions: {
            showChannelInfo: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = mountWithIntl(
            <ChannelInfoButton {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
