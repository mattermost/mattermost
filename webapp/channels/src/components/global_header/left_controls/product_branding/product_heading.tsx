// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useCurrentProduct} from 'utils/products';

/**
 * Names the current product for assistive technology. It is kept separate from
 * ProductBranding because that renders inside the product menu button, and a
 * heading cannot live inside a button.
 */
export function ProductHeading() {
    const currentProduct = useCurrentProduct();

    return (
        <h1 className='sr-only'>
            {currentProduct ? currentProduct.switcherText : 'Channels'}
        </h1>
    );
}
