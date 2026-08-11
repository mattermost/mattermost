// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import configureStore from 'tests/test_store';

import BlocksDialogShell from './blocks_dialog_shell';

const mockDoBlockAction = jest.fn();
const mockOpenInteractiveDialog = jest.fn();
const mockExecuteDialogAction = jest.fn();

jest.mock('mattermost-redux/actions/posts', () => ({
    doBlockAction: (...args: unknown[]) => mockDoBlockAction(...args),
}));

jest.mock('plugins/interactive_dialog', () => ({
    openInteractiveDialog: (...args: unknown[]) => mockOpenInteractiveDialog(...args),
}));

jest.mock('actions/integration_actions', () => ({
    executeDialogAction: (...args: unknown[]) => mockExecuteDialogAction(...args),
}));

jest.mock('components/markdown', () => {
    return function MockMarkdown(props: {message?: string}) {
        return <span>{props.message}</span>;
    };
});

jest.mock('components/block_renderer', () => {
    const React = require('react');

    const {MmBlocksFormContext} = require('components/block_renderer/form');

    return {
        BlockRenderer: (props: any) => {
            const formCtx = React.useContext(MmBlocksFormContext);
            const errors = formCtx?.errors ?? {};
            return (
                <div data-testid='block-renderer'>
                    <button
                        type='button'
                        data-testid='seed-bools'
                        onClick={() => {
                            formCtx?.setDefaultValue('agree', true);
                            formCtx?.setDefaultValue('disagree', false);
                        }}
                    >
                        {'Seed'}
                    </button>
                    <button
                        type='button'
                        data-testid='seed-text-fields'
                        onClick={() => {
                            formCtx?.setDefaultValue('title', 'Hello');
                            formCtx?.setDefaultValue('email', 'you@example.com');
                        }}
                    >
                        {'Seed text'}
                    </button>
                    <button
                        type='button'
                        data-testid='submit-action'
                        onClick={() => props.onAction('dialog_submit', undefined, undefined, undefined, {name: 'Ada'})}
                    >
                        {'Submit'}
                    </button>
                    <button
                        type='button'
                        data-testid='native-action'
                        onClick={() => props.onAction('btn1', undefined, undefined, undefined, undefined)}
                    >
                        {'Native'}
                    </button>
                    <button
                        type='button'
                        data-testid='refresh-project-type'
                        onClick={() => props.onAction('project_type', undefined, undefined, undefined, {project_type: 'mobile'})}
                    >
                        {'Refresh'}
                    </button>
                    <button
                        type='button'
                        data-testid='legacy-action-button'
                        onClick={() => props.onAction('go', undefined, {
                            __dialog_action_button: '1',
                            __dialog_action_url: '/plugins/foo/action',
                        })}
                    >
                        {'Action'}
                    </button>
                    {Object.entries(errors).map(([name, message]) => (
                        <div
                            key={name}
                            data-testid={`${name}-error`}
                        >
                            {String(message)}
                        </div>
                    ))}
                </div>
            );
        },
    };
});

describe('BlocksDialogShell', () => {
    const store = configureStore({
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
            teams: {
                currentTeamId: 'team1',
            },
            channels: {
                currentChannelId: 'channel1',
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as any);

    beforeEach(() => {
        mockDoBlockAction.mockReset();
        mockOpenInteractiveDialog.mockReset();
        mockExecuteDialogAction.mockReset();
        mockDoBlockAction.mockReturnValue(() => Promise.resolve({data: {type: 'ok'}}));
        mockExecuteDialogAction.mockReturnValue(() => Promise.resolve({data: {}}));
    });

    test('legacy submit calls submitInteractiveDialog', async () => {
        const submitInteractiveDialog = jest.fn().mockResolvedValue({data: {}});
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Legacy'
                        url='https://example.com/dialog'
                        submitLabel='Save'
                        elements={[{
                            display_name: 'Name',
                            name: 'name',
                            type: 'text',
                            subtype: '',
                            default: '',
                            placeholder: '',
                            help_text: '',
                            optional: true,
                            min_length: 0,
                            max_length: 0,
                            data_source: '',
                            options: [],
                        }]}
                        actions={{
                            submitInteractiveDialog,
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(document.getElementById('appsModalSubmit')).toHaveTextContent('Save');
        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(submitInteractiveDialog).toHaveBeenCalledWith(expect.objectContaining({
                url: 'https://example.com/dialog',
                submission: {},
                cancelled: false,
            }));
        });
    });

    test('legacy submit preserves boolean field types', async () => {
        const submitInteractiveDialog = jest.fn().mockResolvedValue({data: {}});
        const boolElement = {
            display_name: 'Agree',
            name: 'agree',
            type: 'bool',
            subtype: '',
            default: '',
            placeholder: '',
            help_text: '',
            optional: false,
            min_length: 0,
            max_length: 0,
            data_source: '',
            options: [],
        };

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Legacy bools'
                        url='https://example.com/dialog'
                        submitLabel='Save'
                        elements={[
                            {...boolElement, optional: true},
                            {...boolElement, display_name: 'Disagree', name: 'disagree', optional: true},
                        ]}
                        actions={{
                            submitInteractiveDialog,
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('seed-bools'));
        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(submitInteractiveDialog).toHaveBeenCalledWith(expect.objectContaining({
                submission: {
                    agree: true,
                    disagree: false,
                },
                cancelled: false,
            }));
        });
    });

    test('legacy submit blocks on required field validation', async () => {
        const submitInteractiveDialog = jest.fn().mockResolvedValue({data: {}});
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Required field'
                        url='https://example.com/dialog'
                        submitLabel='Save'
                        elements={[{
                            display_name: 'Role',
                            name: 'role',
                            type: 'select',
                            subtype: '',
                            default: '',
                            placeholder: 'Pick a role',
                            help_text: '',
                            optional: false,
                            min_length: 0,
                            max_length: 0,
                            data_source: 'dynamic',
                            options: [],
                        }]}
                        actions={{
                            submitInteractiveDialog,
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(screen.getByTestId('role-error')).toHaveTextContent('This field is required.');
        });
        expect(submitInteractiveDialog).not.toHaveBeenCalled();
        expect(document.getElementById('appsModal')).toBeInTheDocument();
    });

    test('native submit blocks on required field validation', async () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Native required'
                        mmBlocks={[
                            {type: 'text_input', name: 'title', label: 'Title'},
                        ]}
                        mmBlocksActions='cookie'
                        blockSubmit={{action: 'dialog_submit', label: 'Save'}}
                        blockCancel={{action: 'dialog_cancel', label: 'Cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(screen.getByTestId('title-error')).toHaveTextContent('This field is required.');
        });
        expect(mockDoBlockAction).not.toHaveBeenCalled();
        expect(document.getElementById('appsModal')).toBeInTheDocument();
    });

    test('legacy action-button-only dialog omits footer submit', () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Actions only'
                        url='https://example.com/dialog'
                        elements={[{
                            display_name: 'Go',
                            name: 'go',
                            type: 'action_button',
                            subtype: '',
                            default: '',
                            placeholder: '',
                            help_text: '',
                            optional: false,
                            min_length: 0,
                            max_length: 0,
                            data_source: '',
                            options: [],
                            action_button: {url: '/plugins/foo/action'},
                        }]}
                        actions={{
                            submitInteractiveDialog: jest.fn(),
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(document.getElementById('appsModalSubmit')).toBeNull();
        expect(document.getElementById('appsModalCancel')).not.toBeNull();
    });

    test('native action calls doBlockAction with empty post_id', async () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        mmBlocks={[{type: 'button', text: 'Go', action_id: 'btn1'}]}
                        mmBlocksActions='cookie'
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('native-action'));

        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalledWith(expect.objectContaining({
                subtype: 'execute',
                context: 'dialog',
                post_id: '',
                action_id: 'btn1',
                cookie: 'cookie',
                integration_format: 'mm_block',
            }));
        });
    });

    test('native without submit/cancel does not render footer buttons', () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='No chrome'
                        mmBlocks={[{type: 'text', text: 'Hello'}]}
                        mmBlocksActions='cookie'
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(document.getElementById('appsModalSubmit')).toBeNull();
        expect(document.getElementById('appsModalCancel')).toBeNull();
    });

    test('native footer submit calls doBlockAction with form_values', async () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='With submit'
                        mmBlocks={[{type: 'text', text: 'Hello'}]}
                        mmBlocksActions='cookie'
                        blockSubmit={{action: 'dialog_submit'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalledWith(expect.objectContaining({
                subtype: 'execute',
                context: 'dialog',
                action_id: 'dialog_submit',
                cookie: 'cookie',
                form_values: {},
                integration_format: 'mm_block',
            }));
        });
    });

    test('native footer cancel calls doBlockAction without form_values', async () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='With cancel'
                        mmBlocks={[{type: 'text', text: 'Hello'}]}
                        mmBlocksActions='cookie'
                        blockCancel={{action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(document.getElementById('appsModalCancel')!);

        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalledWith(expect.objectContaining({
                subtype: 'execute',
                context: 'dialog',
                action_id: 'dialog_cancel',
                cookie: 'cookie',
                integration_format: 'mm_block',
            }));
            expect(mockDoBlockAction.mock.calls[0][0].form_values).toBeUndefined();
        });
    });

    test('native header close calls cancel action when defined', async () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Close X'
                        mmBlocks={[{type: 'text', text: 'Hello'}]}
                        mmBlocksActions='cookie'
                        blockCancel={{action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByText('Close'));

        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalledWith(expect.objectContaining({
                action_id: 'dialog_cancel',
            }));
        });
    });

    test('native field errors are applied to form and not bottom banner', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'ok',
                errors: {
                    title: 'Title looks wrong',
                    email: 'Email is invalid',
                },
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Errors'
                        mmBlocks={[
                            {type: 'text_input', name: 'title', label: 'Title'},
                            {type: 'text_input', name: 'email', label: 'Email'},
                        ]}
                        mmBlocksActions='cookie'
                        blockSubmit={{action: 'dialog_submit'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('seed-text-fields'));
        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(screen.getByTestId('title-error')).toHaveTextContent('Title looks wrong');
            expect(screen.getByTestId('email-error')).toHaveTextContent('Email is invalid');
        });
        expect(screen.queryByTestId('mm-blocks-dialog-error')).not.toBeInTheDocument();
    });

    test('native top-level error is shown with field errors', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'ok',
                error: 'Please fix the highlighted fields',
                errors: {
                    title: 'Title looks wrong',
                },
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Errors'
                        mmBlocks={[
                            {type: 'text_input', name: 'title', label: 'Title'},
                        ]}
                        mmBlocksActions='cookie'
                        blockSubmit={{action: 'dialog_submit'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('seed-text-fields'));
        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(screen.getByTestId('title-error')).toHaveTextContent('Title looks wrong');
            expect(screen.getByText('Please fix the highlighted fields')).toBeInTheDocument();
        });
    });

    test('legacy action-button failure surfaces error', async () => {
        mockExecuteDialogAction.mockReturnValueOnce(() => Promise.resolve({
            error: {message: 'network failed'},
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Actions'
                        url='https://example.com/dialog'
                        elements={[{
                            display_name: 'Go',
                            name: 'go',
                            type: 'action_button',
                            subtype: '',
                            default: '',
                            placeholder: '',
                            help_text: '',
                            optional: false,
                            min_length: 0,
                            max_length: 0,
                            data_source: '',
                            options: [],
                            action_button: {url: '/plugins/foo/action'},
                        }]}
                        actions={{
                            submitInteractiveDialog: jest.fn(),
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('legacy-action-button'));

        await waitFor(() => {
            expect(mockExecuteDialogAction).toHaveBeenCalledWith(
                '/plugins/foo/action',
                expect.not.objectContaining({
                    __dialog_action_button: expect.anything(),
                    __dialog_action_url: expect.anything(),
                }),
            );
            expect(screen.getByText('Action failed')).toBeInTheDocument();
        });
    });

    test('legacy submit applies integration field errors and keeps dialog open', async () => {
        const submitInteractiveDialog = jest.fn().mockResolvedValue({
            data: {
                errors: {
                    realname: 'Name was rejected by the integration',
                    someemail: 'Email was rejected by the integration',
                },
            },
        });

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Server errors'
                        url='https://example.com/dialog_submit'
                        callbackId='server_field_errors_callback'
                        elements={[
                            {
                                display_name: 'Name',
                                name: 'realname',
                                type: 'text',
                                optional: true,
                                subtype: '',
                                default: '',
                                placeholder: '',
                                help_text: '',
                                min_length: 0,
                                max_length: 0,
                                data_source: '',
                                options: [],
                            },
                            {
                                display_name: 'Email',
                                name: 'someemail',
                                type: 'text',
                                subtype: 'email',
                                optional: true,
                                default: '',
                                placeholder: '',
                                help_text: '',
                                min_length: 0,
                                max_length: 0,
                                data_source: '',
                                options: [],
                            },
                        ]}
                        actions={{
                            submitInteractiveDialog,
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(screen.getByTestId('realname-error')).toHaveTextContent('Name was rejected by the integration');
            expect(screen.getByTestId('someemail-error')).toHaveTextContent('Email was rejected by the integration');
        });
        expect(document.getElementById('appsModal')).toBeInTheDocument();
        expect(document.getElementById('appsModalSubmit')).toBeInTheDocument();
    });

    test('native keep_dialog_open leaves dialog open', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'ok',
                keep_dialog_open: true,
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Stay open'
                        mmBlocks={[{type: 'button', text: 'Go', action_id: 'btn1'}]}
                        mmBlocksActions='open-cookie'
                        blockCancel={{action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('native-action'));
        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenCalled();
        });

        expect(screen.getByText('Stay open')).toBeInTheDocument();
        expect(document.getElementById('appsModal')).toBeInTheDocument();
        expect(mockOpenInteractiveDialog).not.toHaveBeenCalled();
    });

    test('native type refresh replaces title, chrome, and cookie', async () => {
        mockDoBlockAction.
            mockReturnValueOnce(() => Promise.resolve({
                data: {
                    type: 'refresh',
                    block_dialog: {
                        title: 'Step 2',
                        submit: {label: 'Finish', action: 'dialog_submit'},
                        cancel: {action: 'dialog_cancel'},
                        blocks: [{type: 'text', text: 'Step 2 body'}],
                        actions: 'step2-cookie',
                    },
                },
            })).
            mockReturnValue(() => Promise.resolve({data: {type: 'ok'}}));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Step 1'
                        mmBlocks={[{type: 'button', text: 'Go', action_id: 'btn1'}]}
                        mmBlocksActions='open-cookie'
                        blockSubmit={{action: 'dialog_submit'}}
                        blockCancel={{action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(screen.getByText('Step 1')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('native-action'));
        await waitFor(() => {
            expect(screen.getByText('Step 2')).toBeInTheDocument();
        });
        expect(document.getElementById('appsModalSubmit')).toHaveTextContent('Finish');
        expect(mockOpenInteractiveDialog).not.toHaveBeenCalled();

        fireEvent.click(document.getElementById('appsModalCancel')!);
        await waitFor(() => {
            expect(mockDoBlockAction).toHaveBeenLastCalledWith(expect.objectContaining({
                action_id: 'dialog_cancel',
                cookie: 'step2-cookie',
            }));
        });
    });

    test('native type refresh without cancel clears cancel button', async () => {
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'refresh',
                block_dialog: {
                    title: 'Step 2',
                    submit: {action: 'dialog_submit'},
                    blocks: [{type: 'text', text: 'No cancel'}],
                    actions: 'step2-cookie',
                },
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Step 1'
                        mmBlocks={[{type: 'button', text: 'Go', action_id: 'btn1'}]}
                        mmBlocksActions='open-cookie'
                        blockSubmit={{action: 'dialog_submit'}}
                        blockCancel={{action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(document.getElementById('appsModalCancel')).not.toBeNull();

        fireEvent.click(screen.getByTestId('native-action'));
        await waitFor(() => {
            expect(screen.getByText('Step 2')).toBeInTheDocument();
        });
        expect(document.getElementById('appsModalCancel')).toBeNull();
        expect(document.getElementById('appsModalSubmit')).not.toBeNull();
        expect(mockOpenInteractiveDialog).not.toHaveBeenCalled();
    });

    test('native type dialog stacks via openInteractiveDialog', async () => {
        const blockDialog = {
            title: 'Child dialog',
            submit: {action: 'child_submit'},
            blocks: [{type: 'text', text: 'Stacked'}],
            actions: 'child-cookie',
        };
        mockDoBlockAction.mockReturnValueOnce(() => Promise.resolve({
            data: {
                type: 'dialog',
                trigger_id: 'trig-child',
                block_dialog: blockDialog,
            },
        }));

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Parent'
                        mmBlocks={[{type: 'button', text: 'Go', action_id: 'btn1'}]}
                        mmBlocksActions='open-cookie'
                        blockCancel={{action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('native-action'));
        await waitFor(() => {
            expect(mockOpenInteractiveDialog).toHaveBeenCalledWith({
                trigger_id: 'trig-child',
                block_dialog: blockDialog,
            });
        });
        expect(screen.getByText('Parent')).toBeInTheDocument();
        expect(document.getElementById('appsModal')).toBeInTheDocument();
    });

    test('legacy form response updates modal title for multistep', async () => {
        const submitInteractiveDialog = jest.fn().mockResolvedValue({
            data: {
                type: 'form',
                form: {
                    title: 'Step 2 - Work Info',
                    submit_label: 'Next Step',
                    state: 'step2',
                    elements: [{
                        display_name: 'Department',
                        name: 'department',
                        type: 'text',
                        subtype: '',
                        default: '',
                        placeholder: '',
                        help_text: '',
                        optional: false,
                        min_length: 0,
                        max_length: 0,
                        data_source: '',
                    }],
                },
            },
        });

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Step 1 - Personal Info'
                        url='https://example.com/dialog'
                        submitLabel='Next Step'
                        state='step1'
                        elements={[{
                            display_name: 'First Name',
                            name: 'first_name',
                            type: 'text',
                            subtype: '',
                            default: '',
                            placeholder: '',
                            help_text: '',
                            optional: true,
                            min_length: 0,
                            max_length: 0,
                            data_source: '',
                            options: [],
                        }]}
                        actions={{
                            submitInteractiveDialog,
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(screen.getByText('Step 1 - Personal Info')).toBeInTheDocument();

        fireEvent.click(document.getElementById('appsModalSubmit')!);

        await waitFor(() => {
            expect(screen.getByText('Step 2 - Work Info')).toBeInTheDocument();
        });
        expect(screen.queryByText('Step 1 - Personal Info')).not.toBeInTheDocument();
    });

    test('legacy field refresh preserves source_url when response omits it', async () => {
        const submitInteractiveDialog = jest.fn().
            mockResolvedValueOnce({
                data: {
                    type: 'form',
                    form: {
                        title: 'Field Refresh Demo',
                        elements: [{
                            display_name: 'Project Type',
                            name: 'project_type',
                            type: 'select',
                            refresh: true,
                            default: 'web',
                            options: [
                                {text: 'Web Application', value: 'web'},
                                {text: 'Mobile App', value: 'mobile'},
                            ],
                        }, {
                            display_name: 'Framework',
                            name: 'framework',
                            type: 'select',
                            options: [{text: 'React', value: 'react'}],
                        }],
                    },
                },
            }).
            mockResolvedValueOnce({
                data: {
                    type: 'form',
                    form: {
                        title: 'Field Refresh Demo',
                        elements: [{
                            display_name: 'Project Type',
                            name: 'project_type',
                            type: 'select',
                            refresh: true,
                            default: 'mobile',
                            options: [
                                {text: 'Web Application', value: 'web'},
                                {text: 'Mobile App', value: 'mobile'},
                            ],
                        }, {
                            display_name: 'Platform',
                            name: 'platform',
                            type: 'select',
                            options: [{text: 'iOS', value: 'ios'}],
                        }],
                    },
                },
            });

        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='legacy'
                        title='Field Refresh Demo'
                        url='https://example.com/dialog'
                        sourceUrl='https://example.com/field_refresh_source'
                        submitLabel='Submit'
                        elements={[{
                            display_name: 'Project Type',
                            name: 'project_type',
                            type: 'select',
                            subtype: '',
                            default: '',
                            placeholder: '',
                            help_text: '',
                            optional: false,
                            min_length: 0,
                            max_length: 0,
                            data_source: '',
                            refresh: true,
                            options: [
                                {text: 'Web Application', value: 'web'},
                                {text: 'Mobile App', value: 'mobile'},
                            ],
                        }]}
                        actions={{
                            submitInteractiveDialog,
                            lookupInteractiveDialog: jest.fn(),
                        }}
                    />
                </IntlProvider>
            </Provider>,
        );

        fireEvent.click(screen.getByTestId('refresh-project-type'));
        await waitFor(() => {
            expect(submitInteractiveDialog).toHaveBeenCalledTimes(1);
        });
        expect(submitInteractiveDialog).toHaveBeenLastCalledWith(expect.objectContaining({
            url: 'https://example.com/field_refresh_source',
            type: 'refresh',
        }));

        fireEvent.click(screen.getByTestId('refresh-project-type'));
        await waitFor(() => {
            expect(submitInteractiveDialog).toHaveBeenCalledTimes(2);
        });
        expect(submitInteractiveDialog).toHaveBeenLastCalledWith(expect.objectContaining({
            url: 'https://example.com/field_refresh_source',
            type: 'refresh',
        }));
    });

    test('native uses custom submit and cancel labels', () => {
        render(
            <Provider store={store}>
                <IntlProvider locale='en'>
                    <BlocksDialogShell
                        mode='native'
                        title='Custom labels'
                        mmBlocks={[{type: 'text', text: 'Hello'}]}
                        mmBlocksActions='cookie'
                        blockSubmit={{label: 'Save', action: 'dialog_submit'}}
                        blockCancel={{label: 'Discard', action: 'dialog_cancel'}}
                    />
                </IntlProvider>
            </Provider>,
        );

        expect(document.getElementById('appsModalSubmit')).toHaveTextContent('Save');
        expect(document.getElementById('appsModalCancel')).toHaveTextContent('Discard');
    });

    test('stacked dialog backdrop covers the parent dialog', () => {
        const parentBackdrop = document.createElement('div');
        parentBackdrop.className = 'modal-backdrop';
        parentBackdrop.style.zIndex = '1040';
        parentBackdrop.style.opacity = '0.5';
        document.body.appendChild(parentBackdrop);

        const parentModal = document.createElement('div');
        parentModal.className = 'modal';
        parentModal.style.zIndex = '1050';
        document.body.appendChild(parentModal);

        try {
            render(
                <Provider store={store}>
                    <IntlProvider locale='en'>
                        <BlocksDialogShell
                            mode='native'
                            title='Child dialog'
                            mmBlocks={[{type: 'text', text: 'Hello'}]}
                            mmBlocksActions='cookie'
                            blockSubmit={{label: 'Save', action: 'dialog_submit'}}
                        />
                    </IntlProvider>
                </Provider>,
            );

            const childModal = document.getElementById('appsModal');
            expect(childModal).toBeInTheDocument();

            const childModalZ = parseInt(childModal!.style.zIndex || '0', 10);
            expect(childModalZ).toBeGreaterThan(1050);

            const backdrops = document.querySelectorAll<HTMLElement>('.modal-backdrop');
            expect(backdrops.length).toBeGreaterThanOrEqual(2);

            const topBackdrop = backdrops[backdrops.length - 1];
            const topBackdropZ = parseInt(topBackdrop.style.zIndex || '0', 10);
            expect(topBackdropZ).toBeGreaterThan(1050);
            expect(topBackdropZ).toBeLessThan(childModalZ);
            expect(parentBackdrop.style.opacity).toBe('0');
        } finally {
            parentBackdrop.remove();
            parentModal.remove();
        }
    });
});
