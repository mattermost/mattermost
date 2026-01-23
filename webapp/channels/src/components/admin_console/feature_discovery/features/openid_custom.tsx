// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GroupsSVG from './images/groups_svg';

import FeatureDiscovery from '../index';

const OpenIDCustomFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='openid'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            title={defineMessage({
                id: 'admin.openid_custom_feature_discovery.title',
                defaultMessage: 'Integrate OpenID Connect with Mattermost Professional',
            })}
            copy={defineMessage({
                id: 'admin.openid_custom_feature_discovery.copy',
                defaultMessage: 'Use OpenID Connect for authentication and single sign-on (SSO) with any service that supports the OIDC specification such as Apple, Okta, OneLogin, and more.',
            })}
            learnMoreURL='https://docs.mattermost.com/cloud/cloud-administration/sso-openid-connect.html'
            featureDiscoveryImage={
                <GroupsSVG
                    width={276}
                    height={170}
                />}
        />
    );
};

export default OpenIDCustomFeatureDiscovery;
