// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector, shallowEqual} from 'react-redux';

import {getChannelDecoratorsForSlot} from 'selectors/channel_decorator';

import type {GlobalState} from 'types/store';
import type {ChannelDecoratorRegistration, ChannelDecoratorSlot} from 'types/store/plugins';

const EMPTY_ARRAY: ChannelDecoratorRegistration[] = Object.freeze([] as ChannelDecoratorRegistration[]) as unknown as ChannelDecoratorRegistration[];

/**
 * Returns matching ChannelDecoratorRegistration[] for the given channel and slot.
 *
 * For the 'intro' slot: returned array has at most one element (first-match-wins).
 * Render sites use `matches[0] ?? null` for intro, and `matches.map(...)` for additive slots.
 */
export function useChannelDecorators(
    channelId: string | null | undefined,
    slot: ChannelDecoratorSlot,
): ChannelDecoratorRegistration[] {
    return useSelector((state: GlobalState) => {
        if (!channelId) {
            return EMPTY_ARRAY;
        }
        return getChannelDecoratorsForSlot(state, channelId, slot);
    }, shallowEqual);
}
