// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import Icon from '@mattermost/compass-components/foundations/icon';
import Heading from '@mattermost/compass-components/components/heading';

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

    return (
        <ProductBrandingContainer tabIndex={0}>
            <Icon
                size={20}
                glyph={currentProduct && typeof currentProduct.switcherIcon === 'string' ? currentProduct.switcherIcon : 'product-channels'}
            />
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
