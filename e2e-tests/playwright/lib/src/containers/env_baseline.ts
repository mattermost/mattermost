// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Test-oriented MM_* config the Mattermost server container starts with by default (feature
// flags, CORS, local mode, log verbosity), merged under testConfig.serverEnv (MM_ENV) so callers
// can still override any of it.
export const SERVER_ENV_BASELINE: Record<string, string> = {
    MM_SERVICESETTINGS_ENABLETESTING: 'true',
    MM_SERVICESETTINGS_ALLOWCORSFROM: '*',
    MM_SERVICESETTINGS_ENABLELOCALMODE: 'true',
    MM_SERVICESETTINGS_ENABLESECURITYFIXALERT: 'false',
    MM_CONNECTEDWORKSPACESSETTINGS_ENABLEREMOTECLUSTERSERVICE: 'true',
    MM_CONNECTEDWORKSPACESSETTINGS_ENABLESHAREDWORKSPACES: 'true',
    MM_FEATUREFLAGS_ENABLEREMOTECLUSTERSERVICE: 'true',
    MM_CLUSTERSETTINGS_READONLYCONFIG: 'false',
    MM_SERVICEENVIRONMENT: 'test',
    MM_FEATUREFLAGS_MOVETHREADSENABLED: 'true',
    MM_FEATUREFLAGS_CUSTOMPROFILEATTRIBUTES: 'true',
    MM_FEATUREFLAGS_PERMISSIONPOLICIES: 'true',
    MM_FEATUREFLAGS_TEAMMEMBERSHIPACCESSCONTROL: 'true',
    MM_FEATUREFLAGS_CLASSIFICATIONMARKINGS: 'true',
    MM_FEATUREFLAGS_INTEGRATEDBOARDS: 'true',
    MM_FEATUREFLAGS_PROPERTYFIELDRANK: 'true',
    MM_FEATUREFLAGS_ATTRIBUTEVALUEMASKING: 'true',
    MM_FEATUREFLAGS_WYSIWYGEDITOR: 'true',
    MM_LOGSETTINGS_ENABLEDIAGNOSTICS: 'false',
    MM_LOGSETTINGS_CONSOLELEVEL: 'DEBUG',
    // PluginSettings.EnableUploads can't be toggled via patchConfig once the server is running
    // (rejected as a security-restricted field) — initSetup() always patches it to true, so it
    // must already be true at boot.
    MM_PLUGINSETTINGS_ENABLEUPLOADS: 'true',
    // The additional-service containers sit on private/reserved-range IPs, which the server's SSRF
    // guard blocks by default for any HTTP call it initiates itself (SAML metadata, Elasticsearch/
    // OpenSearch/S3/Azure Blob, webhook callbacks) unless explicitly allowed here. Set via env var
    // rather than patchConfig(): once a Config field is set via its MM_* env var, it reads back
    // that env value forever — later PatchConfig calls for the same field are accepted but
    // silently have no effect. mattermost_container.ts's structuralEnv() appends the network's
    // own gateway IP to this same setting for the same reason.
    MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS: 'keycloak elasticsearch opensearch minio azurite webhook',
};
