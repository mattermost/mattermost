// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UsersState} from '@mattermost/types/users';
import type {UserThread, ThreadsState} from '@mattermost/types/threads';

export type ExtraData = {
    threadsToDelete?: UserThread[];
    threads: ThreadsState['threads'];
    currentUserId?: UsersState['currentUserId'];
}
