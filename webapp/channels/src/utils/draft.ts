// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostDraft} from 'types/store/draft';

export function isDraftEmpty(draft: PostDraft): boolean {
    return !draft || (!draft.message && draft.fileInfos.length === 0);
}
