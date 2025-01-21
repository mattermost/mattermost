// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import ProductBrandingLicensed from './product_branding_licensed';
import ProductBrandingTeamEdition from './product_branding_team_edition';

export default function ProductBranding() {
    const license = useSelector(getLicense);

    if (license.IsLicensed === 'false') {
        return (
            <div className='product_branding_container'>
                <ProductBrandingTeamEdition/>
            </div>
        );
    }

    if (license.IsLicensed === 'true') {
        return (
            <div className='product_branding_container'>
                <ProductBrandingLicensed/>
            </div>
        );
    }

    return null;
}
