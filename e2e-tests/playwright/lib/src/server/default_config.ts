// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    AccessControlSettings,
    AdminConfig,
    AnnouncementSettings,
    ClusterSettings,
    EmailSettings,
    ExperimentalSettings,
    IntuneSettings,
    LdapSettings,
    LogSettings,
    Office365Settings,
    PasswordSettings,
    PrivacySettings,
    SamlSettings,
    ServiceSettings,
    SSOSettings,
    TeamSettings,
} from '@mattermost/types/config';

import {testConfig} from '@/test_config';

/** Live-reloadable on-prem overrides only — safe for patchConfig (no restart-required keys). */
export function getOnPremServerConfigPatch(): Partial<AdminConfig> {
    return onPremServerConfig() as Partial<AdminConfig>;
}

type TestAdminConfig = {
    AccessControlSettings: Partial<AccessControlSettings>;
    AnnouncementSettings: Partial<AnnouncementSettings>;
    ClusterSettings: Partial<ClusterSettings>;
    EmailSettings: Partial<EmailSettings>;
    ExperimentalSettings: Partial<ExperimentalSettings>;
    LogSettings: Partial<LogSettings>;
    PasswordSettings: Partial<PasswordSettings>;
    PrivacySettings: Partial<PrivacySettings>;
    ServiceSettings: Partial<ServiceSettings>;
    TeamSettings: Partial<TeamSettings>;
    GitLabSettings: Partial<SSOSettings>;
    GoogleSettings: Partial<SSOSettings>;
    IntuneSettings: Partial<IntuneSettings>;
    Office365Settings: Partial<Office365Settings>;
    OpenIdSettings: Partial<SSOSettings>;
    SamlSettings: Partial<SamlSettings>;
    LdapSettings: Partial<LdapSettings>;
};

// On-prem setting that is different from the default.
//
// Carries no PluginSettings: patchConfig replaces the PluginStates map wholesale, which would
// clobber the plugins a running spec enabled. Specs enable and disable plugins per id instead.
const onPremServerConfig = (): Partial<TestAdminConfig> => {
    return {
        AccessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: true,
        },
        AnnouncementSettings: {
            // An in-product notice opens a modal over the channel view and swallows clicks near it.
            AdminNoticesEnabled: false,
            UserNoticesEnabled: false,
        },
        ClusterSettings: {
            Enable: testConfig.haClusterEnabled,
            ClusterName: testConfig.haClusterName,
        },
        EmailSettings: {
            FeedbackName: 'Mattermost',
            PushNotificationServer: testConfig.pushNotificationServer,
            EnableSignUpWithEmail: true,
            EnableSignInWithEmail: true,
            EnableSignInWithUsername: true,
            RequireEmailVerification: false,
        },
        LogSettings: {
            EnableDiagnostics: false,
        },
        PasswordSettings: {
            MinimumLength: 14,
            Lowercase: false,
            Number: false,
            Uppercase: false,
            Symbol: false,
            EnableForgotLink: true,
        },
        PrivacySettings: {
            UseAnonymousURLs: false,
        },
        ServiceSettings: {
            // SiteURL is the server's own view of itself (e.g. for building plugin callback
            // URLs), so it must use an address the server can reach itself with. In `testcontainers` mode
            // testConfig.baseURL is a host-mapped port the server's own container can't reach;
            // internalBaseURL is the Docker network alias there, and the same as baseURL in
            // `external` mode — correct in both cases.
            SiteURL: testConfig.internalBaseURL,
            EnableOnboardingFlow: false,
            EnableSecurityFixAlert: false,
            GiphySdkKey: 's0glxvzVg9azvPipKxcPLpXV0q1x1fVP',
            EnableMultifactorAuthentication: false,
            EnforceMultifactorAuthentication: false,
            MaximumLoginAttempts: 10,
            ExperimentalEnableAuthenticationTransfer: true,
            EnableEmailInvitations: false,
            MaximumPersonalAccessTokenLifetimeDays: 0,
        },
        TeamSettings: {
            EnableOpenServer: true,
            MaxUsersPerTeam: 2000,
            EnableUserCreation: true,
            RestrictCreationToDomains: '',
        },
        // Disabled by default; SSO specs enable them.
        GitLabSettings: {Enable: false},
        GoogleSettings: {Enable: false},
        IntuneSettings: {Enable: false},
        Office365Settings: {Enable: false},
        OpenIdSettings: {Enable: false},
        SamlSettings: {Enable: false, EnableSyncWithLdap: false},
        LdapSettings: {Enable: false},
    };
};
