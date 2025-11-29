// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AuditTable from 'components/audit_table/audit_table';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/audit_table/AuditTable', () => {
    const actions = {
        getMissingProfilesByIds: () => vi.fn(),
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
        const {container} = renderWithContext(
            <AuditTable {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(
            <AuditTable {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
