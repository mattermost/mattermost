// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {loadFlaggedPost} from 'mattermost-redux/actions/content_flagging';
import {getFlaggedPost} from 'mattermost-redux/selectors/entities/content_flagging';

import {makeUseEntity} from 'components/common/hooks/useEntity';

export const useGetFlaggedPost = makeUseEntity<Post | undefined>({
    name: 'useGetFlaggedPost',
    fetch: loadFlaggedPost,
    selector: getFlaggedPost,
});
