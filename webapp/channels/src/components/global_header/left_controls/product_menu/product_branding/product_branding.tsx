// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Heading from '@mattermost/compass-components/components/heading'; // eslint-disable-line no-restricted-imports
import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';

import {useCurrentProduct} from 'utils/products';

const ProductBrandingContainer = styled.span`
    display: flex;
    align-items: center;
`;

// Every style here except for 'margin-left' and 'font-family'is from the deprecated 'Heading' element.
// https://github.com/mattermost/compass-components/blob/362e96a4eb3489efc8c1852652859ef14a51eb64/src/components/heading/Heading.mixins.ts#L9-L74
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

            {/* Heading for screen readers since an h1 shouldn't be inside a button */}
            <Heading
                element='h1'
                size={200}
                margin='none'
                className='sr-only'
            >
                {currentProduct ? currentProduct.switcherText : 'Channels'}
            </Heading>

            <ProductBrandingHeading>
                {currentProduct ? currentProduct.switcherText : 'Channels'}
            </ProductBrandingHeading>
        </ProductBrandingContainer>
    );
};

export default ProductBranding;
