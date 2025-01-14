// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GroupsSVG from './images/groups_svg';

import FeatureDiscovery from '../index';

const LDAPFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='ldap'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            title={defineMessage({
                id: 'admin.ldap_feature_discovery.title',
                defaultMessage: 'Integrate Active Directory/LDAP with Mattermost Professional',
            })}
            copy={defineMessage({
                id: 'admin.ldap_feature_discovery.copy',
                defaultMessage: 'When you connect Mattermost with your organization\'s Active Directory/LDAP, users can log in without having to create new usernames and passwords.',
            })}
            learnMoreURL='https://www.mattermost.com/docs-adldap/?utm_medium=product&utm_source=product-feature-discovery&utm_content=adldap'
            featureDiscoveryImage={
                <GroupsSVG
                    width={276}
                    height={170}
                />}
        />
    );
};

export default LDAPFeatureDiscovery;
