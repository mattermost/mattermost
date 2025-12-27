// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {LicenseSkus} from 'utils/constants';

import ProductBrandingFreeEdition from './product_branding_free_edition';
import ProductBrandingLicencedEdition from './product_branding_licenced_edition';

export function ProductBranding() {
    const license = useSelector(getLicense);

    const isFreeEdition = license.IsLicensed === 'false' || license.SkuShortName === LicenseSkus.Entry;
    const isLicencedEdition = license.IsLicensed === 'true';

    if (isFreeEdition) {
        return <ProductBrandingFreeEdition/>;
    }

    if (isLicencedEdition) {
        return <ProductBrandingLicencedEdition/>;
    }

    return null;
}
