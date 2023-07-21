// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable @typescript-eslint/no-unused-vars */

import {AdminConfig} from '@mattermost/types/config';
import {useIntl} from 'react-intl';

import {impactModifiers} from '../dashboard.data';
import {ItemModel, ItemStatus, Options} from '../dashboard.type';
import {ConsolePages, DocLinks} from 'utils/constants';

/**
 *
 * @description This checks to see if the user's active session is done over https. This does not check if the server is configured to use https.
 */
const ssl = (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
): ItemModel => {
    const status = document.location.protocol === 'https:' ? ItemStatus.OK : ItemStatus.ERROR;

    return {
        id: 'ssl',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.ssl.title',
            defaultMessage: 'Configure SSL to make your server more secure',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.ssl.description',
            defaultMessage: 'We strongly recommend securing your Mattermost workspace by configuring SSL in production environments.',
        }),
        infoUrl: DocLinks.SSL_CERTIFICATE,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'ssl',
        status,
        scoreImpact: 25,
        impactModifier: impactModifiers[status],
    };
};

/**
 *
 * @description This checks to see if the user has adjusted the default session lengths to something other than 720 hours.
 */
const sessionLength = (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
): ItemModel => {
    const status = config.ServiceSettings?.SessionLengthMobileInHours === 720 ? ItemStatus.INFO : ItemStatus.OK;
    return {
        id: 'session-length',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.session_length.title',
            defaultMessage: 'Session lengths is set to default',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.session_length.description',
            defaultMessage: 'Your session length is set to the default of 30 days. A longer session length provides convenience, and a shorter session provides tighter security. We recommend adjusting this based on your organization\'s security policies.',
        }),
        configUrl: ConsolePages.SESSION_LENGTHS,
        configText: formatMessage({id: 'admin.reporting.workspace_optimization.configuration.session_length.cta', defaultMessage: 'Configure session length'}),
        infoUrl: DocLinks.SESSION_LENGTHS,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'session-length',
        status,
        scoreImpact: 8,
        impactModifier: impactModifiers[status],
    };
};

export const runConfigChecks = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
) => {
    const checks = [
        ssl,
        sessionLength,
    ];
    const results = await Promise.all(checks.map((check) => check(config, formatMessage, options)));
    return results;
};
