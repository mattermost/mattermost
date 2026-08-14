// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {LicenseSkus} from 'utils/constants';

import ClassificationMarkingsSVG from './images/classification_markings_svg';

import FeatureDiscovery from '../index';

const ClassificationMarkingsFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='classification_markings'
            minimumSKURequiredForFeature={LicenseSkus.EnterpriseAdvanced}
            title={defineMessage({
                id: 'admin.classification_markings_feature_discovery.title',
                defaultMessage: 'Apply classification markings with Mattermost Enterprise Advanced',
            })}
            copy={defineMessage({
                id: 'admin.classification_markings_feature_discovery.desc',
                defaultMessage: 'Set up global and channel-specific classification banners with built-in presets or custom levels, ensuring that users consistently view the appropriate classification level for their workspace.',
            })}
            learnMoreURL='https://docs.mattermost.com/end-user-guide/collaborate/display-channel-banners.html#classification-markings'
            featureDiscoveryImage={
                <ClassificationMarkingsSVG
                    width={294}
                    height={180}
                />
            }
        />
    );
};

export default ClassificationMarkingsFeatureDiscovery;
