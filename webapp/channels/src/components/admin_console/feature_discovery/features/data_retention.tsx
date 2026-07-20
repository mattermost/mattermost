// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import DataRetentionSVG from './images/data_retention_svg';

import FeatureDiscovery from '../index';

const DataRetentionFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='data_retention'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.data_retention_feature_discovery.title',
                defaultMessage: 'Create data retention schedules with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.data_retention_feature_discovery.copy',
                defaultMessage: 'Hold on to your data only as long as you need to. Create data retention jobs for select channels and teams to automatically delete disposable data.',
            })}
            learnMoreURL='https://docs.mattermost.com/administration/data-retention.html'
            featureDiscoveryImage={
                <DataRetentionSVG
                    width={213}
                    height={156}
                />}
        />
    );
};

export default DataRetentionFeatureDiscovery;
