// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';

import {getConfig, isFreeEdition as isFreeEditionSelector, isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';

import ProductBrandingFreeEdition from './product_branding_free_edition';
import ProductBrandingLicensedEdition from './product_branding_licensed_edition';

export function ProductBranding() {
    const isFreeEdition = useSelector(isFreeEditionSelector);
    const productRailEnabled = useSelector(isProductRailEnabled);
    const siteName = useSelector(getConfig).SiteName || 'Mattermost';

    if (isFreeEdition) {
        return <ProductBrandingFreeEdition/>;
    }

    // The product rail already shows which product is open, so the header names the site instead:
    // the menu holds site-wide things (System Console, Integrations, About), and the label widens
    // the button so it's easy to hit.
    if (productRailEnabled) {
        return (
            <span className='globalHeader-leftControls-productBranding-licensedEdition globalHeader-leftControls-productBranding-siteName'>
                <span className='globalHeader-leftControls-productBranding-licensedEdition-heading'>
                    {siteName}
                </span>
                <ChevronDownIcon
                    size={16}
                    aria-hidden='true'
                />
            </span>
        );
    }

    return <ProductBrandingLicensedEdition/>;
}
