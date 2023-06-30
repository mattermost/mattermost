// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';
import {useIntl} from 'react-intl';
import {ItemModel, ItemStatus, Options} from '../dashboard.type';
import {ConsolePages, DocLinks} from 'utils/constants';
import {impactModifiers} from '../dashboard.data';

// import {Client4} from 'mattermost-redux/client';
// import {AnalyticsRow} from '@mattermost/types/admin';
import {ldapTest} from 'actions/admin_actions';

const usesLDAP = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
): Promise<ItemModel> => {
    const testLdap = async (
        config: Partial<AdminConfig>,
        options: Options,
    ): Promise<ItemStatus> => {
        let check = ItemStatus.INFO;

        if (!options.isLicensed || !config.LdapSettings?.Enable) {
            return check;
        }

        const onSuccess = ({status}: any) => {
            if (status === 'OK') {
                check = ItemStatus.OK;
            }
        };

        await ldapTest(onSuccess);

        return check;
    };

    // something feels flawed in this check.
    const status = options.analytics?.TOTAL_USERS as number > 100 ? await testLdap(config, options) : ItemStatus.OK;

    return {
        id: 'ad-ldap',
        title: formatMessage({
            id: 'admin.reporting.workspace_optimization.ease_of_management.ldap.title',
            defaultMessage: 'AD/LDAP integration recommended',
        }),
        description: formatMessage({
            id: 'admin.reporting.workspace_optimization.ease_of_management.ldap.description',
            defaultMessage: 'You\'ve reached over 100 users! We recommend setting up AD/LDAP user authentication for easier onboarding as well as automated deactivations and role assignments.',
        }),
        ...(options.isLicensed && !options.isStarterLicense ? {
            configUrl: ConsolePages.AD_LDAP,
            configText: formatMessage({id: 'admin.reporting.workspace_optimization.ease_of_management.ldap.cta', defaultMessage: 'Try AD/LDAP'}),
        } : options.trialOrEnterpriseCtaConfig),
        infoUrl: DocLinks.SETUP_LDAP,
        infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
        telemetryAction: 'ad-ldap',
        status,
        scoreImpact: 22,
        impactModifier: impactModifiers[status],
    };
};

// // commented out for now.
// // @see discussion here: https://github.com/mattermost/mattermost-webapp/pull/9822#discussion_r806879385
// const fetchGuestAccounts = async (
//     config: Partial<AdminConfig>,
//     analytics: Record<string, number | AnalyticsRow[]> | undefined,
// ) => {
//     if (config.TeamSettings?.EnableOpenServer && config.GuestAccountsSettings?.Enable) {
//         let usersArray = await fetch(`${Client4.getBaseRoute()}/users/invalid_emails`).then((result) => result.json());

//         // this setting is just a string with a list of domains, or an empty string
//         if (config.GuestAccountsSettings?.RestrictCreationToDomains) {
//             const domainList = config.GuestAccountsSettings?.RestrictCreationToDomains;
//             usersArray = usersArray.filter(({email}: Record<string, unknown>) => domainList.includes((email as string).split('@')[1]));
//         }

//         // if guest accounts make up more than 5% of the user base show the info accordion
//         if (analytics && usersArray.length > (analytics.totalUsers as number * 0.05)) {
//             return ItemStatus.INFO;
//         }
//     }

//     return ItemStatus.OK;
// };

// const guestAccounts = async (
//     config: Partial<AdminConfig>,
//     formatMessage: ReturnType<typeof useIntl>['formatMessage'],
//     options: Options,
// ): Promise<ItemModel> => {
//     const status = await fetchGuestAccounts(config, options.analytics);
//     return {
//         id: 'guest-accounts',
//         title: formatMessage({
//             id: 'admin.reporting.workspace_optimization.ease_of_management.guests_accounts.title',
//             defaultMessage: 'Guest Accounts recommended',
//         }),
//         description: formatMessage({
//             id: 'admin.reporting.workspace_optimization.ease_of_management.guests_accounts.description',
//             defaultMessage: 'Several user accounts are using different domains than your Site URL. You can control user access to channels and teams with guest accounts. We recommend starting an Enterprise trial and enabling Guest Access.',
//         }),
//         ...options.trialOrEnterpriseCtaConfig,
//         infoUrl: 'https://docs.mattermost.com/onboard/guest-accounts.html',
//         infoText: formatMessage({id: 'admin.reporting.workspace_optimization.cta.learnMore', defaultMessage: 'Learn more'}),
//         telemetryAction: 'guest-accounts',
//         status,
//         scoreImpact: 6,
//         impactModifier: impactModifiers[status],
//     };
// };

export const runEaseOfUseChecks = async (
    config: Partial<AdminConfig>,
    formatMessage: ReturnType<typeof useIntl>['formatMessage'],
    options: Options,
): Promise<ItemModel[]> => {
    const checks = [
        usesLDAP,

        // guestAccounts,
    ];

    const results = await Promise.all(checks.map((check) => check(config, formatMessage, options)));
    return results;
};
