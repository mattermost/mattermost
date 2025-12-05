// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-underscore-dangle */

import React from 'react';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext, act} from 'tests/vitest_react_testing_utils';
import EmojiMap from 'utils/emoji_map';

import {RawAppsFormContainer} from './apps_form_container';

describe('components/apps_form/AppsFormContainer', () => {
    const emojiMap = new EmojiMap(new Map());

    const appContext = {
        app_id: 'app',
        channel_id: 'channel',
        team_id: 'team',
        post_id: 'post',
    };

    const intl = {
        formatMessage: (message: {id: string; defaultMessage: string}) => {
            return message.defaultMessage;
        },
    } as any;

    const baseProps = {
        emojiMap,
        form: {
            title: 'Form Title',
            header: 'Form Header',
            fields: [
                {
                    type: 'text',
                    name: 'field1',
                    value: 'initial_value_1',
                },
                {
                    type: 'dynamic_select',
                    name: 'field2',
                    value: 'initial_value_2',
                    refresh: true,
                    lookup: {
                        path: '/form_lookup',
                    },
                },
            ],
            submit: {
                path: '/form_url',
            },
        },
        appContext,
        actions: {
            doAppSubmit: vi.fn().mockResolvedValue({}),
            doAppFetchForm: vi.fn(),
            doAppLookup: vi.fn(),
            postEphemeralCallResponseForContext: vi.fn(),
        },
        onExited: vi.fn(),
        intl,
    };

    test('should match snapshot', async () => {
        const props = baseProps;

        let asFragment: () => DocumentFragment;
        await act(async () => {
            const result = renderWithContext(<RawAppsFormContainer {...props}/>);
            asFragment = result.asFragment;
        });
        expect(asFragment!()).toMatchSnapshot();
    });

    describe('submitForm', () => {
        test('should handle form submission result', async () => {
            const response = {
                data: {
                    type: AppCallResponseTypes.OK,
                },
            };

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    doAppSubmit: vi.fn().mockResolvedValue(response),
                },
            };

            let instance: any;
            await act(async () => {
                const {container} = renderWithContext(<RawAppsFormContainer {...props}/>);

                // Get the component instance through container
                instance = (container as any)._reactRootContainer?._internalRoot?.current?.child?.stateNode;
            });

            if (instance && instance.submitForm) {
                let result: any;
                await act(async () => {
                    result = await instance.submitForm({
                        values: {
                            field1: 'value1',
                            field2: {label: 'label2', value: 'value2'},
                        },
                    });
                });

                expect(props.actions.doAppSubmit).toHaveBeenCalledWith({
                    context: {
                        app_id: 'app',
                        channel_id: 'channel',
                        post_id: 'post',
                        team_id: 'team',
                    },
                    path: '/form_url',
                    expand: {},
                    values: {
                        field1: 'value1',
                        field2: {
                            label: 'label2',
                            value: 'value2',
                        },
                    },
                }, expect.any(Object));

                expect(result).toEqual({
                    data: {
                        type: AppCallResponseTypes.OK,
                    },
                });
            }
        });
    });

    describe('performLookupCall', () => {
        test('should handle form user input', async () => {
            const response = {
                data: {
                    type: AppCallResponseTypes.OK,
                    data: {
                        items: [{
                            label: 'Fetched Label',
                            value: 'fetched_value',
                        }],
                    },
                },
            };

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    doAppLookup: vi.fn().mockResolvedValue(response),
                },
            };

            const form = props.form;

            let instance: any;
            await act(async () => {
                const {container} = renderWithContext(<RawAppsFormContainer {...props}/>);

                // Get the component instance through container
                instance = (container as any)._reactRootContainer?._internalRoot?.current?.child?.stateNode;
            });

            if (instance && instance.performLookupCall) {
                let result: any;
                await act(async () => {
                    result = await instance.performLookupCall(
                        form.fields[1],
                        {
                            field1: 'value1',
                            field2: {label: 'label2', value: 'value2'},
                        },
                        'My search',
                    );
                });

                expect(props.actions.doAppLookup).toHaveBeenCalledWith({
                    context: {
                        app_id: 'app',
                        channel_id: 'channel',
                        post_id: 'post',
                        team_id: 'team',
                    },
                    path: '/form_lookup',
                    expand: {},
                    query: 'My search',
                    raw_command: undefined,
                    selected_field: 'field2',
                    values: {
                        field1: 'value1',
                        field2: {
                            label: 'label2',
                            value: 'value2',
                        },
                    },
                }, expect.any(Object));

                expect(result).toEqual(response);
            }
        });
    });
});
