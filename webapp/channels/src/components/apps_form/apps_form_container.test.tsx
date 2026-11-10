// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';
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
            doAppSubmit: jest.fn().mockResolvedValue({}),
            doAppFetchForm: jest.fn(),
            doAppLookup: jest.fn(),
            postEphemeralCallResponseForContext: jest.fn(),
        },
        onExited: jest.fn(),
        intl,
    };

    test('should match snapshot', () => {
        const props = baseProps;

        const {baseElement} = renderWithContext(<RawAppsFormContainer {...props}/>);
        expect(baseElement).toMatchSnapshot();
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
                    doAppSubmit: jest.fn().mockResolvedValue(response),
                },
            };

            const ref = React.createRef<RawAppsFormContainer>();
            renderWithContext(
                <RawAppsFormContainer
                    {...props}
                    ref={ref}
                />,
            );
            const result = await ref.current!.submitForm({
                values: {
                    field1: 'value1',
                    field2: {label: 'label2', value: 'value2'},
                },
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
        });
    });

    describe('refreshForm', () => {
        const source = {path: '/form_source'};
        const refreshedForm = {title: 'Refreshed', fields: [], submit: {path: '/form_url'}};

        const renderContainer = (doAppFetchForm: jest.Mock) => {
            const ref = React.createRef<RawAppsFormContainer>();
            const view = renderWithContext(
                <RawAppsFormContainer
                    {...baseProps}
                    form={{...baseProps.form, source} as any}
                    actions={{...baseProps.actions, doAppFetchForm}}
                    ref={ref}
                />,
            );
            return {ref, view};
        };

        test('should fetch the form from its source without a selected field', async () => {
            const response = {data: {type: AppCallResponseTypes.FORM, form: refreshedForm}};
            const doAppFetchForm = jest.fn().mockResolvedValue(response);
            const {ref} = renderContainer(doAppFetchForm);

            const result = await ref.current!.refreshForm({field1: 'typed'});

            expect(doAppFetchForm).toHaveBeenCalledTimes(1);
            const request = doAppFetchForm.mock.calls[0][0];
            expect(request).toEqual(expect.objectContaining({
                path: '/form_source',
                context: appContext,
                values: {field1: 'typed'},
            }));
            expect(request.selected_field).toBeUndefined();
            expect(result).toEqual(response);
        });

        test('should ignore a superseded response', async () => {
            let resolveFirst!: (v: unknown) => void;
            const doAppFetchForm = jest.fn().
                mockReturnValueOnce(new Promise((res) => {
                    resolveFirst = res;
                })).
                mockResolvedValueOnce({data: {type: AppCallResponseTypes.FORM, form: refreshedForm}});
            const {ref} = renderContainer(doAppFetchForm);

            const first = ref.current!.refreshForm({});
            const second = ref.current!.refreshForm({});
            resolveFirst({data: {type: AppCallResponseTypes.FORM, form: {...refreshedForm, title: 'Stale'}}});

            expect(await first).toEqual({data: {type: AppCallResponseTypes.OK}});
            expect((await second).data?.type).toBe(AppCallResponseTypes.FORM);
        });

        test('should ignore a response that arrives after unmount', async () => {
            let resolveFetch!: (v: unknown) => void;
            const doAppFetchForm = jest.fn().mockReturnValue(new Promise((res) => {
                resolveFetch = res;
            }));
            const {ref, view} = renderContainer(doAppFetchForm);

            const pending = ref.current!.refreshForm({});
            view.unmount();
            resolveFetch({data: {type: AppCallResponseTypes.FORM, form: refreshedForm}});

            expect(await pending).toEqual({data: {type: AppCallResponseTypes.OK}});
        });

        test('should ignore a refresh response once a submit has returned a newer form', async () => {
            let resolveFetch!: (v: unknown) => void;
            const doAppFetchForm = jest.fn().mockReturnValue(new Promise((res) => {
                resolveFetch = res;
            }));
            const nextForm = {title: 'Step 2', fields: [], submit: {path: '/form_url'}};
            const doAppSubmit = jest.fn().mockResolvedValue({data: {type: AppCallResponseTypes.FORM, form: nextForm}});
            const onFormChange = jest.fn();
            const ref = React.createRef<RawAppsFormContainer>();
            renderWithContext(
                <RawAppsFormContainer
                    {...baseProps}
                    form={{...baseProps.form, source} as any}
                    onFormChange={onFormChange}
                    actions={{...baseProps.actions, doAppFetchForm, doAppSubmit}}
                    ref={ref}
                />,
            );

            const pending = ref.current!.refreshForm({});
            await ref.current!.submitForm({values: {}});
            resolveFetch({data: {type: AppCallResponseTypes.FORM, form: refreshedForm}});

            expect(await pending).toEqual({data: {type: AppCallResponseTypes.OK}});
            await waitFor(() => {
                expect(ref.current!.state.form).toEqual(nextForm);
            });

            // * Only the applied form is reported; the discarded refresh form is not
            expect(onFormChange).toHaveBeenCalledTimes(1);
            expect(onFormChange).toHaveBeenCalledWith(nextForm);
        });

        test('should report an applied refresh form through onFormChange', async () => {
            const onFormChange = jest.fn();
            const doAppFetchForm = jest.fn().mockResolvedValue({data: {type: AppCallResponseTypes.FORM, form: refreshedForm}});
            const ref = React.createRef<RawAppsFormContainer>();
            renderWithContext(
                <RawAppsFormContainer
                    {...baseProps}
                    form={{...baseProps.form, source} as any}
                    onFormChange={onFormChange}
                    actions={{...baseProps.actions, doAppFetchForm}}
                    ref={ref}
                />,
            );

            await ref.current!.refreshForm({});

            expect(onFormChange).toHaveBeenCalledWith(refreshedForm);
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
                    doAppLookup: jest.fn().mockResolvedValue(response),
                },
            };

            const form = props.form;

            const ref = React.createRef<RawAppsFormContainer>();
            renderWithContext(
                <RawAppsFormContainer
                    {...props}
                    ref={ref}
                />,
            );
            const result = await ref.current!.performLookupCall(
                form.fields[1],
                {
                    field1: 'value1',
                    field2: {label: 'label2', value: 'value2'},
                },
                'My search',
            );

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
        });
    });
});
