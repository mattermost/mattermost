// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';

import Constants, {ModalIdentifiers, StoragePrefixes} from 'utils/constants';

import AdvancedCreateComment from 'components/advanced_create_comment/advanced_create_comment';
import AdvancedCreateCommentWithStore from 'components/advanced_create_comment';
import {screen, waitFor} from '@testing-library/react';
import {renderWithRealStore, userEvent} from 'tests/react_testing_utils';
import {WebSocketContext} from 'utils/use_websocket';
import WebSocketClient from 'client/web_websocket_client';
import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import Permissions from 'mattermost-redux/constants/permissions';
import {setupServer} from 'msw/node';
import {rest} from 'msw';

global.ResizeObserver = require('resize-observer-polyfill');
jest.mock('utils/exec_commands', () => ({
    execCommandInsertText: jest.fn(),
}));

describe('components/AdvancedCreateComment', () => {
    jest.useFakeTimers();
    beforeEach(() => {
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 16));
    });

    afterEach(() => {
        window.requestAnimationFrame.mockRestore();
    });

    const channelId = 'g6139tbospd18cmxroesdk3kkc';
    const rootId = '';
    const latestPostId = '3498nv24823948v23m4nv34';
    const currentUserId = 'zaktnt8bpbgu8mb6ez9k64r7sa';
    const channel = {
        id: channelId,
    };

    const baseProps = {
        channelId,
        channel,
        currentUserId,
        rootId,
        rootDeleted: false,
        channelMembersCount: 3,
        draft: {
            message: 'Test message',
            uploadsInProgress: [{}],
            fileInfos: [{}, {}, {}],
        },
        isRemoteDraft: false,
        enableAddButton: true,
        ctrlSend: false,
        latestPostId,
        locale: 'en',
        clearCommentDraftUploads: jest.fn(),
        onUpdateCommentDraft: jest.fn(),
        onResetHistoryIndex: jest.fn(),
        moveHistoryIndexBack: jest.fn(),
        moveHistoryIndexForward: jest.fn(),
        onEditLatestPost: jest.fn(),
        resetCreatePostRequest: jest.fn(),
        setShowPreview: jest.fn(),
        shouldShowPreview: false,
        rhsExpanded: false,
        selectedPostFocussedAt: 0,
        canPost: true,
        isFormattingBarHidden: false,
        getChannelMemberCountsFromMessage: jest.fn(),
        handleSubmit: jest.fn().mockReturnValue({data: {}}),
        openModal: jest.fn(),
    };

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

    const emptyDraft = {
        message: '',
        uploadsInProgress: [],
        fileInfos: [],
    };

    test('on mount calls', () => {
        const clearCommentDraftUploads = jest.fn();
        const onResetHistoryIndex = jest.fn();
        const getChannelMemberCountsFromMessage = jest.fn();

        const props = {...baseProps, clearCommentDraftUploads, onResetHistoryIndex, getChannelMemberCountsFromMessage};

        shallow(
            <AdvancedCreateComment {...props}/>,
        );

        // should clear draft uploads on mount
        expect(clearCommentDraftUploads).toHaveBeenCalled();

        // should reset message history index on mount
        expect(onResetHistoryIndex).toHaveBeenCalled();

        // should load channel member counts on mount
        expect(getChannelMemberCountsFromMessage).toHaveBeenCalled();
    });

    test('should match snapshot, empty comment', () => {
        const draft = emptyDraft;
        const isRemoteDraft = false;
        const enableAddButton = false;
        const ctrlSend = true;
        const props = {...baseProps, draft, isRemoteDraft, enableAddButton, ctrlSend};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, comment with message', () => {
        const clearCommentDraftUploads = jest.fn();
        const onResetHistoryIndex = jest.fn();
        const getChannelMemberCountsFromMessage = jest.fn();
        const draft = {
            message: 'Test message',
            uploadsInProgress: [],
            fileInfos: [],
        };
        const isRemoteDraft = false;
        const ctrlSend = true;
        const props = {...baseProps, ctrlSend, draft, isRemoteDraft, clearCommentDraftUploads, onResetHistoryIndex, getChannelMemberCountsFromMessage};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, non-empty message and uploadsInProgress + fileInfos', () => {
        const draft = {
            message: 'Test message',
            uploadsInProgress: [{}],
            fileInfos: [{}, {}, {}],
        };

        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.setState({draft});
        expect(wrapper).toMatchSnapshot();
    });

    test('should correctly change state when toggleEmojiPicker is called', () => {
        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().toggleEmojiPicker();
        expect(wrapper.state().showEmojiPicker).toBe(true);

        wrapper.instance().toggleEmojiPicker();
        expect(wrapper.state().showEmojiPicker).toBe(false);
    });

    test('should correctly change state when hideEmojiPicker is called', () => {
        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().hideEmojiPicker();
        expect(wrapper.state().showEmojiPicker).toBe(false);
    });

    test('should correctly update draft when handleEmojiClick is called', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft = emptyDraft;
        const enableAddButton = false;
        const props = {...baseProps, draft, onUpdateCommentDraft, enableAddButton};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                getBoundingClientRect: jest.fn(mockTop),
                focus: jest.fn(),
            };
        };

        const mockTop = () => {
            return document.createElement('div');
        };

        wrapper.instance().textboxRef.current = {getInputBox: jest.fn(mockImpl), getBoundingClientRect: jest.fn(), focus: jest.fn()};

        wrapper.instance().handleEmojiClick({name: 'smile'});

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft).toHaveBeenCalled();

        // Empty message case
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({message: ':smile: '}),
        );
        expect(wrapper.state().draft.message).toBe(':smile: ');

        wrapper.setState({draft: {message: 'test', uploadsInProgress: [], fileInfos: []},
            caretPosition: 'test'.length, // cursor is at the end
        });
        wrapper.instance().handleEmojiClick({name: 'smile'});

        // Message with no space at the end
        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft.mock.calls[1][0]).toEqual(
            expect.objectContaining({message: 'test :smile:  '}),
        );
        expect(wrapper.state().draft.message).toBe('test :smile:  ');

        wrapper.setState({draft: {message: 'test ', uploadsInProgress: [], fileInfos: []},
            caretPosition: 'test '.length, // cursor is at the end
        });
        wrapper.instance().handleEmojiClick({name: 'smile'});

        // Message with space at the end
        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft.mock.calls[2][0]).toEqual(
            expect.objectContaining({message: 'test  :smile:  '}),
        );
        expect(wrapper.state().draft.message).toBe('test  :smile:  ');

        expect(wrapper.state().showEmojiPicker).toBe(false);
    });

    test('handlePostError should update state with the correct error', () => {
        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().handlePostError('test error 1');
        expect(wrapper.state().postError).toBe('test error 1');

        wrapper.instance().handlePostError('test error 2');
        expect(wrapper.state().postError).toBe('test error 2');
    });

    test('handleUploadError should update state with the correct error', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{}, {}, {}],
        };
        const props = {...baseProps, draft, onUpdateCommentDraft};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        const instance = wrapper.instance();

        const testError1 = 'test error 1';
        wrapper.setState({draft});
        instance.draftsForPost[props.rootId] = draft;
        instance.handleUploadError(testError1, 1, null, props.rootId);

        expect(onUpdateCommentDraft).toHaveBeenCalled();
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({uploadsInProgress: [2, 3]}),
        );
        expect(wrapper.state().serverError.message).toBe(testError1);
        expect(wrapper.state().draft.uploadsInProgress).toEqual([2, 3]);

        const testError2 = 'test error 2';
        instance.handleUploadError(testError2, '', null, props.rootId);

        // should not call onUpdateCommentDraft
        expect(onUpdateCommentDraft.mock.calls.length).toBe(1);
        expect(wrapper.state().serverError.message).toBe(testError2);
    });

    test('should call openModal when showPostDeletedModal is called', () => {
        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().showPostDeletedModal();

        expect(baseProps.openModal).toHaveBeenCalledTimes(1);
    });

    test('handleUploadStart should update comment draft correctly', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{}, {}, {}],
        };
        const props = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        const focusTextbox = jest.fn();
        wrapper.setState({draft});
        wrapper.instance().focusTextbox = focusTextbox;
        wrapper.instance().handleUploadStart([4, 5]);

        expect(onUpdateCommentDraft).toHaveBeenCalled();
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({uploadsInProgress: [1, 2, 3, 4, 5]}),
        );

        expect(wrapper.state().draft.uploadsInProgress === [1, 2, 3, 4, 5]);
        expect(focusTextbox).toHaveBeenCalled();
    });

    test('handleFileUploadComplete should update comment draft correctly', () => {
        const onUpdateCommentDraft = jest.fn();
        const fileInfos = [{id: '1', name: 'aaa', create_at: 100}, {id: '2', name: 'bbb', create_at: 200}];
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos,
        };
        const props = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        const instance = wrapper.instance();
        wrapper.setState({draft});
        instance.draftsForPost[props.rootId] = draft;

        const uploadCompleteFileInfo = [{id: '3', name: 'ccc', create_at: 300}];
        const expectedNewFileInfos = fileInfos.concat(uploadCompleteFileInfo);
        instance.handleFileUploadComplete(uploadCompleteFileInfo, [3], null, props.rootId);

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft).toHaveBeenCalled();
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({uploadsInProgress: [1, 2], fileInfos: expectedNewFileInfos}),
        );

        expect(wrapper.state().draft.uploadsInProgress).toEqual([1, 2]);
        expect(wrapper.state().draft.fileInfos).toEqual(expectedNewFileInfos);
    });

    test('should open PostDeletedModal when createPostErrorId === api.post.create_post.root_id.app_error', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{id: '1', name: 'aaa', create_at: 100}, {id: '2', name: 'bbb', create_at: 200}],
        };
        const props = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        wrapper.setProps({createPostErrorId: 'api.post.create_post.root_id.app_error'});

        expect(props.openModal).toHaveBeenCalledTimes(1);
        expect(props.openModal.mock.calls[0][0]).toMatchObject({
            modalId: ModalIdentifiers.POST_DELETED_MODAL,
        });
    });

    test('should open PostDeletedModal when message is submitted to deleted root', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{id: '1', name: 'aaa', create_at: 100}, {id: '2', name: 'bbb', create_at: 200}],
        };
        const props = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        wrapper.setProps({rootDeleted: true});
        wrapper.instance().handleSubmit({preventDefault: jest.fn()});

        expect(props.openModal).toHaveBeenCalledTimes(1);
        expect(props.openModal.mock.calls[0][0]).toMatchObject({
            modalId: ModalIdentifiers.POST_DELETED_MODAL,
        });
    });

    describe('focusTextbox', () => {
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{id: '1', name: 'aaa', create_at: 100}, {id: '2', name: 'bbb', create_at: 200}],
        };

        it('is called when rootId changes', () => {
            const props = {...baseProps, draft};
            const wrapper = shallow(
                <AdvancedCreateComment {...props}/>,
            );

            const focusTextbox = jest.fn();
            wrapper.instance().focusTextbox = focusTextbox;

            const newProps = {
                ...props,
                rootId: 'testid123',
            };

            // Note that setProps doesn't actually trigger componentDidUpdate
            wrapper.setProps(newProps);
            wrapper.instance().componentDidUpdate(props, newProps);
            expect(focusTextbox).toHaveBeenCalled();
        });

        it('is called when selectPostFocussedAt changes', () => {
            const props = {...baseProps, draft, selectedPostFocussedAt: 1000};
            const wrapper = shallow(
                <AdvancedCreateComment {...props}/>,
            );

            const focusTextbox = jest.fn();
            wrapper.instance().focusTextbox = focusTextbox;

            const newProps = {
                ...props,
                selectedPostFocussedAt: 2000,
            };

            // Note that setProps doesn't actually trigger componentDidUpdate
            wrapper.setProps(newProps);
            wrapper.instance().componentDidUpdate(props, props);
            expect(focusTextbox).toHaveBeenCalled();
        });

        it('is not called when rootId and selectPostFocussedAt have not changed', () => {
            const props = {...baseProps, draft, selectedPostFocussedAt: 1000};
            const wrapper = shallow(
                <AdvancedCreateComment {...props}/>,
            );

            const focusTextbox = jest.fn();
            wrapper.instance().focusTextbox = focusTextbox;
            wrapper.instance().handleBlur();

            // Note that setProps doesn't actually trigger componentDidUpdate
            wrapper.setProps(props);
            wrapper.instance().componentDidUpdate(props, props);
            expect(focusTextbox).not.toHaveBeenCalled();
        });
    });

    test('handleChange should update comment draft correctly', () => {
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{}, {}, {}],
        };
        const scrollToBottom = jest.fn();
        const props = {...baseProps, draft, scrollToBottom};

        const wrapper = shallow(
            <AdvancedCreateComment
                {...props}
            />,
        );

        const testMessage = 'new msg';
        wrapper.instance().handleChange({target: {value: testMessage}});

        expect(baseProps.onUpdateCommentDraft).toHaveBeenCalled();
        expect(baseProps.onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({message: testMessage}),
        );
        expect(baseProps.onUpdateCommentDraft.mock.calls[0][2]).toBeFalsy();
        expect(wrapper.state().draft.message).toBe(testMessage);
        expect(scrollToBottom).toHaveBeenCalled();
    });

    it('handleChange should throw away invalid command error if user resumes typing', async () => {
        const onUpdateCommentDraft = jest.fn();

        const error = new Error('No command found');
        error.server_error_id = 'api.command.execute_command.not_found.app_error';
        const handleSubmit = jest.fn(() => ({error}));

        const draft = {
            message: '/fakecommand other text',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{}, {}, {}],
        };
        const props = {...baseProps, onUpdateCommentDraft, draft, handleSubmit};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        await wrapper.instance().handleSubmit({preventDefault: jest.fn()});

        let call = handleSubmit.mock.calls[0];
        expect(call[0]).toEqual({
            message: '/fakecommand other text',
            uploadsInProgress: [],
            fileInfos: [{}, {}, {}],
        });
        expect(call[3]).toBeFalsy();

        wrapper.instance().handleChange({
            target: {value: 'some valid text'},
        });

        wrapper.instance().handleSubmit({preventDefault: jest.fn()});

        call = handleSubmit.mock.calls[1];
        expect(call[0]).toEqual({
            message: 'some valid text',
            uploadsInProgress: [],
            fileInfos: [{}, {}, {}],
        });
        expect(call[3]).toBeFalsy();
    });

    test('should scroll to bottom when uploadsInProgress increase', () => {
        const draft = {
            message: 'Test message',
            uploadsInProgress: [1, 2, 3],
            fileInfos: [{}, {}, {}],
        };
        const scrollToBottom = jest.fn();
        const props = {...baseProps, draft, scrollToBottom};

        const wrapper = shallow(
            <AdvancedCreateComment
                {...props}
            />,
        );

        wrapper.setState({draft: {...draft, uploadsInProgress: [1, 2, 3, 4]}});
        expect(scrollToBottom).toHaveBeenCalled();
    });

    test('handleSubmit should call handleSubmit prop', () => {
        const handleSubmit = jest.fn(() => ({data: true}));
        const draft = {
            message: 'Test message',
            uploadsInProgress: [],
            fileInfos: [{}, {}, {}],
        };
        const props = {...baseProps, draft, handleSubmit};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        const preventDefault = jest.fn();
        wrapper.instance().handleSubmit({preventDefault});
        expect(handleSubmit).toHaveBeenCalled();
        expect(preventDefault).toHaveBeenCalled();
    });

    it('should update state if invalid slash command error occurs', async () => {
        const server = setupServer(
            rest.post('/api/v4/commands/execute', (req, res, ctx) => {
                return res(
                    ctx.status(404),
                    ctx.json({id: 'api.command.execute_command.not_found.app_error', message: 'Command not found'}),
                );
            }),
        );
        server.listen({
            onUnhandledRequest: (...args) => {
                console.log('unhandled', args);
            },
        });
        const currentChannelId = 'current_channel_id';
        const currentRootId = 'rootId';
        const draft = {
            uploadsInProgress: [],
            fileInfos: [],
            message: '/some command with arguments',
            rootId: currentRootId,
            channelId: currentChannelId,
        };

        const props = {

            // For redux
            rootId: currentRootId,
            channelId: currentChannelId,

            // For component
            rootDeleted: false,
        };

        const draftKey = `${StoragePrefixes.COMMENT_DRAFT}${draft.rootId}`;
        renderWithRealStore(
            <WebSocketContext.Provider value={WebSocketClient}>
                <AdvancedCreateCommentWithStore {...props}/>
            </WebSocketContext.Provider>, mergeObjects(initialState, {
                entities: {
                    roles: {
                        roles: {
                            user_roles: {permissions: [Permissions.CREATE_POST]},
                        },
                    },
                },
                storage: {
                    storage: {
                        [draftKey]: {
                            value: draft,
                        },
                    },
                },
            }));

        expect(screen.getByTestId('reply_textbox')).toHaveTextContent(draft.message);
        expect(screen.getByTestId('SendMessageButton')).toBeInTheDocument();
        await userEvent.click(screen.getByTestId('SendMessageButton'));

        // Should show the error
        await waitFor(() => expect(screen.getByTestId('error_container')).toHaveTextContent('Command with a trigger of \'/some\' not found. Click here to send as a message.'));

        // Should keep the message in the draft
        await waitFor(() => expect(screen.getByTestId('reply_textbox')).toHaveTextContent(draft.message));

        server.close();
    });

    test('removePreview should remove file info and upload in progress with corresponding id', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft = {
            message: 'Test message',
            uploadsInProgress: [4, 5, 6],
            fileInfos: [{id: 1}, {id: 2}, {id: 3}],
        };
        const props = {...baseProps, draft, onUpdateCommentDraft};

        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        wrapper.setState({draft});

        wrapper.instance().removePreview(3);

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft).toHaveBeenCalled();
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({fileInfos: [{id: 1}, {id: 2}]}),
        );
        expect(wrapper.state().draft.fileInfos).toEqual([{id: 1}, {id: 2}]);

        wrapper.instance().removePreview(5);

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft.mock.calls[1][0]).toEqual(
            expect.objectContaining({uploadsInProgress: [4, 6]}),
        );
        expect(wrapper.state().draft.uploadsInProgress).toEqual([4, 6]);
    });

    test('should match draft state on componentWillReceiveProps with change in messageInHistory', () => {
        const draft = {
            message: 'Test message',
            uploadsInProgress: [],
            fileInfos: [{}, {}, {}],
        };

        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );
        expect(wrapper.state('draft')).toEqual(draft);

        const newDraft = {...draft, message: 'Test message edited'};
        wrapper.setProps({draft: newDraft, messageInHistory: 'Test message edited'});
        expect(wrapper.state('draft')).toEqual(newDraft);
    });

    test('should match draft state on componentWillReceiveProps with new rootId', () => {
        const draft = {
            message: 'Test message',
            uploadsInProgress: [4, 5, 6],
            fileInfos: [{id: 1}, {id: 2}, {id: 3}],
        };

        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );
        wrapper.setState({draft});
        expect(wrapper.state('draft')).toEqual(draft);

        wrapper.setProps({rootId: 'new_root_id'});
        expect(wrapper.state('draft')).toEqual({...draft, uploadsInProgress: [], fileInfos: [{}, {}, {}]});
    });

    test('should match snapshot when cannot post', () => {
        const props = {...baseProps, canPost: false};
        const wrapper = shallow(
            <AdvancedCreateComment {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('check for handleFileUploadChange callback for focus', () => {
        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );
        const instance = wrapper.instance();
        instance.focusTextbox = jest.fn();

        instance.handleFileUploadChange();
        expect(instance.focusTextbox).toHaveBeenCalledTimes(1);
    });

    test('should the RHS thread scroll to bottom one time after mount when props.draft.message is not empty', () => {
        const draft = emptyDraft;
        const scrollToBottom = jest.fn();
        const wrapper = shallow(
            <AdvancedCreateComment
                {...baseProps}
                scrollToBottom={scrollToBottom}
            />,
        );

        expect(scrollToBottom).toBeCalledTimes(0);
        expect(wrapper.instance().doInitialScrollToBottom).toEqual(true);

        // should scroll to bottom on first component update
        wrapper.setState({draft: {...draft, message: 'new message'}});
        expect(scrollToBottom).toBeCalledTimes(1);
        expect(wrapper.instance().doInitialScrollToBottom).toEqual(false);

        // but not after the first update
        wrapper.setState({draft: {...draft, message: 'another message'}});
        expect(scrollToBottom).toBeCalledTimes(1);
        expect(wrapper.instance().doInitialScrollToBottom).toEqual(false);
    });

    test('should the RHS thread scroll to bottom when state.draft.uploadsInProgress increases but not when it decreases', () => {
        const draft = emptyDraft;
        const scrollToBottom = jest.fn();
        const wrapper = shallow(
            <AdvancedCreateComment
                {...baseProps}
                draft={draft}
                scrollToBottom={scrollToBottom}
            />,
        );

        expect(scrollToBottom).toBeCalledTimes(0);

        wrapper.setState({draft: {...draft, uploadsInProgress: [1]}});
        expect(scrollToBottom).toBeCalledTimes(1);

        wrapper.setState({draft: {...draft, uploadsInProgress: [1, 2]}});
        expect(scrollToBottom).toBeCalledTimes(2);

        wrapper.setState({draft: {...draft, uploadsInProgress: [2]}});
        expect(scrollToBottom).toBeCalledTimes(2);
    });

    test('should show preview and edit mode, and return focus on preview disable', () => {
        const wrapper = shallow(
            <AdvancedCreateComment {...baseProps}/>,
        );
        const instance = wrapper.instance();
        instance.focusTextbox = jest.fn();
        expect(instance.focusTextbox).not.toBeCalled();

        instance.setShowPreview(true);

        expect(baseProps.setShowPreview).toHaveBeenCalledWith(true);
        expect(instance.focusTextbox).not.toBeCalled();

        wrapper.setProps({shouldShowPreview: true});
        expect(instance.focusTextbox).not.toBeCalled();
        wrapper.setProps({shouldShowPreview: false});
        expect(instance.focusTextbox).toBeCalled();
    });

    testComponentForLineBreak((value) => (
        <AdvancedCreateComment
            {...baseProps}
            draft={{
                ...baseProps.draft,
                message: value,
            }}
            ctrlSend={true}
        />
    ), (instance) => instance.state().draft.message, false);

    // testComponentForMarkdownHotkeys(
    //     (value) => (
    //         <AdvancedCreateComment
    //             {...baseProps}
    //             draft={{
    //                 ...baseProps.draft,
    //                 message: value,
    //             }}
    //             ctrlSend={true}
    //         />
    //     ),
    //     (wrapper, setSelectionRangeFn) => {
    //         const mockTop = () => {
    //             return document.createElement('div');
    //         };
    //         wrapper.instance().textboxRef = {
    //             current: {
    //                 getInputBox: jest.fn(() => {
    //                     return {
    //                         focus: jest.fn(),
    //                         getBoundingClientRect: jest.fn(mockTop),
    //                         setSelectionRange: setSelectionRangeFn,
    //                     };
    //                 }),
    //             },
    //         };
    //     },
    //     (instance) => instance.find(AdvanceTextEditor),
    //     (instance) => instance.state().draft.message,
    //     false,
    //     'reply_textbox',
    // );

    // it('should blur when ESCAPE is pressed', () => {
    //     const wrapper = shallow(
    //         <AdvancedCreateComment
    //             {...baseProps}
    //         />,
    //     );
    //     const instance = wrapper.instance();
    //     const blur = jest.fn();

    //     const mockImpl = () => {
    //         return {
    //             blur: jest.fn(),
    //             focus: jest.fn(),
    //         };
    //     };

    //     instance.textboxRef.current = {blur, getInputBox: jest.fn(mockImpl)};

    //     const mockTarget = {
    //         selectionStart: 0,
    //         selectionEnd: 0,
    //         value: 'brown\nfox jumps over lazy dog',
    //     };

    //     const commentEscapeKey = {
    //         preventDefault: jest.fn(),
    //         ctrlKey: true,
    //         key: Constants.KeyCodes.ESCAPE[0],
    //         keyCode: Constants.KeyCodes.ESCAPE[1],
    //         target: mockTarget,
    //     };

    //     instance.handleKeyDown(commentEscapeKey);
    //     expect(blur).toHaveBeenCalledTimes(1);
    // });
});
