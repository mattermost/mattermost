// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelMemberCountsByGroup} from '@mattermost/types/channels';
import type {CommandArgs} from '@mattermost/types/integrations';
import type {Post} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AdvancedCreatePost from 'components/advanced_create_post/advanced_create_post';
import type {Props} from 'components/advanced_create_post/advanced_create_post';
import type {TextboxElement} from 'components/textbox';

import {testComponentForLineBreak} from 'tests/helpers/line_break_helpers';
import Constants, {StoragePrefixes, ModalIdentifiers} from 'utils/constants';
import EmojiMap from 'utils/emoji_map';
import {TestHelper} from 'utils/test_helper';

jest.mock('actions/global_actions', () => ({
    emitLocalUserTypingEvent: jest.fn(),
    emitUserPostedEvent: jest.fn(),
}));

jest.mock('actions/post_actions', () => ({
    createPost: jest.fn(() => {
        return new Promise<void>((resolve) => {
            process.nextTick(() => resolve());
        });
    }),
}));

jest.mock('utils/exec_commands', () => ({
    execCommandInsertText: jest.fn(),
}));

const currentTeamIdProp = 'r7rws4y7ppgszym3pdd5kaibfa';
const currentUserIdProp = 'zaktnt8bpbgu8mb6ez9k64r7sa';
const showSendTutorialTipProp = false;
const fullWidthTextBoxProp = true;
const latestReplyablePostIdProp = 'a';
const localeProp = 'en';

const currentChannelProp = TestHelper.getChannelMock({
    id: 'owsyt8n43jfxjpzh9np93mx1wa',
    type: 'O',
});

const currentChannelMembersCountProp = 9;

const draftProp = TestHelper.getPostDraftMock({
    fileInfos: [],
    message: '',
    uploadsInProgress: [],
});

const ctrlSendProp = false;

const currentUsersLatestPostProp = TestHelper.getPostMock({id: 'b', root_id: 'a', channel_id: currentChannelProp.id});

const baseProp: Props = {
    currentTeamId: currentTeamIdProp,
    currentChannelMembersCount: currentChannelMembersCountProp,
    currentChannel: currentChannelProp,
    currentUserId: currentUserIdProp,
    showSendTutorialTip: showSendTutorialTipProp,
    fullWidthTextBox: fullWidthTextBoxProp,
    draft: draftProp,
    isRemoteDraft: false,
    latestReplyablePostId: latestReplyablePostIdProp,
    locale: localeProp,
    actions: {
        addMessageIntoHistory: jest.fn(),
        moveHistoryIndexBack: jest.fn(),
        moveHistoryIndexForward: jest.fn(),
        submitReaction: jest.fn(),
        addReaction: jest.fn(),
        removeReaction: jest.fn(),
        clearDraftUploads: jest.fn(),
        onSubmitPost: jest.fn(),
        selectPostFromRightHandSideSearchByPostId: jest.fn(),
        setDraft: jest.fn(),
        setEditingPost: jest.fn(),
        openModal: jest.fn(),
        setShowPreview: jest.fn(),
        savePreferences: jest.fn(),
        executeCommand: () => {
            return Promise.resolve({data: true});
        },
        getChannelTimezones: jest.fn(() => {
            return Promise.resolve({data: [], error: ''});
        }),
        runMessageWillBePostedHooks: (post: Post) => {
            return Promise.resolve({data: post});
        },
        runSlashCommandWillBePostedHooks: (message: string, args: CommandArgs) => {
            return Promise.resolve({data: {message, args}});
        },
        scrollPostListToBottom: jest.fn(),
        getChannelMemberCountsByGroup: jest.fn(),
        emitShortcutReactToLastPostFrom: jest.fn(),
        searchAssociatedGroupsForReference: jest.fn(),
    },
    ctrlSend: ctrlSendProp,
    currentUsersLatestPost: currentUsersLatestPostProp,
    canUploadFiles: false,
    emojiMap: new EmojiMap(new Map()),
    enableEmojiPicker: true,
    enableGifPicker: true,
    useLDAPGroupMentions: true,
    useCustomGroupMentions: true,
    canPost: true,
    isPostPriorityEnabled: false,
    enableConfirmNotificationsToChannel: true,
    maxPostSize: Constants.DEFAULT_CHARACTER_LIMIT,
    userIsOutOfOffice: false,
    rhsExpanded: false,
    rhsOpen: false,
    badConnection: false,
    shouldShowPreview: false,
    useChannelMentions: true,
    isFormattingBarHidden: false,
    groupsWithAllowReference: null,
    channelMemberCountsByGroup: [] as unknown as ChannelMemberCountsByGroup,
    postEditorActions: [],
};

const submitEvent = {
    preventDefault: jest.fn(),
} as unknown as React.FormEvent;

function advancedCreatePost(props?: Partial<Props>) {
    const allProps: Props = {...baseProp, ...props};

    return (
        <AdvancedCreatePost {...allProps}/>
    );
}

describe('components/advanced_create_post', () => {
    jest.useFakeTimers({legacyFakeTimers: true});
    let spy: jest.SpyInstance;

    beforeEach(() => {
        spy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 16));
    });

    afterEach(() => {
        spy.mockRestore();
    });

    it('should match snapshot, init', () => {
        const wrapper = shallow(advancedCreatePost({}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot for center textbox', () => {
        const wrapper = shallow(advancedCreatePost({fullWidthTextBox: false}));

        expect(wrapper.find('#create_post').hasClass('center')).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it('should call clearDraftUploads on mount', () => {
        const clearDraftUploads = jest.fn();
        const actions = {
            ...baseProp.actions,
            clearDraftUploads,
        };

        shallow(advancedCreatePost({actions}));

        expect(clearDraftUploads).toHaveBeenCalled();
    });

    it('Check for state change on channelId change with useLDAPGroupMentions = true', () => {
        const wrapper = shallow(advancedCreatePost({}));
        const draft = {
            ...draftProp,
            message: 'test',
        };

        expect(wrapper.state('message')).toBe('');

        wrapper.setProps({draft});
        expect(wrapper.state('message')).toBe('');

        wrapper.setProps({
            currentChannel: {
                ...currentChannelProp,
                id: 'owsyt8n43jfxjpzh9np93mx1wb',
            },
        });
        expect(wrapper.state('message')).toBe('test');
    });

    it('Check for searchAssociatedGroupsForReference not called on mount when no mentions in the draft', () => {
        const searchAssociatedGroupsForReference = jest.fn();
        const draft = {
            ...draftProp,
            message: 'hello',
        };
        const actions = {
            ...baseProp.actions,
            searchAssociatedGroupsForReference,
        };
        const wrapper = shallow(advancedCreatePost({draft, actions}));
        expect(searchAssociatedGroupsForReference).not.toHaveBeenCalled();
        wrapper.setProps({
            currentChannel: {
                ...currentChannelProp,
                id: 'owsyt8n43jfxjpzh9np93mx1wb',
            },
        });
        expect(searchAssociatedGroupsForReference).not.toHaveBeenCalled();
    });

    it('Check for searchAssociatedGroupsForReference called on mount when one @ mention in the draft', () => {
        const searchAssociatedGroupsForReference = jest.fn();
        const draft = {
            ...draftProp,
            message: '@group1 hello',
        };
        const actions = {
            ...baseProp.actions,
            searchAssociatedGroupsForReference,
        };
        const wrapper = shallow(advancedCreatePost({draft, actions}));
        expect(searchAssociatedGroupsForReference).toHaveBeenCalled();
        wrapper.setProps({
            currentChannel: {
                ...currentChannelProp,
                id: 'owsyt8n43jfxjpzh9np93mx1wb',
            },
        });
        expect(searchAssociatedGroupsForReference).toHaveBeenCalled();
    });

    it('Check for getChannelMemberCountsByGroup called on mount when more than one @ mention in the draft', () => {
        const getChannelMemberCountsByGroup = jest.fn();
        const draft = {
            ...draftProp,
            message: '@group1 @group2 hello',
        };
        const actions = {
            ...baseProp.actions,
            getChannelMemberCountsByGroup,
        };
        const wrapper = shallow(advancedCreatePost({draft, actions}));
        expect(getChannelMemberCountsByGroup).toHaveBeenCalled();
        wrapper.setProps({
            currentChannel: {
                ...currentChannelProp,
                id: 'owsyt8n43jfxjpzh9np93mx1wb',
            },
        });
        expect(getChannelMemberCountsByGroup).toHaveBeenCalled();
    });

    it('Check for getChannelMemberCountsByGroup not called on mount and when channel changed with useLDAPGroupMentions = false', () => {
        const getChannelMemberCountsByGroup = jest.fn();
        const useLDAPGroupMentions = false;
        const actions = {
            ...baseProp.actions,
            getChannelMemberCountsByGroup,
        };
        const wrapper = shallow(advancedCreatePost({actions, useLDAPGroupMentions}));
        expect(getChannelMemberCountsByGroup).not.toHaveBeenCalled();
        wrapper.setProps({
            currentChannel: {
                ...currentChannelProp,
                id: 'owsyt8n43jfxjpzh9np93mx1wb',
            },
        });
        expect(getChannelMemberCountsByGroup).not.toHaveBeenCalled();
    });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('click toggleEmojiPicker', () => {
    //     const wrapper = shallow(advancedCreatePost());
    //     console.log('### debug', wrapper.debug());
    //     wrapper.find('button[aria-label="select an emoji"]').simulate('click');
    //     expect(wrapper.state('showEmojiPicker')).toBe(true);
    //     wrapper.find('.emoji-picker__container').simulate('click');
    //     wrapper.find('EmojiPickerOverlay').prop('onHide')();
    //     expect(wrapper.state('showEmojiPicker')).toBe(false);
    // });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('Check for emoji click message states', () => {
    //     const wrapper = shallow(advancedCreatePost());
    //     const mockImpl = () => {
    //         return {
    //             setSelectionRange: jest.fn(),
    //             focus: jest.fn(),
    //         };
    //     };
    //     wrapper.instance().textboxRef.current = {getInputBox: jest.fn(mockImpl), focus: jest.fn(), blur: jest.fn()};
    //
    //     wrapper.find('.emoji-picker__container').simulate('click');
    //     expect(wrapper.state('showEmojiPicker')).toBe(true);
    //
    //     wrapper.instance().handleEmojiClick({name: 'smile'});
    //     expect(wrapper.state('message')).toBe(':smile: ');
    //
    //     wrapper.setState({
    //         message: 'test',
    //         caretPosition: 'test'.length, // cursor is at the end
    //     });
    //
    //     wrapper.instance().handleEmojiClick({name: 'smile'});
    //     expect(wrapper.state('message')).toBe('test :smile: ');
    //
    //     wrapper.setState({
    //         message: 'test ',
    //     });
    //
    //     wrapper.instance().handleEmojiClick({name: 'smile'});
    //     expect(wrapper.state('message')).toBe('test  :smile: ');
    // });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('onChange textbox should call setDraft and change message state', () => {
    //     const setDraft = jest.fn();
    //     const draft = {
    //         ...draftProp,
    //         message: 'change',
    //     };
    //
    //     const wrapper = shallow(
    //         advancedCreatePost({
    //             actions: {
    //                 ...baseProp.actions,
    //                 setDraft,
    //             },
    //         }),
    //     );
    //
    //     const postTextbox = wrapper.find('#post_textbox');
    //     postTextbox.simulate('change', {target: {value: 'change'}});
    //     expect(setDraft).not.toHaveBeenCalled();
    //     jest.runOnlyPendingTimers();
    //     expect(setDraft).toHaveBeenCalledWith(StoragePrefixes.DRAFT + currentChannelProp.id, draft);
    // });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('onKeyPress textbox should call emitLocalUserTypingEvent', () => {
    //     const wrapper = shallow(advancedCreatePost());
    //     wrapper.instance().textboxRef.current = {blur: jest.fn()};
    //
    //     const postTextbox = wrapper.find('#post_textbox');
    //     postTextbox.simulate('KeyPress', {key: Constants.KeyCodes.ENTER[0], preventDefault: jest.fn(), persist: jest.fn()});
    //     expect(GlobalActions.emitLocalUserTypingEvent).toHaveBeenCalledWith(currentChannelProp.id, '');
    // });

    it('onSubmit test for @all', async () => {
        const result: ActionResult = {
            data: [1, 2, 3, 4],
        };
        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    getChannelTimezones: jest.fn(() => Promise.resolve(result)),
                },
                currentChannelMembersCount: 9,
            }),
        );

        wrapper.setState({
            message: 'test @all',
        });

        const instance = wrapper.instance() as AdvancedCreatePost;

        const showNotifyAllModal = instance.showNotifyAllModal;
        instance.showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

        const form = wrapper.find('#create_post');
        await form.simulate('Submit', {preventDefault: jest.fn()});

        expect(instance.props.actions.openModal).toHaveBeenCalledTimes(1);
        expect(instance.showNotifyAllModal).toHaveBeenCalledWith(['@all'], 4, 8);

        wrapper.setProps({
            currentChannelMembersCount: 2,
        });

        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(instance.props.actions.openModal).toHaveBeenCalledTimes(1);
    });

    it('onSubmit test for @here', async () => {
        const result: ActionResult = {
            data: [1, 2, 3, 4],
        };
        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    getChannelTimezones: jest.fn(() => Promise.resolve(result)),
                },
                currentChannelMembersCount: 9,
            }),
        );

        wrapper.setState({
            message: 'test @here',
        });

        const instance = wrapper.instance() as AdvancedCreatePost;

        const showNotifyAllModal = instance.showNotifyAllModal;
        instance.showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

        const form = wrapper.find('#create_post');
        await form.simulate('Submit', {preventDefault: jest.fn()});

        expect(instance.props.actions.openModal).toHaveBeenCalledTimes(1);
        expect(instance.showNotifyAllModal).toHaveBeenCalledWith(['@here'], 4, 8);

        wrapper.setProps({
            currentChannelMembersCount: 2,
        });

        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(instance.props.actions.openModal).toHaveBeenCalledTimes(1);
    });

    it('onSubmit test for @groups', () => {
        const wrapper = shallow(advancedCreatePost());

        wrapper.setProps({
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
        });
        wrapper.setState({
            message: '@developers',
        });

        const instance = wrapper.instance() as AdvancedCreatePost;

        const showNotifyAllModal = (instance).showNotifyAllModal;
        instance.showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

        const form = wrapper.find('#create_post');
        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(instance.props.actions.openModal).toHaveBeenCalled();
        expect(instance.showNotifyAllModal).toHaveBeenCalledWith(['@developers'], 0, 10);
    });

    it('onSubmit test for several @groups', () => {
        const wrapper = shallow(advancedCreatePost());

        wrapper.setProps({
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
        });
        wrapper.setState({
            message: '@developers @boss @love @you @software-developers',
        });

        const instance = wrapper.instance() as AdvancedCreatePost;

        const showNotifyAllModal = instance.showNotifyAllModal;
        instance.showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

        const form = wrapper.find('#create_post');
        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(instance.props.actions.openModal).toHaveBeenCalled();
        expect(instance.showNotifyAllModal).toHaveBeenCalledWith(['@developers', '@boss', '@love', '@you', '@software-developers'], 0, 40);
    });

    it('onSubmit test for several @groups with timezone', () => {
        const wrapper = shallow(advancedCreatePost());

        wrapper.setProps({
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
            ]),
            channelMemberCountsByGroup: {
                developers: {
                    channel_member_count: 10,
                    channel_member_timezones_count: 10,
                },
                boss: {
                    channel_member_count: 20,
                    channel_member_timezones_count: 130,
                },
                love: {
                    channel_member_count: 30,
                    channel_member_timezones_count: 2,
                },
                you: {
                    channel_member_count: 40,
                    channel_member_timezones_count: 5,
                },
            },
        });
        wrapper.setState({
            message: '@developers @boss @love @you',
        });

        const instance = wrapper.instance() as AdvancedCreatePost;

        const showNotifyAllModal = instance.showNotifyAllModal;
        instance.showNotifyAllModal = jest.fn((mentions, channelTimezoneCount, memberNotifyCount) => showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount));

        const form = wrapper.find('#create_post');
        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(instance.props.actions.openModal).toHaveBeenCalled();
        expect(instance.showNotifyAllModal).toHaveBeenCalledWith(['@developers', '@boss', '@love', '@you'], 5, 40);
    });

    it('Should set mentionHighlightDisabled prop when useChannelMentions disabled before calling actions.onSubmitPost', async () => {
        const onSubmitPost = jest.fn();
        const wrapper = shallow(advancedCreatePost({
            actions: {
                ...baseProp.actions,
                onSubmitPost,
            },
        }));

        wrapper.setProps({
            useChannelMentions: false,
        });

        const post = TestHelper.getPostMock({message: 'message with @here mention'});
        await (wrapper.instance() as AdvancedCreatePost).sendMessage(post);

        expect(onSubmitPost).toHaveBeenCalledTimes(1);
        expect(onSubmitPost.mock.calls[0][0]).toEqual({...post, props: {mentionHighlightDisabled: true}});
    });

    it('Should not set mentionHighlightDisabled prop when useChannelMentions enabled before calling actions.onSubmitPost', async () => {
        const onSubmitPost = jest.fn();
        const wrapper = shallow(advancedCreatePost({
            actions: {
                ...baseProp.actions,
                onSubmitPost,
            },
        }));

        wrapper.setProps({
            useChannelMentions: true,
        });

        const post = TestHelper.getPostMock({message: 'message with @here mention'});
        await (wrapper.instance() as AdvancedCreatePost).sendMessage(post);

        expect(onSubmitPost).toHaveBeenCalledTimes(1);
        expect(onSubmitPost.mock.calls[0][0]).toEqual(post);
    });

    it('Should not set mentionHighlightDisabled prop when useChannelMentions disabled but message does not contain channel metion before calling actions.onSubmitPost', async () => {
        const onSubmitPost = jest.fn();
        const wrapper = shallow(advancedCreatePost({
            actions: {
                ...baseProp.actions,
                onSubmitPost,
            },
        }));

        wrapper.setProps({
            useChannelMentions: false,
        });

        const post = TestHelper.getPostMock({message: 'message with @here mention'});
        await (wrapper.instance() as AdvancedCreatePost).sendMessage(post);

        expect(onSubmitPost).toHaveBeenCalledTimes(1);
        expect(onSubmitPost.mock.calls[0][0]).toEqual(post);
    });

    it('onSubmit test for "/header" message', () => {
        const openModal = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    openModal,
                },
            }),
        );

        wrapper.setState({
            message: '/header',
        });

        const form = wrapper.find('#create_post');
        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal.mock.calls[0][0].modalId).toEqual(ModalIdentifiers.EDIT_CHANNEL_HEADER);
        expect(openModal.mock.calls[0][0].dialogProps.channel).toEqual(currentChannelProp);
    });

    it('onSubmit test for "/purpose" message', () => {
        const openModal = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    openModal,
                },
            }),
        );

        wrapper.setState({
            message: '/purpose',
        });

        const form = wrapper.find('#create_post');
        form.simulate('Submit', {preventDefault: jest.fn()});
        expect(openModal).toHaveBeenCalledTimes(1);
        expect(openModal.mock.calls[0][0].modalId).toEqual(ModalIdentifiers.EDIT_CHANNEL_PURPOSE);
        expect(openModal.mock.calls[0][0].dialogProps.channel).toEqual(currentChannelProp);
    });

    it('onSubmit test for "/unknown" message ', async () => {
        jest.mock('actions/channel_actions', () => ({
            executeCommand: jest.fn((message, _args, resolve) => resolve()),
        }));

        const wrapper = shallow(advancedCreatePost());

        wrapper.setState({
            message: '/unknown',
        });

        await (wrapper.instance() as AdvancedCreatePost).handleSubmit(submitEvent);
        expect(wrapper.state('submitting')).toBe(false);
    });

    it('onSubmit test for addReaction message', async () => {
        const submitReaction = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    submitReaction,
                },
            }),
        );

        wrapper.setState({
            message: '+:smile:',
        });

        await (wrapper.instance() as AdvancedCreatePost).handleSubmit(submitEvent);
        expect(submitReaction).toHaveBeenCalledWith('a', '+', 'smile');
    });

    it('onSubmit test for removeReaction message', async () => {
        const submitReaction = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    submitReaction,
                },
            }),
        );

        wrapper.setState({
            message: '-:smile:',
        });

        await (wrapper.instance() as AdvancedCreatePost).handleSubmit(submitEvent);
        expect(submitReaction).toHaveBeenCalledWith('a', '-', 'smile');
    });

    /*it('check for postError state on handlePostError callback', () => {
        const wrapper = shallow(createPost());
        const textBox = wrapper.find('#post_textbox');
        const form = wrapper.find('#create_post');

        textBox.prop('handlePostError')(true);
        expect(wrapper.state('postError')).toBe(true);

        wrapper.setState({
            message: 'test',
        });

        form.simulate('Submit', {preventDefault: jest.fn()});

        expect(wrapper.update().find('.post-error .animation--highlight').length).toBe(1);
        expect(wrapper.find('#postCreateFooter').hasClass('post-create-footer has-error')).toBe(true);
    });*/

    it('check for handleFileUploadChange callback for focus', () => {
        const wrapper = shallow(advancedCreatePost());
        const instance: any = wrapper.instance();
        const mockImpl = () => {
            return {
                setSelectionRange: jest.fn(),
                focus: jest.fn(),
            };
        };
        instance.textboxRef.current = {getInputBox: jest.fn(mockImpl), focus: jest.fn(), blur: jest.fn()};
        instance.focusTextbox = jest.fn();

        instance.handleFileUploadChange();
        expect(instance.focusTextbox).toHaveBeenCalledTimes(1);
    });

    it('check for handleFileUploadStart callback', () => {
        const setDraft = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    setDraft,
                },
            }),
        );

        const instance = wrapper.instance() as AdvancedCreatePost;
        const clientIds = ['a'];
        const draft = {
            ...draftProp,
            uploadsInProgress: [
                ...draftProp.uploadsInProgress,
                ...clientIds,
            ],
        };

        instance.handleUploadStart(clientIds, currentChannelProp.id);
        expect(setDraft).toHaveBeenCalledWith(StoragePrefixes.DRAFT + currentChannelProp.id, draft, currentChannelProp.id);
    });

    it('check for handleFileUploadComplete callback', () => {
        const setDraft = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    setDraft,
                },
            }),
        );

        const instance: any = wrapper.instance();
        const clientIds = ['a'];
        const uploadsInProgressDraft = {
            ...draftProp,
            uploadsInProgress: [
                ...draftProp.uploadsInProgress,
                'a',
            ],
        };

        const channelId = 'another_channel_id';

        instance.draftsForChannel[channelId] = uploadsInProgressDraft;

        wrapper.setProps({draft: uploadsInProgressDraft});
        const fileInfos = [TestHelper.getFileInfoMock({id: 'a'})];
        const expectedDraft = {
            ...draftProp,
            fileInfos: [
                ...draftProp.fileInfos,
                ...fileInfos,
            ],
        };

        instance.handleFileUploadComplete(fileInfos, clientIds, channelId);

        expect(setDraft).toHaveBeenCalledWith(StoragePrefixes.DRAFT + channelId, expectedDraft, channelId);
    });

    it('check for handleUploadError callback', () => {
        const setDraft = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    setDraft,
                },
            }),
        );

        const instance: any = wrapper.instance();
        const uploadsInProgressDraft = {
            ...draftProp,
            uploadsInProgress: [
                ...draftProp.uploadsInProgress,
                'a',
            ],
        };

        wrapper.setProps({draft: uploadsInProgressDraft});

        instance.draftsForChannel[currentChannelProp.id] = uploadsInProgressDraft;
        instance.handleUploadError('error message', 'a', currentChannelProp.id);

        expect(setDraft).toHaveBeenCalledWith(StoragePrefixes.DRAFT + currentChannelProp.id, draftProp, currentChannelProp.id);
    });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('check for uploadsProgressPercent state on handleUploadProgress callback', () => {
    //     const wrapper = shallow(advancedCreatePost({}));
    //     wrapper.find(FileUpload).prop('onUploadProgress')({clientId: 'clientId', name: 'name', percent: 10, type: 'type'});
    //
    //     expect(wrapper.state('uploadsProgressPercent')).toEqual({clientId: {clientId: 'clientId', percent: 10, name: 'name', type: 'type'}});
    // });

    it('Remove preview from fileInfos', () => {
        const setDraft = jest.fn();
        const fileInfos = TestHelper.getFileInfoMock({
            id: 'a',
            extension: 'jpg',
            name: 'trimmedFilename',
        });
        const uploadsInProgressDraft = {
            ...draftProp,
            fileInfos: [
                ...draftProp.fileInfos,
                fileInfos,
            ],
        };

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    setDraft,
                },
                draft: {
                    ...draftProp,
                    ...uploadsInProgressDraft,
                },
            }),
        );

        const instance = wrapper.instance() as AdvancedCreatePost;
        instance.handleFileUploadChange = jest.fn();
        instance.removePreview('a');

        jest.advanceTimersByTime(Constants.SAVE_DRAFT_TIMEOUT);
        expect(setDraft).toHaveBeenCalledTimes(1);
        expect(setDraft).toHaveBeenCalledWith(StoragePrefixes.DRAFT + currentChannelProp.id, draftProp, currentChannelProp.id);
        expect(instance.handleFileUploadChange).toHaveBeenCalledTimes(1);
    });

    it('Show tutorial', () => {
        const wrapper = shallow(advancedCreatePost({
            showSendTutorialTip: true,
        }));
        expect(wrapper).toMatchSnapshot();
    });

    it('Should have called actions.onSubmitPost on sendMessage', async () => {
        const onSubmitPost = jest.fn();
        const wrapper = shallow(advancedCreatePost({
            actions: {
                ...baseProp.actions,
                onSubmitPost,
            },
        }));
        const post = TestHelper.getPostMock({message: 'message', file_ids: []});
        await (wrapper.instance() as AdvancedCreatePost).sendMessage(post);

        expect(onSubmitPost).toHaveBeenCalledTimes(1);
        expect(onSubmitPost.mock.calls[0][0]).toEqual(post);
        expect(onSubmitPost.mock.calls[0][1]).toEqual([]);
    });

    it('Should have called actions.selectPostFromRightHandSideSearchByPostId on replyToLastPost', () => {
        const selectPostFromRightHandSideSearchByPostId = jest.fn();
        let latestReplyablePostId = '';
        const wrapper = shallow(advancedCreatePost({
            actions: {
                ...baseProp.actions,
                selectPostFromRightHandSideSearchByPostId,
            },
            latestReplyablePostId,
        }));

        const event = {preventDefault: jest.fn()} as unknown as React.KeyboardEvent<Element>;

        (wrapper.instance() as AdvancedCreatePost).replyToLastPost(event);
        expect(selectPostFromRightHandSideSearchByPostId).not.toBeCalled();

        latestReplyablePostId = 'latest_replyablePost_id';
        wrapper.setProps({latestReplyablePostId});
        (wrapper.instance() as AdvancedCreatePost).replyToLastPost(event);
        expect(selectPostFromRightHandSideSearchByPostId).toHaveBeenCalledTimes(1);
        expect(selectPostFromRightHandSideSearchByPostId.mock.calls[0][0]).toEqual(latestReplyablePostId);
    });

    it('should match snapshot when cannot post', () => {
        const wrapper = shallow(advancedCreatePost({canPost: false}));
        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot when file upload disabled', () => {
        const wrapper = shallow(advancedCreatePost({canUploadFiles: false}));
        expect(wrapper).toMatchSnapshot();
    });

    it('should allow to force send invalid slash command as a message', async () => {
        const error = {
            message: 'No command found',
            server_error_id: 'api.command.execute_command.not_found.app_error',
        };
        const result: ActionResult = {
            error,
        };
        const executeCommand = jest.fn(() => Promise.resolve(result));
        const onSubmitPost = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    executeCommand,
                    onSubmitPost,
                },
            }),
        );

        wrapper.setState({
            message: '/fakecommand some text',
        });

        await (wrapper.instance() as AdvancedCreatePost).handleSubmit(submitEvent);
        expect(executeCommand).toHaveBeenCalled();
        expect(onSubmitPost).not.toHaveBeenCalled();

        await (wrapper.instance() as AdvancedCreatePost).handleSubmit(submitEvent);

        expect(onSubmitPost).toHaveBeenCalledWith(
            expect.objectContaining({
                message: '/fakecommand some text',
            }),
            expect.anything(),
        );
    });

    it('should throw away invalid command error if user resumes typing', async () => {
        const error = {
            message: 'No command found',
            server_error_id: 'api.command.execute_command.not_found.app_error',
        };

        const executeCommand = jest.fn().mockResolvedValue({error});
        const onSubmitPost = jest.fn();

        const wrapper = shallow(
            advancedCreatePost({
                actions: {
                    ...baseProp.actions,
                    executeCommand,
                    onSubmitPost,
                },
            }),
        );

        wrapper.setState({
            message: '/fakecommand some text',
        });

        const instance = wrapper.instance() as AdvancedCreatePost;

        await instance.handleSubmit(submitEvent);
        expect(executeCommand).toHaveBeenCalled();
        expect(onSubmitPost).not.toHaveBeenCalled();

        const event = {
            target: {
                value: 'some valid text',
            },
        } as unknown as React.ChangeEvent<TextboxElement>;

        instance.handleChange(event);

        await instance.handleSubmit(submitEvent);

        expect(onSubmitPost).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'some valid text',
            }),
            expect.anything(),
        );
    });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('should not enable the save button when message empty', () => {
    //     const wrapper = shallow(advancedCreatePost());
    //     const saveButton = wrapper.find('.post-body__actions .send-button');
    //
    //     expect(saveButton.hasClass('disabled')).toBe(true);
    // });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('should enable the save button when message not empty', () => {
    //     const wrapper = shallow(advancedCreatePost({draft: {...draftProp, message: 'a message'}}));
    //     const saveButton = wrapper.find('.post-body__actions .send-button');
    //
    //     expect(saveButton.hasClass('disabled')).toBe(false);
    // });

    /**
     * TODO@all: move this test to advanced_text_editor.test.tsx and rewrite it according to the component
     *
     * it is not possible to test for this here since we only shallow render
     *
     * @see: https://mattermost.atlassian.net/browse/MM-44343
     */
    // it('should enable the save button when a file is available for upload', () => {
    //     const wrapper = shallow(advancedCreatePost({draft: {...draftProp, fileInfos: [{id: '1'}]}}));
    //     const saveButton = wrapper.find('.post-body__actions .send-button');
    //
    //     expect(saveButton.hasClass('disabled')).toBe(false);
    // });

    testComponentForLineBreak(
        (value: string) => advancedCreatePost({draft: {...draftProp, message: value}}),
        (instance: any) => instance.state.message,
        false,
    );

    it('should match snapshot, can post; preview enabled', () => {
        const wrapper = shallow(advancedCreatePost({canPost: true}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot, can post; preview disabled', () => {
        const wrapper = shallow(advancedCreatePost({canPost: true}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot, cannot post; preview enabled', () => {
        const wrapper = shallow(advancedCreatePost({canPost: false}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot, cannot post; preview disabled', () => {
        const wrapper = shallow(advancedCreatePost({canPost: false}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot, post priority enabled', () => {
        const wrapper = shallow(advancedCreatePost({isPostPriorityEnabled: true}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot, post priority enabled, with priority important', () => {
        const wrapper = shallow(advancedCreatePost({isPostPriorityEnabled: true, draft: {...draftProp, metadata: {priority: {priority: PostPriority.IMPORTANT}}}}));

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot, post priority disabled, with priority important', () => {
        const wrapper = shallow(advancedCreatePost({isPostPriorityEnabled: false, draft: {...draftProp, metadata: {priority: {priority: PostPriority.IMPORTANT}}}}));

        expect(wrapper).toMatchSnapshot();
    });
});
