// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {t} from 'utils/i18n';
import {LicenseSkus} from 'utils/constants';

import FeatureDiscovery from '../index';

import ComplianceExportSVG from './images/compliance_export_svg';

const ComplianceExportFeatureDiscovery: React.FC = () => {
    return (
        <FeatureDiscovery
            featureName='compliance_export'
            minimumSKURequiredForFeature={LicenseSkus.Enterprise}
            titleID='admin.compliance_export_feature_discovery.title'
            titleDefault='Run compliance exports with Mattermost Enterprise'
            copyID='admin.compliance_export_feature_discovery.copy'
            copyDefault={'Run daily compliance reports and export them to a variety of formats consumable by third-party integration tools such as Smarsh (Actiance).'}
            learnMoreURL='https://docs.mattermost.com/administration/compliance-export.html'
            featureDiscoveryImage={<ComplianceExportSVG/>}
        />
    );
};

t('admin.compliance_export_feature_discovery.title');
t('admin.compliance_export_feature_discovery.copy');

export default ComplianceExportFeatureDiscovery;
