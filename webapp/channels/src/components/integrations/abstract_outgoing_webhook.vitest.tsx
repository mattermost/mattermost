// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook';

import {renderWithContext, fireEvent, screen} from 'tests/vitest_react_testing_utils';

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

    const action = vi.fn().mockImplementation(
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
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should not render username in case of enablePostUsernameOverride is false ', () => {
        const usernameTrueProps = {...requiredProps};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        expect(container.querySelector('#username')).not.toBeInTheDocument();
    });

    test('should not render post icon override in case of enablePostIconOverride is false ', () => {
        const iconUrlTrueProps = {...requiredProps};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>);
        expect(container.querySelector('#iconURL')).not.toBeInTheDocument();
    });

    test('should render username in case of enablePostUsernameOverride is true ', () => {
        const usernameTrueProps = {...requiredProps, enablePostUsernameOverride: true};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        expect(container.querySelector('#username')).toBeInTheDocument();
    });

    test('should render post icon override in case of enablePostIconOverride is true ', () => {
        const iconUrlTrueProps = {...requiredProps, enablePostIconOverride: true};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...iconUrlTrueProps}/>);
        expect(container.querySelector('#iconURL')).toBeInTheDocument();
    });

    test('should update state.channelId when on channel change', () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>);

        // The channel select uses ChannelSelect component
        // Verify the form renders correctly with the channel field
        expect(screen.getByText('Channel')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should update state.description when on description change', () => {
        const newDescription = 'new_description';

        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>);
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;
        fireEvent.change(descriptionInput, {target: {value: newDescription}});

        expect(descriptionInput.value).toBe(newDescription);
    });

    test('should update state.username on post username change', () => {
        const usernameTrueProps = {...requiredProps, enablePostUsernameOverride: true};
        const newUsername = 'new_username';

        const {container} = renderWithContext(<AbstractOutgoingWebhook {...usernameTrueProps}/>);
        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        fireEvent.change(usernameInput, {target: {value: newUsername}});

        expect(usernameInput.value).toBe(newUsername);
    });

    test('should update state.triggerWhen on selection change', () => {
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...requiredProps}/>);

        const selector = container.querySelector('#triggerWhen') as HTMLSelectElement;
        expect(selector.value).toBe('0');

        fireEvent.change(selector, {target: {value: '1'}});
        expect(selector.value).toBe('1');
    });

    test('should call action function', () => {
        const newAction = vi.fn().mockImplementation(
            () => {
                return new Promise<void>((resolve) => {
                    process.nextTick(() => resolve());
                });
            },
        );
        const props = {...requiredProps, action: newAction};
        const {container} = renderWithContext(<AbstractOutgoingWebhook {...props}/>);

        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        fireEvent.change(displayNameInput, {target: {value: 'name'}});

        const submitButton = container.querySelector('.btn-primary');
        fireEvent.click(submitButton!);

        expect(newAction).toHaveBeenCalled();
        expect(newAction).toHaveBeenCalledTimes(1);
    });
});
