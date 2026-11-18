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

    describe('scheduling a message', () => {
        const schedulingInfo = {scheduled_at: Date.now() + 60000};

        function renderSubmit(serverError: UseSubmitParams[4] = mockServerError) {
            const {result} = renderHookWithContext(() => useSubmit(
                mockDraft,
                mockPostError,
                'channel_id',
                'root_id',
                serverError,
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
            return result.current[0];
        }

        it('should return the error message when the server rejects the scheduled post', async () => {
            const serverError = {server_error_id: 'model.scheduled_post.is_valid.scheduled_at.app_error', message: 'Invalid scheduled at time.'};
            jest.mocked(onSubmit).mockReturnValueOnce(() => Promise.resolve({error: serverError}));

            const response = await renderSubmit()(undefined, schedulingInfo);

            expect(response).toEqual({error: 'Invalid scheduled at time.'});
            expect(mockSetServerError).toHaveBeenCalledWith(expect.objectContaining({message: 'Invalid scheduled at time.'}));
        });

        it('should not return an error when the scheduled post is created', async () => {
            const response = await renderSubmit()(undefined, schedulingInfo);

            expect(response).toEqual({});
            expect(onSubmit).toHaveBeenCalledWith('channel_id', 'root_id', expect.anything(), expect.anything(), schedulingInfo);
        });

        it('should not let a previous server error block a scheduling retry', async () => {
            const previousError = {server_error_id: 'model.scheduled_post.is_valid.scheduled_at.app_error', message: 'Invalid scheduled at time.'};

            const response = await renderSubmit(previousError)(undefined, schedulingInfo);

            expect(response).toEqual({});
            expect(onSubmit).toHaveBeenCalledWith('channel_id', 'root_id', expect.anything(), expect.anything(), schedulingInfo);
        });

        it('should still block a non-scheduling submit after a previous server error', async () => {
            const previousError = {server_error_id: 'api.some.error', message: 'Some error'};

            const response = await renderSubmit(previousError)();

            expect(response).toEqual({});
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it('should not report an error thrown by afterSubmit once the scheduled post is created', async () => {
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.mocked(mockAfterSubmit).mockImplementationOnce(() => {
                throw new Error('afterSubmit failed');
            });
            jest.mocked(onSubmit).mockImplementationOnce((...args) => async () => {
                args[3].afterSubmit?.({created: true});
                return {data: {created: true}};
            });

            const response = await renderSubmit()(undefined, schedulingInfo);

            expect(response).toEqual({});
            expect(mockAfterSubmit).toHaveBeenCalled();
            expect(mockSetServerError).not.toHaveBeenCalledWith(expect.objectContaining({message: 'afterSubmit failed'}));
            consoleError.mockRestore();
        });
    });
});

