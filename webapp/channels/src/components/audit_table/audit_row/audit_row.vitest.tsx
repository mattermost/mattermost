// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Audit} from '@mattermost/types/audits';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import AuditRow from './audit_row';
import type {Props} from './audit_row';

describe('components/audit_table/audit_row/AuditRow', () => {
    const audit: Audit = {
        action: '/api/v4/channels',
        create_at: 50778112674,
        extra_info: 'name=yeye',
        id: 'id_2',
        ip_address: '::1',
        session_id: 'hb8febm9ytdiz8zqaxj18efqhy',
        user_id: 'user_id_1',
    };
    const baseProps = {
        audit,
        actionURL: '/dummy/url',
        showUserId: true,
        showIp: true,
        showSession: true,
    };

    const initialState = {
        entities: {
            users: {
                profiles: {
                    [audit.user_id]: {
                        email: 'test@example.com',
                    },
                },
            },
        },
    };

    const wrapper = (props: Props) => {
        return renderWithContext(
            <table>
                <tbody>
                    <AuditRow {...props}/>
                </tbody>
            </table>,
            initialState,
        );
    };

    test('should match snapshot with no desc', () => {
        const {container} = wrapper(baseProps);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with desc', () => {
        const props = {...baseProps, desc: 'Successfully authenticated'};
        const {container} = wrapper(props);
        expect(container).toMatchSnapshot();
    });
});
