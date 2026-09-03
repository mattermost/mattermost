// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import DataSpillageSVG from './images/data_spillage_svg';

import FeatureDiscovery from '../index';

const DataSpillageFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='data_spillage'
            minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
            title={defineMessage({
                id: 'admin.data_spillage_feature_discovery.title',
                defaultMessage: 'Handle data spillage with Mattermost Enterprise Advanced',
            })}
            copy={defineMessage({
                id: 'admin.data_spillage_feature_discovery.desc',
                defaultMessage: 'Set up the ability for users to quarantine messages so designated Content Reviewers can decide whether to keep or remove them.',
            })}
            learnMoreURL='https://docs.mattermost.com/administration-guide/manage/admin/content-flagging.html'
            featureDiscoveryImage={
                <DataSpillageSVG
                    width={294}
                    height={180}
                />
            }
        />
    );
};

export default DataSpillageFeatureDiscovery;
