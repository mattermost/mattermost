// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FileInfo} from '@mattermost/types/files';
import type {PostMetadata} from '@mattermost/types/posts';
import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {getDraftRepeatDisabledReason, getScheduledPostRepeatDisabledReason} from 'utils/scheduled_post_repeat';

import type {PostDraft} from 'types/store/draft';

function makeDraft(overrides: Partial<PostDraft> = {}): PostDraft {
    return {
        message: 'a message',
        fileInfos: [],
        uploadsInProgress: [],
        channelId: 'channel_id',
        rootId: '',
        createAt: 0,
        updateAt: 0,
        ...overrides,
    };
}

function makeScheduledPost(overrides: Partial<ScheduledPost> = {}): ScheduledPost {
    return {
        id: 'scheduled_post_id',
        message: 'a message',
        create_at: 0,
        update_at: 0,
        user_id: 'user_id',
        channel_id: 'channel_id',
        root_id: '',
        props: {},
        scheduled_at: 0,
        ...overrides,
    };
}

describe('getDraftRepeatDisabledReason', () => {
    it('should allow repeating an ordinary message', () => {
        expect(getDraftRepeatDisabledReason(makeDraft())).toBeUndefined();
    });

    it('should block repeating when a file is attached', () => {
        expect(getDraftRepeatDisabledReason(makeDraft({fileInfos: [{id: 'file_id'} as FileInfo]}))).toBe('attachments');
    });

    it('should block repeating while a file is still uploading', () => {
        expect(getDraftRepeatDisabledReason(makeDraft({uploadsInProgress: ['file_id']}))).toBe('attachments');
    });

    it('should block repeating a burn-on-read message', () => {
        expect(getDraftRepeatDisabledReason(makeDraft({type: 'burn_on_read'}))).toBe('burn_on_read');
    });

    it('should report attachments first when a burn-on-read message also has one', () => {
        expect(getDraftRepeatDisabledReason(makeDraft({
            type: 'burn_on_read',
            fileInfos: [{id: 'file_id'} as FileInfo],
        }))).toBe('attachments');
    });
});

describe('getScheduledPostRepeatDisabledReason', () => {
    it('should allow repeating an ordinary message', () => {
        expect(getScheduledPostRepeatDisabledReason(makeScheduledPost())).toBeUndefined();
    });

    // A scheduled post arriving over the websocket carries file_ids but no metadata, since the
    // server only fills in file infos when the list is fetched.
    it('should block repeating when only file ids are present', () => {
        expect(getScheduledPostRepeatDisabledReason(makeScheduledPost({file_ids: ['file_id']}))).toBe('attachments');
    });

    it('should block repeating when file infos are present', () => {
        expect(getScheduledPostRepeatDisabledReason(makeScheduledPost({
            metadata: {files: [{id: 'file_id'} as FileInfo]} as PostMetadata,
        }))).toBe('attachments');
    });

    it('should block repeating a burn-on-read message', () => {
        expect(getScheduledPostRepeatDisabledReason(makeScheduledPost({type: 'burn_on_read'}))).toBe('burn_on_read');
    });

    it('should report attachments first when a burn-on-read message also has one', () => {
        expect(getScheduledPostRepeatDisabledReason(makeScheduledPost({
            type: 'burn_on_read',
            file_ids: ['file_id'],
        }))).toBe('attachments');
    });
});
