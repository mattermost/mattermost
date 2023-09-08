// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';

import type {FileUpload} from 'components/file_upload/file_upload';
import type Textbox from 'components/textbox/textbox';

import WebSocketClient from 'client/web_websocket_client';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithRealStore, userEvent} from 'tests/react_testing_utils';
import {WebSocketContext} from 'utils/use_websocket';

import type {PostDraft} from 'types/store/draft';

import AdavancedTextEditor from './advanced_text_editor';

global.ResizeObserver = require('resize-observer-polyfill');

const currentUserId = 'current_user_id';
const channelId = 'current_channel_id';

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
                current_channel_id: {
                    id: 'current_channel_id',
                    group_constrained: false,
                    team_id: 'current_team_id',
                    type: 'O',
                },
            },
            stats: {
                current_channel_id: {
                    member_count: 1,
                },
            },
            roles: {
                current_channel_id: new Set(['channel_roles']),
            },
            groupsAssociatedToChannel: {},
            channelMemberCountsByGroup: {
                current_channel_id: {},
            },
        },
        teams: {
            currentTeamId: 'current_team_id',
            teams: {
                current_team_id: {
                    id: 'current_team_id',
                    group_constrained: false,
                },
            },
            myMembers: {
                current_team_id: {
                    roles: 'team_roles',
                },
            },
            groupsAssociatedToTeam: {},
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {
                    id: 'current_user_id',
                    roles: 'user_roles',
                    locale: 'en',
                },
            },
            statuses: {
                current_user_id: 'online',
            },
        },
        roles: {
            roles: {
                user_roles: {permissions: []},
                channel_roles: {permissions: []},
                team_roles: {permissions: []},
            },
        },
        groups: {
            groups: {},
        },
        emojis: {
            customEmoji: {},
        },
        preferences: {
            myPreferences: {},
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
    postId: '',
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
        it('Enter should call postMsgKeyPress', () => {
            const postMsgKeyPress = jest.fn();
            renderWithRealStore(
                <WebSocketContext.Provider value={WebSocketClient}>
                    <AdavancedTextEditor
                        {...baseProps}
                        postMsgKeyPress={postMsgKeyPress}
                        message={'test'}
                    />
                </WebSocketContext.Provider>, mergeObjects(initialState, {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.CREATE_POST]},
                            },
                        },
                    },
                }));

            userEvent.type(screen.getByTestId('post_textbox'), '{enter}');
            expect(postMsgKeyPress).toHaveBeenCalledTimes(1);
        });

        it('Ctrl+up should call loadPrevMessage', () => {
            const loadPrevMessage = jest.fn();
            renderWithRealStore(
                <WebSocketContext.Provider value={WebSocketClient}>
                    <AdavancedTextEditor
                        {...baseProps}
                        loadPrevMessage={loadPrevMessage}
                    />
                </WebSocketContext.Provider>, mergeObjects(initialState, {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.CREATE_POST]},
                            },
                        },
                    },
                }));
            userEvent.type(screen.getByTestId('post_textbox'), '{ctrl}{arrowup}');
            expect(loadPrevMessage).toHaveBeenCalledTimes(1);
        });

        it('up should call onEditLatestPost', () => {
            const onEditLatestPost = jest.fn();
            renderWithRealStore(
                <WebSocketContext.Provider value={WebSocketClient}>
                    <AdavancedTextEditor
                        {...baseProps}
                        onEditLatestPost={onEditLatestPost}
                    />
                </WebSocketContext.Provider>, mergeObjects(initialState, {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.CREATE_POST]},
                            },
                        },
                    },
                }));
            userEvent.type(screen.getByTestId('post_textbox'), '{arrowup}');
            expect(onEditLatestPost).toHaveBeenCalledTimes(1);
        });

        it('ESC should blur the input', () => {
            renderWithRealStore(
                <WebSocketContext.Provider value={WebSocketClient}>
                    <AdavancedTextEditor
                        {...baseProps}
                    />
                </WebSocketContext.Provider>, mergeObjects(initialState, {
                    entities: {
                        roles: {
                            roles: {
                                user_roles: {permissions: [Permissions.CREATE_POST]},
                            },
                        },
                    },
                }));
            const textbox = screen.getByTestId('post_textbox');
            userEvent.type(textbox, 'something{esc}');
            expect(textbox).not.toHaveFocus();
        });

        describe('markdown', () => {
            const ttcc = [
                {
                    input: '{ctrl}b',
                    markdownMode: 'bold',
                },
                {
                    input: '{ctrl}i',
                    markdownMode: 'italic',
                },
                {
                    input: '{ctrl}k',
                    markdownMode: 'link',
                },
                {
                    input: '{ctrl}{alt}k',
                    markdownMode: 'link',
                },
            ];
            for (const tc of ttcc) {
                it(`component adds ${tc.markdownMode} markdown`, () => {
                    const applyMarkdown = jest.fn();
                    const message = 'Some markdown text';
                    const selectionStart = 5;
                    const selectionEnd = 10;

                    renderWithRealStore(
                        <WebSocketContext.Provider value={WebSocketClient}>
                            <AdavancedTextEditor
                                {...baseProps}
                                applyMarkdown={applyMarkdown}
                                message={'Some markdown text'}
                            />
                        </WebSocketContext.Provider>, mergeObjects(initialState, {
                            entities: {
                                roles: {
                                    roles: {
                                        user_roles: {permissions: [Permissions.CREATE_POST]},
                                    },
                                },
                            },
                        }));
                    const textbox = screen.getByTestId('post_textbox');
                    userEvent.type(textbox, tc.input, {initialSelectionStart: selectionStart, initialSelectionEnd: selectionEnd});
                    expect(applyMarkdown).toHaveBeenCalledWith({
                        markdownMode: tc.markdownMode,
                        selectionStart,
                        selectionEnd,
                        message,
                    });
                });
            }
        });
    });
});
