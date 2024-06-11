// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import SamlSVG from './images/saml_svg';

import FeatureDiscovery from '../index';

const SAMLFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='saml'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            title={defineMessage({
                id: 'admin.saml_feature_discovery.title',
                defaultMessage: 'Integrate SAML 2.0 with Mattermost Professional',
            })}
            copyID={defineMessage({
                id: 'admin.saml_feature_discovery.copy',
                defaultMessage: 'When you connect Mattermost with your organization\'s single sign-on provider, users can access Mattermost without having to re-enter their credentials.',
            })}
            learnMoreURL='https://www.mattermost.com/docs-saml/?utm_medium=product&utm_source=product-feature-discovery&utm_content=saml'
            featureDiscoveryImage={<SamlSVG/>}
        />
    );
};

export default SAMLFeatureDiscovery;
