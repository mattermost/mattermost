// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {screen} from '@testing-library/react';
import {renderWithRealStore, userEvent} from 'tests/react_testing_utils';
import {WebSocketContext} from 'utils/use_websocket';
import WebSocketClient from 'client/web_websocket_client';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import Permissions from 'mattermost-redux/constants/permissions';
import UnifiedTextEditorForm from './unified_text_editor_form';
import {Channel} from '@mattermost/types/channels';
import {PostDraft} from 'types/store/draft';
import Textbox from 'components/textbox/textbox';
import {FileUpload} from 'components/file_upload/file_upload';

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
    canPost: true,
    currentUserId,
    draft: emptyDraft,
    emitTypingEvent: jest.fn(),
    errorClass: null,
    fileUploadRef: React.createRef<FileUpload>(),
    focusTextbox: jest.fn(),
    handleBlur: jest.fn(),
    handleChange: jest.fn(),
    handleEmojiClick: jest.fn(),
    handleFileUploadChange: jest.fn(),
    handleFileUploadComplete: jest.fn(),
    handleGifClick: jest.fn(),
    handleMouseUpKeyUp: jest.fn(),
    handlePostError: jest.fn(),
    handleSubmit: jest.fn(),
    handleUploadError: jest.fn(),
    handleUploadStart: jest.fn(),
    hideEmojiPicker: jest.fn(),
    isFormattingBarHidden: false,
    loadNextMessage: jest.fn(),
    loadPrevMessage: jest.fn(),
    location: 'CENTER',
    message: '',
    onEditLatestPost: jest.fn(),
    onMessageChange: jest.fn(),
    removePreview: jest.fn(),
    saveDraft: jest.fn(),
    serverError: null,
    setShowPreview: jest.fn(),
    shouldShowPreview: false,
    showEmojiPicker: false,
    textEditorChannel: {id: channelId} as Channel,
    textboxRef: React.createRef<Textbox>(),
    toggleAdvanceTextEditor: jest.fn(),
    toggleEmojiPicker: jest.fn(),
    caretPosition: 0,
};

describe('components/avanced_text_editor/unified_text_editor_form', () => {
    it('emoji picker should not be rendered if not EnableEmojiPicker', () => {
        renderWithRealStore(
            <WebSocketContext.Provider value={WebSocketClient}>
                <UnifiedTextEditorForm {...baseProps}/>
            </WebSocketContext.Provider>, mergeObjects(initialState, {
                entities: {
                    general: {
                        config: {
                            EnableEmojiPicker: 'false',
                        },
                    },
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.CREATE_POST]},
                        },
                    },
                },
            }));

        expect(screen.queryByLabelText('emoji picker')).toBeNull();
    });

    it('Enter should call handleSubmit', () => {
        const handleSubmit = jest.fn();
        renderWithRealStore(
            <WebSocketContext.Provider value={WebSocketClient}>
                <UnifiedTextEditorForm
                    {...baseProps}
                    handleSubmit={handleSubmit}
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
        expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('Ctrl+up should call loadPrevMessage', () => {
        const loadPrevMessage = jest.fn();
        renderWithRealStore(
            <WebSocketContext.Provider value={WebSocketClient}>
                <UnifiedTextEditorForm
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
                <UnifiedTextEditorForm
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
});
