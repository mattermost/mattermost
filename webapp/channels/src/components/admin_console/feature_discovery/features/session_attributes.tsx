// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import GroupsSVG from './images/groups_svg';

import FeatureDiscovery from '../index';

const SessionAttributesFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='session_attributes'
            minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
            title={defineMessage({
                id: 'admin.session_attributes_feature_discovery.title',
                defaultMessage: 'Evaluate per-session context in access policies with Mattermost Enterprise Advanced',
            })}
            copy={defineMessage({
                id: 'admin.session_attributes_feature_discovery.desc',
                defaultMessage: 'Define and tune session attributes such as network status, client type, and device posture for use in attribute-based access control policies.',
            })}
            learnMoreURL='https://docs.mattermost.com/administration-guide/manage/admin/attribute-based-access-control.html'
            featureDiscoveryImage={
                <GroupsSVG
                    width={294}
                    height={180}
                />
            }
        />
    );
};

export default SessionAttributesFeatureDiscovery;
