// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LicenseSkus} from 'utils/constants';
import {t} from 'utils/i18n';

import AnnouncementBannerSVG from './images/announcement_banner_svg';

import FeatureDiscovery from '../index';

const AnnouncementBannerFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='announcement_banner'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            titleID='admin.announcement_banner_feature_discovery.title'
            titleDefault='Create custom announcement banners with Mattermost Professional'
            copyID='admin.announcement_banner_feature_discovery.copy'
            copyDefault={'Create announcement banners to notify all members of important information.'}
            learnMoreURL='https://docs.mattermost.com/administration/announcement-banner.html'
            featureDiscoveryImage={<AnnouncementBannerSVG/>}
        />
    );
};

t('admin.announcement_banner_feature_discovery.title');
t('admin.announcement_banner_feature_discovery.copy');

export default AnnouncementBannerFeatureDiscovery;
