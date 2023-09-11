// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

import {testSiteURL} from 'actions/admin_actions';

import {ConsolePages, DocLinks} from 'utils/constants';

import {impactModifiers} from '../dashboard.data';
import {ItemStatus} from '../dashboard.type';
import type {ItemModel} from '../dashboard.type';

/**
 *
 * @description Checking to see if the siteURL is configured correctly by running it through the same "check siteURL" button that exists on the webserver page.
 */
const siteURLCheck = async (config: Partial<AdminConfig>, formatMessage: ReturnType<typeof useIntl>['formatMessage']): Promise<ItemModel> => {
    let status = ItemStatus.OK;
    const testURL = async () => {
        if (!config.ServiceSettings?.SiteURL) {
            status = ItemStatus.ERROR;
        }

        const onSuccess = ({status: s}: any) => {
            if (s === 'OK') {
                status = ItemStatus.OK;
            }
        };
        const onError = () => {
            status = ItemStatus.ERROR;
        };
        await testSiteURL(onSuccess, onError, config.ServiceSettings?.SiteURL);
    };

    await testURL();
    return {
        id: 'site-url',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.access.site_url.title',
            defaultMessage: 'Misconfigured web server',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.access.site_url.description',
            defaultMessage: 'Your web server settings aren\'t passing a live URL test which means your workspace may not be accessible to users. We recommend updating your web server settings.',
        }),
        configUrl: ConsolePages.WEB_SERVER,
        configText: formatMessage({id: 'admin.reporting.workspace_optimization.access.site_url.cta', defaultMessage: 'Configure web server'}),
        infoUrl: DocLinks.SITE_URL,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'site-url',
        status,
        scoreImpact: 12,
        impactModifier: impactModifiers[status],
    };
};

const checks = [
    siteURLCheck,
];

export const runAccessChecks = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
) => {
    const results = await Promise.all(checks.map((check) => check(config, formatMessage)));
    return results;
};

