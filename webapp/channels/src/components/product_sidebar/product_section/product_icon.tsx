// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Link} from 'react-router-dom';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import WithTooltip from 'components/with_tooltip';

import './product_icon.scss';

export interface ProductIconProps {

    /**
     * Compass icon name from product.switcherIcon
     */
    icon: IconGlyphTypes;

    /**
     * URL path from product.switcherLinkURL
     */
    destination: string;

    /**
     * Product name from product.switcherText
     */
    name: React.ReactNode;

    /**
     * Whether this is the current product
     */
    active: boolean;

    /**
     * Optional click handler
     */
    onClick?: () => void;
}

/**
 * ProductIcon renders a single product navigation icon with:
 * - Dynamic compass icon via glyphMap lookup
 * - React Router Link navigation
 * - WithTooltip showing product name on hover
 * - Active state with blue bar indicator
 */
const ProductIcon = ({icon, destination, name, active, onClick}: ProductIconProps): JSX.Element => {
    // Fallback to product-channels icon if the specified icon doesn't exist in glyphMap
    const IconComponent = glyphMap[icon] || glyphMap['product-channels'];

    return (
        <WithTooltip
            title={name}
            isVertical={false}
        >
            <div
                className={classNames('ProductIcon', {
                    'ProductIcon--active': active,
                })}
            >
                <Link
                    to={destination}
                    onClick={onClick}
                    aria-current={active ? 'page' : undefined}
                >
                    <IconComponent
                        size={20}
                        color={active ? 'var(--sidebar-text)' : 'rgba(var(--sidebar-text-rgb), 0.64)'}
                    />
                </Link>
            </div>
        </WithTooltip>
    );
};

export default ProductIcon;
