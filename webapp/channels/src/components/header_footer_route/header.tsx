// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import BackButton from 'components/common/back_button';
import Logo from 'components/common/svg_images_components/logo_dark_blue_svg';

import './header.scss';

export type HeaderProps = {
    alternateLink?: React.ReactElement;
    backButtonURL?: string;
    onBackButtonClick?: React.EventHandler<React.MouseEvent>;
}

const Header = ({alternateLink, backButtonURL, onBackButtonClick}: HeaderProps) => {
    const {EnableCustomBrand, SiteName} = useSelector(getConfig);
    const license = useSelector(getLicense);

    const ariaLabel = EnableCustomBrand === 'true' && SiteName ? SiteName : 'Mattermost';

    let title = EnableCustomBrand === 'true' || SiteName !== 'Mattermost' ? SiteName : <Logo/>;
    if (license.IsLicensed === 'false') {
        title = <><Logo /><span className='freeBadge'>{'FREE EDITION'}</span></>
    }

    return (
        <div className='hfroute-header'>
            <div className='header-main'>
                <Link
                    className='header-logo-link'
                    to='/'
                    aria-label={ariaLabel}
                >
                    {title}
                </Link>
                {alternateLink}
            </div>
            {onBackButtonClick && (
                <BackButton
                    className='header-back-button'
                    url={backButtonURL}
                    onClick={onBackButtonClick}
                />
            )}
        </div>
    );
};

export default Header;
