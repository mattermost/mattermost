// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {useIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import {CloudLinks, DocLinks} from 'utils/constants';

import {impactModifiers} from '../dashboard.data';
import {ItemStatus} from '../dashboard.type';
import type {Options} from '../dashboard.type';

const testServerVersion = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
) => {
    const serverVersion = await fetchAndCompareVersion(options.installedVersion, formatMessage);
    return {
        id: 'server_version',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.updates.server_version.status.title',
            defaultMessage: '{type} version update available.',
        }, {type: serverVersion.type}),
        description: serverVersion.description,
        configUrl: CloudLinks.DOWNLOAD_UPDATE,
        configText: formatMessage({id: 'admin.reporting.workspace_optimization.updates.server_version.cta', defaultMessage: 'Download update'}),
        infoUrl: DocLinks.UPGRADE_SERVER,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'server-version',
        status: serverVersion.status,
        scoreImpact: 15,
        impactModifier: impactModifiers[serverVersion.status],
    };
};

export const fetchAndCompareVersion = async (
    installedVersion: string,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
) => {
    const result = await fetch(`${Client4.getBaseRoute()}/latest_version`).then((result) => result.json());

    if (result.tag_name) {
        const sanitizedVersion = result.tag_name.startsWith('v') ? result.tag_name.slice(1) : result.tag_name;
        const newVersionParts = sanitizedVersion.split('.');
        const installedVersionParts = installedVersion.split('.').slice(0, 3);

        // quick general check if a newer version is available
        let type = '';
        let status: ItemStatus = ItemStatus.OK;

        if (sanitizedVersion.localeCompare(installedVersion, undefined, {numeric: true, sensitivity: 'base'}) > 0) {
            // get correct values to be inserted into the accordion item
            switch (true) {
            case Number(newVersionParts[0]) > Number(installedVersionParts[0]):
                type = formatMessage({
                    id: 'admin.reporting.workspace_optimization.updates.server_version.update_type.major',
                    defaultMessage: 'Major',
                });
                status = ItemStatus.ERROR;
                break;
            case Number(newVersionParts[1]) > Number(installedVersionParts[1]):
                type = formatMessage({
                    id: 'admin.reporting.workspace_optimization.updates.server_version.update_type.minor',
                    defaultMessage: 'Minor',
                });
                status = ItemStatus.WARNING;
                break;
            case Number(newVersionParts[2]) > Number(installedVersionParts[2]):
                type = formatMessage({
                    id: 'admin.reporting.workspace_optimization.updates.server_version.update_type.patch',
                    defaultMessage: 'Patch',
                });
                status = ItemStatus.INFO;
                break;
            }
        }

        return {type, description: result.body, status};
    }

    return {type: '', description: '', status: ItemStatus.OK};
};

export const runUpdateChecks = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
) => {
    const checks = [
        testServerVersion,
    ];

    const results = await Promise.all(checks.map((check) => check(config, formatMessage, options)));
    return results;
};
