// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import {DocLinks, LicenseSkus} from 'utils/constants';

import ComplianceExportSVG from './images/compliance_export_svg';

import FeatureDiscovery from '../index';

const ComplianceExportFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='compliance_export'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            title={defineMessage({
                id: 'admin.compliance_export_feature_discovery.title',
                defaultMessage: 'Run compliance exports with Mattermost Enterprise',
            })}
            copy={defineMessage({
                id: 'admin.compliance_export_feature_discovery.copy',
                defaultMessage: 'Run daily compliance reports and export them to a variety of formats consumable by third-party integration tools such as Smarsh (Actiance).',
            })}
            learnMoreURL={DocLinks.COMPILANCE_EXPORT}
            featureDiscoveryImage={<ComplianceExportSVG/>}
        />
    );
};

export default ComplianceExportFeatureDiscovery;
