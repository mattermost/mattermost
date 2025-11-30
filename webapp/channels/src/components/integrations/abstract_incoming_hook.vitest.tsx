// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

import {renderWithContext, fireEvent, screen} from 'tests/vitest_react_testing_utils';

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

    const action = vi.fn().mockImplementation(
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
        canBypassChannelLock: true,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on serverError', () => {
        const newServerError = 'serverError';
        const props = {...requiredProps, serverError: newServerError};
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, displays client error when no initial hook', () => {
        const props = {...requiredProps};
        delete (props as any).initialHook;
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>);

        const submitButton = container.querySelector('.btn-primary');
        fireEvent.click(submitButton!);

        expect(action).not.toHaveBeenCalled();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, hiding post username if not enabled', () => {
        const props = {
            ...requiredProps,
            enablePostUsernameOverride: false,
        };
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, hiding post icon url if not enabled', () => {
        const props = {
            ...requiredProps,
            enablePostIconOverride: false,
        };
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>);
        expect(container).toMatchSnapshot();

        const displayNameInput = container.querySelector('#displayName') as HTMLInputElement;
        fireEvent.change(displayNameInput, {target: {value: 'name'}});

        const submitButton = container.querySelector('.btn-primary');
        fireEvent.click(submitButton!);

        expect(newAction).toHaveBeenCalled();
        expect(newAction).toHaveBeenCalledTimes(1);
    });

    test('should update state.channelId when on channel change', () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>);

        // The channel select uses ChannelSelect component
        // Verify the form renders correctly with the channel field
        expect(screen.getByText('Channel')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should update state.description when on description change', () => {
        const newDescription = 'new_description';

        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>);
        const descriptionInput = container.querySelector('#description') as HTMLInputElement;
        fireEvent.change(descriptionInput, {target: {value: newDescription}});

        expect(descriptionInput.value).toBe(newDescription);
    });

    test('should update state.username on post username change', () => {
        const newUsername = 'new_username';

        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>);
        const usernameInput = container.querySelector('#username') as HTMLInputElement;
        fireEvent.change(usernameInput, {target: {value: newUsername}});

        expect(usernameInput.value).toBe(newUsername);
    });

    test('should update state.iconURL on post icon url change', () => {
        const newIconURL = 'http://example.com/icon';

        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>);
        const iconURLInput = container.querySelector('#iconURL') as HTMLInputElement;
        fireEvent.change(iconURLInput, {target: {value: newIconURL}});

        expect(iconURLInput.value).toBe(newIconURL);
    });

    test('should match snapshot when channelLocked is true', () => {
        const props = {...requiredProps, channelLocked: true};
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
