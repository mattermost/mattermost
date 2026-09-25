// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {PostTypes} from 'utils/constants';

import type {PostDraft} from 'types/store/draft';
import {draftHasAttachments} from 'types/store/draft';

// Why a message can't be scheduled to repeat weekly. Undefined means nothing is stopping it.
export type RepeatDisabledReason = 'attachments' | 'burn_on_read';

// file_ids alone is not enough: the server only fills in metadata.files when the scheduled post
// list is fetched, so a post that arrived over the websocket has ids and no file infos.
function scheduledPostHasAttachments(scheduledPost: ScheduledPost): boolean {
    return Boolean(scheduledPost.file_ids?.length || scheduledPost.metadata?.files?.length);
}

// The two functions below apply the same rules in the same order, so a message that is both
// burn-on-read and carries an attachment reports the attachment whichever shape it arrives in.
export function getDraftRepeatDisabledReason(draft: Pick<PostDraft, 'fileInfos' | 'uploadsInProgress' | 'type'>): RepeatDisabledReason | undefined {
    if (draftHasAttachments(draft)) {
        return 'attachments';
    }

    if (draft.type === PostTypes.BURN_ON_READ) {
        return 'burn_on_read';
    }

    return undefined;
}

export function getScheduledPostRepeatDisabledReason(scheduledPost: ScheduledPost): RepeatDisabledReason | undefined {
    if (scheduledPostHasAttachments(scheduledPost)) {
        return 'attachments';
    }

    if (scheduledPost.type === PostTypes.BURN_ON_READ) {
        return 'burn_on_read';
    }

    return undefined;
}
