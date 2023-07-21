// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FeatureDiscovery from '../index';
import {LicenseSkus} from 'utils/constants';
import {t} from 'utils/i18n';

import GroupsSVG from './images/groups_svg';

const GroupsFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='groups'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            titleID='admin.groups_feature_discovery.title'
            titleDefault='Synchronize your Active Directory/LDAP groups with Mattermost Enterprise'
            copyID='admin.groups_feature_discovery.copy'
            copyDefault={'Use AD/LDAP groups to organize and apply actions to multiple users at once. Manage team and channel memberships, permissions, and more.'}
            learnMoreURL='https://docs.mattermost.com/deployment/ldap-group-sync.html'
            featureDiscoveryImage={<GroupsSVG/>}
        />
    );
};

t('admin.groups_feature_discovery.title');
t('admin.groups_feature_discovery.copy');

export default GroupsFeatureDiscovery;
