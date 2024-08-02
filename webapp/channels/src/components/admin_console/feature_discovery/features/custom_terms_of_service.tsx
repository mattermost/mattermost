// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import CustomTermsOfServiceSVG from './images/custom_terms_of_service_svg';

import FeatureDiscovery from '../index';

const CustomTermsOfServiceFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='custom_terms_of_service'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.custom_terms_of_service_feature_discovery.title',
                defaultMessage: 'Create custom terms of service with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.custom_terms_of_service_feature_discovery.copy',
                defaultMessage: 'Create your own terms of service that new users must accept before accessing your Mattermost instance on desktop, web, or mobile.',
            })}
            learnMoreURL='https://docs.mattermost.com/cloud/cloud-administration/custom-terms-of-service.html'
            featureDiscoveryImage={<CustomTermsOfServiceSVG/>}
        />
    );
};

export default CustomTermsOfServiceFeatureDiscovery;
