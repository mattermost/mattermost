// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';
import {useIntl} from 'react-intl';

import {elasticsearchTest} from 'actions/admin_actions';

import {impactModifiers} from '../dashboard.data';
import {ItemModel, ItemStatus, Options} from '../dashboard.type';
import {ConsolePages, DocLinks} from 'utils/constants';

const search = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
): Promise<ItemModel> => {
    const testElasticsearch = async (
        config: Partial<AdminConfig>,
        options: Options,
    ) => {
        let check = ItemStatus.INFO;

        if (!options.isLicensed || !options.isEnterpriseLicense || !(config.ElasticsearchSettings?.EnableIndexing && config.ElasticsearchSettings?.EnableSearching)) {
            return check;
        }

        const onSuccess = ({status}: any) => {
            if (status === 'OK') {
                check = ItemStatus.OK;
            }
        };
        await elasticsearchTest(config, onSuccess);
        return check;
    };

    const totalPosts = options.analytics?.TOTAL_POSTS as number;
    const totalUsers = options.analytics?.TOTAL_USERS as number;
    const status = totalPosts < 2_000_000 && totalUsers < 500 ? ItemStatus.OK : await testElasticsearch(config, options);
    return {
        id: 'search',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.performance.search.title',
            defaultMessage: 'Search performance',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.performance.search.description',
            defaultMessage: 'Your server has reached over 500 users and 2 million posts which can result in slow search performance. We recommend enabling Elasticsearch for better performance.',
        }),
        ...(options.isLicensed && options.isEnterpriseLicense ? {
            configUrl: ConsolePages.ELASTICSEARCH,
            configText: formatMessage({id: 'admin.reporting.workspace_optimization.search.cta', defaultMessage: 'Try Elasticsearch'}),
        } : options.trialOrEnterpriseCtaConfig),
        infoUrl: DocLinks.ELASTICSEARCH,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'search-optimization',
        status,
        scoreImpact: 20,
        impactModifier: impactModifiers[status],
    };
};

export const runPerformanceChecks = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
) => {
    const checks = [
        search,
    ];

    const results = await Promise.all(checks.map((check) => check(config, formatMessage, options)));
    return results;
};
