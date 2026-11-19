// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React from 'react';

import type {PostType} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';
import type {PropertyField} from '@mattermost/types/properties';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import Permissions from 'mattermost-redux/constants/permissions';

import {onSubmit} from 'actions/views/create_comment';
import type {OnSubmitOptions} from 'actions/views/create_comment';
import {quoteTextInDraft, removeDraft, updateDraft} from 'actions/views/drafts';

import type {FileUpload} from 'components/file_upload/file_upload';
import type Textbox from 'components/textbox/textbox';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, userEvent, screen, act, createEvent, fireEvent, waitFor} from 'tests/react_testing_utils';
import Constants, {Locations, PostTypes, Preferences, StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {PostDraft} from 'types/store/draft';

import AdvancedTextEditor from './advanced_text_editor';
import type {Props} from './advanced_text_editor';

jest.mock('actions/views/drafts', () => ({
    ...jest.requireActual('actions/views/drafts'),
    updateDraft: jest.fn((...args) => ({type: 'MOCK_UPDATE_DRAFT', args})),
    removeDraft: jest.fn((...args) => ({type: 'MOCK_REMOVE_DRAFT', args})),
}));

jest.mock('actions/views/create_comment', () => ({
    ...jest.requireActual('actions/views/create_comment'),
    onSubmit: jest.fn(() => () => Promise.resolve({data: true})),
}));

jest.mock('utils/exec_commands.ts', () => ({
    focusAndInsertText: (element: HTMLElement, text: string) => {
        element.focus();

        if ('value' in element && 'selectionStart' in element) {
            const textbox = element as HTMLTextAreaElement;
            const textBefore = textbox.value.substring(0, textbox.selectionStart);
            const textAfter = textbox.value.substring(textbox.selectionEnd);
            textbox.value = textBefore + text + textAfter;

            textbox.selectionStart = textBefore.length + text.length;
            textbox.selectionEnd = textbox.selectionStart;
        }
    },
    replaceTextboxValue: () => false,
}));

const mockedRemoveDraft = jest.mocked(removeDraft);
const mockedUpdateDraft = jest.mocked(updateDraft);
const mockedOnSubmit = jest.mocked(onSubmit);

const currentUserId = 'current_user_id';
const channelId = 'current_channel_id';
const otherChannelId = 'other_channel_id';

const initialState = {
    entities: {
        general: {
            config: {
                EnableConfirmNotificationsToChannel: 'false',
                EnableCustomGroups: 'false',
                PostPriority: 'false',
                ExperimentalTimezone: 'false',
                EnableCustomEmoji: 'false',
                AllowSyncedDrafts: 'false',
            },
            license: {
                IsLicensed: 'false',
                LDAPGroups: 'false',
            },
        },
        channels: {
            channels: {
                current_channel_id: TestHelper.getChannelMock({
                    id: 'current_channel_id',
                    team_id: 'current_team_id',
                    display_name: 'Test Channel',
                }),
                other_channel_id: TestHelper.getChannelMock({
                    id: 'other_channel_id',
                    team_id: 'current_team_id',
                    display_name: 'Other Channel',
                }),
            },
            stats: {
                current_channel_id: {
                    member_count: 1,
                },
                other_channel_id: {
                    member_count: 1,
                },
            },
            roles: {
                current_channel_id: new Set(['channel_roles']),
                other_channel_id: new Set(['channel_roles']),
            },
        },
        roles: {
            roles: {
                user_roles: {permissions: [Permissions.CREATE_POST]},
            },
        },
        teams: {
            currentTeamId: 'current_team_id',
            teams: {
                current_team_id: TestHelper.getTeamMock({id: 'current_team_id'}),
            },
            myMembers: {
                current_team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: TestHelper.getUserMock({
                    id: 'current_user_id',
                    roles: 'user_roles',
                    timezone: {
                        useAutomaticTimezone: 'true',
                        automaticTimezone: 'America/New_York',
                        manualTimezone: '',
                    }}),
            },
            statuses: {
                current_user_id: 'online',
            },
        },
    },
    websocket: {
        connectionId: 'connection_id',
    },
};

const emptyDraft: PostDraft = {
    message: '',
    uploadsInProgress: [],
    fileInfos: [],
    channelId,
    rootId: '',
    createAt: 0,
    updateAt: 0,
};

const baseProps = {
    location: 'CENTER',
    message: '',
    showEmojiPicker: false,
    uploadsProgressPercent: {},
    channelId,
    rootId: '',
    errorClass: null,
    serverError: null,
    postError: null,
    isFormattingBarHidden: false,
    draft: emptyDraft,
    badConnection: false,
    handleSubmit: jest.fn(),
    removePreview: jest.fn(),
    showSendTutorialTip: false,
    setShowPreview: jest.fn(),
    shouldShowPreview: false,
    maxPostSize: 100,
    canPost: true,
    applyMarkdown: jest.fn(),
    useChannelMentions: false,
    currentChannelTeammateUsername: '',
    currentUserId,
    canUploadFiles: true,
    enableEmojiPicker: true,
    enableGifPicker: true,
    handleBlur: jest.fn(),
    handlePostError: jest.fn(),
    emitTypingEvent: jest.fn(),
    handleMouseUpKeyUp: jest.fn(),
    postMsgKeyPress: jest.fn(),
    handleChange: jest.fn(),
    toggleEmojiPicker: jest.fn(),
    handleGifClick: jest.fn(),
    handleEmojiClick: jest.fn(),
    hideEmojiPicker: jest.fn(),
    toggleAdvanceTextEditor: jest.fn(),
    handleUploadProgress: jest.fn(),
    handleUploadError: jest.fn(),
    handleFileUploadComplete: jest.fn(),
    handleUploadStart: jest.fn(),
    handleFileUploadChange: jest.fn(),
    getFileUploadTarget: jest.fn(),
    fileUploadRef: React.createRef<FileUpload>(),
    prefillMessage: jest.fn(),
    textboxRef: React.createRef<Textbox>(),
    isThreadView: false,
    ctrlSend: true,
    codeBlockOnCtrlEnter: true,
    onMessageChange: jest.fn(),
    onEditLatestPost: jest.fn(),
    loadPrevMessage: jest.fn(),
    loadNextMessage: jest.fn(),
    replyToLastPost: jest.fn(),
};

describe('components/avanced_text_editor/advanced_text_editor', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    describe('keyDown behavior', () => {
        it('ESC should blur the input', async () => {
            jest.useFakeTimers();
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                mergeObjects(initialState, {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.CREATE_POST]},
                            },
                        },
                    },
                }),
            );
            const textbox = screen.getByTestId('post_textbox');

            await userEvent.type(textbox, 'something{escape}', {advanceTimers: jest.advanceTimersByTime});

            expect(textbox).not.toHaveFocus();
            expect(mockedUpdateDraft).not.toHaveBeenCalled();
        });

        it('ESC should blur the input and reset draft when in editing mode', async () => {
            jest.useFakeTimers();
            const props = {
                ...baseProps,
                isInEditMode: true,
            };
            renderWithContext(
                <AdvancedTextEditor
                    {...props}
                />,
                mergeObjects(initialState, {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.CREATE_POST]},
                            },
                        },
                    },
                }),
            );
            const textbox = screen.getByTestId('edit_textbox');
            await userEvent.type(textbox, 'something{escape}', {advanceTimers: jest.advanceTimersByTime});
            expect(textbox).not.toHaveFocus();

            // save is called with a short delayed after pressing escape key
            jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT + 50);
            expect(mockedRemoveDraft).toHaveBeenCalled();
            expect(mockedUpdateDraft).not.toHaveBeenCalled();
        });
    });

    it('should set the textbox value to an existing draft on mount and when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.DRAFT + channelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: 'original draft',
                            }),
                        },
                        [StoragePrefixes.DRAFT + otherChannelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: 'a different draft',
                            }),
                        },
                    },
                },
            }),
        );

        expect(screen.getByPlaceholderText('Write to Test Channel')).toHaveValue('original draft');

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        expect(screen.getByPlaceholderText('Write to Other Channel')).toHaveValue('a different draft');
    });

    it('should mount and send when rootId is omitted, as plugins may do via window.Components', async () => {
        // Plugins reach AdvancedTextEditor through the untyped window.Components bridge, so
        // TypeScript cannot enforce the required rootId prop. An undefined rootId used to
        // mismatch the draft's '' on every render pass, throwing React error #301 on mount
        // and, once mounted, leaving the post-submit draft reset silently dropped.
        const message = 'a message sent from a composer without a rootId';

        renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
                rootId={undefined as unknown as string}
            />,
            mergeObjects(initialState, {
                entities: {
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.CREATE_POST]},
                        },
                    },
                },
            }),
        );

        const textbox = screen.getByTestId('post_textbox');

        // SuggestionBox listens to onInput, not onChange.
        fireEvent.input(textbox, {target: {value: message}});
        expect(textbox).toHaveValue(message);

        await act(async () => {
            fireEvent.click(screen.getByTestId('SendMessageButton'));
        });

        expect(mockedOnSubmit).toHaveBeenCalledWith(
            channelId,
            '',
            expect.objectContaining({message, channelId, rootId: ''}),
            expect.anything(),
            undefined,
        );
        expect(textbox).toHaveValue('');
    });

    it('should submit a destination-owned draft while the textbox still holds the previous channel value', async () => {
        const sourceDraft = 'stale draft from the source channel';
        const destinationMessage = 'new message composed for the destination channel';
        const sourceFileInfo = TestHelper.getFileInfoMock({id: 'source-file-id', name: 'source-file.txt'});
        const destinationFileInfo = TestHelper.getFileInfoMock({id: 'destination-file-id', name: 'destination-file.txt'});
        const sourceMetadata = {priority: {priority: PostPriority.URGENT}, files: [sourceFileInfo]};
        const destinationMetadata = {priority: {priority: PostPriority.IMPORTANT}, files: [destinationFileInfo]};
        const sourceProps = {sourceOnly: 'source-prop'};
        const destinationProps = {destinationOnly: 'destination-prop'};
        const typeOnSwitchRef = {current: false};

        function Harness({editorChannelId}: {editorChannelId: string}) {
            const [sendDestinationMessage, setSendDestinationMessage] = React.useState(false);

            // Cmd+K can focus the composer after channelId updates but before the
            // composer's effect replaces the local draft. Layout effects run before
            // that effect, so typing here lands in the window the user reported.
            React.useLayoutEffect(() => {
                if (!typeOnSwitchRef.current) {
                    return;
                }
                typeOnSwitchRef.current = false;

                const textbox = screen.getByPlaceholderText('Write to Other Channel');
                expect(textbox).toHaveValue(sourceDraft);

                // SuggestionBox listens to onInput, not onChange. Dispatched directly instead of
                // with fireEvent because fireEvent opens a nested act(...) scope, which React
                // rejects while it's already flushing this commit.
                textbox.dispatchEvent(createEvent.input(textbox, {target: {value: destinationMessage}}));
                setSendDestinationMessage(true);
            }, [editorChannelId]);

            // The typed message is applied on the next render, still before the
            // draft-swap effect, so sending from this layout effect submits while
            // draft.channelId is still the source channel.
            React.useLayoutEffect(() => {
                if (!sendDestinationMessage) {
                    return;
                }

                screen.getByTestId('SendMessageButton').click();
            }, [sendDestinationMessage]);

            return (
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={editorChannelId}
                />
            );
        }

        const {rerender} = renderWithContext(
            <Harness editorChannelId={channelId}/>,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.DRAFT + channelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: sourceDraft,
                                channelId,
                                metadata: sourceMetadata,
                                type: PostTypes.BURN_ON_READ as PostType,
                                props: sourceProps,
                            }),
                        },
                        [StoragePrefixes.DRAFT + otherChannelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: '',
                                channelId: otherChannelId,
                                metadata: destinationMetadata,
                                type: PostTypes.ME as PostType,
                                props: destinationProps,
                            }),
                        },
                    },
                },
            }),
        );

        expect(screen.getByPlaceholderText('Write to Test Channel')).toHaveValue(sourceDraft);

        typeOnSwitchRef.current = true;
        rerender(<Harness editorChannelId={otherChannelId}/>);

        await act(async () => {
            await Promise.resolve();
        });

        expect(mockedOnSubmit).toHaveBeenCalledWith(
            otherChannelId,
            '',
            expect.objectContaining({
                message: destinationMessage,
                channelId: otherChannelId,
                rootId: '',
                fileInfos: [destinationFileInfo],
                metadata: destinationMetadata,
                type: PostTypes.ME,
                props: destinationProps,
            }),
            expect.anything(),
            undefined,
        );
        expect(mockedOnSubmit).toHaveBeenCalledWith(
            otherChannelId,
            '',
            expect.not.objectContaining({
                fileInfos: [sourceFileInfo],
                metadata: sourceMetadata,
                type: PostTypes.BURN_ON_READ,
                props: sourceProps,
            }),
            expect.anything(),
            undefined,
        );
    });

    it('should persist text typed during a channel switch only under the destination draft', async () => {
        jest.useFakeTimers();

        const sourceDraft = 'stale draft from the source channel';
        const destinationMessage = 'new message composed for the destination channel';
        const sourceFileInfo = TestHelper.getFileInfoMock({id: 'source-file-id', name: 'source-file.txt'});
        const destinationFileInfo = TestHelper.getFileInfoMock({id: 'destination-file-id', name: 'destination-file.txt'});
        const sourceMetadata = {priority: {priority: PostPriority.URGENT}, files: [sourceFileInfo]};
        const destinationMetadata = {priority: {priority: PostPriority.IMPORTANT}, files: [destinationFileInfo]};
        const sourceProps = {sourceOnly: 'source-prop'};
        const destinationProps = {destinationOnly: 'destination-prop'};
        const typeOnSwitchRef = {current: false};

        function Harness({editorChannelId}: {editorChannelId: string}) {
            React.useLayoutEffect(() => {
                if (!typeOnSwitchRef.current) {
                    return;
                }
                typeOnSwitchRef.current = false;

                const textbox = screen.getByPlaceholderText('Write to Other Channel');
                expect(textbox).toHaveValue(sourceDraft);

                // Dispatched directly instead of with fireEvent because fireEvent opens a nested
                // act(...) scope, which React rejects while it's already flushing this commit.
                textbox.dispatchEvent(createEvent.input(textbox, {target: {value: destinationMessage}}));
            }, [editorChannelId]);

            return (
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={editorChannelId}
                />
            );
        }

        const {rerender} = renderWithContext(
            <Harness editorChannelId={channelId}/>,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.DRAFT + channelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: sourceDraft,
                                channelId,
                                metadata: sourceMetadata,
                                type: PostTypes.BURN_ON_READ as PostType,
                                props: sourceProps,
                            }),
                        },
                        [StoragePrefixes.DRAFT + otherChannelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: '',
                                channelId: otherChannelId,
                                metadata: destinationMetadata,
                                type: PostTypes.ME as PostType,
                                props: destinationProps,
                            }),
                        },
                    },
                },
            }),
        );

        mockedUpdateDraft.mockClear();
        typeOnSwitchRef.current = true;
        rerender(<Harness editorChannelId={otherChannelId}/>);

        await act(async () => {
            await Promise.resolve();
        });

        act(() => {
            jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT + 50);
        });

        expect(mockedUpdateDraft).toHaveBeenCalledWith(
            StoragePrefixes.DRAFT + otherChannelId,
            expect.objectContaining({
                message: destinationMessage,
                channelId: otherChannelId,
                rootId: '',
                fileInfos: [destinationFileInfo],
                metadata: destinationMetadata,
                type: PostTypes.ME,
                props: destinationProps,
            }),
            '',
        );
        expect(mockedUpdateDraft).not.toHaveBeenCalledWith(
            StoragePrefixes.DRAFT + channelId,
            expect.objectContaining({message: destinationMessage}),
            expect.anything(),
        );
        expect(mockedUpdateDraft).not.toHaveBeenCalledWith(
            StoragePrefixes.DRAFT + otherChannelId,
            expect.objectContaining({
                fileInfos: [sourceFileInfo],
                metadata: sourceMetadata,
                type: PostTypes.BURN_ON_READ,
                props: sourceProps,
            }),
            expect.anything(),
        );
    });

    describe('with the rich text editor', () => {
        // jsdom doesn't lay out ranges, which the editor measures to scroll on focus.
        beforeAll(() => {
            Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
            Range.prototype.getBoundingClientRect = () => ({top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0}) as DOMRect;
        });

        afterAll(() => {
            delete (Range.prototype as Partial<Range>).getClientRects;
            delete (Range.prototype as Partial<Range>).getBoundingClientRect;
        });

        const renderRichTextEditor = () => {
            const result = renderWithContext(
                <AdvancedTextEditor {...baseProps}/>,
                mergeObjects(initialState, {
                    entities: {
                        general: {config: {FeatureFlagWysiwygEditor: 'true'}},
                        preferences: {
                            myPreferences: {
                                [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.WYSIWYG_EDITOR}`]: {
                                    category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                                    name: Preferences.WYSIWYG_EDITOR,
                                    user_id: currentUserId,
                                    value: 'true',
                                },
                            },
                        },
                    },
                }),
            );
            const typeInEditor = (text: string) => act(() => {
                const editor = (result.container.querySelector('.ProseMirror') as HTMLElement & {editor: Editor}).editor;
                editor.view.dispatch(editor.state.tr.insertText(text));
            });
            return {...result, typeInEditor};
        };

        it('should save and show rich text typed right before a channel switch without waiting', () => {
            jest.useFakeTimers();
            const {rerender, typeInEditor} = renderRichTextEditor();

            typeInEditor('typed before leaving');
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );

            expect(mockedUpdateDraft).toHaveBeenCalledWith(
                StoragePrefixes.DRAFT + channelId,
                expect.objectContaining({message: 'typed before leaving', show: true}),
                '',
                true,
            );
        });

        it('should save rich text typed right before a channel switch when the next channel changes too', () => {
            jest.useFakeTimers();
            const {rerender, typeInEditor} = renderRichTextEditor();

            typeInEditor('typed in the first channel');
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
            typeInEditor('typed in the next channel');
            act(() => {
                jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT + 50);
            });

            expect(mockedUpdateDraft).toHaveBeenCalledWith(
                StoragePrefixes.DRAFT + channelId,
                expect.objectContaining({message: 'typed in the first channel'}),
                '',
                true,
            );
        });

        it('should send rich text whose debounced change fired right before Enter', () => {
            jest.useFakeTimers();
            const {container, typeInEditor} = renderRichTextEditor();
            typeInEditor('sent right after the debounce');
            act(() => {
                jest.advanceTimersByTime(99);
            });

            // Like a browser, fire the 100 ms debounce and the key press outside act, with no render in between.
            const reactGlobals = globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean};
            const actEnvironment = reactGlobals.IS_REACT_ACT_ENVIRONMENT;
            reactGlobals.IS_REACT_ACT_ENVIRONMENT = false;
            try {
                jest.advanceTimersToNextTimer();
                (container.querySelector('.ProseMirror') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
            } finally {
                reactGlobals.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
            }

            expect(mockedOnSubmit).toHaveBeenCalledWith(
                channelId,
                '',
                expect.objectContaining({message: 'sent right after the debounce'}),
                expect.anything(),
                undefined,
            );
        });
    });

    it('should save a new draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            initialState,
        );

        await userEvent.type(screen.getByPlaceholderText('Write to Test Channel'), 'some text');

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        expect(mockedUpdateDraft).toHaveBeenCalled();
        expect(mockedUpdateDraft.mock.calls[0][1]).toMatchObject({
            message: 'some text',
            show: true,
        });
    });

    it('should not adopt the previous channel draft when a submit resolves after a channel switch', async () => {
        let resolveSubmit = () => {};
        mockedOnSubmit.mockImplementation((() => () => new Promise((resolve) => {
            resolveSubmit = () => resolve({data: true});
        })) as unknown as typeof onSubmit);

        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            initialState,
        );

        await userEvent.type(screen.getByPlaceholderText('Write to Test Channel'), 'first message');
        await userEvent.click(screen.getByTestId('SendMessageButton'));

        // The channel switches while that submit is still in flight, exactly as
        // /msg does when redirecting to a DM that already exists in the store.
        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        // Now the in-flight submit resolves and clears the origin channel's draft.
        await act(async () => {
            resolveSubmit();
        });

        await userEvent.type(screen.getByPlaceholderText('Write to Other Channel'), 'second message');

        // Switching away flushes the composer's draft, revealing which channel it
        // believes it belongs to. Before the fix this was the origin channel, so
        // the message would have posted there.
        mockedUpdateDraft.mockClear();
        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={channelId}
            />,
        );

        expect(mockedUpdateDraft).toHaveBeenCalled();
        expect(mockedUpdateDraft.mock.calls[0][1]).toMatchObject({
            message: 'second message',
            channelId: otherChannelId,
        });
    });

    it('should not adopt the previous thread draft when a submit resolves after a thread switch', async () => {
        let resolveSubmit = () => {};
        mockedOnSubmit.mockImplementation((() => () => new Promise((resolve) => {
            resolveSubmit = () => resolve({data: true});
        })) as unknown as typeof onSubmit);

        const firstThreadId = 'thread_1';
        const secondThreadId = 'thread_2';

        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
                rootId={firstThreadId}
            />,
            initialState,
        );

        await userEvent.type(screen.getByPlaceholderText('Reply to this thread...'), 'first reply');
        await userEvent.click(screen.getByTestId('SendMessageButton'));

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                rootId={secondThreadId}
            />,
        );

        await act(async () => {
            resolveSubmit();
        });

        await userEvent.type(screen.getByPlaceholderText('Reply to this thread...'), 'second reply');

        mockedUpdateDraft.mockClear();
        rerender(
            <AdvancedTextEditor
                {...baseProps}
                rootId={firstThreadId}
            />,
        );

        expect(mockedUpdateDraft).toHaveBeenCalled();
        expect(mockedUpdateDraft.mock.calls[0][1]).toMatchObject({
            message: 'second reply',
            channelId,
            rootId: secondThreadId,
        });
    });

    it('MM-60541 should not save an unmodified draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.DRAFT + channelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: 'original draft',
                            }),
                        },
                    },
                },
            }),
        );

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        expect(mockedUpdateDraft).not.toHaveBeenCalled();
    });

    it('should save an updated draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.DRAFT + channelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: 'original draft',
                            }),
                        },
                    },
                },
            }),
        );

        await userEvent.type(screen.getByPlaceholderText('Write to Test Channel'), ' plus some new text');

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        expect(mockedUpdateDraft).toHaveBeenCalled();
        expect(mockedUpdateDraft.mock.calls[0][1]).toMatchObject({
            message: 'original draft plus some new text',
            show: true,
        });
    });

    it('MM-69928 should not create a synced/visible draft when editing a post and unmounting', async () => {
        const editStorageKey = StoragePrefixes.EDIT_DRAFT + 'post_id_1';
        const {unmount} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
                postId='post_id_1'
                isInEditMode={true}
                storageKey={editStorageKey}
            />,
            mergeObjects(initialState, {
                entities: {
                    general: {
                        config: {
                            AllowSyncedDrafts: 'true',
                        },
                    },
                },
                storage: {
                    storage: {
                        [editStorageKey]: {
                            value: TestHelper.getPostDraftMock({
                                message: 'original message',
                                channelId,
                            }),
                        },
                    },
                },
            }),
        );

        await userEvent.type(screen.getByTestId('edit_textbox'), ' edited');

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        unmount();

        // The edit content may be persisted locally, but it must never be flagged
        // as visible (show) or synced to the server (save), which would surface it
        // as a draft in the drafts UI.
        mockedUpdateDraft.mock.calls.forEach((call) => {
            expect(call[1]).not.toMatchObject({show: true});
            expect(call[3]).toBeFalsy();
        });
    });

    it('should deleted a deleted draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.DRAFT + channelId]: {
                            value: TestHelper.getPostDraftMock({
                                message: 'original draft',
                            }),
                        },
                    },
                },
            }),
        );

        await userEvent.clear(screen.getByPlaceholderText('Write to Test Channel'));

        expect(mockedRemoveDraft).not.toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        expect(mockedRemoveDraft).toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();
    });

    it('MM-60541 should not attempt to delete a non-existent draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            initialState,
        );

        expect(mockedRemoveDraft).not.toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        rerender(
            <AdvancedTextEditor
                {...baseProps}
                channelId={otherChannelId}
            />,
        );

        expect(mockedRemoveDraft).not.toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();
    });

    it('should show @mention warning when a mention exists in the message', () => {
        const props = {
            ...baseProps,
            rootId: 'post_id_1',
            isInEditMode: true,
        };

        renderWithContext(
            <AdvancedTextEditor
                {...props}
            />,
            mergeObjects(initialState, {
                storage: {
                    storage: {
                        [StoragePrefixes.COMMENT_DRAFT + 'post_id_1']: {
                            value: TestHelper.getPostDraftMock({
                                message: 'mentioning @user',
                            }),
                        },
                    },
                },
            }),
        );

        expect(screen.getByText('Editing this message with an \'@mention\' will not notify the recipient.')).toBeVisible();
    });

    it('should have file upload overlay', () => {
        const props: Props = {
            ...baseProps,
        };

        const {container, rerender} = renderWithContext(
            <AdvancedTextEditor
                {...props}
            />,
        );
        expect(container.querySelector('#createPostFileDropOverlay')).toBeVisible();

        props.rootId = 'post_id_1';
        rerender(<AdvancedTextEditor {...props}/>);
        expect(container.querySelector('#createCommentFileDropOverlay')).toBeVisible();

        // in center channel editing a post
        props.isInEditMode = true;
        rerender(<AdvancedTextEditor {...props}/>);
        expect(container.querySelector('#editPostFileDropOverlay')).toBeVisible();

        // in RHS editing a post
        props.location = Locations.RHS_COMMENT;
        rerender(<AdvancedTextEditor {...props}/>);
        expect(container.querySelector('#editPostFileDropOverlay')).toBeVisible();

        // in threads
        props.isThreadView = true;
        rerender(<AdvancedTextEditor {...props}/>);
        expect(container.querySelector('#editPostFileDropOverlay')).toBeVisible();
    });

    describe('emoji picker', () => {
        const testState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableEmojiPicker: 'true',
                    },
                },
            },
        });

        it('should add emojis to the end of the text', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                testState,
            );

            const textbox = screen.getByPlaceholderText('Write to Test Channel') as HTMLTextAreaElement;

            expect(textbox).toHaveValue('');

            // Open the emoji picker and select an emoji
            await userEvent.click(screen.getByRole('button', {name: 'select an emoji'}));
            await userEvent.click(screen.getByRole('button', {name: 'blush emoji'}));

            expect(textbox).toHaveFocus();
            expect(textbox).toHaveValue('\uD83D\uDE0A ');
            expect(textbox.selectionStart).toEqual(3);
            expect(textbox.selectionEnd).toEqual(3);

            // Do it again
            await userEvent.click(screen.getByRole('button', {name: 'select an emoji'}));
            await userEvent.click(screen.getByRole('button', {name: 'relaxed emoji'}));

            expect(textbox).toHaveFocus();
            expect(textbox).toHaveValue('\uD83D\uDE0A \u263A\uFE0F ');
            expect(textbox.selectionStart).toEqual(6);
            expect(textbox.selectionEnd).toEqual(6);
        });

        it('should add a space after the existing text if needed', async () => {
            renderWithContext(
                <AdvancedTextEditor {...baseProps}/>,
                testState,
            );

            const textbox = screen.getByPlaceholderText('Write to Test Channel') as HTMLTextAreaElement;

            await userEvent.type(textbox, 'This is some text');

            expect(textbox).toHaveValue('This is some text');

            // Open the emoji picker and select an emoji
            await userEvent.click(screen.getByRole('button', {name: 'select an emoji'}));
            await userEvent.click(screen.getByRole('button', {name: 'blush emoji'}));

            expect(textbox).toHaveFocus();
            expect(textbox).toHaveValue('This is some text \uD83D\uDE0A ');
            expect(textbox.selectionStart).toEqual(21);
            expect(textbox.selectionEnd).toEqual(21);
        });

        it('should be able to add an emoji in the middle of the text', async () => {
            renderWithContext(
                <AdvancedTextEditor {...baseProps}/>,
                testState,
            );

            const textbox = screen.getByPlaceholderText('Write to Test Channel') as HTMLTextAreaElement;

            await userEvent.type(textbox, 'aaabbb');
            expect(textbox).toHaveValue('aaabbb');

            // Move into the middle of the text
            await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');

            expect(textbox).toHaveValue('aaabbb');

            // Open the emoji picker and select an emoji
            await userEvent.click(screen.getByRole('button', {name: 'select an emoji'}));
            await userEvent.click(screen.getByRole('button', {name: 'blush emoji'}));

            expect(textbox).toHaveFocus();
            expect(textbox).toHaveValue('aaa \uD83D\uDE0A bbb');
            expect(textbox.selectionStart).toEqual(7);
            expect(textbox.selectionEnd).toEqual(textbox.selectionEnd);
        });

        it('should be able to add an emoji in the middle of the text without adding an extra space', async () => {
            renderWithContext(
                <AdvancedTextEditor {...baseProps}/>,
                testState,
            );

            const textbox = screen.getByPlaceholderText('Write to Test Channel') as HTMLTextAreaElement;

            await userEvent.type(textbox, 'aaabbb');
            expect(textbox).toHaveValue('aaabbb');

            // Move into the middle of the text
            await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft} ');

            expect(textbox).toHaveValue('aaa bbb');

            // Open the emoji picker and select an emoji
            await userEvent.click(screen.getByRole('button', {name: 'select an emoji'}));
            await userEvent.click(screen.getByRole('button', {name: 'blush emoji'}));

            expect(textbox).toHaveFocus();
            expect(textbox).toHaveValue('aaa \uD83D\uDE0A bbb');
            expect(textbox.selectionStart).toEqual(7);
            expect(textbox.selectionEnd).toEqual(textbox.selectionEnd);
        });
    });

    describe('composer placeholder', () => {
        const suffixState = {
            plugins: {
                components: {
                    ComposerPlaceholder: [
                        {
                            id: 'suffix-1',
                            pluginId: 'test-plugin',
                            transform: (placeholder: string) => `${placeholder} (encrypted)`,
                        },
                    ],
                },
            },
        };

        it('appends registered suffix to the composer placeholder', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                mergeObjects(initialState, suffixState),
            );

            expect(screen.getByPlaceholderText('Write to Test Channel (encrypted)')).toBeInTheDocument();
        });

        it('appends suffix to the thread-reply placeholder', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    rootId='root-post-id'
                />,
                mergeObjects(initialState, suffixState),
            );

            expect(screen.getByPlaceholderText('Reply to this thread... (encrypted)')).toBeInTheDocument();
        });

        it('appends suffix to the read-only channel placeholder', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                mergeObjects(mergeObjects(initialState, suffixState), {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: []},
                            },
                        },
                    },
                }),
            );

            expect(screen.getByPlaceholderText(
                'This channel is read-only. Only members with permission can post here. (encrypted)',
            )).toBeInTheDocument();
        });
    });

    describe('channel_write_access policy', () => {
        const withWriteDecision = (allowed: boolean) => mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        FeatureFlagPermissionPolicies: 'true',
                    },
                },
                renderPermissions: {
                    byResource: {
                        channel: {
                            [channelId]: {
                                channel_write_access: {allowed, evaluated: true, generation: 1},
                            },
                        },
                    },
                },
            },
        });

        it('disables the editor and explains why when the policy denies', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withWriteDecision(false),
            );

            const textbox = screen.getByPlaceholderText('You do not have permission to post in this channel.');
            expect(textbox).toBeDisabled();
        });

        it('leaves the editor alone when the policy allows', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withWriteDecision(true),
            );

            expect(screen.getByPlaceholderText('Write to Test Channel')).toBeEnabled();
        });

        // The endpoint enforces regardless, and failing closed would grey the composer
        // out on the first visit to every channel.
        it('fails open while no decision has been fetched', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                mergeObjects(initialState, {
                    entities: {
                        general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                        renderPermissions: {byResource: {}},
                    },
                }),
            );

            expect(screen.getByPlaceholderText('Write to Test Channel')).toBeEnabled();
        });

        // The policy message wins over the generic read-only one: it names the actual
        // cause, and a session denied by policy usually has the RBAC permission.
        it('reports the policy denial even when RBAC denies too', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                mergeObjects(withWriteDecision(false), {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: []},
                            },
                        },
                    },
                }),
            );

            expect(screen.getByPlaceholderText(
                'You do not have permission to post in this channel.',
            )).toBeInTheDocument();
        });

        it('disables the edit Save button when the policy denies write access', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    isInEditMode={true}
                    rootId={'post_id_1'}
                />,
                withWriteDecision(false),
            );

            expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        });

        it('leaves the edit Save button enabled when the policy allows write access', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    isInEditMode={true}
                    rootId={'post_id_1'}
                />,
                withWriteDecision(true),
            );

            expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
        });
    });

    describe('post attributes button', () => {
        const attributesGroupId = 'post_attributes_group';
        const attributeOptions = [{id: 'opt_secret', name: 'SECRET', color: 'red'}];

        function makeAttributeField(overrides: Partial<PropertyField>): PropertyField {
            return {
                id: 'field_id',
                group_id: attributesGroupId,
                name: 'field',
                type: 'select',
                object_type: 'post',
                target_type: 'system',
                target_id: '',
                attrs: {options: attributeOptions},
                permission_values: 'member',
                create_at: 1,
                update_at: 1,
                delete_at: 0,
                created_by: 'current_user_id',
                updated_by: 'current_user_id',
                ...overrides,
            };
        }

        // Neither field has a chip until the user picks it. `classification`
        // is declared `always`, which makes no difference in the composer: it
        // is offered by the picker like `priority`.
        const priorityField = makeAttributeField({id: 'f_priority', name: 'priority', attrs: {options: attributeOptions, display_name: 'Priority', visibility: 'when_set'}});
        const classificationField = makeAttributeField({id: 'f_classification', name: 'classification', attrs: {options: attributeOptions, display_name: 'Classification', visibility: 'always'}});

        const spareField = makeAttributeField({id: 'f_spare', name: 'spare', attrs: {options: attributeOptions, display_name: 'Spare', visibility: 'when_set'}});

        // A text field draws an input rather than a menu button, and builds its
        // DOM id separately, so it needs its own case where ids could collide.
        const referenceField = makeAttributeField({id: 'f_reference', name: 'reference', type: 'text', attrs: {display_name: 'Reference', visibility: 'always'}});

        function withFields(fields: PropertyField[], flag = 'true') {
            const byId = Object.fromEntries(fields.map((field) => [field.id, field]));

            return mergeObjects(initialState, {
                entities: {
                    general: {
                        config: {
                            FeatureFlagPostAttributes: flag,
                        },
                    },
                    properties: {
                        fields: {
                            byId,
                            byObjectType: {post: {[attributesGroupId]: byId}},
                        },
                        values: {byTargetId: {}, byFieldId: {}},
                        groups: {
                            byId: {[attributesGroupId]: {id: attributesGroupId, name: 'post_attributes'}},
                            byName: {post_attributes: {id: attributesGroupId, name: 'post_attributes'}},
                        },
                    },
                },
            });
        }

        // One field the user can still add, which is what puts the `+` on screen.
        const flagOn = withFields([priorityField]);

        // Picks a field from the `+` in a composer's action row. Both composers
        // can be mounted at once, hence the index. An option field's chip opens
        // its value menu; the first option is picked there, because closing it
        // empty would un-stage the field, and the next step starts from a clean
        // page.
        async function pickFromActionRow(fieldName: string, composerIndex = 0) {
            await userEvent.click(screen.getAllByTestId('post-attributes-composer-add')[composerIndex]);
            await userEvent.click(screen.getByTestId(`post-attribute-add-${fieldName}`));
            await waitFor(() => expect(screen.getAllByTestId(`post-attribute-chip-${fieldName}`)).toHaveLength(composerIndex + 1));

            const firstOption = screen.queryAllByRole('menuitemradio')[0];
            if (firstOption) {
                await userEvent.click(firstOption);
                await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
            }
        }

        it('is absent with the feature flag off', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                initialState,
            );

            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        });

        // The editor never loads fields itself: `loadPostAttributeFields`, called by
        // the channel view and the thread sidebar, does, and its flag gate is tested
        // in `actions/post_attributes.test.ts`. This pins the editor's side: with
        // the flag off it draws nothing even when fields are already in the store,
        // and doesn't start a request of its own.
        it('renders nothing with the flag off even when fields are in the store, and makes no field request of its own', () => {
            const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, classificationField], 'false'),
            );

            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-composer')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument();
            expect(getPropertyFields).not.toHaveBeenCalled();

            getPropertyFields.mockRestore();
        });

        it('is present in the centre channel composer with the flag on', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                flagOn,
            );

            expect(screen.getByTestId('post-attributes-composer-add')).toBeInTheDocument();
        });

        it('is present in the RHS reply composer with the flag on', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    location={Locations.RHS_COMMENT}
                    rootId='root-post-id'
                />,
                flagOn,
            );

            expect(screen.getByTestId('post-attributes-composer-add')).toBeInTheDocument();
        });

        it('is absent when editing an existing post', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    isInEditMode={true}
                />,
                flagOn,
            );

            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        });

        it('sits before the formatting toggle in the action row', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                flagOn,
            );

            const add = screen.getByLabelText('Add attributes');
            const formatting = screen.getByLabelText('formatting');

            expect(add.compareDocumentPosition(formatting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it('opens the field picker, and picking a field stages its chip', async () => {
            // A second field, so there is still something to add afterwards
            // and the button is still on screen to be inspected.
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, spareField]),
            );

            const add = screen.getByTestId('post-attributes-composer-add');
            expect(add).not.toHaveAttribute('aria-disabled');
            expect(screen.queryByTestId('post-attribute-chip-priority')).not.toBeInTheDocument();

            await userEvent.click(add);

            expect(screen.getByRole('menu', {name: 'Add an attribute'})).toBeInTheDocument();
            await userEvent.click(screen.getByTestId('post-attribute-add-priority'));

            // The picked field's chip arrives with its own menu already open.
            await waitFor(() => expect(screen.getByTestId('post-attribute-chip-priority')).toBeInTheDocument());
            expect(await screen.findByRole('menuitemradio', {name: /^SECRET/})).toBeInTheDocument();
            expect(screen.getByTestId('post-attributes-composer-add')).not.toHaveAttribute('aria-disabled');
        });

        it('draws the chip row above the message box, outside its border', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, spareField]),
            );

            await pickFromActionRow('priority');

            const row = screen.getByTestId('post-attributes-composer');
            const box = document.querySelector('.AdvancedTextEditor__body') as HTMLElement;

            expect(box).not.toContainElement(row);
            expect(row.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(row.closest('.AdvancedTextEditor__attributes')).not.toBeNull();
        });

        it('offers the fields the inline add control offers', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, spareField, classificationField]),
            );

            // The inline control only exists once something is staged.
            expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument();
            await pickFromActionRow('priority');

            await userEvent.click(screen.getByTestId('post-attributes-composer-add'));
            const fromButton = screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'));
            await userEvent.keyboard('{Escape}');
            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

            await userEvent.click(screen.getByTestId('post-attributes-add'));
            const fromInline = screen.getAllByRole('menuitem').map((item) => item.getAttribute('data-testid'));

            // `classification` is declared `always` and is offered like the rest.
            expect(fromButton).toEqual(['post-attribute-add-classification', 'post-attribute-add-spare']);
            expect(fromInline).toEqual(fromButton);
        });

        it('is not rendered when the channel declares no attribute the user can add', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([]),
            );

            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        });

        it('draws no chip for an `always` field until the user picks it, and stages nothing for it', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([classificationField]),
            );

            expect(screen.queryByTestId('post-attributes-composer')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();

            await userEvent.click(screen.getByTestId('post-attributes-composer-add'));
            await userEvent.click(screen.getByTestId('post-attribute-add-classification'));
            await waitFor(() => expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument());

            // Picked, but empty: the chip shows the field's name while its menu
            // is open, and nothing is staged for it.
            expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('Classification');
            expect(screen.getByTestId('post-attribute-trigger-classification')).not.toHaveTextContent('SECRET');

            // Closed without a value, it goes again, as any picked option field does.
            await userEvent.keyboard('{Escape}');
            await waitFor(() => expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument());
            expect(screen.getByTestId('post-attributes-composer-add')).toBeInTheDocument();
        });

        it('stops rendering both add controls once the last field is picked', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, classificationField]),
            );

            // Nothing is staged, so there is no chip row and no inline control.
            expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument();
            expect(screen.getByTestId('post-attributes-composer-add')).toBeInTheDocument();

            await pickFromActionRow('priority');
            expect(screen.getByTestId('post-attributes-add')).toBeInTheDocument();

            await pickFromActionRow('classification');

            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument();
        });

        it('adds each picked chip at the end of the row, after the ones already there', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, classificationField]),
            );

            // Field order is priority, classification; pick them the other way round.
            await pickFromActionRow('classification');
            await pickFromActionRow('priority');

            const chipNames = screen.getAllByTestId(/^post-attribute-chip-/).map((chip) => chip.dataset.testid);
            expect(chipNames).toEqual(['post-attribute-chip-classification', 'post-attribute-chip-priority']);
        });

        it('gives the two add controls their own ids and test ids', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withFields([priorityField, classificationField]),
            );

            await pickFromActionRow('priority');

            const inline = screen.getByTestId('post-attributes-add');
            const button = screen.getByTestId('post-attributes-composer-add');

            expect(new Set([inline.id, button.id]).size).toBe(2);
            expect(inline.id).not.toBe('');
            expect(button.id).not.toBe('');
            expect(inline.getAttribute('aria-controls')).not.toBe(button.getAttribute('aria-controls'));
        });

        it('keeps DOM ids unique with the centre channel and the thread composers side by side', async () => {
            renderWithContext(
                <>
                    <AdvancedTextEditor
                        {...baseProps}
                    />
                    <AdvancedTextEditor
                        {...baseProps}
                        location={Locations.RHS_COMMENT}
                        rootId='root-post-id'
                    />
                </>,
                withFields([priorityField, classificationField]),
            );

            // Both composers have their add controls, and the same field is picked in each.
            expect(screen.getAllByTestId('post-attributes-composer-add')).toHaveLength(2);

            await pickFromActionRow('classification', 0);
            await pickFromActionRow('classification', 1);

            expect(screen.getAllByTestId('post-attribute-trigger-classification')).toHaveLength(2);

            const ids = Array.from(document.querySelectorAll('[id^="postAttribute"]')).map((element) => element.id);

            expect(ids.length).toBeGreaterThanOrEqual(6);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('keeps a text field\'s input ids unique with the centre channel and the thread composers side by side', async () => {
            renderWithContext(
                <>
                    <AdvancedTextEditor
                        {...baseProps}
                    />
                    <AdvancedTextEditor
                        {...baseProps}
                        location={Locations.RHS_COMMENT}
                        rootId='root-post-id'
                    />
                </>,
                withFields([priorityField, referenceField]),
            );

            // The same text field is picked in both composers. A text chip is
            // an input only while it is being edited, and picking in the
            // thread composer moves focus out of the centre one, so the two
            // inputs are read one after the other.
            await pickFromActionRow('reference', 0);
            const centreId = screen.getByTestId('post-attribute-input-reference').id;

            await pickFromActionRow('reference', 1);
            const inputs = screen.getAllByTestId('post-attribute-input-reference');
            expect(inputs).toHaveLength(1);
            const threadId = inputs[0].id;

            expect(centreId).toMatch(/^postAttributeValueInput-f_reference/);
            expect(threadId).toMatch(/^postAttributeValueInput-f_reference/);
            expect(centreId).not.toBe(threadId);

            const ids = Array.from(document.querySelectorAll('[id^="postAttribute"]')).map((element) => element.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('quoting text from a post', () => {
        const stateWithDraft = mergeObjects(initialState, {
            entities: {
                roles: {
                    roles: {
                        user_roles: {permissions: [Permissions.CREATE_POST]},
                    },
                },
            },
            storage: {
                storage: {
                    [StoragePrefixes.DRAFT + channelId]: {
                        value: TestHelper.getPostDraftMock({
                            message: 'original draft',
                        }),
                    },
                },
            },
        });

        it('should append the quote to the draft of the matching channel', () => {
            const {store} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                stateWithDraft,
            );

            act(() => {
                store.dispatch(quoteTextInDraft(channelId, '', 'Diam sapien\npellentesque'));
            });

            expect(screen.getByTestId('post_textbox')).toHaveValue('original draft\n\n> Diam sapien\n> pellentesque\n\n');
            expect(store.getState().views.drafts.pendingQuote).toBeNull();
        });

        it('should ignore a quote meant for another channel or thread', () => {
            const {store} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                stateWithDraft,
            );

            act(() => {
                store.dispatch(quoteTextInDraft(channelId, 'some_root_id', 'Diam sapien'));
            });

            expect(screen.getByTestId('post_textbox')).toHaveValue('original draft');
            expect(store.getState().views.drafts.pendingQuote).not.toBeNull();

            act(() => {
                store.dispatch(quoteTextInDraft(otherChannelId, '', 'Diam sapien'));
            });

            expect(screen.getByTestId('post_textbox')).toHaveValue('original draft');
        });

        it('should not quote into a message being edited', () => {
            const {store} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    isInEditMode={true}
                />,
                stateWithDraft,
            );
            const textbox = screen.getByTestId('edit_textbox');
            const valueBefore = (textbox as HTMLTextAreaElement).value;

            act(() => {
                store.dispatch(quoteTextInDraft(channelId, '', 'Diam sapien'));
            });

            expect(textbox).toHaveValue(valueBefore);
        });
    });

    describe('staged post attributes', () => {
        const groupId = 'post_attributes_group';
        const options = [
            {id: 'opt_secret', name: 'SECRET', color: 'red'},
            {id: 'opt_unclassified', name: 'UNCLASSIFIED', color: 'green'},
        ];

        // System-scoped, so both channels in the state offer the same fields
        // and a channel switch shows what was cleared rather than a field
        // that simply does not apply.
        function makeField(overrides: Partial<PropertyField>): PropertyField {
            return {
                id: 'field_id',
                group_id: groupId,
                name: 'field',
                type: 'select',
                object_type: 'post',
                target_type: 'system',
                target_id: '',
                attrs: {options},
                permission_values: 'member',
                create_at: 1,
                update_at: 1,
                delete_at: 0,
                created_by: currentUserId,
                updated_by: currentUserId,
                ...overrides,
            };
        }

        const alwaysField = makeField({id: 'f_always', name: 'classification', attrs: {options, display_name: 'Classification', visibility: 'always'}});
        const pickedField = makeField({id: 'f_picked', name: 'priority', attrs: {options, display_name: 'Priority', visibility: 'when_set'}});

        const withAttributes = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        FeatureFlagPostAttributes: 'true',
                    },
                },
                properties: {
                    fields: {
                        byId: {[alwaysField.id]: alwaysField, [pickedField.id]: pickedField},
                        byObjectType: {post: {[groupId]: {[alwaysField.id]: alwaysField, [pickedField.id]: pickedField}}},
                    },
                    values: {byTargetId: {}, byFieldId: {}},
                    groups: {
                        byId: {[groupId]: {id: groupId, name: 'post_attributes'}},
                        byName: {post_attributes: {id: groupId, name: 'post_attributes'}},
                    },
                },
            },
        });

        // Earlier tests in this file leave `onSubmit` returning a promise
        // they resolve by hand; these need it to settle on its own. By default
        // it behaves like a created post, which runs `afterOptimisticSubmit`
        // once the pending post is in the store.
        beforeEach(() => {
            mockedOnSubmit.mockImplementation(((_channelId: string, _rootId: string, _draft: unknown, submitOptions: OnSubmitOptions) => () => {
                submitOptions.afterOptimisticSubmit?.();
                return Promise.resolve({data: true});
            }) as unknown as typeof onSubmit);
        });

        // `classification` is declared `always`, and is still only staged by
        // picking it from the `+` in the action row, like any other field.
        async function stageClassification() {
            await userEvent.click(screen.getByTestId('post-attributes-composer-add'));
            await userEvent.click(screen.getByTestId('post-attribute-add-classification'));
            await userEvent.click(await screen.findByRole('menuitemradio', {name: /^SECRET/}));
            await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET'));
        }

        // Stages a value on the `always` field, then picks the `when_set` field
        // from the chip row's own picker, giving it a value too.
        async function stageAttributes() {
            await stageClassification();

            await userEvent.click(screen.getByTestId('post-attributes-add'));
            await userEvent.click(screen.getByTestId('post-attribute-add-priority'));
            await userEvent.click(await screen.findByRole('menuitemradio', {name: /^UNCLASSIFIED/}));
            await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-priority')).toHaveTextContent('UNCLASSIFIED'));
        }

        function expectNothingStaged() {
            expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attribute-chip-priority')).not.toBeInTheDocument();
        }

        it('sends the staged values and clears them with the message box', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            const textbox = screen.getByTestId('post_textbox');
            fireEvent.input(textbox, {target: {value: 'a message with attributes'}});

            await act(async () => {
                fireEvent.click(screen.getByTestId('SendMessageButton'));
            });

            expect(mockedOnSubmit).toHaveBeenCalledWith(
                channelId,
                '',
                expect.anything(),
                expect.objectContaining({
                    propertyValues: expect.arrayContaining([
                        {field_id: 'f_always', value: 'opt_secret'},
                        {field_id: 'f_picked', value: 'opt_unclassified'},
                    ]),
                }),
                undefined,
            );
            expect(textbox).toHaveValue('');
            expectNothingStaged();
        });

        // A field can stop applying while the post is being written: deleted, or
        // its permission changed so this user may no longer set it. Its chip goes,
        // and its value must go with it rather than ride on the post unseen for
        // the server to refuse it.
        it.each([
            ['its field is deleted', {type: PropertyTypes.PROPERTY_FIELD_DELETED, data: {fieldId: pickedField.id}}],
            ['the user may no longer set it', {type: PropertyTypes.RECEIVED_PROPERTY_FIELDS, data: {fields: [{...pickedField, permission_values: 'none'}]}}],
        ])('does not send a staged value once %s', async (_, action) => {
            const {store} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            act(() => {
                store.dispatch(action);
            });
            await waitFor(() => expect(screen.queryByTestId('post-attribute-chip-priority')).not.toBeInTheDocument());

            fireEvent.input(screen.getByTestId('post_textbox'), {target: {value: 'a message with attributes'}});

            await act(async () => {
                fireEvent.click(screen.getByTestId('SendMessageButton'));
            });

            expect(mockedOnSubmit).toHaveBeenCalledWith(
                channelId,
                '',
                expect.anything(),
                expect.objectContaining({
                    propertyValues: [{field_id: alwaysField.id, value: 'opt_secret'}],
                }),
                undefined,
            );
        });

        it('keeps the staged values when the submit fails', async () => {
            mockedOnSubmit.mockImplementationOnce((() => () => Promise.resolve({error: {message: 'failed', server_error_id: 'api.error'}})) as unknown as typeof onSubmit);

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            fireEvent.input(screen.getByTestId('post_textbox'), {target: {value: 'a message with attributes'}});

            await act(async () => {
                fireEvent.click(screen.getByTestId('SendMessageButton'));
            });

            expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');
            expect(screen.getByTestId('post-attribute-trigger-priority')).toHaveTextContent('UNCLASSIFIED');
        });

        it('keeps the staged values when a slash command is submitted', async () => {
            // A command or a `+:emoji:` reaction resolves without creating a
            // post, so `afterOptimisticSubmit` never runs.
            mockedOnSubmit.mockImplementationOnce((() => () => Promise.resolve({data: true})) as unknown as typeof onSubmit);

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            const textbox = screen.getByTestId('post_textbox');
            fireEvent.input(textbox, {target: {value: '/echo hello'}});

            await act(async () => {
                fireEvent.click(screen.getByTestId('SendMessageButton'));
            });

            expect(mockedOnSubmit).toHaveBeenCalledWith(
                channelId,
                '',
                expect.objectContaining({message: '/echo hello'}),
                expect.anything(),
                undefined,
            );
            expect(textbox).toHaveValue('');
            expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');
            expect(screen.getByTestId('post-attribute-trigger-priority')).toHaveTextContent('UNCLASSIFIED');
        });

        it('keeps the staged values when a reaction is submitted', async () => {
            // A `+:emoji:` message makes `onSubmit` add a reaction to the latest
            // post and return, without creating a post, so it resolves without
            // running `afterOptimisticSubmit` (the action's own test covers that).
            mockedOnSubmit.mockImplementationOnce((() => () => Promise.resolve({data: {id: 'reaction_1'}})) as unknown as typeof onSubmit);

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            const textbox = screen.getByTestId('post_textbox');
            fireEvent.input(textbox, {target: {value: '+:smile:'}});

            await act(async () => {
                fireEvent.click(screen.getByTestId('SendMessageButton'));
            });

            expect(mockedOnSubmit).toHaveBeenCalledWith(
                channelId,
                '',
                expect.objectContaining({message: '+:smile:'}),
                expect.anything(),
                undefined,
            );
            expect(textbox).toHaveValue('');
            expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');
            expect(screen.getByTestId('post-attribute-trigger-priority')).toHaveTextContent('UNCLASSIFIED');
        });

        it('does not count a staged value as draft content', async () => {
            const {rerender} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            // The message is typed and then cleared, so the draft changed and
            // is flushed when leaving the channel. With only a staged value
            // left it is empty, so it is removed, not saved.
            const textbox = screen.getByTestId('post_textbox');
            fireEvent.input(textbox, {target: {value: 'x'}});
            fireEvent.input(textbox, {target: {value: ''}});

            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );

            expect(mockedUpdateDraft).not.toHaveBeenCalled();
            expect(mockedRemoveDraft).toHaveBeenCalled();
        });

        it('never writes the staged values into the saved draft', async () => {
            const {rerender} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            fireEvent.input(screen.getByTestId('post_textbox'), {target: {value: 'a message with attributes'}});

            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );

            expect(mockedUpdateDraft).toHaveBeenCalled();
            const savedDraft = mockedUpdateDraft.mock.calls[0][1];
            expect(savedDraft).toMatchObject({message: 'a message with attributes'});

            // Nothing that came from the attributes may be in the draft: neither
            // a property values key nor the staged field ids and option ids.
            const serialized = JSON.stringify(savedDraft);
            expect(serialized).not.toMatch(/propert/i);
            expect(serialized).not.toContain('f_always');
            expect(serialized).not.toContain('f_picked');
            expect(serialized).not.toContain('opt_secret');
            expect(serialized).not.toContain('opt_unclassified');
        });

        it('clears the staged values when the channel changes', async () => {
            const {rerender} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                withAttributes,
            );

            await stageAttributes();

            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );

            expectNothingStaged();
        });

        it('clears the staged values when the thread changes', async () => {
            const {rerender} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    rootId='thread_1'
                />,
                withAttributes,
            );

            await stageAttributes();

            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    rootId='thread_2'
                />,
            );

            expectNothingStaged();
        });

        describe('scheduling', () => {
            const withScheduling = mergeObjects(withAttributes, {
                entities: {
                    general: {
                        config: {
                            ScheduledPosts: 'true',
                        },
                        license: {
                            IsLicensed: 'true',
                        },
                    },
                },
            });

            it('disables only the schedule chevron while a value is staged, and re-enables it when the value is removed', async () => {
                renderWithContext(
                    <AdvancedTextEditor
                        {...baseProps}
                    />,
                    withScheduling,
                );

                fireEvent.input(screen.getByTestId('post_textbox'), {target: {value: 'a message with attributes'}});

                expect(screen.getByRole('button', {name: 'Schedule message'})).toBeEnabled();
                expect(screen.getByTestId('SendMessageButton')).toBeEnabled();

                await stageClassification();

                expect(screen.getByRole('button', {name: 'Schedule message'})).toBeDisabled();
                expect(screen.getByTestId('SendMessageButton')).toBeEnabled();

                await userEvent.click(screen.getByTestId('post-attribute-remove-classification'));

                await waitFor(() => expect(screen.getByRole('button', {name: 'Schedule message'})).toBeEnabled());
                expect(screen.getByTestId('SendMessageButton')).toBeEnabled();
            });
        });

        // The server refuses a burn-on-read post with attributes, so the
        // composer keeps the two apart, in both directions.
        describe('burn-on-read', () => {
            const withBurnOnRead = mergeObjects(withAttributes, {
                entities: {
                    general: {
                        config: {
                            EnableBurnOnRead: 'true',
                        },
                        license: {
                            IsLicensed: 'true',
                            SkuShortName: 'advanced',
                        },
                    },
                },
            });

            const burnOnReadButton = () => document.getElementById('burnOnReadButton') as HTMLElement;

            it('disables burn-on-read while a chip is staged, says why, and enables it again when the chip is removed', async () => {
                renderWithContext(
                    <AdvancedTextEditor
                        {...baseProps}
                    />,
                    withBurnOnRead,
                );

                fireEvent.input(screen.getByTestId('post_textbox'), {target: {value: 'a message with attributes'}});
                expect(burnOnReadButton()).toBeEnabled();

                await stageClassification();

                expect(burnOnReadButton()).toBeDisabled();
                await userEvent.hover(screen.getByTestId('burn-on-read-blocked'));

                // Another control's tooltip may still be open from the click before.
                expect((await screen.findByText('Messages with attributes can’t be burn-on-read')).closest('[role="tooltip"]')).not.toBeNull();
                expect(screen.getByTestId('SendMessageButton')).toBeEnabled();

                await userEvent.click(screen.getByTestId('post-attribute-remove-classification'));

                await waitFor(() => expect(burnOnReadButton()).toBeEnabled());
                expect(screen.queryByTestId('burn-on-read-blocked')).not.toBeInTheDocument();
            });

            it('disables burn-on-read for a staged chip that has no value yet', async () => {
                renderWithContext(
                    <AdvancedTextEditor
                        {...baseProps}
                    />,
                    withBurnOnRead,
                );

                // The value menu opens on the pick; nothing is chosen yet.
                await userEvent.click(screen.getByTestId('post-attributes-composer-add'));
                await userEvent.click(screen.getByTestId('post-attribute-add-priority'));
                await screen.findByRole('menuitemradio', {name: /^SECRET/});

                expect(screen.getByTestId('post-attribute-chip-priority')).toBeInTheDocument();
                expect(burnOnReadButton()).toBeDisabled();
            });

            it('disables adding attributes while the message is burn-on-read, says why, and enables it again when turned off', async () => {
                renderWithContext(
                    <AdvancedTextEditor
                        {...baseProps}
                    />,
                    withBurnOnRead,
                );

                await userEvent.click(burnOnReadButton());

                const add = screen.getByTestId('post-attributes-composer-add');
                await waitFor(() => expect(add).toBeDisabled());

                await userEvent.hover(screen.getByTestId('post-attributes-composer-add-blocked'));

                // Another control's tooltip may still be open from the click before.
                expect((await screen.findByText('Burn-on-read messages can’t have attributes')).closest('[role="tooltip"]')).not.toBeNull();

                await userEvent.click(add);
                expect(screen.queryByRole('menu')).not.toBeInTheDocument();
                expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();

                await userEvent.click(burnOnReadButton());

                await waitFor(() => expect(screen.getByTestId('post-attributes-composer-add')).toBeEnabled());
                expect(screen.queryByTestId('post-attributes-composer-add-blocked')).not.toBeInTheDocument();
            });

            it('leaves adding attributes alone when burn-on-read is not available', async () => {
                renderWithContext(
                    <AdvancedTextEditor
                        {...baseProps}
                    />,
                    withAttributes,
                );

                expect(document.getElementById('burnOnReadButton')).toBeNull();
                expect(screen.getByTestId('post-attributes-composer-add')).toBeEnabled();

                await stageClassification();
                expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
            });
        });
    });
});
