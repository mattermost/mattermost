// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {isFreeEdition as isFreeEditionSelector} from 'mattermost-redux/selectors/entities/general';

import ProductBrandingFreeEdition from './product_branding_free_edition';
import ProductBrandingLicensedEdition from './product_branding_licensed_edition';

export function ProductBranding() {
    const isFreeEdition = useSelector(isFreeEditionSelector);

    if (isFreeEdition) {
        return <ProductBrandingFreeEdition/>;
    }

    return <ProductBrandingLicensedEdition/>;
}
