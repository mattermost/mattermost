// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import SystemRolesSVG from './images/system_roles_svg';

import FeatureDiscovery from '../index';

const SystemRolesFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='system_roles'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.system_roles_feature_discovery.title',
                defaultMessage: 'Provide controlled access to the System Console with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.system_roles_feature_discovery.copy',
                defaultMessage: 'Assign customizable admin roles to give designated users read and/or write access to select sections of System Console.',
            })}
            learnMoreURL='https://docs.mattermost.com/deployment/admin-roles.html'
            featureDiscoveryImage={
                <SystemRolesSVG
                    width={294}
                    height={180}
                />}
        />
    );
};

export default SystemRolesFeatureDiscovery;
