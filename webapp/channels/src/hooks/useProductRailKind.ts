// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getProductRailFilter} from 'selectors/views/product_rail';

import type {GlobalState} from 'types/store';
import type {ChannelKind} from 'types/store/plugins';

/**
 * The kind the channel sidebar is narrowed to by the product rail ('board' on the Boards item,
 * otherwise 'channel'), for sidebar text that names the list as a whole rather than one channel.
 * It picks the message from a KindMessages entry, as useChannelKind does for a single channel.
 */
export function useProductRailKind(): ChannelKind {
    return useSelector((state: GlobalState) => (getProductRailFilter(state) === 'boards' ? 'board' : 'channel'));
}
