// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import LinkingLandingPage from './linking_landing_page';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        desktopAppLink: config.AppDownloadLink,
        iosAppLink: config.IosAppDownloadLink,
        androidAppLink: config.AndroidAppDownloadLink,
        defaultTheme: getTheme(state),
        siteUrl: config.SiteURL,
        siteName: config.SiteName,
        brandImageUrl: Client4.getBrandImageUrl('0'),
        enableCustomBrand: config.EnableCustomBrand === 'true',
    };
}

export default connect(mapStateToProps)(LinkingLandingPage);
