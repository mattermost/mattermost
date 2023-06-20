// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {t} from 'utils/i18n';
import {LicenseSkus} from 'utils/constants';

import FeatureDiscovery from '../index';

import LdapSVG from './images/ldap_svg';

const LDAPFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='ldap'
            minimumSKURequiredForFeature={LicenseSkus.Professional}
            titleID='admin.ldap_feature_discovery.title'
            titleDefault='Integrate Active Directory/LDAP with Mattermost Professional'
            copyID='admin.ldap_feature_discovery.copy'
            copyDefault={'When you connect Mattermost with your organization\'s Active Directory/LDAP, users can log in without having to create new usernames and passwords.'}
            learnMoreURL='https://www.mattermost.com/docs-adldap/?utm_medium=product&utm_source=product-feature-discovery&utm_content=adldap'
            featureDiscoveryImage={<LdapSVG/>}
        />
    );
};

t('admin.ldap_feature_discovery.title');
t('admin.ldap_feature_discovery.copy');

export default LDAPFeatureDiscovery;
