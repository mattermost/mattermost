// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React from 'react';

import type {PostType} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import * as PreferenceActions from 'mattermost-redux/actions/preferences';
import Permissions from 'mattermost-redux/constants/permissions';

import {onSubmit} from 'actions/views/create_comment';
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
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Emoji'}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'blush emoji'})).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('button', {name: 'blush emoji'}));

            expect(textbox).toHaveFocus();
            expect(textbox).toHaveValue('\uD83D\uDE0A ');
            expect(textbox.selectionStart).toEqual(3);
            expect(textbox.selectionEnd).toEqual(3);

            // Do it again
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Emoji'}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'relaxed emoji'})).toBeInTheDocument();
            });
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
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Emoji'}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'blush emoji'})).toBeInTheDocument();
            });
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
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Emoji'}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'blush emoji'})).toBeInTheDocument();
            });
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
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
            await userEvent.click(screen.getByRole('menuitem', {name: 'Emoji'}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'blush emoji'})).toBeInTheDocument();
            });
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

    describe('composer plus menu', () => {
        const flagOn = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        FeatureFlagPostAttributes: 'true',
                    },
                },
            },
        });

        const openMenu = async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
        };

        it('omits Add attributes when the feature flag is off', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                initialState,
            );

            await openMenu();

            expect(screen.queryByRole('menuitem', {name: 'Add attributes'})).not.toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Formatting'})).toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        });

        it('includes Add attributes in the centre channel plus menu when the flag is on', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                flagOn,
            );

            await openMenu();

            expect(screen.getByRole('menuitem', {name: 'Add attributes'})).toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        });

        it('includes Add attributes in the RHS reply plus menu when the flag is on', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    location={Locations.RHS_COMMENT}
                    rootId='root-post-id'
                />,
                flagOn,
            );

            await openMenu();

            expect(screen.getByRole('menuitem', {name: 'Add attributes'})).toBeInTheDocument();
        });

        it('omits Add attributes when editing an existing post', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    isInEditMode={true}
                />,
                flagOn,
            );

            await openMenu();

            expect(screen.queryByRole('menuitem', {name: 'Add attributes'})).not.toBeInTheDocument();
        });

        it('sits on the left of the composer', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                />,
                flagOn,
            );

            const plus = screen.getByTestId('composer-plus');
            const menu = screen.getByRole('button', {name: 'Message options'});
            const send = screen.getByTestId('SendMessageButton');

            expect(plus).toContainElement(menu);
            expect(menu).toHaveClass('agent-composer-menu-button');
            expect(document.querySelector('.AdvancedTextEditor')).toHaveClass('AdvancedTextEditor--plus');
            expect(plus.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    describe('agent mode', () => {
        const chromeState = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        EnableEmojiPicker: 'true',
                        EnableFileAttachments: 'true',
                        PostPriority: 'true',
                        ScheduledPosts: 'true',
                        EnableBurnOnRead: 'true',
                        FeatureFlagPostAttributes: 'true',
                    },
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: 'advanced',
                    },
                },
            },
            plugins: {
                components: {
                    AIActionMenuItem: [{
                        id: 'ai-item',
                        pluginId: 'agents',
                        icon: null,
                        text: 'Use a skill',
                        sortOrder: 0,
                        action: () => {},
                    }],
                },
            },
        });

        const openMenu = async () => {
            await userEvent.click(screen.getByRole('button', {name: 'Message options'}));
        };

        it('puts attach, emoji, attributes, priority, burn-on-read, skills, and formatting in the left plus', async () => {
            renderWithContext(
                <AdvancedTextEditor {...baseProps}/>,
                chromeState,
            );

            expect(screen.getByTestId('formattingBarContainer')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Schedule message'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Message priority'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'AI Actions'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /burn-on-read/i})).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Message options'})).toBeInTheDocument();
            expect(screen.getByTestId('SendMessageButton')).toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'attachment'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'select an emoji'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'formatting'})).not.toBeInTheDocument();
            expect(document.querySelector('.AdvancedTextEditor')).not.toHaveClass('AdvancedTextEditor--agent');

            await openMenu();
            expect(screen.getByRole('menuitem', {name: 'Message priority'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Burn-on-read'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Use a skill'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Formatting'})).toBeInTheDocument();
        });

        it('hides channel chrome and keeps send', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            expect(screen.queryByRole('button', {name: 'formatting'})).not.toBeInTheDocument();
            expect(screen.queryByTestId('formattingBarContainer')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Message priority'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Schedule message'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'AI Actions'})).not.toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'attachment'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'select an emoji'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /burn-on-read/i})).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Message options'})).toBeInTheDocument();
            expect(screen.getByTestId('SendMessageButton')).toBeInTheDocument();
        });

        it('puts the + on the left of the composer and send at the end', () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            const plus = screen.getByTestId('composer-plus');
            const menu = screen.getByRole('button', {name: 'Message options'});
            const send = screen.getByTestId('SendMessageButton');

            expect(plus).toContainElement(menu);
            expect(menu).toHaveClass('agent-composer-menu-button');
            expect(plus.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(document.querySelector('.AdvancedTextEditor')).toHaveClass('AdvancedTextEditor--agent');
            expect(plus.compareDocumentPosition(document.querySelector('.AutoHeight')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it('omits Add attributes when post attributes are off', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                mergeObjects(chromeState, {
                    entities: {
                        general: {
                            config: {
                                FeatureFlagPostAttributes: 'false',
                            },
                        },
                    },
                }),
            );

            await openMenu();

            expect(screen.queryByRole('menuitem', {name: 'Add attributes'})).not.toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Attach files'})).toBeInTheDocument();
        });

        it('puts attach, emoji, attributes, and formatting in the + menu', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            await openMenu();

            expect(screen.getByRole('menuitem', {name: 'Attach files'})).toHaveFocus();
            expect(screen.getByRole('menuitem', {name: 'Emoji'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Message priority'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Burn-on-read'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Use a skill'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Formatting'})).toBeInTheDocument();

            const attributes = screen.getByRole('menuitem', {name: 'Add attributes'});
            expect(attributes).toHaveAttribute('aria-disabled', 'true');
            expect(attributes.querySelector('svg')).toBeInTheDocument();
            expect(screen.queryByTestId('post-attributes-composer-add')).not.toBeInTheDocument();
        });

        it('opens the formatting bar for this composer without saving the shared preference', async () => {
            const savePreferences = jest.spyOn(PreferenceActions, 'savePreferences');

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            await openMenu();
            await userEvent.click(screen.getByRole('menuitem', {name: 'Formatting'}));

            await waitFor(() => {
                expect(screen.getByTestId('formattingBarContainer')).toBeInTheDocument();
            });
            const textbox = screen.getByTestId('post_textbox');
            const bar = screen.getByTestId('formattingBarContainer');
            expect(textbox.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(screen.queryByRole('button', {name: 'Message priority'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'AI Actions'})).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /burn-on-read/i})).not.toBeInTheDocument();
            expect(savePreferences).not.toHaveBeenCalled();

            savePreferences.mockRestore();
        });

        it('opens the file picker from the + menu', async () => {
            const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            const input = document.querySelector('input.file-attachment-menu-item-input');
            expect(input).toBeInTheDocument();
            expect(input?.closest('[hidden]')).toBeNull();

            const clicksBefore = clickSpy.mock.calls.length;
            await openMenu();
            await userEvent.click(screen.getByRole('menuitem', {name: 'Attach files'}));

            expect(clickSpy.mock.calls.length).toBeGreaterThan(clicksBefore);

            clickSpy.mockRestore();
        });

        it('inserts an emoji chosen from the + menu', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            await openMenu();
            await userEvent.click(screen.getByRole('menuitem', {name: 'Emoji'}));
            await waitFor(() => {
                expect(screen.getByRole('button', {name: 'blush emoji'})).toBeInTheDocument();
            });
            await userEvent.click(screen.getByRole('button', {name: 'blush emoji'}));

            expect(screen.getByTestId('post_textbox')).toHaveValue('\uD83D\uDE0A ');
        });

        it('keeps markdown shortcuts working while the formatting bar is closed', async () => {
            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                chromeState,
            );

            const textbox = screen.getByTestId('post_textbox') as HTMLTextAreaElement;
            await userEvent.type(textbox, 'hello');
            textbox.setSelectionRange(0, 5);
            fireEvent.keyDown(textbox, {key: 'b', keyCode: 66, ctrlKey: true});

            expect(textbox).toHaveValue('**hello**');
            expect(screen.queryByTestId('formattingBarContainer')).not.toBeInTheDocument();
        });

        it('keeps the rich text editor and starts with its formatting bar closed', () => {
            const rect = () => ({top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}}) as DOMRect;
            const originalRects = Range.prototype.getClientRects;
            const originalRect = Range.prototype.getBoundingClientRect;
            Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
            Range.prototype.getBoundingClientRect = rect;

            renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                mergeObjects(chromeState, {
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

            expect(document.querySelector('.ProseMirror')).toBeInTheDocument();
            expect(screen.queryByTestId('formattingBarContainer')).not.toBeInTheDocument();
            expect(screen.getByTestId('SendMessageButton')).toBeInTheDocument();

            Range.prototype.getClientRects = originalRects;
            Range.prototype.getBoundingClientRect = originalRect;
        });

        it('opens the link popover from the keyboard while the formatting bar stays closed', () => {
            const rect = () => ({top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}}) as DOMRect;
            const originalRects = Range.prototype.getClientRects;
            const originalRect = Range.prototype.getBoundingClientRect;
            Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
            Range.prototype.getBoundingClientRect = rect;

            const {rerender} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                />,
                mergeObjects(chromeState, {
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

            const editor = document.querySelector('.ProseMirror');
            expect(editor).toBeInTheDocument();
            fireEvent.keyDown(editor!, {key: 'k', keyCode: 75, ctrlKey: true, altKey: true});

            expect(screen.getByPlaceholderText('Type or paste a link')).toBeInTheDocument();
            expect(screen.queryByTestId('formattingBarContainer')).not.toBeInTheDocument();

            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                    channelId={otherChannelId}
                />,
            );

            expect(screen.queryByPlaceholderText('Type or paste a link')).not.toBeInTheDocument();

            Range.prototype.getClientRects = originalRects;
            Range.prototype.getBoundingClientRect = originalRect;
        });

        it('lets a plugin replace send, and ignores that slot when the mode is off', () => {
            const renderSendButton = () => <button type='button'>{'Stop generating'}</button>;

            const {rerender} = renderWithContext(
                <AdvancedTextEditor
                    {...baseProps}
                    agentMode={true}
                    renderSendButton={renderSendButton}
                />,
                chromeState,
            );

            expect(screen.getByRole('button', {name: 'Stop generating'})).toBeInTheDocument();
            expect(screen.queryByTestId('SendMessageButton')).not.toBeInTheDocument();

            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    renderSendButton={renderSendButton}
                />,
            );

            expect(screen.getByTestId('SendMessageButton')).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Stop generating'})).not.toBeInTheDocument();
        });
    });
});
