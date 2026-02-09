// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import useSubmit from 'components/advanced_text_editor/use_submit';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: ''})),
}));

jest.mock('actions/views/create_comment', () => ({
    onSubmit: jest.fn(() => ({type: 'MOCK_ON_SUBMIT'})),
}));

const mockEditPost = jest.fn(() => ({type: 'MOCK_EDIT_POST'}));
jest.mock('actions/views/posts', () => ({
    editPost: (...args: any[]) => mockEditPost(...args),
}));

describe('useSubmit - spoiler file handling in edit mode', () => {
    const mockDraft: PostDraft = {
        message: 'Test message',
        fileInfos: [
            {id: 'file1', name: 'img1.png'} as any,
            {id: 'file2', name: 'img2.png'} as any,
        ],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: 'channel_id',
        rootId: '',
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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should attach spoiler_files to post props when editing with spoilerFileIds', async () => {
        const draftWithSpoilers: PostDraft = {
            ...mockDraft,
            spoilerFileIds: ['file1'],
        };

        const {result} = renderHookWithContext(() => useSubmit(
            draftWithSpoilers,
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
            undefined,
            undefined,
            false,
            true, // isInEditMode
            'post_id',
        ), getBaseState());

        const [handleSubmit] = result.current;
        await handleSubmit();

        expect(mockEditPost).toHaveBeenCalledWith(
            expect.objectContaining({
                props: expect.objectContaining({
                    spoiler_files: {file1: true},
                }),
            }),
        );
    });

    it('should clear spoiler_files when all spoilers removed in edit mode', async () => {
        const draftNoSpoilers: PostDraft = {
            ...mockDraft,
            spoilerFileIds: [],
            props: {
                spoiler_files: {file1: true},
            },
        };

        const {result} = renderHookWithContext(() => useSubmit(
            draftNoSpoilers,
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
            undefined,
            undefined,
            false,
            true, // isInEditMode
            'post_id',
        ), getBaseState());

        const [handleSubmit] = result.current;
        await handleSubmit();

        expect(mockEditPost).toHaveBeenCalledWith(
            expect.objectContaining({
                props: expect.objectContaining({
                    spoiler_files: undefined,
                }),
            }),
        );
    });

    it('should only include spoiler_files for file IDs that exist in fileInfos', async () => {
        const draftWithOrphanSpoiler: PostDraft = {
            ...mockDraft,
            spoilerFileIds: ['file1', 'nonexistent_file'],
        };

        const {result} = renderHookWithContext(() => useSubmit(
            draftWithOrphanSpoiler,
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
            undefined,
            undefined,
            false,
            true, // isInEditMode
            'post_id',
        ), getBaseState());

        const [handleSubmit] = result.current;
        await handleSubmit();

        // Should only include file1 (exists in fileInfos), not nonexistent_file
        expect(mockEditPost).toHaveBeenCalledWith(
            expect.objectContaining({
                props: expect.objectContaining({
                    spoiler_files: {file1: true},
                }),
            }),
        );
    });
});
