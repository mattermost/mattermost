// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    ChartLineIcon,
    ServerVariantIcon,
    ArrowUpBoldCircleOutlineIcon,
    TuneIcon,
    LockOutlineIcon,
    AccountMultipleOutlineIcon,
} from '@mattermost/compass-icons/components';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {GlobalState} from '@mattermost/types/store';

import {CloudLinks, ConsolePages, DocLinks, LicenseLinks} from 'utils/constants';
import {daysToLicenseExpire, isEnterpriseOrE20License, getIsStarterLicense} from '../../../utils/license_utils';

export type DataModel = {
    [key: string]: {
        title: string;
        description: string;
        descriptionOk: string;
        items: ItemModel[];
        icon: React.ReactNode;
        hide?: boolean;
    };
}

export enum ItemStatus {
    NONE = 'none',
    OK = 'ok',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

export type ItemModel = {
    id: string;
    title: string;
    description: string;
    status: ItemStatus;
    scoreImpact: number;
    impactModifier: number;
    configUrl?: string;
    configText?: string;
    telemetryAction?: string;
    infoUrl?: string;
    infoText?: string;
}

export type UpdatesParam = {
    serverVersion: {
        type: string;
        status: ItemStatus;
        description: string;
    };
}

const impactModifiers: Record<ItemStatus, number> = {
    [ItemStatus.NONE]: 1,
    [ItemStatus.OK]: 1,
    [ItemStatus.INFO]: 0.5,
    [ItemStatus.WARNING]: 0.25,
    [ItemStatus.ERROR]: 0,
};

const useMetricsData = () => {
    const {formatMessage} = useIntl();
    const prevTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);
    const license = useSelector(getLicense);

    const canStartTrial = license?.IsLicensed !== 'true' && prevTrialLicense?.IsLicensed !== 'true';
    const daysUntilExpiration = daysToLicenseExpire(license) || -1;

    const isLicensed = license?.IsLicensed === 'true' && daysUntilExpiration >= 0;

    const isCloud = license?.Cloud === 'true';
    const isEnterpriseLicense = isEnterpriseOrE20License(license);
    const isStarterLicense = getIsStarterLicense(license);

    const trialOrEnterpriseCtaConfig = {
        configUrl: canStartTrial ? ConsolePages.LICENSE : LicenseLinks.CONTACT_SALES,
        configText: canStartTrial ? formatMessage({id: 'admin.reporting.workspace_optimization.cta.startTrial', defaultMessage: 'Start trial'}) : formatMessage({id: 'admin.reporting.workspace_optimization.cta.upgradeLicense', defaultMessage: 'Contact sales'}),
    };

    const getUpdatesData = (data: UpdatesParam) => ({
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.updates.title',
            defaultMessage: 'Server updates',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.updates.description',
            defaultMessage: 'An update is available.',
        }),
        descriptionOk: formatMessage({
            id: 'admin.reporting.workspace_optimization.updates.descriptionOk',
            defaultMessage: 'Your workspace is completely up to date!',
        }),
        icon: (
            <div className='icon'>
                <ArrowUpBoldCircleOutlineIcon
                    size={20}
                    color={'var(--sys-center-channel-color)'}
                />
            </div>
        ),
        items: [
            {
                id: 'server_version',
                title: formatMessage({
                    id: 'admin.reporting.workspace_optimization.updates.server_version.status.title',
                    defaultMessage: '{type} version update available.',
                }, {type: data.serverVersion.type}),
                description: data.serverVersion.description,
                configUrl: CloudLinks.DOWNLOAD_UPDATE,
                configText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.downloadUpdate', defaultMessage: 'Download update'}),
                infoUrl: DocLinks.UPGRADE_SERVER,
                infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
                telemetryAction: 'server-version',
                status: data.serverVersion.status,
                scoreImpact: 15,
                impactModifier: impactModifiers[data.serverVersion.status],
            },
        ],
    });

    type ConfigurationParam = {
        ssl: {
            status: ItemStatus;
        };
        sessionLength: {
            status: ItemStatus;
        };
    }

    const getConfigurationData = (data: ConfigurationParam) => ({
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.title',
            defaultMessage: 'Configuration',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.description',
            defaultMessage: 'You have configuration issues to resolve',
        }),
        hide: isCloud,
        descriptionOk: formatMessage({
            id: 'admin.reporting.workspace_optimization.configuration.descriptionOk',
            defaultMessage: 'You\'ve successfully configured SSL and Session Lengths!',
        }),
        icon: (
            <div className='icon'>
                <TuneIcon
                    size={20}
                    color={'var(--sys-center-channel-color)'}
                />
            </div>
        ),
        items: [
            {
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
                status: data.ssl.status,
                scoreImpact: 25,
                impactModifier: impactModifiers[data.ssl.status],
            },
            {
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
                configText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.configureSessionLength', defaultMessage: 'Configure session length'}),
                infoUrl: DocLinks.SESSION_LENGTHS,
                infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
                telemetryAction: 'session-length',
                status: data.sessionLength.status,
                scoreImpact: 8,
                impactModifier: impactModifiers[data.sessionLength.status],
            },
        ],
    });

    type AccessParam = {
        siteUrl: {
            status: ItemStatus;
        };
    }

    const getAccessData = (data: AccessParam) => ({
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.access.title',
            defaultMessage: 'Workspace access',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.access.description',
            defaultMessage: 'Web server configuration may be affecting access to your Mattermost workspace.',
        }),
        hide: isCloud,
        descriptionOk: formatMessage({
            id: 'admin.reporting.workspace_optimization.access.descriptionOk',
            defaultMessage: 'Your web server configuration is passing a live URL test!',
        }),
        icon: (
            <div className='icon'>
                <ServerVariantIcon
                    size={20}
                    color={'var(--sys-center-channel-color)'}
                />
            </div>
        ),
        items: [
            {
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
                configText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.configureWebServer', defaultMessage: 'Configure web server'}),
                infoUrl: DocLinks.SITE_URL,
                infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
                telemetryAction: 'site-url',
                status: data.siteUrl.status,
                scoreImpact: 12,
                impactModifier: impactModifiers[data.siteUrl.status],
            },
        ],
    });

    type PerformanceParam = {
        search: {
            status: ItemStatus;
        };
    }

    const getPerformanceData = (data: PerformanceParam) => ({
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.performance.title',
            defaultMessage: 'Performance',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.performance.description',
            defaultMessage: 'Your server would benefit from some performance tweaks.',
        }),
        hide: isCloud,
        descriptionOk: formatMessage({
            id: 'admin.reporting.workspace_optimization.performance.descriptionOk',
            defaultMessage: 'Your search performance suits your workspace usage!',
        }),
        icon: (
            <div className='icon'>
                <ChartLineIcon
                    size={20}
                    color={'var(--sys-center-channel-color)'}
                />
            </div>
        ),
        items: [
            {
                id: 'search',
                title: formatMessage({
                    id: 'admin.reporting.workspace_optimization.performance.search.title',
                    defaultMessage: 'Search performance',
                }),
                description: formatMessage({
                    id: 'admin.reporting.workspace_optimization.performance.search.description',
                    defaultMessage: 'Your server has reached over 500 users and 2 million posts which can result in slow search performance. We recommend enabling Elasticsearch for better performance.',
                }),
                ...(isLicensed && isEnterpriseLicense ? {
                    configUrl: ConsolePages.ELASTICSEARCH,
                    configText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.configureElasticsearch', defaultMessage: 'Try Elasticsearch'}),
                } : trialOrEnterpriseCtaConfig),
                infoUrl: DocLinks.ELASTICSEARCH,
                infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
                telemetryAction: 'search-optimization',
                status: data.search.status,
                scoreImpact: 20,
                impactModifier: impactModifiers[data.search.status],
            },
        ],
    });

    type DataPrivacyParam = {
        retention: {
            status: ItemStatus;
        };
    }

    // TBD
    const getDataPrivacyData = (data: DataPrivacyParam) => ({
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.data_privacy.title',
            defaultMessage: 'Data privacy',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.data_privacy.description',
            defaultMessage: 'Get better insight and control over your data.',
        }),
        descriptionOk: formatMessage({
            id: 'admin.reporting.workspace_optimization.data_privacy.descriptionOk',
            defaultMessage: 'You\'ve enabled data retention and compliance features!',
        }),
        icon: (
            <div className='icon'>
                <LockOutlineIcon
                    size={20}
                    color={'var(--sys-center-channel-color)'}
                />
            </div>
        ),
        items: [
            {
                id: 'data-retention',
                title: formatMessage({
                    id: 'admin.reporting.workspace_optimization.data_privacy.retention.title',
                    defaultMessage: 'Become more data aware',
                }),
                description: formatMessage({
                    id: 'admin.reporting.workspace_optimization.data_privacy.retention.description',
                    defaultMessage: 'Organizations in highly regulated industries require more control and insight with their data. We recommend enabling Data Retention and Compliance features.',
                }),
                ...(isLicensed && isEnterpriseLicense ? {
                    configUrl: ConsolePages.DATA_RETENTION,
                    configText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.configureDataRetention', defaultMessage: 'Try data retention'}),
                } : trialOrEnterpriseCtaConfig),
                infoUrl: DocLinks.DATA_RETENTION_POLICY,
                infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
                telemetryAction: 'data-retention',
                status: data.retention.status,
                scoreImpact: 16,
                impactModifier: impactModifiers[data.retention.status],
            },
        ],
    });

    type EaseOfManagementParam = {
        ldap: {
            status: ItemStatus;
        };
        guestAccounts?: {
            status: ItemStatus;
        };
    }

    // TBD
    const getEaseOfManagementData = (data: EaseOfManagementParam) => ({
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.ease_of_management.title',
            defaultMessage: 'Ease of management',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.ease_of_management.description',
            defaultMessage: 'Make it easier to manage your Mattermost workspace.',
        }),
        descriptionOk: formatMessage({
            id: 'admin.reporting.workspace_optimization.ease_of_management.descriptionOk',
            defaultMessage: 'Your user authentication setup is appropriate based on your current usage!',
        }),
        icon: (
            <div className='icon'>
                <AccountMultipleOutlineIcon
                    size={20}
                    color={'var(--sys-center-channel-color)'}
                />
            </div>
        ),
        items: [
            {
                id: 'ad-ldap',
                title: formatMessage({
                    id: 'admin.reporting.workspace_optimization.ease_of_management.ldap.title',
                    defaultMessage: 'AD/LDAP integration recommended',
                }),
                description: formatMessage({
                    id: 'admin.reporting.workspace_optimization.ease_of_management.ldap.description',
                    defaultMessage: 'You\'ve reached over 100 users! We recommend setting up AD/LDAP user authentication for easier onboarding as well as automated deactivations and role assignments.',
                }),
                ...(isLicensed && !isStarterLicense ? {
                    configUrl: ConsolePages.AD_LDAP,
                    configText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.configureLDAP', defaultMessage: 'Try AD/LDAP'}),
                } : trialOrEnterpriseCtaConfig),
                infoUrl: DocLinks.AD_LDAP,
                infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
                telemetryAction: 'ad-ldap',
                status: data.ldap.status,
                scoreImpact: 22,
                impactModifier: impactModifiers[data.ldap.status],
            },

            // commented out for now.
            // @see discussion here: https://github.com/mattermost/mattermost-webapp/pull/9822#discussion_r806879385
            // {
            //     id: 'guest-accounts',
            //     title: formatMessage({
            //         id: 'admin.reporting.workspace_optimization.ease_of_management.guests_accounts.title',
            //         defaultMessage: 'Guest Accounts recommended',
            //     }),
            //     description: formatMessage({
            //         id: 'admin.reporting.workspace_optimization.ease_of_management.guests_accounts.description',
            //         defaultMessage: 'Several user accounts are using different domains than your Site URL. You can control user access to channels and teams with guest accounts. We recommend starting an Enterprise trial and enabling Guest Access.',
            //     }),
            //     ...trialOrEnterpriseCtaConfig,
            //     infoUrl: 'https://docs.mattermost.com/onboard/guest-accounts.html',
            //     infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
            //     telemetryAction: 'guest-accounts',
            //     status: data.guestAccounts.status,
            //     scoreImpact: 6,
            //     impactModifier: impactModifiers[data.guestAccounts.status],
            // },
        ],
    });

    return {getAccessData, getConfigurationData, getUpdatesData, getPerformanceData, getDataPrivacyData, getEaseOfManagementData, isLicensed, isEnterpriseLicense};
};

export default useMetricsData;
