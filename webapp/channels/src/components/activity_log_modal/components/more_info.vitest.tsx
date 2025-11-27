// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {General} from 'mattermost-redux/constants';

import MoreInfo from 'components/activity_log_modal/components/more_info';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';
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
        handleMoreInfo: vi.fn(),
    };

    test('should match snapshot extra info toggled off', () => {
        const {container} = renderWithIntl(
            <MoreInfo {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, extra info toggled on', () => {
        const props = {...baseProps, moreInfo: true};
        const {container} = renderWithIntl(
            <MoreInfo {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
