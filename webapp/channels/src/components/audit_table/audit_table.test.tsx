// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AuditTable from 'components/audit_table/audit_table';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

describe('components/audit_table/AuditTable', () => {
    const actions = {
        getMissingProfilesByIds: () => jest.fn(),
    };

    const baseProps = {
        audits: [],
        showUserId: true,
        showIp: true,
        showSession: true,
        currentUser: TestHelper.getUserMock({id: 'user-1'}),
        actions,
    };

    test('should match snapshot with no audits', () => {
        const wrapper = shallowWithIntl(
            <AuditTable {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with audits', () => {
        const audits = [
            {
                action: '/api/v4/channels',
                create_at: 50778112674,
                extra_info: 'name=yeye',
                id: 'id_2',
                ip_address: '::1',
                session_id: 'hb8febm9ytdiz8zqaxj18efqhy',
                user_id: 'user_id_1',
            },
            {
                action: '/api/v4/users/login',
                create_at: 51053522355,
                extra_info: 'success',
                id: 'id_1',
                ip_address: '::1',
                session_id: '',
                user_id: 'user_id_1',
            },
        ];

        const props = {...baseProps, audits};
        const wrapper = shallowWithIntl(
            <AuditTable {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
