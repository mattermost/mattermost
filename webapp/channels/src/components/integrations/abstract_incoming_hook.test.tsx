// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Team} from '@mattermost/types/teams';

import ChannelSelect from 'components/channel_select';
import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

type AbstractIncomingWebhookProps = React.ComponentProps<typeof AbstractIncomingWebhook>;

describe('components/integrations/AbstractIncomingWebhook', () => {
    const team: Team = {id: 'team_id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        display_name: 'team_name',
        name: 'team_name',
        description: 'team_description',
        email: 'team_email',
        type: 'I',
        company_name: 'team_company_name',
        allowed_domains: 'team_allowed_domains',
        invite_id: 'team_invite_id',
        allow_open_invite: false,
        scheme_id: 'team_scheme_id',
        group_constrained: false,
    };
    const header = {id: 'header_id', defaultMessage: 'Header'};
    const footer = {id: 'footer_id', defaultMessage: 'Footer'};
    const loading = {id: 'loading_id', defaultMessage: 'Loading'};
    const serverError = '';
    const initialHook = {
        display_name: 'testIncomingWebhook',
        channel_id: '88cxd9wpzpbpfp8pad78xj75pr',
        description: 'testing',
        id: 'test_id',
        team_id: 'test_team_id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        user_id: 'test_user_id',
        username: '',
        icon_url: '',
        channel_locked: false,
    };
    const enablePostUsernameOverride = true;
    const enablePostIconOverride = true;

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const requiredProps: AbstractIncomingWebhookProps = {
        team,
        header,
        footer,
        loading,
        serverError,
        initialHook,
        enablePostUsernameOverride,
        enablePostIconOverride,
        action,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<AbstractIncomingWebhook {...requiredProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', () => {
        const newServerError = 'serverError';
        const props = {...requiredProps, serverError: newServerError};
        const wrapper = shallow(<AbstractIncomingWebhook {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, displays client error when no initial hook', () => {
        const props = {...requiredProps};
        delete props.initialHook;
        const wrapper = shallow(<AbstractIncomingWebhook {...props}/>);
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).not.toBeCalled();
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, hiding post username if not enabled', () => {
        const props = {
            ...requiredProps,
            enablePostUsernameOverride: false,
        };
        const wrapper = shallow(<AbstractIncomingWebhook {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, hiding post icon url if not enabled', () => {
        const props = {
            ...requiredProps,
            enablePostIconOverride: false,
        };
        const wrapper = shallow(<AbstractIncomingWebhook {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call action function', () => {
        const wrapper = shallow(<AbstractIncomingWebhook {...requiredProps}/>);
        expect(wrapper).toMatchSnapshot();

        wrapper.find('#displayName').simulate('change', {target: {value: 'name'}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).toBeCalled();
        expect(action).toHaveBeenCalledTimes(1);
    });

    test('should update state.channelId when on channel change', () => {
        const newChannelId = 'new_channel_id';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newChannelId},
        };

        const wrapper = shallow(<AbstractIncomingWebhook {...requiredProps}/>);
        wrapper.find(ChannelSelect).simulate('change', evt);

        expect(wrapper.state('channelId')).toBe(newChannelId);
    });

    test('should update state.description when on description change', () => {
        const newDescription = 'new_description';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newDescription},
        };

        const wrapper = shallow(<AbstractIncomingWebhook {...requiredProps}/>);
        wrapper.find('#description').simulate('change', evt);

        expect(wrapper.state('description')).toBe(newDescription);
    });

    test('should update state.username on post username change', () => {
        const newUsername = 'new_username';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newUsername},
        };

        const wrapper = shallow(<AbstractIncomingWebhook {...requiredProps}/>);
        wrapper.find('#username').simulate('change', evt);

        expect(wrapper.state('username')).toBe(newUsername);
    });

    test('should update state.iconURL on post icon url change', () => {
        const newIconURL = 'http://example.com/icon';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newIconURL},
        };

        const wrapper = shallow(<AbstractIncomingWebhook {...requiredProps}/>);
        wrapper.find('#iconURL').simulate('change', evt);

        expect(wrapper.state('iconURL')).toBe(newIconURL);
    });
});
