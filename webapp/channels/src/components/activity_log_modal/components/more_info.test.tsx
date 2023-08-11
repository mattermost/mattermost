// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {General} from 'mattermost-redux/constants';

import MoreInfo from 'components/activity_log_modal/components/more_info';

import {TestHelper} from 'utils/test_helper';

describe('components/activity_log_modal/MoreInfo', () => {
    const baseProps = {
        locale: General.DEFAULT_LOCALE,
        currentSession: TestHelper.getSessionMock({
            props: {os: 'Linux', platform: 'Linux', browser: 'Desktop App'},
            id: 'sessionId',
            create_at: 1534917291042,
            last_activity_at: 1534917643890,
        }),
        moreInfo: false,
        handleMoreInfo: jest.fn(),
    };

    test('should match snapshot extra info toggled off', () => {
        const wrapper = shallow(
            <MoreInfo {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, extra info toggled on', () => {
        const props = {...baseProps, moreInfo: true};
        const wrapper = shallow(
            <MoreInfo {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
