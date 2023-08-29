// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {PreferenceType} from '@mattermost/types/preferences';

import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';
import {testComponentForMarkdownHotkeys} from 'tests/helpers/markdown_hotkey_helpers.js';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {execCommandInsertText} from 'utils/exec_commands';

import AdvancedCreateComment from 'components/advanced_create_comment/advanced_create_comment';
import AdvanceTextEditor from 'components/advanced_text_editor/advanced_text_editor';
import {isEqual} from 'lodash';
import {Props} from 'components/advanced_create_comment/advanced_create_comment';
import {ActionResult} from 'mattermost-redux/types/actions';
import { PostDraft } from 'types/store/draft';
import { ChannelMemberCountsByGroup } from '@mattermost/types/channels';
import {ServerError} from '@mattermost/types/errors';
import { TestHelper } from 'utils/test_helper';
import { FileInfo } from '@mattermost/types/files';
import { getPostDraft } from 'selectors/rhs';
jest.mock('utils/exec_commands', () => ({
    execCommandInsertText: jest.fn(),
}));
 
describe('components/AdvancedCreateComment', () => {
    jest.useFakeTimers();
    let spy: jest.SpyInstance;
    beforeEach(() => {
        spy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 16));
    });

    afterEach(() => {
        spy.mockRestore();
    });

    const currentTeamId:string = 'current-team-id';
    const channelId:string = 'g6139tbospd18cmxroesdk3kkc';
    const rootId:string = '';
    const latestPostId:string = '3498nv24823948v23m4nv34';
    const currentUserId:string = 'zaktnt8bpbgu8mb6ez9k64r7sa';

    const emptyDraft:PostDraft = TestHelper.getPostDraftMock({message:""});
    const defaultFileInfo:FileInfo = TestHelper.getFileInfoMock()

    const baseProps: Props = {
        channelId,
        currentTeamId,
        currentUserId,
        rootId,
        rootDeleted: false,
        channelMembersCount: 3,
        draft: TestHelper.getPostDraftMock({
            fileInfos:[defaultFileInfo, defaultFileInfo, defaultFileInfo]
        }),
        isRemoteDraft: false,
        enableAddButton: true,
        ctrlSend: false,
        latestPostId,
        locale: 'en',
        clearCommentDraftUploads: jest.fn(),
        onUpdateCommentDraft: jest.fn(),
        updateCommentDraftWithRootId: jest.fn(),
        onSubmit: jest.fn(),
        onResetHistoryIndex: jest.fn(),
        onMoveHistoryIndexBack: jest.fn(),
        onMoveHistoryIndexForward: jest.fn(),
        onEditLatestPost: jest.fn(),
        resetCreatePostRequest: jest.fn(),
        setShowPreview: jest.fn(),
        searchAssociatedGroupsForReference: jest.fn(),
        shouldShowPreview: false,
        enableEmojiPicker: true,
        enableGifPicker: true,
        enableConfirmNotificationsToChannel: true,
        maxPostSize: Constants.DEFAULT_CHARACTER_LIMIT,
        rhsExpanded: false,
        badConnection: false,
        getChannelTimezones: jest.fn((channelId:string) => Promise.resolve({data:"", error:""})),
        isTimezoneEnabled: false,
        selectedPostFocussedAt: 0,
        canPost: true,
        canUploadFiles: true,
        isFormattingBarHidden: false,
        useChannelMentions: true,
        getChannelMemberCountsByGroup: jest.fn(),
        useLDAPGroupMentions: true,
        useCustomGroupMentions: true,
        openModal: jest.fn(),
        postEditorActions: [],
        emitShortcutReactToLastPostFrom: function (location: string): void {
            throw new Error('Function not implemented.');
        },
        groupsWithAllowReference: null,
        channelMemberCountsByGroup: undefined as any,
        savePreferences: function (userId: string, preferences: PreferenceType[]): ActionResult {
            throw new Error('Function not implemented.');
        }
    };

   

    const submitEvent = {
        preventDefault: jest.fn(),
    } as unknown as React.FormEvent;

    test('should match snapshot, empty comment', () => {
        const draft: PostDraft = emptyDraft;
        const isRemoteDraft:boolean = false;
        const enableAddButton:boolean = false;
        const ctrlSend:boolean = true;
        const props: any = {...baseProps, draft, isRemoteDraft, enableAddButton, ctrlSend};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, comment with message', () => {
        const clearCommentDraftUploads = jest.fn();
        const onResetHistoryIndex = jest.fn();
        const getChannelMemberCountsByGroup = jest.fn();
        const draft: PostDraft = TestHelper.getPostDraftMock()
        const isRemoteDraft :boolean= false;
        const ctrlSend:boolean = true;
        const props: any = {...baseProps, ctrlSend, draft, isRemoteDraft, clearCommentDraftUploads, onResetHistoryIndex, getChannelMemberCountsByGroup};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        // should clear draft uploads on mount
        expect(clearCommentDraftUploads).toHaveBeenCalled();

        // should reset message history index on mount
        expect(onResetHistoryIndex).toHaveBeenCalled();

        // should load channel member counts on mount
        expect(getChannelMemberCountsByGroup).not.toHaveBeenCalled();

        expect(wrapper).toMatchSnapshot();
    });

    test('should call searchAssociatedGroupsForReference if there is one mention in the draft', () => {
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: '@group',
        });

        const searchAssociatedGroupsForReference:any = jest.fn();
        const props: any = {...baseProps, draft, searchAssociatedGroupsForReference};

        shallow(<AdvancedCreateComment {...props}/>);

        expect(searchAssociatedGroupsForReference).toHaveBeenCalled();
    }); 

    test('should call getChannelMemberCountsByGroup if there is more than one mention in the draft', () => {
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: '@group @othergroup',
           
        });
        const getChannelMemberCountsByGroup  = jest.fn();
        const props: any = {...baseProps, draft, getChannelMemberCountsByGroup};

        shallow(<AdvancedCreateComment {...props}/>);

        expect(getChannelMemberCountsByGroup).toHaveBeenCalled();
    });

    test('should not call getChannelMemberCountsByGroup, without group mentions permission or license', () => {
        const useLDAPGroupMentions:boolean = false;
        const useCustomGroupMentions:boolean = false;
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: '@group @othergroup',
           
        });

        const getChannelMemberCountsByGroup = jest.fn();
        const props: any = {...baseProps, useLDAPGroupMentions, useCustomGroupMentions, getChannelMemberCountsByGroup, draft};

        shallow<AdvancedCreateComment>(<AdvancedCreateComment {...props}/>);

        // should not load channel member counts on mount without useGroupmentions
        expect(getChannelMemberCountsByGroup).not.toHaveBeenCalled();
    });

    test('should match snapshot, non-empty message and uploadsInProgress + fileInfos', () => {
        const draft: PostDraft = TestHelper.getPostDraftMock();

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.setState({draft});
        expect(wrapper).toMatchSnapshot();
    });

    test('should correctly change state when toggleEmojiPicker is called', () => {
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().toggleEmojiPicker();
        expect(wrapper.state().showEmojiPicker).toBe(true);

        wrapper.instance().toggleEmojiPicker();
        expect(wrapper.state().showEmojiPicker).toBe(false);
    });

    test('should correctly change state when hideEmojiPicker is called', () => {
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().hideEmojiPicker();
        expect(wrapper.state().showEmojiPicker).toBe(false);
    });

    test('should correctly update draft when handleEmojiClick is called', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft: PostDraft = emptyDraft;
        const enableAddButton:boolean = false;
        const props: any = {...baseProps, draft, onUpdateCommentDraft, enableAddButton};

        const wrapper = shallow<AdvancedCreateComment>(
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

        (wrapper.instance() as any).textboxRef.current = {getInputBox: jest.fn(mockImpl), getBoundingClientRect: jest.fn(), focus: jest.fn()};
       
        wrapper.instance().handleEmojiClick({name: 'smile'} as any);

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft).toHaveBeenCalled();

        // Empty message case
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({message: ':smile: '}),
        );
        expect(wrapper.state().draft!.message).toBe(':smile: ');

        wrapper.setState({draft: TestHelper.getPostDraftMock({message: 'test', uploadsInProgress: [], fileInfos: []}),
            caretPosition: 'test'.length, // cursor is at the end
        });
        wrapper.instance().handleEmojiClick({name: 'smile'} as any);

        // Message with no space at the end
        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft.mock.calls[1][0]).toEqual(
            expect.objectContaining({message: 'test :smile:  '}),
        );
        expect(wrapper.state().draft!.message).toBe('test :smile:  ');

        wrapper.setState({draft: TestHelper.getPostDraftMock({message: 'test ', uploadsInProgress: [], fileInfos: []}),
            caretPosition: 'test '.length, // cursor is at the end
        });
        wrapper.instance().handleEmojiClick({name: 'smile'} as any);

        // Message with space at the end
        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft.mock.calls[2][0]).toEqual(
            expect.objectContaining({message: 'test  :smile:  '}),
        );
        expect(wrapper.state().draft!.message).toBe('test  :smile:  ');

        expect(wrapper.state().showEmojiPicker).toBe(false);
    });

    test('handlePostError should update state with the correct error', () => {
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().handlePostError('test error 1');
        expect(wrapper.state().postError).toBe('test error 1');

        wrapper.instance().handlePostError('test error 2');
        expect(wrapper.state().postError).toBe('test error 2');
    });

    // debug next
    test('handleUploadError should update state with the correct error', () => {
        const updateCommentDraftWithRootId = jest.fn();
        const fileInfoObject:FileInfo = TestHelper.getFileInfoMock()
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: 'Test message',
            uploadsInProgress: ['1', '2', '3'],
            fileInfos:[fileInfoObject,fileInfoObject,fileInfoObject],
        });
        const props: any = {...baseProps, draft, updateCommentDraftWithRootId};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        const instance = wrapper.instance();

        const testError1 = 'test error 1';
        wrapper.setState({draft});
        instance.draftsForPost[props.rootId] = draft;
        instance.handleUploadError(testError1, '1', undefined, props.rootId);

        expect(updateCommentDraftWithRootId).toHaveBeenCalled();
        expect(updateCommentDraftWithRootId.mock.calls[0][0]).toEqual(props.rootId);
        expect(updateCommentDraftWithRootId.mock.calls[0][1]).toEqual(
            expect.objectContaining({uploadsInProgress: ['2', '3']}),
        );
        expect(wrapper.state().serverError!.message).toBe(testError1);
        expect(wrapper.state().draft!.uploadsInProgress).toEqual(['2', '3']);

        const testError2 = 'test error 2';
        instance.handleUploadError(testError2, '', undefined, props.rootId);

        // should not call onUpdateCommentDraft
        expect(updateCommentDraftWithRootId.mock.calls.length).toBe(1);
        expect(wrapper.state().serverError!.message).toBe(testError2);
    });

    test('should call openModal when showPostDeletedModal is called', () => {
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );

        wrapper.instance().showPostDeletedModal();

        expect(baseProps.openModal).toHaveBeenCalledTimes(1);
    });

    test('handleUploadStart should update comment draft correctly', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft:PostDraft = TestHelper.getPostDraftMock({
            uploadsInProgress:['1','2','3'],
            fileInfos:[TestHelper.getFileInfoMock(),TestHelper.getFileInfoMock(),TestHelper.getFileInfoMock()]
        })
       
        const props: any = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        const focusTextbox = jest.fn();
        wrapper.setState({draft});
        wrapper.instance().focusTextbox = focusTextbox;
        wrapper.instance().handleUploadStart(['4', '5']);

        expect(onUpdateCommentDraft).toHaveBeenCalled();
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({uploadsInProgress: ['1', '2', '3', '4', '5']}),
        );

        expect(wrapper.state().draft!.uploadsInProgress).toEqual(['1', '2', '3', '4', '5'])
        expect(focusTextbox).toHaveBeenCalled();
    });

    test('handleFileUploadComplete should update comment draft correctly', () => {
        const updateCommentDraftWithRootId: any = jest.fn();
        const fileInfos = [
            TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}), 
            TestHelper.getFileInfoMock({id: '2', name: 'bbb', create_at: 200})
        ];

        const draft: PostDraft = TestHelper.getPostDraftMock({
            uploadsInProgress: ['1', '2', '3'],
            fileInfos,
        });
        const props: any = {...baseProps, updateCommentDraftWithRootId, draft};

        const wrapper: any = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        const instance: any = wrapper.instance();
        wrapper.setState({draft});
        instance.draftsForPost[props.rootId] = draft;

        const uploadCompleteFileInfo: any = [{id: '3', name: 'ccc', create_at: 300}];
        const expectedNewFileInfos: any = fileInfos.concat(uploadCompleteFileInfo);
        instance.handleFileUploadComplete(uploadCompleteFileInfo, ['3'], null as any, props.rootId);

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(updateCommentDraftWithRootId).toHaveBeenCalled();
        expect(updateCommentDraftWithRootId.mock.calls[0][0]).toEqual(props.rootId);
        expect(updateCommentDraftWithRootId.mock.calls[0][1]).toEqual(
            expect.objectContaining({uploadsInProgress: ['1', '2'], fileInfos: expectedNewFileInfos}),
        );

        expect(wrapper.state().draft!.uploadsInProgress).toEqual(['1', '2']);
        expect(wrapper.state().draft!.fileInfos).toEqual(expectedNewFileInfos);
    });

    test('should open PostDeletedModal when createPostErrorId === api.post.create_post.root_id.app_error', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: 'Test message',
            uploadsInProgress: ['1', '2', '3'],
            fileInfos: [
                TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}),
                TestHelper.getFileInfoMock({id: '2', name: 'bbb', create_at: 200})
                ],
        });
        const props: any = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow<AdvancedCreateComment>(
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
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: 'Test message',
            uploadsInProgress: ['1', '2', '3'],
            fileInfos: [
                TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}), 
                TestHelper.getFileInfoMock({id: '2', name: 'bbb', create_at: 200})
            ],
        });
        const props: any = {...baseProps, onUpdateCommentDraft, draft};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        wrapper.setProps({rootDeleted: true});
            wrapper.instance().handleSubmit(submitEvent);

        expect(props.openModal).toHaveBeenCalledTimes(1);
        expect(props.openModal.mock.calls[0][0]).toMatchObject({
            modalId: ModalIdentifiers.POST_DELETED_MODAL,
        });
    });

    describe('focusTextbox', () => {
        const draft: PostDraft = TestHelper.getPostDraftMock({
            uploadsInProgress: ['1', '2', '3'],
            fileInfos: [
                TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}), 
                TestHelper.getFileInfoMock({id: '2', name: 'bbb', create_at: 200})
            ],
        });

        it('is called when rootId changes', () => {
            const props: any = {...baseProps, draft};
            const wrapper = shallow<AdvancedCreateComment>(
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
            const props: any = {...baseProps, draft, selectedPostFocussedAt: 1000};
            const wrapper = shallow<AdvancedCreateComment>(
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
            const props: any = {...baseProps, draft, selectedPostFocussedAt: 1000};
            const wrapper = shallow<AdvancedCreateComment>(
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
        const draft:PostDraft = TestHelper.getPostDraftMock({
            uploadsInProgress:['1','2','3'],
            fileInfos:[TestHelper.getFileInfoMock(),TestHelper.getFileInfoMock(),TestHelper.getFileInfoMock()]
        })
        const scrollToBottom = jest.fn();
        const props: any = {...baseProps, draft, scrollToBottom};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...props}
            />,
        );

        const testMessage:string = 'new msg';
        wrapper.instance().handleChange({target: {value: testMessage}} as any);

        // The callback won't we called until after a short delay
        expect(baseProps.onUpdateCommentDraft).not.toHaveBeenCalled();

        jest.runOnlyPendingTimers();
        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(baseProps.onUpdateCommentDraft).toHaveBeenCalled();
        
        expect(baseProps.onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({message: testMessage}),
        );
        expect(wrapper.state().draft!.message).toBe(testMessage);
        expect(scrollToBottom).toHaveBeenCalled();
    });

    // debug
    it('handleChange should throw away invalid command error if user resumes typing', async () => {
        const onUpdateCommentDraft = jest.fn();

        const error:ServerError = {message: 'No command found'};

        error.server_error_id = 'api.command.execute_command.not_found.app_error';
        const onSubmit = jest.fn(() => Promise.reject(error));
        const defaultFileInfo = TestHelper.getFileInfoMock()

        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: '/fakecommand other text',
            uploadsInProgress: ['1', '2', '3'],
            fileInfos: [defaultFileInfo, defaultFileInfo, defaultFileInfo],
        });
        const props: any = {...baseProps, onUpdateCommentDraft, draft, onSubmit};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

            await wrapper.instance().handleSubmit(submitEvent);

        expect(onSubmit).toHaveBeenCalledWith(TestHelper.getPostDraftMock({
            message: '/fakecommand other text',
            uploadsInProgress: [],
            fileInfos: [defaultFileInfo,defaultFileInfo,defaultFileInfo],
        }), {ignoreSlash: false});

        wrapper.instance().handleChange({
            target: {value: 'some valid text'},
        } as any);

            wrapper.instance().handleSubmit(submitEvent);

        expect(onSubmit).toHaveBeenCalledWith(TestHelper.getPostDraftMock({
            message: 'some valid text',
            uploadsInProgress: [],
            fileInfos: [defaultFileInfo, defaultFileInfo, defaultFileInfo],
        }), {ignoreSlash: false});
    });

    test('should scroll to bottom when uploadsInProgress increase', () => {
        const draft:PostDraft = TestHelper.getPostDraftMock({
            uploadsInProgress:['1','2','3'],
            fileInfos:[TestHelper.getFileInfoMock(),TestHelper.getFileInfoMock(),TestHelper.getFileInfoMock()]
        })
        const scrollToBottom = jest.fn();
        const props: any = {...baseProps, draft, scrollToBottom};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...props}
            />,
        );

        wrapper.setState({draft: {...draft, uploadsInProgress: ['1', '2', '3', '4']}});
        expect(scrollToBottom).toHaveBeenCalled();
    });

    test('handleSubmit should call onSubmit prop', () => {
        const onSubmit = jest.fn();
        const defaultFileInfo = TestHelper.getFileInfoMock()
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: 'Test message',
            uploadsInProgress: [],
            fileInfos: [defaultFileInfo, defaultFileInfo, defaultFileInfo],
        });
        const props: any = {...baseProps, draft, onSubmit};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        const preventDefault = jest.fn();
        wrapper.instance().handleSubmit({...submitEvent, preventDefault});
        expect(onSubmit).toHaveBeenCalled();
        expect(preventDefault).toHaveBeenCalled();
    });

    describe('handleSubmit', () => {
        let onSubmit: any;
        let preventDefault: any;

        beforeEach(() => {
            onSubmit = jest.fn();
            preventDefault = jest.fn();
            submitEvent.preventDefault = preventDefault;
        });

        ['channel', 'all', 'here'].forEach((mention: string) => {
            describe(`should not show Confirm Modal for @${mention} mentions`, () => {
                it('when channel member count too low', () => {
                    const props: any = {
                        ...baseProps,
                        draft: {
                            message: `Test message @${mention}`,
                            uploadsInProgress: [],
                            fileInfos: [{}, {}, {}],
                        },
                        onSubmit,
                        channelMembersCount: 1,
                        enableConfirmNotificationsToChannel: true,
                    };

                    const wrapper = shallow<AdvancedCreateComment>(
                        <AdvancedCreateComment {...props}/>,
                    );

                    wrapper.instance().handleSubmit(submitEvent);
                    expect(onSubmit).toHaveBeenCalled();
                    expect(preventDefault).toHaveBeenCalled();
                    expect(props.openModal).not.toHaveBeenCalled();
                });

                it('when feature disabled', () => {
                    const props: any = {
                        ...baseProps,
                        draft: {
                            message: `Test message @${mention}`,
                            uploadsInProgress: [],
                            fileInfos: [{}, {}, {}],
                        },
                        onSubmit,
                        channelMembersCount: 8,
                        enableConfirmNotificationsToChannel: false,
                    };

                    const wrapper = shallow<AdvancedCreateComment>(
                        <AdvancedCreateComment {...props}/>,
                    );

                    wrapper.instance().handleSubmit(submitEvent);
                    expect(onSubmit).toHaveBeenCalled();
                    expect(preventDefault).toHaveBeenCalled();
                    expect(props.openModal).not.toHaveBeenCalled();
                });

                it('when no mention', () => {
                    const props: any = {
                        ...baseProps,
                        draft: {
                            message: `Test message ${mention}`,
                            uploadsInProgress: [],
                            fileInfos: [{}, {}, {}],
                        },
                        onSubmit,
                        channelMembersCount: 8,
                        enableConfirmNotificationsToChannel: true,
                    };

                    const wrapper = shallow<AdvancedCreateComment>(
                        <AdvancedCreateComment {...props}/>,
                    );

                    wrapper.instance().handleSubmit(submitEvent);
                    expect(onSubmit).toHaveBeenCalled();
                    expect(preventDefault).toHaveBeenCalled();
                    expect(props.openModal).not.toHaveBeenCalled();
                });

                it('when user has insufficient permissions', () => {
                    const props: any = {
                        ...baseProps,
                        useChannelMentions: false,
                        draft: {
                            message: `Test message @${mention}`,
                            uploadsInProgress: [],
                            fileInfos: [{}, {}, {}],
                        },
                        onSubmit,
                        channelMembersCount: 8,
                        enableConfirmNotificationsToChannel: true,
                    };

                    const wrapper = shallow<AdvancedCreateComment>(
                        <AdvancedCreateComment {...props}/>,
                    );

                    wrapper.instance().handleSubmit(submitEvent);
                    expect(onSubmit).toHaveBeenCalled();
                    expect(preventDefault).toHaveBeenCalled();
                    expect(props.openModal).not.toHaveBeenCalled();
                });
            });

            it(`should show Confirm Modal for @${mention} mentions when needed`, () => {
                const props: any = {
                    ...baseProps,
                    draft: {
                        message: `Test message @${mention}`,
                        uploadsInProgress: [],
                        fileInfos: [{}, {}, {}],
                    },
                    onSubmit,
                    channelMembersCount: 8,
                    enableConfirmNotificationsToChannel: true,
                };

                const wrapper = shallow<AdvancedCreateComment>(
                    <AdvancedCreateComment {...props}/>,
                );

                wrapper.instance().handleSubmit(submitEvent);
                expect(onSubmit).not.toHaveBeenCalled();
                expect(preventDefault).toHaveBeenCalled();
                expect(props.openModal).toHaveBeenCalled();
            });

            it(`should show Confirm Modal for @${mention} mentions when needed and timezone notification`, async () => {
                const props: any = {
                    ...baseProps,
                    draft: {
                        message: `Test message @${mention}`,
                        uploadsInProgress: [],
                        fileInfos: [{}, {}, {}],
                    },
                    onSubmit,
                    isTimezoneEnabled: true,
                    channelMembersCount: 8,
                    enableConfirmNotificationsToChannel: true,
                };

                const wrapper = shallow<AdvancedCreateComment>(
                    <AdvancedCreateComment {...props}/>,
                );

                await wrapper.instance().handleSubmit(submitEvent);
                wrapper.setState({channelTimezoneCount: 4} as any);

                expect(onSubmit).not.toHaveBeenCalled();
                expect(preventDefault).toHaveBeenCalled();
                expect(wrapper.state('channelTimezoneCount')).toBe(4);
                expect(baseProps.getChannelTimezones).toHaveBeenCalledTimes(1);
                expect(props.openModal).toHaveBeenCalled();
            });

            it(`should show Confirm Modal for @${mention} mentions when needed and no timezone notification`, async () => {
                const props: any = {
                    ...baseProps,
                    draft: {
                        message: `Test message @${mention}`,
                        uploadsInProgress: [],
                        fileInfos: [{}, {}, {}],
                    },
                    onSubmit,
                    isTimezoneEnabled: true,
                    channelMembersCount: 8,
                    enableConfirmNotificationsToChannel: true,
                };

                const wrapper = shallow<AdvancedCreateComment>(
                    <AdvancedCreateComment {...props}/>,
                );

                await wrapper.instance().handleSubmit(submitEvent);
                wrapper.setState({channelTimezoneCount: 0} as any);

                expect(onSubmit).not.toHaveBeenCalled();
                expect(preventDefault).toHaveBeenCalled();
                expect(wrapper.state('channelTimezoneCount')).toBe(0);
                expect(baseProps.getChannelTimezones).toHaveBeenCalledTimes(1);
                expect(props.openModal).toHaveBeenCalled();
            });
        });

        it('should show Confirm Modal for @group mention when needed and no timezone notification', async () => {
            const props: any = {
                ...baseProps,
                draft: {
                    message: 'Test message @developers',
                    uploadsInProgress: [],
                    fileInfos: [{}, {}, {}],
                },
                groupsWithAllowReference: new Map([
                    ['@developers', {
                        id: 'developers',
                        name: 'developers',
                    }],
                ]),
                channelMemberCountsByGroup: {
                    developers: {
                        channel_member_count: 10,
                        channel_member_timezones_count: 0,
                    },
                },
                isTimezoneEnabled: false,
                channelMembersCount: 8,
                useChannelMentions: true,
                enableConfirmNotificationsToChannel: true,
            };

            const wrapper = shallow<AdvancedCreateComment>(
                <AdvancedCreateComment {...props}/>,
            );
            const showNotifyAllModal = wrapper.instance().showNotifyAllModal;
            wrapper.instance().showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

            await wrapper.instance().handleSubmit(submitEvent);
            expect(onSubmit).not.toHaveBeenCalled();
            expect(preventDefault).toHaveBeenCalled();
            expect(baseProps.getChannelTimezones).toHaveBeenCalledTimes(0);
            expect(wrapper.instance().showNotifyAllModal).toHaveBeenCalledWith(['@developers'], 0, 10);
            expect(props.openModal).toHaveBeenCalled();
        });

        it('should show Confirm Modal for @group mentions when needed and no timezone notification', async () => {
            const props: any = {
                ...baseProps,
                draft: {
                    message: 'Test message @developers @boss @love @you @software-developers',
                    uploadsInProgress: [],
                    fileInfos: [{}, {}, {}],
                },
                groupsWithAllowReference: new Map([
                    ['@developers', {
                        id: 'developers',
                        name: 'developers',
                    }],
                    ['@boss', {
                        id: 'boss',
                        name: 'boss',
                    }],
                    ['@love', {
                        id: 'love',
                        name: 'love',
                    }],
                    ['@you', {
                        id: 'you',
                        name: 'you',
                    }],
                    ['@software-developers', {
                        id: 'softwareDevelopers',
                        name: 'software-developers',
                    }],
                ]),
                channelMemberCountsByGroup: {
                    developers: {
                        channel_member_count: 10,
                        channel_member_timezones_count: 0,
                    },
                    boss: {
                        channel_member_count: 20,
                        channel_member_timezones_count: 0,
                    },
                    love: {
                        channel_member_count: 30,
                        channel_member_timezones_count: 0,
                    },
                    you: {
                        channel_member_count: 40,
                        channel_member_timezones_count: 0,
                    },
                    softwareDevelopers: {
                        channel_member_count: 5,
                        channel_member_timezones_count: 0,
                    },
                },
                isTimezoneEnabled: false,
                channelMembersCount: 8,
                useChannelMentions: true,
                enableConfirmNotificationsToChannel: true,
            };

            const wrapper = shallow<AdvancedCreateComment>(
                <AdvancedCreateComment {...props}/>,
            );

            const showNotifyAllModal = wrapper.instance().showNotifyAllModal;
            wrapper.instance().showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

            await wrapper.instance().handleSubmit(submitEvent);
            expect(onSubmit).not.toHaveBeenCalled();
            expect(preventDefault).toHaveBeenCalled();
            expect(baseProps.getChannelTimezones).toHaveBeenCalledTimes(0);
            expect(wrapper.instance().showNotifyAllModal).toHaveBeenCalledWith(['@developers', '@boss', '@love', '@you', '@software-developers'], 0, 40);
            expect(props.openModal).toHaveBeenCalled();
        });

        it('should show Confirm Modal for @group mention with timezone enabled', async () => {
            const props: any = {
                ...baseProps,
                draft: {
                    message: 'Test message @developers',
                    uploadsInProgress: [],
                    fileInfos: [{}, {}, {}],
                },
                groupsWithAllowReference: new Map([
                    ['@developers', {
                        id: 'developers',
                        name: 'developers',
                    }],
                ]),
                channelMemberCountsByGroup: {
                    developers: {
                        channel_member_count: 10,
                        channel_member_timezones_count: 5,
                    },
                },
                isTimezoneEnabled: true,
                channelMembersCount: 8,
                useChannelMentions: true,
                enableConfirmNotificationsToChannel: true,
            };

            const wrapper = shallow<AdvancedCreateComment>(
                <AdvancedCreateComment {...props}/>,
            );

            const showNotifyAllModal = wrapper.instance().showNotifyAllModal;
            wrapper.instance().showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

            await wrapper.instance().handleSubmit(submitEvent);
            expect(onSubmit).not.toHaveBeenCalled();
            expect(preventDefault).toHaveBeenCalled();
            expect(baseProps.getChannelTimezones).toHaveBeenCalledTimes(0);
            expect(wrapper.instance().showNotifyAllModal).toHaveBeenCalledWith(['@developers'], 5, 10);
            expect(props.openModal).toHaveBeenCalled();
        });

        it('should allow to force send invalid slash command as a message', async () => {
            const error:ServerError = {message: 'No command found'};
            error.server_error_id = 'api.command.execute_command.not_found.app_error';
            const onSubmitWithError = jest.fn(() => Promise.reject(error));

            const props: any = {
                ...baseProps,
                draft: {
                    message: '/fakecommand other text',
                    uploadsInProgress: [],
                    fileInfos: [{}, {}, {}],
                },
                onSubmit: onSubmitWithError,
            };

            const wrapper = shallow<AdvancedCreateComment>(
                <AdvancedCreateComment {...props}/>,
            );

            await wrapper.instance().handleSubmit(submitEvent);
            expect(onSubmitWithError).toHaveBeenCalledWith({
                message: '/fakecommand other text',
                uploadsInProgress: [],
                fileInfos: [{}, {}, {}],
            }, {ignoreSlash: false});
            expect(preventDefault).toHaveBeenCalled();

            wrapper.setProps({onSubmit});
            await wrapper.instance().handleSubmit(submitEvent);
            expect(onSubmit).toHaveBeenCalledWith({
                message: '/fakecommand other text',
                uploadsInProgress: [],
                fileInfos: [{}, {}, {}],
            }, {ignoreSlash: true});
            expect(wrapper.find('[id="postServerError"]').exists()).toBe(false);
        });

        it('should update global draft state if invalid slash command error occurs', async () => {
            const error:ServerError = {message: 'No command found'};
            error.server_error_id = 'api.command.execute_command.not_found.app_error';
            const onSubmitWithError = jest.fn(() => Promise.reject(error));

            const props: any = {
                ...baseProps,
                draft: {
                    message: '/fakecommand other text',
                    uploadsInProgress: [],
                    fileInfos: [{}, {}, {}],
                },
                onSubmit: onSubmitWithError,
            };

            const wrapper = shallow<AdvancedCreateComment>(
                <AdvancedCreateComment {...props}/>,
            );

            const submitPromise = wrapper.instance().handleSubmit(submitEvent);
            expect(props.onUpdateCommentDraft).not.toHaveBeenCalled();

            await submitPromise;
            expect(props.onUpdateCommentDraft).toHaveBeenCalledWith(props.draft);
        });
        ['channel', 'all', 'here'].forEach((mention) => {
            it(`should set mentionHighlightDisabled when user does not have permission and message contains channel @${mention}`, async () => {
                const props: any = {
                    ...baseProps,
                    useChannelMentions: false,
                    enableConfirmNotificationsToChannel: false,
                    draft: {
                        message: `Test message @${mention}`,
                        uploadsInProgress: [],
                        fileInfos: [{}, {}, {}],
                    },
                    onSubmit,
                };

                const wrapper = shallow<AdvancedCreateComment>(
                    <AdvancedCreateComment {...props}/>,
                );

                wrapper.instance().handleSubmit(submitEvent);
                expect(onSubmit).toHaveBeenCalled();
                expect(wrapper.state('draft')!.props.mentionHighlightDisabled).toBe(true);
            });

            it(`should not set mentionHighlightDisabled when user does have permission and message contains channel channel @${mention}`, async () => {
                const props: any = {
                    ...baseProps,
                    useChannelMentions: true,
                    enableConfirmNotificationsToChannel: false,
                    draft: {
                        message: `Test message @${mention}`,
                        uploadsInProgress: [],
                        fileInfos: [{}, {}, {}],
                    },
                    onSubmit,
                };

                const wrapper = shallow<AdvancedCreateComment>(
                    <AdvancedCreateComment {...props}/>,
                );

                wrapper.instance().handleSubmit(submitEvent);
                expect(onSubmit).toHaveBeenCalled();
                expect(wrapper.state('draft')!.props).toBe(undefined);
            });
        });

        it('should not set mentionHighlightDisabled when user does not have useChannelMentions permission and message contains no mention', async () => {
            const props: any = {
                ...baseProps,
                useChannelMentions: false,
                draft: {
                    message: 'Test message',
                    uploadsInProgress: [],
                    fileInfos: [{}, {}, {}],
                },
                onSubmit,
            };

            const wrapper = shallow<AdvancedCreateComment>(
                <AdvancedCreateComment {...props}/>,
            );

            wrapper.instance().handleSubmit(submitEvent);
            expect(onSubmit).toHaveBeenCalled();
            expect(wrapper.state('draft')!.props).toBe(undefined);
        });
    });

    test('removePreview should remove file info and upload in progress with corresponding id', () => {
        const onUpdateCommentDraft = jest.fn();
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: 'Test message',
            uploadsInProgress: ['4', '5', '6'],
            fileInfos: [
                TestHelper.getFileInfoMock({id: '1'}), 
                TestHelper.getFileInfoMock({id: '2'}), 
                TestHelper.getFileInfoMock({id: '3'})
            ],
        });
        const props: any = {...baseProps, draft, onUpdateCommentDraft};

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        wrapper.setState({draft});

        wrapper.instance().removePreview('3');

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft).toHaveBeenCalled();
        expect(onUpdateCommentDraft.mock.calls[0][0]).toEqual(
            expect.objectContaining({fileInfos: [
                    TestHelper.getFileInfoMock({id: '1'}), 
                    TestHelper.getFileInfoMock({id: '2'})
                ]}),
        );
        expect(wrapper.state().draft!.fileInfos).toEqual([
            TestHelper.getFileInfoMock({id: '1'}), 
            TestHelper.getFileInfoMock({id: '2'})
        ]);

        wrapper.instance().removePreview('5');

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(onUpdateCommentDraft.mock.calls[1][0]).toEqual(
            expect.objectContaining({uploadsInProgress: ['4', '6']}),
        );
        expect(wrapper.state().draft!.uploadsInProgress).toEqual(['4', '6']);
    });

    test('should match draft state on componentWillReceiveProps with change in messageInHistory', () => {
        const draft: PostDraft = TestHelper.getPostDraftMock({
            fileInfos: [defaultFileInfo, defaultFileInfo, defaultFileInfo],
        });

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );
        expect(wrapper.state('draft')).toEqual(draft);

        const newDraft:PostDraft = TestHelper.getPostDraftMock({...draft, message: 'Test message edited'});
        wrapper.setProps({draft: newDraft, messageInHistory: 'Test message edited'});
        expect(wrapper.state('draft')).toEqual(newDraft);
    });

    test('should match draft state on componentWillReceiveProps with new rootId', () => {
        const defaultFileInfo = TestHelper.getFileInfoMock()
        const draft: PostDraft = TestHelper.getPostDraftMock({
            message: 'Test message',
            uploadsInProgress: ['4', '5', '6'],
            fileInfos: [
                TestHelper.getFileInfoMock({id: '1'}), 
                TestHelper.getFileInfoMock({id: '2'}), 
                TestHelper.getFileInfoMock({id: '3'})
            ],
        });

        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );
        wrapper.setState({draft});
        expect(wrapper.state('draft')).toEqual(draft);

        wrapper.setProps({rootId: 'new_root_id'});
        expect(wrapper.state('draft')).toEqual(TestHelper.getPostDraftMock({...draft, uploadsInProgress: [], fileInfos: [defaultFileInfo,defaultFileInfo, defaultFileInfo]}));
    });

    test('should match snapshot when cannot post', () => {
        const props: any = {...baseProps, canPost: false};
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, emoji picker disabled', () => {
        const props: any = {...baseProps, enableEmojiPicker: false};
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('check for handleFileUploadChange callback for focus', () => {
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment {...baseProps}/>,
        );
        const instance = wrapper.instance();
        instance.focusTextbox = jest.fn();

        instance.handleFileUploadChange();
        expect(instance.focusTextbox).toHaveBeenCalledTimes(1);
    });

    test('should call functions on handleKeyDown', () => {
        const onMoveHistoryIndexBack = jest.fn();
        const onMoveHistoryIndexForward = jest.fn();
        const onEditLatestPost = jest.fn().
            mockImplementationOnce(() => ({data: true})).
            mockImplementationOnce(() => ({data: false}));
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
                ctrlSend={true}
                onMoveHistoryIndexBack={onMoveHistoryIndexBack}
                onMoveHistoryIndexForward={onMoveHistoryIndexForward}
                onEditLatestPost={onEditLatestPost}
            />,
        );
        const instance = wrapper.instance();
        instance.commentMsgKeyPress = jest.fn();
        instance.focusTextbox = jest.fn();
        const blur = jest.fn();

        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                getBoundingClientRect: jest.fn(mockTop),
                blur: jest.fn(),
                focus: jest.fn(),
            };
        };

        const mockTop = () => {
            return document.createElement('div');
        };

        (instance as any).textboxRef.current = {blur, focus, getInputBox: jest.fn(mockImpl)};
    
        const mockTarget = {
            selectionStart: 0,
            selectionEnd: 0,
            value: 'brown\nfox jumps over lazy dog',
        };

        const commentMsgKey: any = {
            preventDefault: jest.fn(),
            ctrlKey: true,
            key: Constants.KeyCodes.ENTER[0],
            keyCode: Constants.KeyCodes.ENTER[1],
            target: mockTarget,
        };
        instance.handleKeyDown(commentMsgKey);
        expect(instance.commentMsgKeyPress).toHaveBeenCalledTimes(1);

        const upKey: any = {
            preventDefault: jest.fn(),
            ctrlKey: true,
            key: Constants.KeyCodes.UP[0],
            keyCode: Constants.KeyCodes.UP[1],
            target: mockTarget,
        };
        instance.handleKeyDown(upKey);
        expect(upKey.preventDefault).toHaveBeenCalledTimes(1);
        expect(onMoveHistoryIndexBack).toHaveBeenCalledTimes(1);

        const downKey = {
            preventDefault: jest.fn(),
            ctrlKey: true,
            key: Constants.KeyCodes.DOWN[0],
            keyCode: Constants.KeyCodes.DOWN[1],
            target: mockTarget,
        };
        instance.handleKeyDown(downKey as any);
        expect(downKey.preventDefault).toHaveBeenCalledTimes(1);
        expect(onMoveHistoryIndexForward).toHaveBeenCalledTimes(1);

        wrapper.setState({draft: emptyDraft});
        const upKeyForEdit: any = {
            preventDefault: jest.fn(),
            ctrlKey: false,
            key: Constants.KeyCodes.UP[0],
            keyCode: Constants.KeyCodes.UP[1],
            target: mockTarget,
        };
        instance.handleKeyDown(upKeyForEdit);
        expect(upKeyForEdit.preventDefault).toHaveBeenCalledTimes(1);
        expect(onEditLatestPost).toHaveBeenCalledTimes(1);
        expect(blur).toHaveBeenCalledTimes(1);

        instance.handleKeyDown(upKeyForEdit);
        expect(upKeyForEdit.preventDefault).toHaveBeenCalledTimes(2);
        expect(onEditLatestPost).toHaveBeenCalledTimes(2);
        expect(instance.focusTextbox).toHaveBeenCalledTimes(1);
        expect(instance.focusTextbox).toHaveBeenCalledWith(true);
    });

    test('should the RHS thread scroll to bottom one time after mount when props.draft.message is not empty', () => {
        const draft: PostDraft = emptyDraft;
        const scrollToBottom = jest.fn();
        const wrapper = shallow<AdvancedCreateComment>(
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
        const draft: PostDraft = emptyDraft;
        const scrollToBottom = jest.fn();
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
                draft={draft}
                scrollToBottom={scrollToBottom}
            />,
        );

        expect(scrollToBottom).toBeCalledTimes(0);

        wrapper.setState({draft: {...draft, uploadsInProgress: ['1']}});
        expect(scrollToBottom).toBeCalledTimes(1);

        wrapper.setState({draft: {...draft, uploadsInProgress: ['1', '2']}});
        expect(scrollToBottom).toBeCalledTimes(2);

        wrapper.setState({draft: {...draft, uploadsInProgress: ['2']}});
        expect(scrollToBottom).toBeCalledTimes(2);
    });

    test('should be able to format a pasted markdown table', () => {
        const draft: PostDraft = emptyDraft;
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
                draft={draft}
            />,
        );

        const mockTop = () => {
            return document.createElement('div');
        };

        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                getBoundingClientRect: jest.fn(mockTop),
                focus: jest.fn(),
            };
        };

        (wrapper.instance() as any).textboxRef.current = {getInputBox: jest.fn(mockImpl), focus: jest.fn(), blur: jest.fn()};

        const event: any = {
            target: {
                id: 'reply_textbox',
            },
            preventDefault: jest.fn(),
            clipboardData: {
                items: [1],
                types: ['text/html'],
                getData: () => {
                    return '<table><tr><th>test</th><th>test</th></tr><tr><td>test</td><td>test</td></tr></table>';
                },
            },
        };

        const markdownTable = '| test | test |\n| --- | --- |\n| test | test |';

        wrapper.instance().pasteHandler(event);
        expect(execCommandInsertText).toHaveBeenCalledWith(markdownTable);
    });

    test('should be able to format a pasted markdown table without headers', () => {
        const draft: PostDraft = emptyDraft;
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
                draft={draft}
            />,
        );

        const mockTop = () => {
            return document.createElement('div');
        };

        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                getBoundingClientRect: jest.fn(mockTop),
                focus: jest.fn(),
            };
        };

        (wrapper.instance() as any).textboxRef.current = {getInputBox: jest.fn(mockImpl), focus: jest.fn(), blur: jest.fn()};
    

        const event: any = {
            target: {
                id: 'reply_textbox',
            },
            preventDefault: jest.fn(),
            clipboardData: {
                items: [1],
                types: ['text/html'],
                getData: () => {
                    return '<table><tr><td>test</td><td>test</td></tr><tr><td>test</td><td>test</td></tr></table>';
                },
            },
        };

        const markdownTable = '| test | test |\n| --- | --- |\n| test | test |\n';

        wrapper.instance().pasteHandler(event);
        expect(execCommandInsertText).toHaveBeenCalledWith(markdownTable);
    });

    test('should be able to format a pasted hyperlink', () => {
        const draft: PostDraft = emptyDraft;
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
                draft={draft}
            />,
        );

        const mockTop = () => {
            return document.createElement('div');
        };

        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                getBoundingClientRect: jest.fn(mockTop),
                focus: jest.fn(),
            };
        };

        (wrapper.instance() as any).textboxRef.current = {getInputBox: jest.fn(mockImpl), focus: jest.fn(), blur: jest.fn()};
     
        const event: any = {
            target: {
                id: 'reply_textbox',
            },
            preventDefault: jest.fn(),
            clipboardData: {
                items: [1],
                types: ['text/html'],
                getData: () => {
                    return '<a href="https://test.domain">link text</a>';
                },
            },
        };

        const markdownLink = '[link text](https://test.domain)';

        wrapper.instance().pasteHandler(event);
        expect(execCommandInsertText).toHaveBeenCalledWith(markdownLink);
    });

    test('should be able to format a github codeblock (pasted as a table)', () => {
        const draft: PostDraft = emptyDraft;
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
                draft={draft}
            />,
        );

        const mockTop = () => {
            return document.createElement('div');
        };

        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                getBoundingClientRect: jest.fn(mockTop),
                focus: jest.fn(),
            };
        };

        (wrapper.instance() as any).textboxRef.current = {getInputBox: jest.fn(mockImpl), focus: jest.fn(), blur: jest.fn()};
     
        const event: any = {
            target: {
                id: 'reply_textbox',
            },
            preventDefault: jest.fn(),
            clipboardData: {
                items: [1],
                types: ['text/plain', 'text/html'],
                getData: (type: any) => {
                    if (type === 'text/plain') {
                        return '// a javascript codeblock example\nif (1 > 0) {\n  return \'condition is true\';\n}';
                    }
                    return '<table class="highlight tab-size js-file-line-container" data-tab-size="8"><tbody><tr><td id="LC1" class="blob-code blob-code-inner js-file-line"><span class="pl-c"><span class="pl-c">//</span> a javascript codeblock example</span></td></tr><tr><td id="L2" class="blob-num js-line-number" data-line-number="2">&nbsp;</td><td id="LC2" class="blob-code blob-code-inner js-file-line"><span class="pl-k">if</span> (<span class="pl-c1">1</span> <span class="pl-k">&gt;</span> <span class="pl-c1">0</span>) {</td></tr><tr><td id="L3" class="blob-num js-line-number" data-line-number="3">&nbsp;</td><td id="LC3" class="blob-code blob-code-inner js-file-line"><span class="pl-en">console</span>.<span class="pl-c1">log</span>(<span class="pl-s"><span class="pl-pds">\'</span>condition is true<span class="pl-pds">\'</span></span>);</td></tr><tr><td id="L4" class="blob-num js-line-number" data-line-number="4">&nbsp;</td><td id="LC4" class="blob-code blob-code-inner js-file-line">}</td></tr></tbody></table>';
                },
            },
        };

        const codeBlockMarkdown = "```\n// a javascript codeblock example\nif (1 > 0) {\n  return 'condition is true';\n}\n```";

        wrapper.instance().pasteHandler(event);
        expect(execCommandInsertText).toHaveBeenCalledWith(codeBlockMarkdown);
    });

    test('should show preview and edit mode, and return focus on preview disable', () => {
        const wrapper = shallow<AdvancedCreateComment>(
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

    testComponentForLineBreak((value: any) => (
        <AdvancedCreateComment
            {...baseProps}
            draft={{
                ...baseProps.draft,
                message: value,
            }}
            ctrlSend={true}
        />
    ), (instance: any) => instance.state().draft.message, false);

    testComponentForMarkdownHotkeys(
        (value: any) => (
            <AdvancedCreateComment
                {...baseProps}
                draft={{
                    ...baseProps.draft,
                    message: value,
                }}
                ctrlSend={true}
            />
        ),
        (wrapper: any, setSelectionRangeFn: any) => {
            const mockTop = () => {
                return document.createElement('div');
            };
            wrapper.instance().textboxRef = {
                current: {
                    getInputBox: jest.fn(() => {
                        return {
                            focus: jest.fn(),
                            getBoundingClientRect: jest.fn(mockTop),
                            setSelectionRange: setSelectionRangeFn,
                        };
                    }),
                },
            };
        },
        (instance: any) => instance.find(AdvanceTextEditor),
        (instance: any) => instance.state().draft.message,
        false,
        'reply_textbox',
    );

    it('should blur when ESCAPE is pressed', () => {
        const wrapper = shallow<AdvancedCreateComment>(
            <AdvancedCreateComment
                {...baseProps}
            />,
        );
        const instance = wrapper.instance();
        const blur = jest.fn();

        const mockImpl = () => {
            return {
                blur: jest.fn(),
                focus: jest.fn(),
            };
        };

        (instance as any).textboxRef.current = {blur, getInputBox: jest.fn(mockImpl)};
      
        const mockTarget = {
            selectionStart: 0,
            selectionEnd: 0,
            value: 'brown\nfox jumps over lazy dog',
        };

        const commentEscapeKey = {
            preventDefault: jest.fn(),
            ctrlKey: true,
            key: Constants.KeyCodes.ESCAPE[0],
            keyCode: Constants.KeyCodes.ESCAPE[1],
            target: mockTarget,
        };

        instance.handleKeyDown(commentEscapeKey as any);
        expect(blur).toHaveBeenCalledTimes(1);
    });
});
