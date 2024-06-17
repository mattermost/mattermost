// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import AlertIcon from 'components/widgets/icons/alert_icon';
import EmailIcon from 'components/widgets/icons/mail_icon';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import Avatar from 'components/widgets/users/avatar';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import ResultTable from './result_table';
import type {Props} from './result_table';

let props: Props = {
    sent: true,
    rows: [],
};

const defaultUser = deepFreeze({
    id: 'userid',
    create_at: 1,
    update_at: 1,
    delete_at: 1,
    username: 'username',
    password: 'password',
    auth_service: 'auth_service',
    email: 'aa@aa.aa',
    email_verified: true,
    nickname: 'nickname',
    first_name: 'first_name',
    last_name: 'last_name',
    position: 'position',
    roles: 'user',
    props: {},
    notify_props: {
        desktop: 'default',
        desktop_sound: 'true',
        email: 'true',
        mark_unread: 'all',
        push: 'default',
        push_status: 'ooo',
        comments: 'never',
        first_name: 'true',
        channel: 'true',
        mention_keys: '',
    },
    last_password_update: 1,
    last_picture_update: 1,
    locale: 'en',
    mfa_active: false,
    last_activity_at: 1,
    is_bot: false,
    bot_description: '',
    terms_of_service_id: '',
    terms_of_service_create_at: 1,
},
);

describe('ResultTable', () => {
    beforeEach(() => {
        props = {
            sent: true,
            rows: [],
        };
    });

    test('emails render as email', () => {
        props.rows = [{
            email: 'aa@aa.aa',
            reason: {id: 'some_reason', defaultMessage: 'some reason'},
        }];
        const wrapper = shallow(<ResultTable {...props}/>);
        expect(wrapper.find(EmailIcon).length).toBe(1);
    });

    test('unsent invites render as unsent invites', () => {
        props.rows = [{
            text: '@incomplete_userna',
            reason: {id: 'incomplete_user', defaultMessage: 'This was not a complete user'},
        }];
        const wrapper = shallow(<ResultTable {...props}/>);
        expect(wrapper.find(AlertIcon).length).toBe(1);
    });

    test('user invites render as users', () => {
        props.rows = [{
            user: defaultUser,
            reason: {id: 'success', defaultMessage: 'added successfully'},
        }];
        const wrapper = shallow(<ResultTable {...props}/>);
        expect(wrapper.find(Avatar).length).toBe(1);
        expect(wrapper.find(BotTag).length).toBe(0);
        expect(wrapper.find(GuestTag).length).toBe(0);
    });

    test('bots render as bots', () => {
        props.rows = [{
            user: {
                ...defaultUser,
                is_bot: true,
            },
            reason: {id: 'success', defaultMessage: 'added successfully'},
        }];
        const wrapper = shallow(<ResultTable {...props}/>);
        expect(wrapper.find(Avatar).length).toBe(1);
        expect(wrapper.find(BotTag).length).toBe(1);
        expect(wrapper.find(GuestTag).length).toBe(0);
    });

    test('guests render as guests', () => {
        props.rows = [{
            user: {
                ...defaultUser,
                roles: 'system_guest',
            },
            reason: {id: 'success', defaultMessage: 'added successfully'},
        }];
        const wrapper = shallow(<ResultTable {...props}/>);
        expect(wrapper.find(Avatar).length).toBe(1);
        expect(wrapper.find(BotTag).length).toBe(0);
        expect(wrapper.find(GuestTag).length).toBe(1);
    });

    test('renders success banner when invites were sent', () => {
        props.sent = true;
        const wrapper = mountWithIntl(<ResultTable {...props}/>);
        expect(wrapper.find('h2').at(0).text()).toContain('Successful Invites');
    });

    test('renders not sent banner when invites were not sent', () => {
        props.sent = false;
        const wrapper = mountWithIntl(<ResultTable {...props}/>);
        expect(wrapper.find('h2').at(0).text()).toContain('Invitations Not Sent');
    });
});
