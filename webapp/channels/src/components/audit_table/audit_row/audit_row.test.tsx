// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import {Audit} from '@mattermost/types/audits';
import mockStore from 'tests/test_store';

import AuditRow, {Props} from './audit_row';

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

    const store = mockStore({
        entities: {
            users: {
                profiles: {
                    [audit.user_id]: {
                        email: 'test@example.com',
                    },
                },
            },
        },
    });

    const wrapper = (props: Props) => {
        return mountWithIntl(
            <Provider store={store}>
                <table>
                    <tbody>
                        <AuditRow {...props}/>
                    </tbody>
                </table>
            </Provider>,
        );
    };

    test('should match snapshot with no desc', () => {
        expect(wrapper(baseProps)).toMatchSnapshot();
    });

    test('should match snapshot with desc', () => {
        const props = {...baseProps, desc: 'Successfully authenticated'};
        expect(wrapper(props)).toMatchSnapshot();
    });
});
