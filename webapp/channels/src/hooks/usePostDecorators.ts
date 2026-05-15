// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector, shallowEqual} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getPostDecoratorsForSlot} from 'selectors/post_decorator';

import type {GlobalState} from 'types/store';
import type {PostDecoratorRegistration, PostDecoratorSlot} from 'types/store/plugins';

const EMPTY_ARRAY: PostDecoratorRegistration[] = Object.freeze([] as PostDecoratorRegistration[]) as unknown as PostDecoratorRegistration[];

export function usePostDecorators(
    post: Post | null | undefined,
    slot: PostDecoratorSlot,
): PostDecoratorRegistration[] {
    return useSelector((state: GlobalState) => {
        if (!post) {
            return EMPTY_ARRAY;
        }
        return getPostDecoratorsForSlot(state, post, slot);
    }, shallowEqual);
}
