// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GroupsSVG from './images/groups_svg';

import FeatureDiscovery from '../index';

const GroupsFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='groups'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.groups_feature_discovery.title',
                defaultMessage: 'Synchronize your Active Directory/LDAP groups with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.groups_feature_discovery.copy',
                defaultMessage: 'Use AD/LDAP groups to organize and apply actions to multiple users at once. Manage team and channel memberships, permissions, and more.',
            })}
            learnMoreURL='https://docs.mattermost.com/deployment/ldap-group-sync.html'
            featureDiscoveryImage={<GroupsSVG/>}
        />
    );
};

export default GroupsFeatureDiscovery;
