// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Test-oriented MM_* config the Mattermost server container starts with by default,
// merged under testConfig.serverEnv (MM_ENV) so callers can still override any of it.
//
// SiteURL is deliberately not set here: an env var would pin it for the container's whole life.
// It lives in the config instead (global setup and initSetup() set the Docker network alias), so
// pw.ensureSiteUrl() can point it at the host for one test and the next initSetup() puts it back.
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
};
