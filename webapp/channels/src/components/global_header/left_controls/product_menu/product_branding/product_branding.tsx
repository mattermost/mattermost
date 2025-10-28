// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';

import {useCurrentProduct} from 'utils/products';

const ProductBrandingContainer = styled.span`
    display: flex;
    align-items: center;
`;

const ProductBrandingHeading = styled.span`
    font-family: 'Metropolis';
    font-size: 16px;
    line-height: 24px;
    font-weight: bold;
    margin: 0;
    color: inherit;

    margin-left: 8px;
`;

const ProductBranding = (): JSX.Element => {
    const currentProduct = useCurrentProduct();

    const Icon = currentProduct?.switcherIcon ? glyphMap[currentProduct.switcherIcon] : ProductChannelsIcon;

    return (
        <ProductBrandingContainer tabIndex={-1}>
            <Icon size={24}/>
            <h1 className='sr-only'>
                {currentProduct ? currentProduct.switcherText : 'Channels'}
            </h1>
            <ProductBrandingHeading>
                {currentProduct ? currentProduct.switcherText : 'Channels'}
            </ProductBrandingHeading>
        </ProductBrandingContainer>
    );
};

export default ProductBranding;
