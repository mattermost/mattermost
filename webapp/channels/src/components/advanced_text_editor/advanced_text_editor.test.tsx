// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';

import {removeDraft, updateDraft} from 'actions/views/drafts';

import type {FileUpload} from 'components/file_upload/file_upload';
import type Textbox from 'components/textbox/textbox';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, userEvent, screen} from 'tests/react_testing_utils';
import {Locations, StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {PostDraft} from 'types/store/draft';

import AdvancedTextEditor from './advanced_text_editor';
import type {Props} from './advanced_text_editor';

jest.mock('actions/views/drafts', () => ({
    ...jest.requireActual('actions/views/drafts'),
    updateDraft: jest.fn((...args) => ({type: 'MOCK_UPDATE_DRAFT', args})),
    removeDraft: jest.fn((...args) => ({type: 'MOCK_REMOVE_DRAFT', args})),
}));

const mockedRemoveDraft = jest.mocked(removeDraft);
const mockedUpdateDraft = jest.mocked(updateDraft);

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
    caretPosition: 0,
};

describe('components/avanced_text_editor/advanced_text_editor', () => {
    describe('keyDown behavior', () => {
        it('ESC should blur the input', () => {
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
            userEvent.type(textbox, 'something{esc}');
            expect(textbox).not.toHaveFocus();
        });
    });

    it('should set the textbox value to an existing draft on mount and when changing channels', () => {
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

    it('should save a new draft when changing channels', () => {
        const {rerender} = renderWithContext(
            <AdvancedTextEditor
                {...baseProps}
            />,
            initialState,
        );

        userEvent.type(screen.getByPlaceholderText('Write to Test Channel'), 'some text');

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

    it('MM-60541 should not save an unmodified draft when changing channels', () => {
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

    it('should save an updated draft when changing channels', () => {
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

        userEvent.type(screen.getByPlaceholderText('Write to Test Channel'), ' plus some new text');

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

    it('should deleted a deleted draft when changing channels', () => {
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

        userEvent.clear(screen.getByPlaceholderText('Write to Test Channel'));

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

    it('MM-60541 should not attempt to delete a non-existent draft when changing channels', () => {
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
});
