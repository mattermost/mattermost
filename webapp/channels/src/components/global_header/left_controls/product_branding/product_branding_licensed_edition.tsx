// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';

import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {useCurrentProduct} from 'utils/products';

const ProductBranding = (): JSX.Element => {
    const currentProduct = useCurrentProduct();

    const productName = currentProduct ? currentProduct.switcherText : 'Channels';

    // Products may register either a compass icon name or a React element.
    const renderIcon = () => {
        if (!currentProduct?.switcherIcon) {
            return <ProductChannelsIcon size={24}/>;
        }

        if (typeof currentProduct.switcherIcon === 'string') {
            const Icon = glyphMap[currentProduct.switcherIcon as IconGlyphTypes];

            return Icon ? <Icon size={24}/> : <ProductChannelsIcon size={24}/>;
        }

        return <>{currentProduct.switcherIcon}</>;
    };

    return (
        <span className='globalHeader-leftControls-productBranding-licensedEdition'>
            {renderIcon()}
            <span className='globalHeader-leftControls-productBranding-licensedEdition-heading'>
                {productName}
            </span>
        </span >
    );
};

export default ProductBranding;
