// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getProductRailSection} from 'selectors/views/product_rail';

import {useCurrentProduct} from 'utils/products';

/**
 * Whether the user is in Boards: the channels product with the channel sidebar narrowed to boards,
 * which the header then names in place of Channels.
 */
export default function useInBoardsSection(): boolean {
    const currentProduct = useCurrentProduct();
    const section = useSelector(getProductRailSection);
    return !currentProduct && section === 'boards';
}
