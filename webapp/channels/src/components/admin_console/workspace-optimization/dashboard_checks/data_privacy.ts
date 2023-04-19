// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {impactModifiers} from '../dashboard.data';
import {ConsolePages, DocLinks} from 'utils/constants';
import {Client4} from 'mattermost-redux/client';
import {ItemStatus, Options} from '../dashboard.type';
import {AdminConfig} from '@mattermost/types/config';

/**
 *
 * @description Checks if they they have a global policy deletion enabled, or if a custom policy has been created.
 */
const dataRetentionCheck = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
) => {
    const testDataRetention = async (
        config: Partial<AdminConfig>,
        options: Options,
    ) => {
        if (!options.isLicensed || !options.isEnterpriseLicense) {
            return ItemStatus.INFO;
        }

        if (config.DataRetentionSettings?.EnableMessageDeletion || config.DataRetentionSettings?.EnableFileDeletion) {
            return ItemStatus.OK;
        }

        const policyCount: {total_count: number} = await fetch(`${Client4.getBaseRoute()}/data_retention/policies_count`).then((result) => result.json());
        return policyCount.total_count > 0 ? ItemStatus.OK : ItemStatus.INFO;
    };

    const status = await testDataRetention(config, options);
    return {
        id: 'data-retention',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.data_privacy.retention.title',
            defaultMessage: 'Become more data aware',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.data_privacy.retention.description',
            defaultMessage: 'Organizations in highly regulated industries require more control and insight with their data. We recommend enabling Data Retention and Compliance features.',
        }),
        ...(options.isLicensed && options.isEnterpriseLicense ? {
            configUrl: ConsolePages.DATA_RETENTION,
            configText: formatMessage({id: 'admin.reporting.workspace_optimization.data_privacy.retention.cta', defaultMessage: 'Try data retention'}),
        } : options.trialOrEnterpriseCtaConfig),
        infoUrl: DocLinks.DATA_RETENTION_POLICY,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'data-retention',
        status,
        scoreImpact: 16,
        impactModifier: impactModifiers[status],
    };
};

export const runDataPrivacyChecks = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
) => {
    const checks = [
        dataRetentionCheck,
    ];
    const results = await Promise.all(checks.map((check) => check(config, formatMessage, options)));
    return results;
};
