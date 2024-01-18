// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppBinding, AppCallResponse} from '@mattermost/types/apps';
import type {Post} from '@mattermost/types/posts';

import {
    renderWithContext,
    screen,
    userEvent,
    waitFor,
} from 'tests/react_testing_utils';

import ButtonBinding from './button_binding';

describe('components/post_view/embedded_bindings/button_binding/', () => {
    const post = {
        id: 'some_post_id',
        channel_id: 'some_channel_id',
        root_id: 'some_root_id',
    } as Post;

    const binding: AppBinding = {
        app_id: 'some_app_id',
        label: 'some_label',
        location: 'some_location',
        form: {
            submit: {
                path: 'some_url',
            },
        },
    };

    const callResponse: AppCallResponse = {
        type: 'ok',
        text: 'Nice job!',
        app_metadata: {
            bot_user_id: 'botuserid',
            bot_username: 'botusername',
        },
    };

    const baseProps = {
        post,
        userId: 'user_id',
        binding,
        actions: {
            handleBindingClick: jest.fn().mockResolvedValue({
                data: callResponse,
            }),
            getChannel: jest.fn().mockResolvedValue({
                data: {
                    id: 'some_channel_id',
                    team_id: 'some_team_id',
                },
            }),
            postEphemeralCallResponseForPost: jest.fn(),
            openAppsModal: jest.fn(),
        },
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                profiles: {
                },
            },
            groups: {myGroups: []},
            emojis: {},
            channels: {},
            teams: {
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should match default component state', () => {
        renderWithContext(<ButtonBinding {...baseProps}/>, initialState);

        screen.getByText('some_label');
    });

    test('should call doAppSubmit on click', async () => {
        renderWithContext(<ButtonBinding {...baseProps}/>, initialState);

        screen.getByText('some_label');

        const submitButton = screen.getByRole('button');
        userEvent.click(submitButton);

        expect(baseProps.actions.getChannel).toHaveBeenCalledWith('some_channel_id');
        await waitFor(() => {
            expect(baseProps.actions.handleBindingClick).toHaveBeenCalledWith(binding, {
                app_id: 'some_app_id',
                channel_id: 'some_channel_id',
                location: '/in_post/some_location',
                post_id: 'some_post_id',
                root_id: 'some_root_id',
                team_id: 'some_team_id',
            }, expect.anything());
        });

        expect(baseProps.actions.postEphemeralCallResponseForPost).toHaveBeenCalledWith(callResponse, 'Nice job!', post);
    });

    test('should handle error call response', async () => {
        const errorCallResponse = {
            type: 'error',
            text: 'The error',
            app_metadata: {
                bot_user_id: 'botuserid',
            },
        };

        const props = {
            ...baseProps,
            actions: {
                handleBindingClick: jest.fn().mockResolvedValue({
                    error: errorCallResponse,
                }),
                getChannel: jest.fn().mockResolvedValue({
                    data: {
                        id: 'some_channel_id',
                        team_id: 'some_team_id',
                    },
                }),
                postEphemeralCallResponseForPost: jest.fn(),
                openAppsModal: jest.fn(),
            },
        };

        renderWithContext(<ButtonBinding {...props}/>, initialState);

        screen.getByText('some_label');

        const submitButton = screen.getByRole('button');
        userEvent.click(submitButton);

        await waitFor(() => {
            expect(props.actions.postEphemeralCallResponseForPost).toHaveBeenCalledWith(errorCallResponse, 'The error', post);
        });
    });
});
