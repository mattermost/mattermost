// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {useCurrentProduct} from 'utils/products';

import useInBoardsSection from './use_in_boards_section';

/**
 * Names the current product for assistive technology. It is kept separate from
 * ProductBranding because that renders inside the product menu button, and a
 * heading cannot live inside a button.
 */
export function ProductHeading() {
    const {formatMessage} = useIntl();
    const currentProduct = useCurrentProduct();
    const inBoards = useInBoardsSection();

    let productName: React.ReactNode = 'Channels';
    if (currentProduct) {
        productName = currentProduct.switcherText;
    } else if (inBoards) {
        productName = formatMessage({id: 'globalHeader.productBranding.boards', defaultMessage: 'Boards', description: 'Product name in the global header while the channel sidebar is narrowed to boards.'});
    }

    return (
        <h1 className='sr-only'>
            {productName}
        </h1>
    );
}
