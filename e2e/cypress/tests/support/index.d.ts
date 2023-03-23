// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

declare namespace Cypress {
    type AdminConfig = import('@mattermost/types/config').AdminConfig;
    type AnalyticsRow = import('@mattermost/types/admin').AnalyticsRow;
    type Bot = import('@mattermost/types/bots').Bot;
    type BotPatch = import('@mattermost/types/bots').BotPatch;
    type Channel = import('@mattermost/types/channels').Channel;
    type ClusterInfo = import('@mattermost/types/admin').ClusterInfo;
    type Client = import('./client-impl').E2EClient;
    type ClientLicense = import('@mattermost/types/config').ClientLicense;
    type ChannelMembership = import('@mattermost/types/channels').ChannelMembership;
    type ChannelType = import('@mattermost/types/channels').ChannelType;
    type IncomingWebhook = import('@mattermost/types/integrations').IncomingWebhook;
    type OutgoingWebhook = import('@mattermost/types/integrations').OutgoingWebhook;
    type Permissions = string[];
    type PluginManifest = import('@mattermost/types/plugins').PluginManifest;
    type PluginsResponse = import('@mattermost/types/plugins').PluginsResponse;
    type PreferenceType = import('@mattermost/types/preferences').PreferenceType;
    type Product = import('@mattermost/types/cloud').Product;
    type Role = import('@mattermost/types/roles').Role;
    type Scheme = import('@mattermost/types/schemes').Scheme;
    type Session = import('@mattermost/types/sessions').Session;
    type Subscription = import('@mattermost/types/cloud').Subscription;
    type Team = import('@mattermost/types/teams').Team;
    type TeamMembership = import('@mattermost/types/teams').TeamMembership;
    type TermsOfService = import('@mattermost/types/terms_of_service').TermsOfService;
    type UserProfile = import('@mattermost/types/users').UserProfile;
    type UserStatus = import('@mattermost/types/users').UserStatus;
    type UserCustomStatus = import('@mattermost/types/users').UserCustomStatus;
    type UserAccessToken = import('@mattermost/types/users').UserAccessToken;
    type DeepPartial = import('@mattermost/types/utilities').DeepPartial;
    interface Chainable {
        tab: (options?: {shift?: boolean}) => Chainable<JQuery>;
    }
}
