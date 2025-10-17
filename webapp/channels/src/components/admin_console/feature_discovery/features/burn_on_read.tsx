// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import BurnOnReadSVG from './images/burn_on_read_svg';

import FeatureDiscovery from '../index';

const BurnOnReadFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='burn_on_read'
            minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
            title={defineMessage({
                id: 'admin.burn_on_read_feature_discovery.title',
                defaultMessage: 'Enable secure ephemeral messaging with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.burn_on_read_feature_discovery.copy',
                defaultMessage: 'Send sensitive information with confidence using burn-on-read messages that automatically delete after viewing, ensuring compliance and data security.',
            })}
            learnMoreURL='https://docs.mattermost.com/deployment/burn-on-read-messages.html'
            featureDiscoveryImage={<BurnOnReadSVG/>}
        />
    );
};

export default BurnOnReadFeatureDiscovery;
