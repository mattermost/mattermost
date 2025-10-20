// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {connect} from 'react-redux';

import type {ClientLicense} from '@mattermost/types/config';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import InlineSectionFeatureDiscovery from 'components/admin_console/inline_section_feature_discovery';
import AdminSectionPanel from 'components/widgets/admin_console/admin_section_panel';

import {LicenseSkus} from 'utils/constants';
import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

type OwnProps = {
    settingsList: React.ReactNode[];
    requiredSku: LicenseSkus;
    sectionTitle?: string;
    sectionDescription?: string | MessageDescriptor;
    featureDiscoveryConfig: {
        featureName: string;
        title: MessageDescriptor;
        description: MessageDescriptor;
        learnMoreURL: string;
        svgImage?: React.ComponentType<{width?: number; height?: number}>;
    };
};

type StateProps = {
    license: ClientLicense | undefined;
};

type Props = OwnProps & StateProps;

const LicensedSectionContainer: React.FC<Props> = ({
    settingsList,
    requiredSku,
    sectionTitle,
    sectionDescription,
    featureDiscoveryConfig,
    license,
}) => {
    // Determine if user has sufficient licensing to access the feature
    const isEntryLicense = license?.SkuShortName === LicenseSkus.Entry;
    const hasEnterpriseAdvanced = license ? isMinimumEnterpriseAdvancedLicense(license) : false;
    const canAccessFeature = isEntryLicense || hasEnterpriseAdvanced;

    if (canAccessFeature) {
        // Render settings panel with optional license badge for trial users
        return (
            <AdminSectionPanel
                title={sectionTitle}
                description={sectionDescription}
                licenseSku={isEntryLicense ? requiredSku : undefined}
            >
                {settingsList}
            </AdminSectionPanel>
        );
    }

    // Render feature discovery for users without sufficient licensing
    return (
        <InlineSectionFeatureDiscovery
            featureName={featureDiscoveryConfig.featureName}
            title={featureDiscoveryConfig.title}
            description={featureDiscoveryConfig.description}
            learnMoreURL={featureDiscoveryConfig.learnMoreURL}
            svgImage={featureDiscoveryConfig.svgImage}
        />
    );
};

function mapStateToProps(state: GlobalState): StateProps {
    return {
        license: getLicense(state),
    };
}

export default connect(mapStateToProps)(LicensedSectionContainer);

