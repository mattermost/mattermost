// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import type {Audit} from '@mattermost/types/audits';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import FormatAudit from './format_audit';
import type {Props} from './format_audit';

describe('components/audit_table/audit_row/AuditRow', () => {
    const baseProps = {
        actionURL: '/dummy/url',
        showUserId: true,
        showIp: true,
        showSession: true,
    };

    const channelName = 'default-name';
    const userId = 'user_id_1';
    const store = mockStore({
        entities: {
            channels: {
                channels: {
                    current_channel_id: {
                        id: 'current_channel_id',
                        name: channelName,
                        display_name: 'Default',
                        delete_at: 0,
                        type: 'O',
                        team_id: 'team_id',
                    },
                },
            },
            users: {
                profiles: {
                    [userId]: {
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
                        <FormatAudit {...props}/>
                    </tbody>
                </table>
            </Provider>,
        );
    };
    test('should match snapshot with channel audit', () => {
        const audit: Audit = {
            action: '/api/v4/channels',
            create_at: 50778112674,
            extra_info: `name=${channelName}`,
            id: 'id_2',
            ip_address: '::1',
            session_id: 'hb8febm9ytdiz8zqaxj18efqhy',
            user_id: userId,
        };
        const props = {...baseProps, audit};

        expect(wrapper(props)).toMatchSnapshot();
    });

    test('should match snapshot with user audit', () => {
        const audit: Audit = {
            action: '/api/v4/users/login',
            create_at: 51053522355,
            extra_info: 'success',
            id: 'id_1',
            ip_address: '::1',
            session_id: '',
            user_id: userId,
        };
        const props = {...baseProps, audit};
        expect(wrapper(props)).toMatchSnapshot();
    });

    test('should match snapshot with user audit', () => {
        const audit: Audit = {
            action: '/api/v4/oauth/register',
            create_at: 51053522355,
            extra_info: 'client_id=client_id',
            id: 'id_1',
            ip_address: '::1',
            session_id: '',
            user_id: userId,
        };
        const props = {...baseProps, audit};
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <table>
                    <tbody>
                        <FormatAudit {...props}/>
                    </tbody>
                </table>
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
