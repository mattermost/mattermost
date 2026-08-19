// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {onSubmit} from 'actions/views/create_comment';
import {openModal} from 'actions/views/modals';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import useSubmit from './use_submit';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: ''})),
}));

jest.mock('actions/views/create_comment', () => ({
    ...jest.requireActual('actions/views/create_comment'),
    onSubmit: jest.fn(() => () => Promise.resolve({data: true})),
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
                        channel_id: {},
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
                            permissions: [Permissions.USE_CHANNEL_MENTIONS],
                        },
                    },
                },
            },
        };
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

    // Cmd+K (Find Channels) only history.push-es; SELECT_CHANNEL and the composer
    // draft swap happen later. The focused textbox can submit a new message whose
    // draft.channelId is still the channel we switched away from.
    it('should submit a new message to the destination channel when the draft still belongs to the previous channel', async () => {
        const sourceChannelId = 'source_channel_id';
        const destinationChannelId = 'destination_channel_id';
        const message = 'new message composed for the destination channel';

        const state = getBaseState();
        state.entities!.channels!.channels = {
            [sourceChannelId]: {},
            [destinationChannelId]: {},
        };
        state.entities!.channels!.stats = {
            [sourceChannelId]: {member_count: 1},
            [destinationChannelId]: {member_count: 1},
        };

        const staleDraft: PostDraft = {
            ...mockDraft,
            message,
            channelId: sourceChannelId,
            rootId: '',
        };

        const {result} = renderHookWithContext(() => useSubmit(
            staleDraft,
            mockPostError,
            destinationChannelId,
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
        ), state);

        const [handleSubmit] = result.current;
        await handleSubmit();

        // The post is routed by the editor's channel and thread, not by the ids the
        // draft happens to carry.
        expect(onSubmit).toHaveBeenCalledWith(
            destinationChannelId,
            '',
            expect.objectContaining({
                message,
                channelId: sourceChannelId,
            }),
            expect.anything(),
            undefined,
        );
    });
});

