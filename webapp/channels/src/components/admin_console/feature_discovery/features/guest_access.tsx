// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GuestAccessSVG from './images/guest_access_svg';

import FeatureDiscovery from '../index';

const GuestAccessFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='guest_access'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            title={defineMessage({
                id: 'admin.guest_access_feature_discovery.title',
                defaultMessage: 'Enable guest accounts with Mattermost Professional',
            })}
            copy={defineMessage({
                id: 'admin.guest_access_feature_discovery.copy',
                defaultMessage: 'Collaborate with users outside of your organization while tightly controlling their access channels and team members.',
            })}
            learnMoreURL='https://docs.mattermost.com/deployment/guest-accounts.html'
            featureDiscoveryImage={<GuestAccessSVG/>}
        />
    );
};

export default GuestAccessFeatureDiscovery;
