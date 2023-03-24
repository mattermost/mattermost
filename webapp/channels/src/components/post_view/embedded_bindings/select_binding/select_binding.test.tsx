// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {AppBinding, AppCallResponse} from '@mattermost/types/apps';

import {Post} from '@mattermost/types/posts';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import SelectBinding, {RawSelectBinding} from './select_binding';

describe('components/post_view/embedded_bindings/select_binding', () => {
    const post = {
        id: 'some_post_id',
        channel_id: 'some_channel_id',
        root_id: 'some_root_id',
    } as Post;

    const binding = {
        app_id: 'some_app_id',
        location: '/some_location',
        bindings: [
            {
                app_id: 'some_app_id',
                label: 'Option 1',
                location: 'option1',
                form: {
                    submit: {
                        path: 'some_url_1',
                    },
                },
            },
            {
                app_id: 'some_app_id',
                label: 'Option 2',
                location: 'option2',
                form: {
                    submit: {
                        path: 'some_url_2',
                    },
                },
            },
        ] as AppBinding[],
    } as AppBinding;

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

    const intl = {
        formatMessage: (message: {id: string; defaultMessage: string}) => {
            return message.defaultMessage;
        },
    } as any;

    test('should start with nothing selected', () => {
        const wrapper = shallowWithIntl(<SelectBinding {...baseProps}/>);

        expect(wrapper.state()).toMatchObject({});
    });

    describe('handleSelected', () => {
        test('should call handleBindingClick', async () => {
            const props = {
                ...baseProps,
                actions: {
                    handleBindingClick: jest.fn().mockResolvedValue({
                        data: {
                            type: 'ok',
                            text: 'Nice job!',
                            app_metadata: {
                                bot_user_id: 'botuserid',
                                bot_username: 'botusername',
                            },
                        },
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
                intl,
            };

            const wrapper = shallow<RawSelectBinding>(<RawSelectBinding {...props}/>);

            await wrapper.instance().handleSelected({
                text: 'Option 1',
                value: 'option1',
            });

            expect(props.actions.getChannel).toHaveBeenCalledWith('some_channel_id');
            expect(props.actions.handleBindingClick).toHaveBeenCalledWith({
                app_id: 'some_app_id',
                label: 'Option 1',
                location: 'option1',
                form: {
                    submit: {
                        path: 'some_url_1',
                    },
                },
            }, {
                app_id: 'some_app_id',
                channel_id: 'some_channel_id',
                location: '/in_post/option1',
                post_id: 'some_post_id',
                root_id: 'some_root_id',
                team_id: 'some_team_id',
            }, expect.anything());

            expect(props.actions.postEphemeralCallResponseForPost).toHaveBeenCalledWith(callResponse, 'Nice job!', post);
        });
    });

    test('should handle error call response', async () => {
        const errorResponse: AppCallResponse = {
            type: 'error',
            text: 'The error',
            app_metadata: {
                bot_user_id: 'botuserid',
                bot_username: 'botusername',
            },
        };

        const props = {
            ...baseProps,
            actions: {
                handleBindingClick: jest.fn().mockResolvedValue({
                    error: errorResponse,
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
            intl,
        };

        const wrapper = shallow<RawSelectBinding>(<RawSelectBinding {...props}/>);

        await wrapper.instance().handleSelected({
            text: 'Option 1',
            value: 'option1',
        });

        expect(props.actions.postEphemeralCallResponseForPost).toHaveBeenCalledWith(errorResponse, 'The error', post);
    });
});
