// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MATTERMOST_ALIAS, MATTERMOST_PORT} from './constants';

// Test-oriented MM_* config the Mattermost server container starts with by default,
// merged under testConfig.serverEnv (MM_ENV) so callers can still override any of it.
//
// SiteURL defaults to the Docker network alias but, unlike structuralEnv() in
// mattermost_container.ts, lives at this overridable tier so pw.ensureSiteUrl() can flip it
// to a host-reachable URL via restart when a spec needs one.
export const SERVER_ENV_BASELINE: Record<string, string> = {
    MM_SERVICEENVIRONMENT: 'test',
    MM_CLUSTERSETTINGS_READONLYCONFIG: 'false',
    MM_CONNECTEDWORKSPACESSETTINGS_ENABLEREMOTECLUSTERSERVICE: 'true',
    MM_CONNECTEDWORKSPACESSETTINGS_ENABLESHAREDWORKSPACES: 'true',
    MM_LOGSETTINGS_CONSOLELEVEL: 'DEBUG',
    MM_LOGSETTINGS_ENABLEDIAGNOSTICS: 'false',
    MM_PLUGINSETTINGS_ENABLEUPLOADS: 'true',
    MM_SERVICESETTINGS_ALLOWCORSFROM: '*',
    MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS: 'keycloak elasticsearch opensearch minio azurite webhook',
    MM_SERVICESETTINGS_ENABLELOCALMODE: 'true',
    MM_SERVICESETTINGS_ENABLESECURITYFIXALERT: 'false',
    MM_SERVICESETTINGS_ENABLETESTING: 'true',
    // Feature flags this test suite needs on, off by default in the server
    MM_FEATUREFLAGS_CHANNELACCESSABACPERMISSION: 'true',
    MM_FEATUREFLAGS_ATTRIBUTEVALUEMASKING: 'true',
    MM_FEATUREFLAGS_PERMISSIONPOLICIES: 'true',
    MM_FEATUREFLAGS_PROPERTYFIELDRANK: 'true',
    MM_FEATUREFLAGS_RECURRINGSCHEDULEDPOSTS: 'true',
    MM_FEATUREFLAGS_RESOURCEATTRIBUTESINPOLICIES: 'true',
    MM_FEATUREFLAGS_TEAMMEMBERSHIPACCESSCONTROL: 'true',
    MM_FEATUREFLAGS_WYSIWYGEDITOR: 'true',
    MM_SERVICESETTINGS_SITEURL: `http://${MATTERMOST_ALIAS}:${MATTERMOST_PORT}`,
};
