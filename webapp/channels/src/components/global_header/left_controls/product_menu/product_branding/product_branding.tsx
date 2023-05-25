// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';
import Heading from '@mattermost/compass-components/components/heading'; // eslint-disable-line no-restricted-imports

import {useCurrentProduct} from 'utils/products';

const ProductBrandingContainer = styled.div`
    display: flex;
    align-items: center;

    > * + * {
        margin-left: 8px;
    }
`;

const ProductBranding = (): JSX.Element => {
    const currentProduct = useCurrentProduct();

    const Icon = currentProduct?.switcherIcon ? glyphMap[currentProduct.switcherIcon] : ProductChannelsIcon;

    return (
        <ProductBrandingContainer tabIndex={0}>
            <Icon size={24}/>
            <Heading
                element='h1'
                size={200}
                margin='none'
            >
                {currentProduct ? currentProduct.switcherText : 'Channels'}
            </Heading>
        </ProductBrandingContainer>
    );
};

export default ProductBranding;
