// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {useIntl} from 'react-intl';

import glyphMap, {ProductBoardsIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {useCurrentProduct} from 'utils/products';

import useInBoardsSection from './use_in_boards_section';

const ProductBranding = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const currentProduct = useCurrentProduct();
    const inBoards = useInBoardsSection();

    let productName: React.ReactNode = 'Channels';
    if (currentProduct) {
        productName = currentProduct.switcherText;
    } else if (inBoards) {
        productName = formatMessage({id: 'globalHeader.productBranding.boards', defaultMessage: 'Boards', description: 'Product name in the global header while the channel sidebar is narrowed to boards.'});
    }

    // Products may register either a compass icon name or a React element.
    const renderIcon = () => {
        if (inBoards) {
            return <ProductBoardsIcon size={24}/>;
        }

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
