// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import * as fs from 'fs';
import * as path from 'path';
/**
 * Build environment variables for the Mattermost server from connection info.
 * These can be used to start a local server pointing to testcontainers dependencies.
 */
export function buildServerEnvVars(info) {
    const env = {
        // Skip Docker in make run-server (testcontainers provides dependencies)
        MM_NO_DOCKER: 'true',
        // Database
        MM_SQLSETTINGS_DRIVERNAME: 'postgres',
        MM_SQLSETTINGS_DATASOURCE: info.postgres.connectionString,
        // Server settings
        MM_SERVICESETTINGS_SITEURL: 'http://localhost:8065',
        MM_SERVICESETTINGS_LISTENADDRESS: ':8065',
    };
    // Email settings if inbucket is available (connection only, other settings via mmctl)
    if (info.inbucket) {
        env.MM_EMAILSETTINGS_SMTPSERVER = info.inbucket.host;
        env.MM_EMAILSETTINGS_SMTPPORT = String(info.inbucket.smtpPort);
    }
    // LDAP settings if openldap is available (Enable is set via mmctl, not env var)
    if (info.openldap) {
        // Connection settings
        env.MM_LDAPSETTINGS_LDAPSERVER = info.openldap.host;
        env.MM_LDAPSETTINGS_LDAPPORT = String(info.openldap.port);
        env.MM_LDAPSETTINGS_BASEDN = info.openldap.baseDN;
        env.MM_LDAPSETTINGS_BINDUSERNAME = info.openldap.bindDN;
        env.MM_LDAPSETTINGS_BINDPASSWORD = info.openldap.bindPassword;
        // Attribute mappings (required for LDAP to work)
        env.MM_LDAPSETTINGS_EMAILATTRIBUTE = 'mail';
        env.MM_LDAPSETTINGS_USERNAMEATTRIBUTE = 'uid';
        env.MM_LDAPSETTINGS_IDATTRIBUTE = 'uid';
        env.MM_LDAPSETTINGS_LOGINIDATTRIBUTE = 'uid';
        env.MM_LDAPSETTINGS_FIRSTNAMEATTRIBUTE = 'cn';
        env.MM_LDAPSETTINGS_LASTNAMEATTRIBUTE = 'sn';
        env.MM_LDAPSETTINGS_NICKNAMEATTRIBUTE = 'cn';
        env.MM_LDAPSETTINGS_POSITIONATTRIBUTE = 'title';
    }
    // MinIO settings if available
    if (info.minio) {
        env.MM_FILESETTINGS_DRIVERNAME = 'amazons3';
        env.MM_FILESETTINGS_AMAZONS3ACCESSKEYID = info.minio.accessKey;
        env.MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY = info.minio.secretKey;
        env.MM_FILESETTINGS_AMAZONS3BUCKET = 'mattermost-test';
        env.MM_FILESETTINGS_AMAZONS3ENDPOINT = `${info.minio.host}:${info.minio.port}`;
        env.MM_FILESETTINGS_AMAZONS3SSL = 'false';
    }
    // Elasticsearch settings if available (EnableIndexing/EnableSearching set via mmctl, not env var)
    if (info.elasticsearch) {
        env.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = info.elasticsearch.url;
    }
    // OpenSearch settings if available (EnableIndexing/EnableSearching set via mmctl, not env var)
    if (info.opensearch) {
        env.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = info.opensearch.url;
        env.MM_ELASTICSEARCHSETTINGS_BACKEND = 'opensearch';
    }
    // Redis settings if available (CacheType set via mmctl, not env var)
    if (info.redis) {
        env.MM_CACHESETTINGS_REDISADDRESS = `${info.redis.host}:${info.redis.port}`;
        env.MM_CACHESETTINGS_REDISDB = '0';
    }
    return env;
}
/**
 * Print environment variables for the Mattermost server in a format that can be sourced.
 * @param info Service connection information
 * @param logger Optional custom logger function (defaults to console.log)
 */
export function printServerEnvVars(info, logger = console.log) {
    const envVars = buildServerEnvVars(info);
    logger('\n# Server Environment Variables (source this or export manually):');
    for (const [key, value] of Object.entries(envVars)) {
        logger(`export ${key}="${value}"`);
    }
    logger('');
}
/**
 * Print connection info for all dependencies in the test environment.
 * @param info Service connection information
 * @param logger Optional custom logger function (defaults to console.log)
 */
export function printConnectionInfo(info, logger = console.log) {
    logger('\nTest Environment Connection Info:');
    logger('=================================');
    if (info.mattermost) {
        logger(`  Mattermost: ${info.mattermost.url}`);
    }
    logger(`  PostgreSQL: ${info.postgres.connectionString}`);
    if (info.inbucket) {
        logger(`  Inbucket Web: http://${info.inbucket.host}:${info.inbucket.webPort}`);
    }
    if (info.openldap) {
        logger(`  OpenLDAP: ldap://${info.openldap.host}:${info.openldap.port}`);
    }
    if (info.minio) {
        logger(`  MinIO: ${info.minio.endpoint}`);
    }
    if (info.elasticsearch) {
        logger(`  Elasticsearch: ${info.elasticsearch.url}`);
    }
    if (info.opensearch) {
        logger(`  OpenSearch: ${info.opensearch.url}`);
    }
    if (info.keycloak) {
        logger(`  Keycloak: ${info.keycloak.adminUrl}`);
    }
    if (info.redis) {
        logger(`  Redis: ${info.redis.url}`);
    }
    if (info.dejavu) {
        logger(`  Dejavu: ${info.dejavu.url}`);
    }
    if (info.prometheus) {
        logger(`  Prometheus: ${info.prometheus.url}`);
    }
    if (info.grafana) {
        logger(`  Grafana: ${info.grafana.url}`);
    }
    if (info.loki) {
        logger(`  Loki: ${info.loki.url}`);
    }
    if (info.promtail) {
        logger(`  Promtail: ${info.promtail.url}`);
    }
    logger('');
}
/**
 * Write environment variables to a file that can be sourced by shell.
 * Includes section comments for each dependency.
 * @param info Service connection information
 * @param outputDir Directory to write the file to
 * @param options Options for file generation
 * @param options.depsOnly Whether running in deps-only mode (adds MM_NO_DOCKER)
 * @param options.filename Filename (default: .env.tc)
 * @returns The full path to the written file
 */
export function writeEnvFile(info, outputDir, options = {}) {
    const { depsOnly = false, filename = '.env.tc' } = options;
    const lines = [];
    // General settings (only for deps-only mode when running local server)
    if (depsOnly) {
        lines.push('# General');
        lines.push('export MM_NO_DOCKER="true"');
        lines.push('export MM_SERVICEENVIRONMENT="dev"');
        lines.push('');
    }
    // PostgreSQL
    lines.push('# PostgreSQL');
    lines.push('export MM_SQLSETTINGS_DRIVERNAME="postgres"');
    lines.push(`export MM_SQLSETTINGS_DATASOURCE="${info.postgres.connectionString}"`);
    lines.push('');
    // Server settings
    lines.push('# Server');
    lines.push('export MM_SERVICESETTINGS_SITEURL="http://localhost:8065"');
    lines.push('export MM_SERVICESETTINGS_LISTENADDRESS=":8065"');
    lines.push('');
    // Inbucket (Email) - connection settings only, other email settings via mmctl
    if (info.inbucket) {
        lines.push('# Inbucket (Email)');
        lines.push(`export MM_EMAILSETTINGS_SMTPSERVER="${info.inbucket.host}"`);
        lines.push(`export MM_EMAILSETTINGS_SMTPPORT="${info.inbucket.smtpPort}"`);
        lines.push('');
    }
    // OpenLDAP
    // Enable via System Console or set MM_LDAPSETTINGS_ENABLE="true"
    if (info.openldap) {
        lines.push('# OpenLDAP - Connection Settings');
        lines.push(`export MM_LDAPSETTINGS_LDAPSERVER="${info.openldap.host}"`);
        lines.push(`export MM_LDAPSETTINGS_LDAPPORT="${info.openldap.port}"`);
        lines.push(`export MM_LDAPSETTINGS_BASEDN="${info.openldap.baseDN}"`);
        lines.push(`export MM_LDAPSETTINGS_BINDUSERNAME="${info.openldap.bindDN}"`);
        lines.push(`export MM_LDAPSETTINGS_BINDPASSWORD="${info.openldap.bindPassword}"`);
        lines.push('');
        lines.push('# OpenLDAP - Attribute Mappings (required for LDAP to work)');
        lines.push('export MM_LDAPSETTINGS_EMAILATTRIBUTE="mail"');
        lines.push('export MM_LDAPSETTINGS_USERNAMEATTRIBUTE="uid"');
        lines.push('export MM_LDAPSETTINGS_IDATTRIBUTE="uid"');
        lines.push('export MM_LDAPSETTINGS_LOGINIDATTRIBUTE="uid"');
        lines.push('export MM_LDAPSETTINGS_FIRSTNAMEATTRIBUTE="cn"');
        lines.push('export MM_LDAPSETTINGS_LASTNAMEATTRIBUTE="sn"');
        lines.push('export MM_LDAPSETTINGS_NICKNAMEATTRIBUTE="cn"');
        lines.push('export MM_LDAPSETTINGS_POSITIONATTRIBUTE="title"');
        lines.push('');
        lines.push('# OpenLDAP - Group Settings (optional, for LDAP group sync)');
        lines.push('# export MM_LDAPSETTINGS_GROUPDISPLAYNAMEATTRIBUTE="cn"');
        lines.push('# export MM_LDAPSETTINGS_GROUPIDATTRIBUTE="entryUUID"');
        lines.push('# export MM_LDAPSETTINGS_GROUPFILTER=""');
        lines.push('# export MM_LDAPSETTINGS_USERFILTER=""');
        lines.push('');
        lines.push('# OpenLDAP - Enable LDAP (uncomment to enable)');
        lines.push('# export MM_LDAPSETTINGS_ENABLE="true"');
        lines.push('');
    }
    // MinIO (S3)
    if (info.minio) {
        lines.push('# MinIO (S3)');
        lines.push('export MM_FILESETTINGS_DRIVERNAME="amazons3"');
        lines.push(`export MM_FILESETTINGS_AMAZONS3ACCESSKEYID="${info.minio.accessKey}"`);
        lines.push(`export MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY="${info.minio.secretKey}"`);
        lines.push('export MM_FILESETTINGS_AMAZONS3BUCKET="mattermost-test"');
        lines.push(`export MM_FILESETTINGS_AMAZONS3ENDPOINT="${info.minio.host}:${info.minio.port}"`);
        lines.push('export MM_FILESETTINGS_AMAZONS3SSL="false"');
        lines.push('');
    }
    // Elasticsearch (EnableIndexing/EnableSearching set via mmctl, not env var)
    if (info.elasticsearch) {
        lines.push('# Elasticsearch');
        lines.push(`export MM_ELASTICSEARCHSETTINGS_CONNECTIONURL="${info.elasticsearch.url}"`);
        lines.push('');
    }
    // OpenSearch (EnableIndexing/EnableSearching set via mmctl, not env var)
    if (info.opensearch) {
        lines.push('# OpenSearch');
        lines.push(`export MM_ELASTICSEARCHSETTINGS_CONNECTIONURL="${info.opensearch.url}"`);
        lines.push('export MM_ELASTICSEARCHSETTINGS_BACKEND="opensearch"');
        lines.push('');
    }
    // Redis (CacheType set via mmctl, not env var)
    if (info.redis) {
        lines.push('# Redis');
        lines.push(`export MM_CACHESETTINGS_REDISADDRESS="${info.redis.host}:${info.redis.port}"`);
        lines.push('export MM_CACHESETTINGS_REDISDB="0"');
        lines.push('');
    }
    // Keycloak (SAML/OpenID) - settings for reference
    // Note: SAML requires certificate upload via System Console (env vars alone won't work with database config)
    // OpenID is simpler and can be configured via env vars or System Console
    // Keycloak clients: 'mattermost' (SAML), 'mattermost-openid' (OpenID, secret: mattermost-openid-secret)
    if (info.keycloak) {
        const keycloakPort = info.keycloak.port;
        lines.push('# Keycloak Credentials');
        lines.push('# Admin Console: admin / admin');
        lines.push('# Test Users:');
        lines.push('#   - user-1 / Password1! (user-1@sample.mattermost.com)');
        lines.push('#   - user-2 / Password1! (user-2@sample.mattermost.com)');
        lines.push('');
        lines.push('# Keycloak - SAML Settings (requires certificate upload via System Console)');
        lines.push(`# export MM_SAMLSETTINGS_IDPURL="http://localhost:${keycloakPort}/realms/mattermost/protocol/saml"`);
        lines.push(`# export MM_SAMLSETTINGS_IDPDESCRIPTORURL="http://localhost:${keycloakPort}/realms/mattermost"`);
        lines.push(`# export MM_SAMLSETTINGS_IDPMETADATAURL="http://localhost:${keycloakPort}/realms/mattermost/protocol/saml/descriptor"`);
        lines.push('# export MM_SAMLSETTINGS_SERVICEPROVIDERIDENTIFIER="mattermost"');
        lines.push('# export MM_SAMLSETTINGS_ASSERTIONCONSUMERSERVICEURL="http://localhost:8065/login/sso/saml"');
        lines.push('# export MM_SAMLSETTINGS_IDATTRIBUTE="id"');
        lines.push('# export MM_SAMLSETTINGS_FIRSTNAMEATTRIBUTE="givenName"');
        lines.push('# export MM_SAMLSETTINGS_LASTNAMEATTRIBUTE="surname"');
        lines.push('# export MM_SAMLSETTINGS_EMAILATTRIBUTE="email"');
        lines.push('# export MM_SAMLSETTINGS_USERNAMEATTRIBUTE="username"');
        lines.push('# export MM_SAMLSETTINGS_ENABLE="true"');
        lines.push('');
        lines.push('# Keycloak - OpenID Settings (can be configured via env vars or System Console)');
        lines.push('# export MM_OPENIDSETTINGS_SECRET="mattermost-openid-secret"');
        lines.push('# export MM_OPENIDSETTINGS_ID="mattermost-openid"');
        lines.push('# export MM_OPENIDSETTINGS_SCOPE="profile openid email"');
        lines.push(`# export MM_OPENIDSETTINGS_DISCOVERYENDPOINT="http://localhost:${keycloakPort}/realms/mattermost/.well-known/openid-configuration"`);
        lines.push('# export MM_OPENIDSETTINGS_BUTTONTEXT="Login using OpenID"');
        lines.push('# export MM_OPENIDSETTINGS_ENABLE="true"');
        lines.push('');
    }
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, lines.join('\n'));
    return filePath;
}
/**
 * Write server configuration to a JSON file.
 * @param config Server configuration object (from mmctl config show)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: .tc.server.config.json)
 * @returns The full path to the written file
 */
export function writeServerConfig(config, outputDir, filename = '.tc.server.config.json') {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
    return filePath;
}
/**
 * Helper to merge connection info with container metadata.
 */
function mergeContainerInfo(connection, metadata) {
    if (!metadata)
        return connection;
    return {
        id: metadata.id,
        name: metadata.name,
        image: metadata.image,
        labels: metadata.labels,
        ...connection,
    };
}
/**
 * Build Docker container information from connection info and metadata.
 * @param info Service connection information
 * @param metadata Container metadata (ID, name, labels)
 * @returns Object with container details for each service
 */
export function buildDockerInfo(info, metadata) {
    const containers = {};
    if (info.mattermost) {
        containers.mattermost = mergeContainerInfo({
            host: info.mattermost.host,
            port: info.mattermost.port,
            url: info.mattermost.url,
            internalUrl: info.mattermost.internalUrl,
        }, metadata?.mattermost);
    }
    containers.postgres = mergeContainerInfo({
        host: info.postgres.host,
        port: info.postgres.port,
        database: info.postgres.database,
        username: info.postgres.username,
        connectionString: info.postgres.connectionString,
    }, metadata?.postgres);
    if (info.inbucket) {
        containers.inbucket = mergeContainerInfo({
            host: info.inbucket.host,
            smtpPort: info.inbucket.smtpPort,
            webPort: info.inbucket.webPort,
            pop3Port: info.inbucket.pop3Port,
            webUrl: `http://${info.inbucket.host}:${info.inbucket.webPort}`,
        }, metadata?.inbucket);
    }
    if (info.openldap) {
        containers.openldap = mergeContainerInfo({
            host: info.openldap.host,
            port: info.openldap.port,
            tlsPort: info.openldap.tlsPort,
            baseDN: info.openldap.baseDN,
            bindDN: info.openldap.bindDN,
        }, metadata?.openldap);
    }
    if (info.minio) {
        containers.minio = mergeContainerInfo({
            host: info.minio.host,
            port: info.minio.port,
            consolePort: info.minio.consolePort,
            endpoint: info.minio.endpoint,
            consoleUrl: info.minio.consoleUrl,
            accessKey: info.minio.accessKey,
        }, metadata?.minio);
    }
    if (info.elasticsearch) {
        containers.elasticsearch = mergeContainerInfo({
            host: info.elasticsearch.host,
            port: info.elasticsearch.port,
            url: info.elasticsearch.url,
        }, metadata?.elasticsearch);
    }
    if (info.opensearch) {
        containers.opensearch = mergeContainerInfo({
            host: info.opensearch.host,
            port: info.opensearch.port,
            url: info.opensearch.url,
        }, metadata?.opensearch);
    }
    if (info.keycloak) {
        containers.keycloak = mergeContainerInfo({
            host: info.keycloak.host,
            port: info.keycloak.port,
            adminUrl: info.keycloak.adminUrl,
            realmUrl: info.keycloak.realmUrl,
        }, metadata?.keycloak);
    }
    if (info.redis) {
        containers.redis = mergeContainerInfo({
            host: info.redis.host,
            port: info.redis.port,
            url: info.redis.url,
        }, metadata?.redis);
    }
    if (info.dejavu) {
        containers.dejavu = mergeContainerInfo({
            host: info.dejavu.host,
            port: info.dejavu.port,
            url: info.dejavu.url,
        }, metadata?.dejavu);
    }
    if (info.prometheus) {
        containers.prometheus = mergeContainerInfo({
            host: info.prometheus.host,
            port: info.prometheus.port,
            url: info.prometheus.url,
        }, metadata?.prometheus);
    }
    if (info.grafana) {
        containers.grafana = mergeContainerInfo({
            host: info.grafana.host,
            port: info.grafana.port,
            url: info.grafana.url,
        }, metadata?.grafana);
    }
    if (info.loki) {
        containers.loki = mergeContainerInfo({
            host: info.loki.host,
            port: info.loki.port,
            url: info.loki.url,
        }, metadata?.loki);
    }
    if (info.promtail) {
        containers.promtail = mergeContainerInfo({
            host: info.promtail.host,
            port: info.promtail.port,
            url: info.promtail.url,
        }, metadata?.promtail);
    }
    return {
        startedAt: new Date().toISOString(),
        containers,
    };
}
/**
 * Write Docker container information to a JSON file.
 * @param info Service connection information
 * @param metadata Container metadata (ID, name, labels)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: .tc.docker.json)
 * @returns The full path to the written file
 */
export function writeDockerInfo(info, metadata, outputDir, filename = '.tc.docker.json') {
    const dockerInfo = buildDockerInfo(info, metadata);
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(dockerInfo, null, 2) + '\n');
    return filePath;
}
// Keycloak SAML certificate (from server/build/docker/keycloak/keycloak.crt)
// This certificate is used by Mattermost to verify SAML assertions from Keycloak
export const KEYCLOAK_SAML_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0MB4XDTI0MDIyMTIwNDA0OFoXDTM0MDIyMTIwNDIyOFowFTETMBEGA1UEAwwKbWF0dGVybW9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOnsgNexkO5tbKkFXN+SdMUuLHbqdjZ9/JSnKrYPHLarf8801YDDzV8wI9jjdCCgq+xtKFKWlwU2rGpjPbefDLV1m7CSu0Iq+hNxDiBdX3wkEIK98piDpx+xYGL0aAbXn3nAlqFOWQJLKLM1I65ZmK31YZeVj4Kn01W4WfsvKHoxPjLPwPTug4HB6vaQXqEpzYYYHyuJKvIYNuVwo0WQdaPRXb0poZoYzOnoB6tOFrim6B7/chqtZeXQc7h6/FejBsV59aO5uATI0aAJw1twzjCNIiOeJLB2jlLuIMR3/Yaqr8IRpRXzcRPETpisWNilhV07ZBW0YL9ZwuU4sHWy+iMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW4I1egm+czdnnZxTtth3cjCmLg/UsalUDKSfFOLAlnbe6TtVhP4DpAl+OaQO4+kdEKemLENPmh4ddaHUjSSbbCQZo8B7IjByEe7x3kQdj2ucQpA4bh0vGZ11pVhk5HfkGqAO+UVNQsyLpTmWXQ8SEbxcw6mlTM4SjuybqaGOva1LBscI158Uq5FOVT6TJaxCt3dQkBH0tK+vhRtIM13pNZ/+SFgecn16AuVdBfjjqXynefrSihQ20BZ3NTyjs/N5J2qvSwQ95JARZrlhfiS++L81u2N/0WWni9cXmHsdTLxRrDZjz2CXBNeFOBRio74klSx8tMK27/2lxMsEC7R+DA==
-----END CERTIFICATE-----`;
/**
 * Write Keycloak SAML certificate to the output directory.
 * This certificate can be uploaded to Mattermost via System Console or API.
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: saml-idp.crt)
 * @returns The full path to the written file
 */
export function writeKeycloakCertificate(outputDir, filename = 'saml-idp.crt') {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, KEYCLOAK_SAML_CERTIFICATE);
    return filePath;
}
/**
 * Write OpenLDAP setup documentation to the output directory.
 * @param info Service connection information (must include openldap)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: openldap_setup.md)
 * @returns The full path to the written file, or null if openldap not configured
 */
export function writeOpenLdapSetup(info, outputDir, filename = 'openldap_setup.md') {
    if (!info.openldap) {
        return null;
    }
    const { host, port, tlsPort, baseDN, bindDN, bindPassword, image } = info.openldap;
    const content = `# OpenLDAP Setup for Mattermost Testing

This document describes the OpenLDAP configuration used by the testcontainers environment.

## Container Information

| Property | Value |
|----------|-------|
| Image | \`${image}\` |
| Host | \`${host}\` |
| LDAP Port | ${port} |
| LDAPS Port | ${tlsPort} |
| Network Alias | \`openldap\` |

## Admin Credentials

| Field | Value |
|-------|-------|
| Bind DN | \`${bindDN}\` |
| Password | \`${bindPassword}\` |
| Base DN | \`${baseDN}\` |
| Domain | \`mm.test.com\` |
| Organisation | \`Mattermost Test\` |

## Pre-loaded Test Users

| Username | Password | Email | Title |
|----------|----------|-------|-------|
| \`test.one\` | \`Password1\` | \`success+testone@simulator.amazonses.com\` | Test1 Title |
| \`test.two\` | \`Password1\` | \`success+testtwo@simulator.amazonses.com\` | Test2 Title |
| \`dev.one\` | \`Password1\` | \`success+devone@simulator.amazonses.com\` | Senior Software Design Engineer |

### User DNs

| Username | DN |
|----------|-----|
| \`test.one\` | \`uid=test.one,ou=testusers,${baseDN}\` |
| \`test.two\` | \`uid=test.two,ou=testusers,${baseDN}\` |
| \`dev.one\` | \`uid=dev.one,ou=testusers,${baseDN}\` |

## Pre-loaded Test Groups

| Group Name | DN | Members |
|------------|-----|---------|
| \`developers\` | \`cn=developers,ou=testgroups,${baseDN}\` | \`dev.one\`, \`test.one\` |

## Organizational Units

| OU | DN |
|----|-----|
| Test Users | \`ou=testusers,${baseDN}\` |
| Test Groups | \`ou=testgroups,${baseDN}\` |

## Custom Schema Extensions

### 1. Active Directory ObjectGUID Support
- **Attribute**: \`objectGUID\` - AD object GUID (octet string, single-value)
- **Object Class**: \`activeDSObject\` - Auxiliary class with \`objectGUID\` attribute

### 2. Custom Profile Attributes (CPA)

| Attribute | Description | Type |
|-----------|-------------|------|
| \`textCustomAttribute\` | Text custom attribute | String |
| \`dateCustomAttribute\` | Date attribute | GeneralizedTime |
| \`selectCustomAttribute\` | Single selection | String, single-value |
| \`multiSelectCustomAttribute\` | Multi-selection | String, multi-value |
| \`userReferenceCustomAttribute\` | Reference to single user | DN, single-value |
| \`multiUserReferenceCustomAttribute\` | References to multiple users | DN, multi-value |

## Mattermost LDAP Configuration

### System Console Settings (AD/LDAP)

| Setting | Value |
|---------|-------|
| Enable sign-in with AD/LDAP | \`true\` |
| AD/LDAP Server | \`${host}\` |
| AD/LDAP Port | \`${port}\` |
| Connection Security | None |
| Base DN | \`${baseDN}\` |
| Bind Username | \`${bindDN}\` |
| Bind Password | \`${bindPassword}\` |
| User Filter | \`(objectClass=iNetOrgPerson)\` |
| Group Filter | \`(objectClass=groupOfUniqueNames)\` |

### Attribute Mappings

| Mattermost Field | LDAP Attribute |
|------------------|----------------|
| ID Attribute | \`uid\` |
| Login ID Attribute | \`uid\` |
| Username Attribute | \`uid\` |
| Email Attribute | \`mail\` |
| First Name Attribute | \`cn\` |
| Last Name Attribute | \`sn\` |
| Position Attribute | \`title\` |

## Testing LDAP Connection

\`\`\`bash
# Search for all users
ldapsearch -x -H ldap://${host}:${port} \\
  -D "${bindDN}" \\
  -w ${bindPassword} \\
  -b "ou=testusers,${baseDN}" \\
  "(objectClass=iNetOrgPerson)"

# Test user authentication
ldapwhoami -x -H ldap://${host}:${port} \\
  -D "uid=test.one,ou=testusers,${baseDN}" \\
  -w Password1
\`\`\`

## Logging into Mattermost with LDAP

1. Navigate to the Mattermost login page
2. Click "AD/LDAP" or enter credentials in the LDAP login form
3. Use test user credentials: \`test.one\` / \`Password1\`
`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
}
/**
 * Write Keycloak setup documentation to the output directory.
 * @param info Service connection information (must include keycloak)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: keycloak_setup.md)
 * @returns The full path to the written file, or null if keycloak not configured
 */
export function writeKeycloakSetup(info, outputDir, filename = 'keycloak_setup.md') {
    if (!info.keycloak) {
        return null;
    }
    const { host, port, adminUrl, realmUrl, image } = info.keycloak;
    const content = `# Keycloak Setup for Mattermost Testing

This document describes the Keycloak configuration for SAML and OpenID Connect authentication testing.

## Container Information

| Property | Value |
|----------|-------|
| Image | \`${image}\` |
| Host | \`${host}\` |
| Port | ${port} |
| Network Alias | \`keycloak\` |

## Admin Console Access

| Field | Value |
|-------|-------|
| Admin URL | \`${adminUrl}\` |
| Username | \`admin\` |
| Password | \`admin\` |

## Pre-configured Realm

| Property | Value |
|----------|-------|
| Realm Name | \`mattermost\` |
| Realm URL | \`${realmUrl}\` |
| SSL Required | None |

## Test Users

| Username | Password | Email | First Name | Last Name |
|----------|----------|-------|------------|-----------|
| \`user-1\` | \`Password1!\` | \`user-1@sample.mattermost.com\` | User | One |
| \`user-2\` | \`Password1!\` | \`user-2@sample.mattermost.com\` | User | Two |

## Pre-configured Clients

### 1. SAML Client (\`mattermost\`)

| Property | Value |
|----------|-------|
| Client ID | \`mattermost\` |
| Protocol | SAML |
| Name | Mattermost SAML |

#### SAML Protocol Mappers

| Mapper Name | User Attribute | SAML Attribute |
|-------------|----------------|----------------|
| email | email | email |
| firstName | firstName | firstName |
| lastName | lastName | lastName |
| username | username | username |
| id | id | id |

### 2. OpenID Connect Client (\`mattermost-openid\`)

| Property | Value |
|----------|-------|
| Client ID | \`mattermost-openid\` |
| Client Secret | \`mattermost-openid-secret\` |
| Protocol | OpenID Connect |

## Mattermost SAML Configuration

### System Console Settings (SAML 2.0)

| Setting | Value |
|---------|-------|
| Enable Login With SAML 2.0 | \`true\` |
| SAML SSO URL | \`http://${host}:${port}/realms/mattermost/protocol/saml\` |
| Identity Provider Issuer URL | \`http://${host}:${port}/realms/mattermost\` |
| Identity Provider Public Certificate | Upload \`saml-idp.crt\` from output directory |
| Service Provider Identifier | \`mattermost\` |

### SAML Attribute Mappings

| Mattermost Field | SAML Attribute |
|------------------|----------------|
| ID Attribute | \`id\` |
| Email Attribute | \`email\` |
| Username Attribute | \`username\` |
| First Name Attribute | \`firstName\` |
| Last Name Attribute | \`lastName\` |

## Mattermost OpenID Connect Configuration

### System Console Settings

| Setting | Value |
|---------|-------|
| Client ID | \`mattermost-openid\` |
| Client Secret | \`mattermost-openid-secret\` |
| Discovery Endpoint | \`http://${host}:${port}/realms/mattermost/.well-known/openid-configuration\` |

### OpenID Connect URLs

| Endpoint | URL |
|----------|-----|
| Discovery | \`http://${host}:${port}/realms/mattermost/.well-known/openid-configuration\` |
| Authorization | \`http://${host}:${port}/realms/mattermost/protocol/openid-connect/auth\` |
| Token | \`http://${host}:${port}/realms/mattermost/protocol/openid-connect/token\` |
| User Info | \`http://${host}:${port}/realms/mattermost/protocol/openid-connect/userinfo\` |

## SAML IdP Certificate

The SAML signing certificate is available at:
\`\`\`
${outputDir}/saml-idp.crt
\`\`\`

Upload this to Mattermost System Console under:
**SAML 2.0 > Identity Provider Public Certificate**

## Testing Authentication

### SAML Login Flow

1. Navigate to Mattermost login page
2. Click "SAML" login button
3. Enter credentials: \`user-1\` / \`Password1!\`
4. Redirected back to Mattermost (authenticated)

### OpenID Connect Login Flow

1. Navigate to Mattermost login page
2. Click "OpenID Connect" login button
3. Enter credentials: \`user-1\` / \`Password1!\`
4. Redirected back to Mattermost (authenticated)

## Keycloak Health Check

\`\`\`bash
curl -s "http://${host}:${port}/health/ready"
\`\`\`
`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
}
