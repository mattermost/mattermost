// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Team} from '@mattermost/types/teams';

import ChannelSelect from 'components/channel_select';
import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook';

describe('components/integrations/AbstractOutgoingWebhook', () => {
    const team: Team = {
        id: 'team_id',
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

    const initialHook = {
        display_name: 'testOutgoingWebhook',
        channel_id: '88cxd9wpzpbpfp8pad78xj75pr',
        creator_id: 'test_creator_id',
        description: 'testing',
        id: 'test_id',
        team_id: 'test_team_id',
        token: 'test_token',
        trigger_words: ['test', 'trigger', 'word'],
        trigger_when: 0,
        callback_urls: ['callbackUrl1.com', 'callbackUrl2.com'],
        content_type: 'test_content_type',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        user_id: 'test_user_id',
        username: '',
        icon_url: '',
        channel_locked: false,
    };

    const action = jest.fn().mockImplementation(
        () => {
            return new Promise<void>((resolve) => {
                process.nextTick(() => resolve());
            });
        },
    );

    const requiredProps = {
        team,
        header,
        footer,
        loading,
        initialHook,
        enablePostUsernameOverride: false,
        enablePostIconOverride: false,
        renderExtra: '',
        serverError: '',
        action,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<AbstractOutgoingWebhook {...requiredProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not render username in case of enablePostUsernameOverride is false ', () => {
        const usernameTrueProps = {...requiredProps};
        const wrapper = shallow(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        expect(wrapper.find('#username')).toHaveLength(0);
    });

    test('should not render post icon override in case of enablePostIconOverride is false ', () => {
        const iconUrlTrueProps = {...requiredProps};
        const wrapper = shallow(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>);
        expect(wrapper.find('#iconURL')).toHaveLength(0);
    });

    test('should render username in case of enablePostUsernameOverride is true ', () => {
        const usernameTrueProps = {...requiredProps, enablePostUsernameOverride: true};
        const wrapper = shallow(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        expect(wrapper.find('#username')).toHaveLength(1);
    });

    test('should render post icon override in case of enablePostIconOverride is true ', () => {
        const iconUrlTrueProps = {...requiredProps, enablePostIconOverride: true};
        const wrapper = shallow(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>);
        expect(wrapper.find('#iconURL')).toHaveLength(1);
    });

    test('should update state.channelId when on channel change', () => {
        const newChannelId = 'new_channel_id';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newChannelId},
        };

        const wrapper = shallow(<AbstractOutgoingWebhook {...requiredProps}/>);
        wrapper.find(ChannelSelect).simulate('change', evt);

        expect(wrapper.state('channelId')).toBe(newChannelId);
    });

    test('should update state.description when on description change', () => {
        const newDescription = 'new_description';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newDescription},
        };

        const wrapper = shallow(<AbstractOutgoingWebhook {...requiredProps}/>);
        wrapper.find('#description').simulate('change', evt);

        expect(wrapper.state('description')).toBe(newDescription);
    });

    test('should update state.username on post username change', () => {
        const usernameTrueProps = {...requiredProps, enablePostUsernameOverride: true};
        const newUsername = 'new_username';
        const evt = {
            preventDefault: jest.fn(),
            target: {value: newUsername},
        };

        const wrapper = shallow(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        wrapper.find('#username').simulate('change', evt);

        expect(wrapper.state('username')).toBe(newUsername);
    });

    test('should update state.triggerWhen on selection change', () => {
        const wrapper = shallow(<AbstractOutgoingWebhook {...requiredProps}/>);
        expect(wrapper.state('triggerWhen')).toBe(0);

        const selector = wrapper.find('#triggerWhen');
        selector.simulate('change', {target: {value: 1}});
        console.log('selector: ', selector.debug());
        expect(wrapper.state('triggerWhen')).toBe(1);
    });

    test('should call action function', () => {
        const wrapper = shallow(<AbstractOutgoingWebhook {...requiredProps}/>);

        wrapper.find('#displayName').simulate('change', {target: {value: 'name'}});
        wrapper.find('.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(action).toBeCalled();
        expect(action).toHaveBeenCalledTimes(1);
    });
});
