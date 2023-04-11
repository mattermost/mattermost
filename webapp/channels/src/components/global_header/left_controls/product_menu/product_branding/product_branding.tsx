// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';
import React from 'react';
import styled from 'styled-components';

import Heading from '@mattermost/compass-components/components/heading';

import {Typography} from '@mattermost/compass-ui';
import {useCurrentProduct} from 'utils/products';
import {useSelector} from 'react-redux';
import {getNewUIEnabled} from 'mattermost-redux/selectors/entities/preferences';

const ProductBrandingContainer = styled.div`
    display: flex;
    align-items: center;

    > * + * {
        margin-left: 8px;
    }
`;

const ProductBranding = (): JSX.Element => {
    const currentProduct = useCurrentProduct();
    const isNewUI = useSelector(getNewUIEnabled);

    const Icon = currentProduct?.switcherIcon ? glyphMap[currentProduct.switcherIcon] : ProductChannelsIcon;

    return (
        <ProductBrandingContainer tabIndex={0}>
            <Icon size={20}/>
            {isNewUI ? (
                <Typography
                    variant={'h200'}
                    margin={0}
                >
                    {currentProduct ? currentProduct.switcherText : 'Channels'}
                </Typography>

            ) : (
                <Heading
                    element='h1'
                    size={200}
                    margin='none'
                >
                    {currentProduct ? currentProduct.switcherText : 'Channels'}
                </Heading>
            )}
        </ProductBrandingContainer>
    );
};

export default ProductBranding;
