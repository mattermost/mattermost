// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import Logo from 'components/svg_images_components/logo_dark_blue_svg';

import HistoryBackButton from 'design_system/components/patterns/history_back_button';
import {LicenseSkus} from 'utils/constants';

import './header.scss';

export type HeaderProps = {
    alternateLink?: React.ReactElement;
    backButtonURL?: string;
    onBackButtonClick?: React.EventHandler<React.MouseEvent>;
}

const Header = ({alternateLink, backButtonURL, onBackButtonClick}: HeaderProps) => {
    const {SiteName} = useSelector(getConfig);
    const license = useSelector(getLicense);

    const ariaLabel = SiteName || 'Mattermost';

    let freeBanner = null;
    if (license.IsLicensed === 'false') {
        freeBanner = <><Logo/><span className='freeBadge'>{'TEAM EDITION'}</span></>;
    } else if (license.SkuShortName === LicenseSkus.Entry) {
        freeBanner = <><Logo/><span className='freeBadge'>{'ENTRY EDITION'}</span></>;
    }

    let title: React.ReactNode = SiteName;
    if (title === 'Mattermost') {
        if (freeBanner) {
            title = '';
        } else {
            title = <Logo/>;
        }
    }

    return (
        <div className={classNames('hfroute-header', {'has-free-banner': freeBanner, 'has-custom-site-name': title})}>
            <div className='header-main'>
                <div>
                    {freeBanner &&
                        <Link
                            className='header-logo-link'
                            to='/'
                            aria-label={ariaLabel}
                        >
                            {freeBanner}
                        </Link>
                    }
                    {title &&
                        <Link
                            className='header-logo-link'
                            to='/'
                            aria-label={ariaLabel}
                        >
                            {title}
                        </Link>
                    }
                </div>
                {alternateLink}
            </div>
            {onBackButtonClick && (
                <HistoryBackButton
                    className='header-back-button'
                    url={backButtonURL}
                    onClick={onBackButtonClick}
                />
            )}
        </div>
    );
};

export default Header;
