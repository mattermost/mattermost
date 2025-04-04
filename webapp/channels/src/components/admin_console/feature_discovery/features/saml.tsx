// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GroupsSVG from './images/groups_svg';

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
            copy={defineMessage({
                id: 'admin.saml_feature_discovery.copy',
                defaultMessage: 'When you connect Mattermost with your organization\'s single sign-on provider, users can access Mattermost without having to re-enter their credentials.',
            })}
            learnMoreURL={DocLinks.SAML_SSO}
            featureDiscoveryImage={
                <GroupsSVG
                    width={276}
                    height={170}
                />
            }
        />
    );
};

export default SAMLFeatureDiscovery;
