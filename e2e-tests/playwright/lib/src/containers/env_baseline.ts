// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MATTERMOST_ALIAS, MATTERMOST_PORT} from './constants';

// Test-oriented MM_* config the Mattermost server container starts with by default,
// merged under testConfig.serverEnv (MM_ENV) so callers can still override any of it.
//
// MM_SERVICESETTINGS_SITEURL defaults to the Docker network alias (the server's own view of
// itself, reachable by its own container - see default_config.ts's ServiceSettings.SiteURL
// comment) but, unlike mattermost_container.ts's structuralEnv(), lives at this overridable tier
// on purpose: a caller that genuinely needs the running server's SiteURL to be host-reachable
// (e.g. pw.ensureServerEnv('MM_SERVICESETTINGS_SITEURL', testConfig.baseURL), for an OAuth-style
// flow whose redirect_uri a plain browser must be able to follow) can flip it via a restart.
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
    MM_SERVICESETTINGS_SITEURL: `http://${MATTERMOST_ALIAS}:${MATTERMOST_PORT}`,
};
