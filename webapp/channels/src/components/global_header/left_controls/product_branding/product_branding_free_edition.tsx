// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import MattermostLogo from 'components/common/svg_images_components/logo_dark_blue_svg';

import {LicenseSkus} from 'utils/constants';

const ProductBrandingFreeEdition = (): JSX.Element => {
    const license = useSelector(getLicense);

    let badgeText = '';
    if (license?.SkuShortName === LicenseSkus.Entry) {
        badgeText = 'ENTRY EDITION';
    } else if (license?.IsLicensed === 'false') {
        badgeText = 'TEAM EDITION';
    }

    return (
        <span className='globalHeader-leftControls-productBranding-freeEdition'>
            <MattermostLogo
                className='globalHeader-leftControls-productBranding-freeEdition-logo'
                width={116}
                height={20}
            />
            <span className='globalHeader-leftControls-productBranding-freeEdition-badge'>
                {badgeText}
            </span>
        </span>
    );
};

export default ProductBrandingFreeEdition;
