// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions, Preferences} from 'mattermost-redux/constants';

import {onSubmit} from 'actions/views/create_comment';
import {openModal} from 'actions/views/modals';
import {suppressOutOfChannelEphemeralPost} from 'actions/views/out_of_channel_mention';

import {renderHookWithContext, act, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import * as OutOfChannelMentions from 'utils/out_of_channel_mentions';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import useSubmit from './use_submit';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: ''})),
}));

jest.mock('actions/views/create_comment', () => ({
    onSubmit: jest.fn(() => async () => ({data: {}})),
}));

jest.mock('utils/out_of_channel_mentions', () => ({
    getOutOfChannelMentionsFromMessage: jest.fn(),
}));

jest.mock('actions/views/out_of_channel_mention', () => ({
    suppressOutOfChannelEphemeralPost: jest.fn(() => () => ({type: 'SUPPRESS_OUT_OF_CHANNEL_EPHEMERAL'})),
}));

describe('useSubmit', () => {
    const mockDraft: PostDraft = {
        message: 'Test message',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: 'channel_id',
        rootId: 'root_id',
    };

    type UseSubmitParams = Parameters<typeof useSubmit>;

    const mockPostError: UseSubmitParams[1] = null;
    const mockServerError: UseSubmitParams[4] = null;
    const mockLastBlurAt: UseSubmitParams[5] = {current: 0};
    const mockFocusTextbox: UseSubmitParams[6] = jest.fn();
    const mockSetServerError: UseSubmitParams[7] = jest.fn();
    const mockSetShowPreview: UseSubmitParams[8] = jest.fn();
    const mockHandleDraftChange: UseSubmitParams[9] = jest.fn();
    const mockPrioritySubmitCheck: UseSubmitParams[10] = jest.fn(() => false);
    const mockAfterOptimisticSubmit: UseSubmitParams[11] = jest.fn();
    const mockAfterSubmit: UseSubmitParams[12] = jest.fn();

    function getBaseState(): DeepPartial<GlobalState> {
        return {
            entities: {
                general: {
                    config: {
                        EnableConfirmNotificationsToChannel: 'true',
                    },
                },
                channels: {
                    channels: {
                        channel_id: TestHelper.getChannelMock({
                            id: 'channel_id',
                            team_id: 'team_id',
                        }),
                    },
                    stats: {
                        channel_id: {
                            member_count: 1,
                        },
                    },
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {
                            id: 'current_user_id',
                            roles: 'system_admin',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_admin: {
                            permissions: [
                                Permissions.USE_CHANNEL_MENTIONS,
                                Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
                            ],
                        },
                        system_user: {
                            permissions: [],
                        },
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        };
    }

    function getStateWithSkipOutOfChannelMentionConfirm(): DeepPartial<GlobalState> {
        const state = getBaseState();
        state.entities!.preferences!.myPreferences = {
            [`${Preferences.CATEGORY_ADVANCED_SETTINGS}--${Preferences.OUT_OF_CHANNEL_MENTION_SKIP_CONFIRM}`]: {
                category: Preferences.CATEGORY_ADVANCED_SETTINGS,
                name: Preferences.OUT_OF_CHANNEL_MENTION_SKIP_CONFIRM,
                user_id: 'current_user_id',
                value: 'true',
            },
        };
        return state;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).mockResolvedValue(null);
        jest.mocked(onSubmit).mockImplementation(() => async () => ({data: {}}));
    });

    type OutOfChannelMentionModalDialogProps = {
        addable: UserProfile[];
        channelId: string;
        rootId: string;
        onSend: () => void;
        onExited: () => void;
    };

    function getOutOfChannelModalCall(): {dialogProps: OutOfChannelMentionModalDialogProps} | undefined {
        const call = jest.mocked(openModal).mock.calls.find(
            ([args]) => args.modalId === ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
        )?.[0];

        if (!call) {
            return undefined;
        }

        return call as unknown as {dialogProps: OutOfChannelMentionModalDialogProps};
    }

    it('should check priority on non-edit mode', async () => {
        const {result} = renderHookWithContext(() => useSubmit(
            mockDraft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            false,
            'post_id',
        ), getBaseState());
        expect(result.current[0]).toBeDefined();

        const [handleSubmit] = result.current;

        await handleSubmit();

        expect(mockPrioritySubmitCheck).toHaveBeenCalled();
    });

    it('should not check priority on edit mode', async () => {
        const {result} = renderHookWithContext(() => useSubmit(
            mockDraft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            true,
            'post_id',
        ), getBaseState());
        expect(result.current[0]).toBeDefined();

        const [handleSubmit] = result.current;

        await handleSubmit();

        expect(mockPrioritySubmitCheck).not.toHaveBeenCalled();
    });

    it('should show notify all modal if member notify count is greater than 0 and not in edit mode', async () => {
        const baseState = getBaseState();
        baseState.entities!.channels!.stats!.channel_id!.member_count = 10;

        const draft = {...mockDraft, message: '@all'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            false,
            'post_id',
        ), baseState);
        expect(result.current[0]).toBeDefined();

        const [handleSubmit] = result.current;

        await handleSubmit();

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.NOTIFY_CONFIRM_MODAL,
        }));
    });

    it('should show notify all modal if member notify count is greater than 0 in edit mode', async () => {
        const baseState = getBaseState();
        baseState.entities!.channels!.stats!.channel_id!.member_count = 10;
        const draft = {...mockDraft, message: '@all'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            true,
            'post_id',
        ), baseState);
        expect(result.current[0]).toBeDefined();

        const [handleSubmit] = result.current;

        await handleSubmit();

        expect(openModal).not.toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.NOTIFY_CONFIRM_MODAL,
        }));
    });

    it('should handle commands if not in edit mode', async () => {
        const draft = {...mockDraft, message: '/header'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            false,
            'post_id',
        ), getBaseState());
        expect(result.current[0]).toBeDefined();

        const [handleSubmit] = result.current;

        await handleSubmit();

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
        }));
    });

    it('should not handle commands if in edit mode', async () => {
        const draft = {...mockDraft, message: '/header'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            true,
            'post_id',
        ), getBaseState());
        expect(result.current[0]).toBeDefined();

        const [handleSubmit] = result.current;

        await handleSubmit();

        expect(openModal).not.toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
        }));
    });

    it('should show out of channel mention modal when users are out of channel', async () => {
        const user = TestHelper.getUserMock({id: 'user1', username: 'alice'});
        jest.mocked(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).mockResolvedValue({
            addable: [user],
            notAddable: [],
            outOfTeam: [],
        });

        const draft = {...mockDraft, message: '@alice hello'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            false,
            'post_id',
        ), getBaseState());

        const [handleSubmit] = result.current;
        await handleSubmit();

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
        }));
    });

    it('should submit without modal when out of channel mention skip preference is enabled', async () => {
        const user = TestHelper.getUserMock({id: 'user1', username: 'alice'});
        jest.mocked(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).mockResolvedValue({
            addable: [user],
            notAddable: [],
            outOfTeam: [],
        });

        const draft = {...mockDraft, message: '@alice hello', rootId: ''};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            '',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            false,
            'post_id',
        ), getStateWithSkipOutOfChannelMentionConfirm());

        await result.current[0]();

        expect(openModal).not.toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
        }));
        expect(suppressOutOfChannelEphemeralPost).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: '@alice hello',
                    channelId: 'channel_id',
                    rootId: '',
                }),
                expect.any(Object),
                undefined,
            );
        });
    });

    it('should not show out of channel mention modal in edit mode', async () => {
        jest.mocked(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).mockResolvedValue({
            addable: [TestHelper.getUserMock({id: 'user1', username: 'alice'})],
            notAddable: [],
            outOfTeam: [],
        });

        const draft = {...mockDraft, message: '@alice hello'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            true,
            'post_id',
        ), getBaseState());

        const [handleSubmit] = result.current;
        await handleSubmit();

        expect(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).not.toHaveBeenCalled();
        expect(openModal).not.toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
        }));
    });

    it('should not show out of channel mention modal when user cannot manage members', async () => {
        const state = getBaseState();
        state.entities!.users!.profiles!.current_user_id!.roles = 'system_user';

        const draft = {...mockDraft, message: '@alice hello'};
        const {result} = renderHookWithContext(() => useSubmit(
            draft,
            mockPostError,
            'channel_id',
            'root_id',
            mockServerError,
            mockLastBlurAt,
            mockFocusTextbox,
            mockSetServerError,
            mockSetShowPreview,
            mockHandleDraftChange,
            mockPrioritySubmitCheck,
            mockAfterOptimisticSubmit,
            mockAfterSubmit,
            false,
            false,
            'post_id',
        ), state);

        const [handleSubmit] = result.current;
        await handleSubmit();

        expect(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).not.toHaveBeenCalled();
        expect(openModal).not.toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
        }));
    });

    describe('out of channel mention modal confirm and dismiss', () => {
        const addableUser = TestHelper.getUserMock({id: 'user1', username: 'alice'});

        beforeEach(() => {
            jest.mocked(OutOfChannelMentions.getOutOfChannelMentionsFromMessage).mockResolvedValue({
                addable: [addableUser],
                notAddable: [],
                outOfTeam: [],
            });
        });

        it('passes mention data and callbacks to the modal', async () => {
            const draft = {...mockDraft, message: '@alice hello', rootId: ''};
            const {result} = renderHookWithContext(() => useSubmit(
                draft,
                mockPostError,
                'channel_id',
                '',
                mockServerError,
                mockLastBlurAt,
                mockFocusTextbox,
                mockSetServerError,
                mockSetShowPreview,
                mockHandleDraftChange,
                mockPrioritySubmitCheck,
                mockAfterOptimisticSubmit,
                mockAfterSubmit,
                false,
                false,
                'post_id',
            ), getBaseState());

            await result.current[0]();

            const modalCall = getOutOfChannelModalCall();
            expect(modalCall).toEqual(expect.objectContaining({
                modalId: ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
                dialogProps: expect.objectContaining({
                    addable: [addableUser],
                    channelId: 'channel_id',
                    rootId: '',
                    onSend: expect.any(Function),
                    onExited: expect.any(Function),
                }),
            }));
        });

        it('submits the post when the modal confirms send', async () => {
            const draft = {...mockDraft, message: '@alice hello', rootId: ''};
            const {result} = renderHookWithContext(() => useSubmit(
                draft,
                mockPostError,
                'channel_id',
                '',
                mockServerError,
                mockLastBlurAt,
                mockFocusTextbox,
                mockSetServerError,
                mockSetShowPreview,
                mockHandleDraftChange,
                mockPrioritySubmitCheck,
                mockAfterOptimisticSubmit,
                mockAfterSubmit,
                false,
                false,
                'post_id',
            ), getBaseState());

            await result.current[0]();

            const modalCall = getOutOfChannelModalCall();
            expect(modalCall).toBeDefined();
            await act(async () => {
                modalCall!.dialogProps.onSend();
            });

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        message: '@alice hello',
                        channelId: 'channel_id',
                        rootId: '',
                    }),
                    expect.any(Object),
                    undefined,
                );
            });
            expect(mockHandleDraftChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: '',
                    channelId: 'channel_id',
                    rootId: '',
                }),
                {instant: true},
            );
        });

        it('allows another submit after the modal is dismissed without sending', async () => {
            const draft = {...mockDraft, message: '@alice hello', rootId: ''};
            const {result} = renderHookWithContext(() => useSubmit(
                draft,
                mockPostError,
                'channel_id',
                '',
                mockServerError,
                mockLastBlurAt,
                mockFocusTextbox,
                mockSetServerError,
                mockSetShowPreview,
                mockHandleDraftChange,
                mockPrioritySubmitCheck,
                mockAfterOptimisticSubmit,
                mockAfterSubmit,
                false,
                false,
                'post_id',
            ), getBaseState());

            await result.current[0]();

            const modalCall = getOutOfChannelModalCall();
            expect(modalCall).toBeDefined();
            modalCall!.dialogProps.onExited();

            expect(onSubmit).not.toHaveBeenCalled();

            await result.current[0]();

            expect(getOutOfChannelModalCall()).toBeDefined();
            expect(jest.mocked(openModal).mock.calls.filter(
                ([args]) => args.modalId === ModalIdentifiers.OUT_OF_CHANNEL_MENTION_CONFIRM_MODAL,
            )).toHaveLength(2);
        });
    });
});

