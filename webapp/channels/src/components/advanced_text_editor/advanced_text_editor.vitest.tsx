// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';

import {removeDraft, updateDraft} from 'actions/views/drafts';

import type {FileUpload} from 'components/file_upload/file_upload';
import type Textbox from 'components/textbox/textbox';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, fireEvent, act, waitFor} from 'tests/vitest_react_testing_utils';
import Constants, {Locations, StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {PostDraft} from 'types/store/draft';

import AdvancedTextEditor from './advanced_text_editor';
import type {Props} from './advanced_text_editor';

vi.mock('actions/views/drafts', async () => {
    const actual = await vi.importActual('actions/views/drafts');
    return {
        ...actual,
        updateDraft: vi.fn((...args) => ({type: 'MOCK_UPDATE_DRAFT', args})),
        removeDraft: vi.fn((...args) => ({type: 'MOCK_REMOVE_DRAFT', args})),
    };
});

const mockedRemoveDraft = vi.mocked(removeDraft);
const mockedUpdateDraft = vi.mocked(updateDraft);

beforeEach(() => {
    vi.clearAllMocks();
});

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
    currentChannel: initialState.entities.channels.channels.current_channel_id as Channel,
    channelId,
    rootId: '',
    errorClass: null,
    serverError: null,
    postError: null,
    isFormattingBarHidden: false,
    draft: emptyDraft,
    badConnection: false,
    handleSubmit: vi.fn(),
    removePreview: vi.fn(),
    showSendTutorialTip: false,
    setShowPreview: vi.fn(),
    shouldShowPreview: false,
    maxPostSize: 100,
    canPost: true,
    applyMarkdown: vi.fn(),
    useChannelMentions: false,
    currentChannelTeammateUsername: '',
    currentUserId,
    canUploadFiles: true,
    enableEmojiPicker: true,
    enableGifPicker: true,
    handleBlur: vi.fn(),
    handlePostError: vi.fn(),
    emitTypingEvent: vi.fn(),
    handleMouseUpKeyUp: vi.fn(),
    postMsgKeyPress: vi.fn(),
    handleChange: vi.fn(),
    toggleEmojiPicker: vi.fn(),
    handleGifClick: vi.fn(),
    handleEmojiClick: vi.fn(),
    hideEmojiPicker: vi.fn(),
    toggleAdvanceTextEditor: vi.fn(),
    handleUploadProgress: vi.fn(),
    handleUploadError: vi.fn(),
    handleFileUploadComplete: vi.fn(),
    handleUploadStart: vi.fn(),
    handleFileUploadChange: vi.fn(),
    getFileUploadTarget: vi.fn(),
    fileUploadRef: React.createRef<FileUpload>(),
    prefillMessage: vi.fn(),
    textboxRef: React.createRef<Textbox>(),
    isThreadView: false,
    ctrlSend: true,
    codeBlockOnCtrlEnter: true,
    onMessageChange: vi.fn(),
    onEditLatestPost: vi.fn(),
    loadPrevMessage: vi.fn(),
    loadNextMessage: vi.fn(),
    replyToLastPost: vi.fn(),
    caretPosition: 0,
};

describe('components/avanced_text_editor/advanced_text_editor', () => {
    describe('keyDown behavior', () => {
        it('ESC should blur the input', async () => {
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

            // Focus and simulate typing something then pressing Escape
            await act(async () => {
                textbox.focus();
                fireEvent.input(textbox, {target: {value: 'something'}});
            });

            // Use bubbles: true to ensure event propagates to parent handlers
            await act(async () => {
                fireEvent.keyDown(textbox, {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true});
            });

            expect(textbox).not.toHaveFocus();
            expect(mockedUpdateDraft).not.toHaveBeenCalled();
        });

        it('ESC should blur the input and reset draft when in editing mode', async () => {
            vi.useFakeTimers();
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

            // Focus and simulate typing something then pressing Escape
            await act(async () => {
                textbox.focus();
                fireEvent.input(textbox, {target: {value: 'something'}});
                fireEvent.keyDown(textbox, {key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true});
            });

            expect(textbox).not.toHaveFocus();

            // save is called with a short delayed after pressing escape key
            await act(async () => {
                vi.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT + 50);
            });
            expect(mockedRemoveDraft).toHaveBeenCalled();
            expect(mockedUpdateDraft).not.toHaveBeenCalled();

            vi.useRealTimers();
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

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Write to Test Channel')).toHaveValue('original draft');
        });

        await act(async () => {
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
        });

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Write to Other Channel')).toHaveValue('a different draft');
        });
    });

    it('should save a new draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            initialState,
        );

        const textbox = screen.getByPlaceholderText('Write to Test Channel');
        await act(async () => {
            fireEvent.input(textbox, {target: {value: 'some text'}});
        });

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        await act(async () => {
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
        });

        await waitFor(() => {
            expect(mockedUpdateDraft).toHaveBeenCalled();
        });
        expect(mockedUpdateDraft.mock.calls[0][1]).toMatchObject({
            message: 'some text',
            show: true,
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

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Write to Test Channel')).toBeInTheDocument();
        });

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        await act(async () => {
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
        });

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

        const textbox = screen.getByPlaceholderText('Write to Test Channel');
        await act(async () => {
            fireEvent.input(textbox, {target: {value: 'original draft plus some new text'}});
        });

        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        await act(async () => {
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
        });

        await waitFor(() => {
            expect(mockedUpdateDraft).toHaveBeenCalled();
        });
        expect(mockedUpdateDraft.mock.calls[0][1]).toMatchObject({
            message: 'original draft plus some new text',
            show: true,
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

        const textbox = screen.getByPlaceholderText('Write to Test Channel');
        await act(async () => {
            fireEvent.input(textbox, {target: {value: ''}});
        });

        expect(mockedRemoveDraft).not.toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        await act(async () => {
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
        });

        await waitFor(() => {
            expect(mockedRemoveDraft).toHaveBeenCalled();
        });
        expect(mockedUpdateDraft).not.toHaveBeenCalled();
    });

    it('MM-60541 should not attempt to delete a non-existent draft when changing channels', async () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Write to Test Channel')).toBeInTheDocument();
        });

        expect(mockedRemoveDraft).not.toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();

        await act(async () => {
            rerender(
                <AdvancedTextEditor
                    {...baseProps}
                    channelId={otherChannelId}
                />,
            );
        });

        expect(mockedRemoveDraft).not.toHaveBeenCalled();
        expect(mockedUpdateDraft).not.toHaveBeenCalled();
    });

    it('should show @mention warning when a mention exists in the message', async () => {
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

        await waitFor(() => {
            expect(screen.getByText('Editing this message with an \'@mention\' will not notify the recipient.')).toBeVisible();
        });
    });

    it('should have file upload overlay', async () => {
        const props: Props = {
            ...baseProps,
        };

        const {container, rerender} = renderWithContext(
            <AdvancedTextEditor
                {...props}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('#createPostFileDropOverlay')).toBeVisible();
        });

        props.rootId = 'post_id_1';
        await act(async () => {
            rerender(<AdvancedTextEditor {...props}/>);
        });
        expect(container.querySelector('#createCommentFileDropOverlay')).toBeVisible();

        // in center channel editing a post
        props.isInEditMode = true;
        await act(async () => {
            rerender(<AdvancedTextEditor {...props}/>);
        });
        expect(container.querySelector('#editPostFileDropOverlay')).toBeVisible();

        // in RHS editing a post
        props.location = Locations.RHS_COMMENT;
        await act(async () => {
            rerender(<AdvancedTextEditor {...props}/>);
        });
        expect(container.querySelector('#editPostFileDropOverlay')).toBeVisible();

        // in threads
        props.isThreadView = true;
        await act(async () => {
            rerender(<AdvancedTextEditor {...props}/>);
        });
        expect(container.querySelector('#editPostFileDropOverlay')).toBeVisible();
    });
});
