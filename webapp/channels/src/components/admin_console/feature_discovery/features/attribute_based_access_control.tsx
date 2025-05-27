// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import SystemRolesSVG from './images/system_roles_svg';

import FeatureDiscovery from '../index';

const AttributeBasedAccessControlFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='attribute_based_access_control'
            minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
            title={defineMessage({
                id: 'admin.attribute_based_access_control_feature_discovery.title',
                defaultMessage: 'Use attribute based access policies to control channel access with Mattermost Enterprise Advanced',
            })}
            copy={defineMessage({
                id: 'admin.attribute_based_access_control_feature_discovery.desc',
                defaultMessage: 'Create policies containing access rules based on user attributes and apply them to channels and other resources within Mattermost.',
            })}
            learnMoreURL='https://docs.mattermost.com/deployment/'
            featureDiscoveryImage={
                <SystemRolesSVG
                    width={294}
                    height={180}
                />
            }
        />
    );
};

export default AttributeBasedAccessControlFeatureDiscovery;
