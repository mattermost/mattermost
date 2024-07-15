// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import tinycolor from 'tinycolor2';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import MattermostLogoSvg from 'images/logo.svg';

const LinkingLandingPageHeader = () => {
    const {
        SiteName,
        EnableCustomBrand,
        CustomBrandHasLogo,
        CustomBrandColorBackground,
    } = useSelector(getConfig);

    let logo = (
        <div className='get-app__header'>
            <img
                src={MattermostLogoSvg}
                className='get-app__logo'
            />
        </div>
    );
    if (EnableCustomBrand === 'true') {
        if (CustomBrandHasLogo === 'true') {
            const useDarkLogo = tinycolor(CustomBrandColorBackground || '#ffffff').isDark();
            logo = (
                <img
                    src={useDarkLogo ? Client4.getCustomDarkLogoUrl('0') : Client4.getCustomLightLogoUrl('0')}
                    className='get-app__custom-logo'
                />
            );
        } else {
            logo = (
                <div className='get-app__custom-site-name'>
                    <span>{SiteName}</span>
                </div>
            );
        }
    }

    return (
        <div className='get-app__header'>
            {logo}
        </div>
    );
};

export default LinkingLandingPageHeader;
