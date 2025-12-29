// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import glyphMap, {CheckIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {ProductIdentifier} from '@mattermost/types/products';

import {selectProducts} from 'selectors/products';

import * as Menu from 'components/menu';

interface Props {
    currentProductID: ProductIdentifier;
}

export default function ProductSwitcherProductsMenuItems(props: Props) {
    const products = useSelector(selectProducts);

    if (products.length === 0) {
        return <></>;
    }

    return (
        <>
            {products.map((product) => (
                <ProductSwitcherProductMenuItem
                    key={product.id}
                    icon={product.switcherIcon}
                    label={product.switcherText}
                    link={product.switcherLinkURL}
                    isActive={product.id === props.currentProductID}
                />
            ))}
        </>
    );
}

interface ProductSwitcherProductMenuItemProps {
    icon: IconGlyphTypes;
    label: React.ReactNode;
    link: string;
    isActive: boolean;
}

function ProductSwitcherProductMenuItem(props: ProductSwitcherProductMenuItemProps) {
    const history = useHistory();

    const Icon = glyphMap[props.icon];

    function handleClick() {
        history.push(props.link);
    }

    return (
        <Menu.Item
            className='globalHeader-leftControls-productSwitcherMenu-productMenuItem'
            leadingElement={(
                <Icon
                    size={20}
                    aria-hidden='true'
                />
            )}
            labels={(
                <span>
                    {props.label}
                </span>
            )}
            trailingElements={props.isActive && (
                <CheckIcon
                    size={18}
                    aria-hidden='true'
                />
            )}
            onClick={handleClick}
        />
    );
}
