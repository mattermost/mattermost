'use strict';

var testcontainers = require('testcontainers');
var postgresql = require('@testcontainers/postgresql');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var http = require('http');
var url = require('url');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Default container images for all dependencies.
 * Centralized here for easy modification.
 *
 * These versions match server/build/docker-compose.common.yml
 */
const DEFAULT_IMAGES = {
    // Container image under test - user configurable via SERVER_IMAGE env var
    mattermost: 'mattermostdevelopment/mattermost-enterprise-edition:master',
    // Database - version configurable via SERVICE_POSTGRES_IMAGE env var
    postgres: 'postgres:14',
    // Supporting dependencies (versions from server/build/docker-compose.common.yml)
    inbucket: 'inbucket/inbucket:stable',
    openldap: 'osixia/openldap:1.4.0',
    keycloak: 'quay.io/keycloak/keycloak:23.0.7',
    minio: 'minio/minio:RELEASE.2024-06-22T05-26-45Z',
    elasticsearch: 'mattermostdevelopment/mattermost-elasticsearch:8.9.0',
    opensearch: 'mattermostdevelopment/mattermost-opensearch:2.7.0',
    redis: 'redis:7.4.0',
    // Observability stack (versions from server/build/docker-compose.common.yml)
    dejavu: 'appbaseio/dejavu:3.4.2',
    prometheus: 'prom/prometheus:v2.46.0',
    grafana: 'grafana/grafana:10.4.2',
    loki: 'grafana/loki:3.0.0',
    promtail: 'grafana/promtail:3.0.0',
    // Load balancer for HA and subpath modes
    nginx: 'nginx:1.29.4',
};
/**
 * Environment variable names for image overrides.
 * Used by CI automation to test against different versions.
 * All prefixed with TC_ (testcontainers).
 *
 * Note: Mattermost server image is configured via TC_EDITION and TC_SERVER_TAG.
 */
const IMAGE_ENV_VARS = {
    postgres: 'TC_POSTGRES_IMAGE',
    inbucket: 'TC_INBUCKET_IMAGE',
    openldap: 'TC_OPENLDAP_IMAGE',
    keycloak: 'TC_KEYCLOAK_IMAGE',
    minio: 'TC_MINIO_IMAGE',
    elasticsearch: 'TC_ELASTICSEARCH_IMAGE',
    opensearch: 'TC_OPENSEARCH_IMAGE',
    redis: 'TC_REDIS_IMAGE',
    dejavu: 'TC_DEJAVU_IMAGE',
    prometheus: 'TC_PROMETHEUS_IMAGE',
    grafana: 'TC_GRAFANA_IMAGE',
    loki: 'TC_LOKI_IMAGE',
    promtail: 'TC_PROMTAIL_IMAGE',
    nginx: 'TC_NGINX_IMAGE',
};
/**
 * Get image for a service with environment variable override support.
 * @param service The service name
 * @returns The image to use (from env var or default)
 */
function getServiceImage(service) {
    const envVar = IMAGE_ENV_VARS[service];
    if (envVar && process.env[envVar]) {
        return process.env[envVar];
    }
    return DEFAULT_IMAGES[service];
}
/**
 * Get Mattermost server image with environment variable override support.
 */
function getMattermostImage() {
    return getServiceImage('mattermost');
}
/**
 * Get PostgreSQL image with environment variable override support.
 */
function getPostgresImage() {
    return getServiceImage('postgres');
}
/**
 * Get Inbucket image with environment variable override support.
 */
function getInbucketImage() {
    return getServiceImage('inbucket');
}
/**
 * Get OpenLDAP image with environment variable override support.
 */
function getOpenLdapImage() {
    return getServiceImage('openldap');
}
/**
 * Get Keycloak image with environment variable override support.
 */
function getKeycloakImage() {
    return getServiceImage('keycloak');
}
/**
 * Get MinIO image with environment variable override support.
 */
function getMinioImage() {
    return getServiceImage('minio');
}
/**
 * Get Elasticsearch image with environment variable override support.
 */
function getElasticsearchImage() {
    return getServiceImage('elasticsearch');
}
/**
 * Get OpenSearch image with environment variable override support.
 */
function getOpenSearchImage() {
    return getServiceImage('opensearch');
}
/**
 * Get Redis image with environment variable override support.
 */
function getRedisImage() {
    return getServiceImage('redis');
}
/**
 * Get Dejavu image with environment variable override support.
 */
function getDejavuImage() {
    return getServiceImage('dejavu');
}
/**
 * Get Prometheus image with environment variable override support.
 */
function getPrometheusImage() {
    return getServiceImage('prometheus');
}
/**
 * Get Grafana image with environment variable override support.
 */
function getGrafanaImage() {
    return getServiceImage('grafana');
}
/**
 * Get Loki image with environment variable override support.
 */
function getLokiImage() {
    return getServiceImage('loki');
}
/**
 * Get Promtail image with environment variable override support.
 */
function getPromtailImage() {
    return getServiceImage('promtail');
}
/**
 * Get Nginx image with environment variable override support.
 */
function getNginxImage() {
    return getServiceImage('nginx');
}
/**
 * Default credentials for dependencies
 */
const DEFAULT_CREDENTIALS = {
    postgres: {
        database: 'mattermost_test',
        username: 'mmuser',
        password: 'mostest',
    },
    minio: {
        accessKey: 'minioaccesskey',
        secretKey: 'miniosecretkey',
    },
    openldap: {
        adminPassword: 'mostest',
        domain: 'mm.test.com',
        organisation: 'Mattermost Test',
    },
    keycloak: {
        adminUser: 'admin',
        adminPassword: 'admin',
    }};
/**
 * Internal ports for dependencies (inside containers)
 */
const INTERNAL_PORTS = {
    postgres: 5432,
    inbucket: {
        smtp: 10025,
        web: 9001,
        pop3: 10110,
    },
    openldap: {
        ldap: 389,
        ldaps: 636,
    },
    minio: {
        api: 9000,
        console: 9002,
    },
    elasticsearch: 9200,
    opensearch: 9200,
    redis: 6379,
    keycloak: 8080,
    mattermost: 8065,
    dejavu: 1358,
    prometheus: 9090,
    grafana: 3000,
    loki: 3100,
    promtail: 9080,
    nginx: 8065, // Load balancer port (same as mattermost)
};
/**
 * Default cluster settings for HA mode
 */
const DEFAULT_HA_SETTINGS = {
    clusterName: 'mm_test_cluster',
};
/**
 * Fixed number of nodes for HA mode (not configurable)
 */
const HA_NODE_COUNT = 3;

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Log a message with timestamp to stderr.
 * Format: [ISO8601] [tc] message
 *
 * @param message The message to log
 */
function log(message) {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    process.stderr.write(`[${timestamp}] [tc] ${message}\n`);
}
// Default output directory for all testcontainers artifacts
const DEFAULT_OUTPUT_DIR$1 = '.tc.out';
// Subdirectory for container logs within outputDir
const LOGS_SUBDIR = 'logs';
// Configured output directory (can be set via setOutputDir or TC_OUTPUT_DIR env var)
let outputDir = null;
/**
 * Get the output directory path.
 * Priority: setOutputDir() > TC_OUTPUT_DIR env var > default (.tc.out in cwd)
 */
function getOutputDir() {
    if (outputDir) {
        return outputDir;
    }
    if (process.env.TC_OUTPUT_DIR) {
        return process.env.TC_OUTPUT_DIR;
    }
    return path__namespace.join(process.cwd(), DEFAULT_OUTPUT_DIR$1);
}
/**
 * Set the output directory path.
 * @param dir Directory path for testcontainers output
 */
function setOutputDir(dir) {
    outputDir = dir;
}
/**
 * Get the log directory path (always <outputDir>/logs).
 */
function getLogDir() {
    return path__namespace.join(getOutputDir(), LOGS_SUBDIR);
}
/**
 * Ensure the log directory exists.
 */
function ensureLogDir() {
    const dir = getLogDir();
    if (!fs__namespace.existsSync(dir)) {
        fs__namespace.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Create a log consumer that writes to a file.
 * @param containerName Name of the container (used for the log file name)
 * @returns A log consumer function for testcontainers
 */
function createFileLogConsumer(containerName) {
    ensureLogDir();
    const logFile = path__namespace.join(getLogDir(), `${containerName}.log`);
    // Clear the log file at start
    fs__namespace.writeFileSync(logFile, '');
    return (stream) => {
        stream.on('data', (chunk) => {
            const line = chunk.toString();
            fs__namespace.appendFileSync(logFile, line);
        });
        stream.on('err', (chunk) => {
            const line = `[ERR] ${chunk.toString()}`;
            fs__namespace.appendFileSync(logFile, line);
        });
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const POSTGRES_CONFIG = `
max_connections = 500
listen_addresses = '*'
fsync = off
full_page_writes = off
default_text_search_config = 'pg_catalog.english'
commit_delay = 1000
logging_collector = off
password_encryption = 'scram-sha-256'
`;
const POSTGRES_INIT_SQL = `
CREATE DATABASE mattermost_node_test;
GRANT ALL PRIVILEGES ON DATABASE mattermost_node_test TO mmuser;
`;
async function createPostgresContainer(network, config = {}) {
    const image = config.image ?? getPostgresImage();
    const database = config.database ?? DEFAULT_CREDENTIALS.postgres.database;
    const username = config.username ?? DEFAULT_CREDENTIALS.postgres.username;
    const password = config.password ?? DEFAULT_CREDENTIALS.postgres.password;
    const container = await new postgresql.PostgreSqlContainer(image)
        .withNetwork(network)
        .withNetworkAliases('postgres')
        .withDatabase(database)
        .withUsername(username)
        .withPassword(password)
        .withEnvironment({
        POSTGRES_INITDB_ARGS: '--auth-host=scram-sha-256 --auth-local=scram-sha-256',
    })
        .withCopyContentToContainer([
        { content: POSTGRES_CONFIG, target: '/etc/postgresql/postgresql.conf' },
        { content: POSTGRES_INIT_SQL, target: '/docker-entrypoint-initdb.d/init.sql' },
    ])
        .withCommand(['postgres', '-c', 'config_file=/etc/postgresql/postgresql.conf'])
        .withLogConsumer(createFileLogConsumer('postgres'))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getPostgresConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.postgres);
    const database = container.getDatabase();
    const username = container.getUsername();
    const password = container.getPassword();
    const connectionString = `postgres://${username}:${password}@${host}:${port}/${database}?sslmode=disable`;
    return {
        host,
        port,
        database,
        username,
        password,
        connectionString,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createInbucketContainer(network, config = {}) {
    const image = config.image ?? getInbucketImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('inbucket')
        .withEnvironment({
        INBUCKET_WEB_ADDR: `0.0.0.0:${INTERNAL_PORTS.inbucket.web}`,
        INBUCKET_POP3_ADDR: `0.0.0.0:${INTERNAL_PORTS.inbucket.pop3}`,
        INBUCKET_SMTP_ADDR: `0.0.0.0:${INTERNAL_PORTS.inbucket.smtp}`,
    })
        .withExposedPorts(INTERNAL_PORTS.inbucket.web, INTERNAL_PORTS.inbucket.smtp, INTERNAL_PORTS.inbucket.pop3)
        .withLogConsumer(createFileLogConsumer('inbucket'))
        .withWaitStrategy(testcontainers.Wait.forLogMessage(/SMTP listening/i))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getInbucketConnectionInfo(container, image) {
    const host = container.getHost();
    return {
        host,
        smtpPort: container.getMappedPort(INTERNAL_PORTS.inbucket.smtp),
        webPort: container.getMappedPort(INTERNAL_PORTS.inbucket.web),
        pop3Port: container.getMappedPort(INTERNAL_PORTS.inbucket.pop3),
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Custom schema for objectGUID attribute (from server/tests/custom-schema-objectID.ldif)
const CUSTOM_SCHEMA_OBJECT_ID = `dn: cn=schema,cn=config
changetype: modify
add: olcAttributeTypes
olcAttributeTypes: ( 1.2.840.113556.1.4.2 NAME 'objectGUID'
  DESC 'AD object GUID'
  EQUALITY octetStringMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.40
  SINGLE-VALUE )
-
add: olcObjectClasses
olcObjectClasses: ( 1.2.840.113556.1.5.256 NAME 'activeDSObject'
  DESC 'Active Directory Schema Object'
  SUP top AUXILIARY
  MAY ( objectGUID ) )`;
// Custom schema for Custom Profile Attributes (from server/tests/custom-schema-cpa.ldif)
const CUSTOM_SCHEMA_CPA = `dn: cn=schema,cn=config
changetype: modify
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.101
    NAME 'textCustomAttribute'
    DESC 'A text custom attribute for inetOrgPerson'
    EQUALITY caseIgnoreMatch
    SUBSTR caseIgnoreSubstringsMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.15 )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.104
    NAME 'dateCustomAttribute'
    DESC 'A date attribute'
    EQUALITY generalizedTimeMatch
    ORDERING generalizedTimeOrderingMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.24 )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.105
    NAME 'selectCustomAttribute'
    DESC 'A selection attribute with values: option1, option2, option3'
    EQUALITY caseIgnoreMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.15
    SINGLE-VALUE )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.106
    NAME 'multiSelectCustomAttribute'
    DESC 'A multi-selection attribute with values: choice1, choice2, choice3, choice4'
    EQUALITY caseIgnoreMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.15 )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.107
    NAME 'userReferenceCustomAttribute'
    DESC 'A reference to a single user'
    EQUALITY distinguishedNameMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.12
    SINGLE-VALUE )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.108
    NAME 'multiUserReferenceCustomAttribute'
    DESC 'References to multiple users'
    EQUALITY distinguishedNameMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.12 )
-
add: olcObjectClasses
olcObjectClasses: ( 1.3.6.1.4.1.4203.666.1.103
    NAME 'customInetOrgPerson'
    DESC 'inetOrgPerson with custom attributes'
    SUP top
    AUXILIARY
    MAY ( textCustomAttribute $ dateCustomAttribute $ selectCustomAttribute $ multiSelectCustomAttribute $ userReferenceCustomAttribute $ multiUserReferenceCustomAttribute))`;
// Test data LDIF (from server/tests/test-data.ldif) - simplified version with essential test users
const TEST_DATA_LDIF = `dn: ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: organizationalunit

dn: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
sn: User
cn: Test1
title: Test1 Title
mail: success+testone@simulator.amazonses.com
userPassword: Password1

dn: uid=test.two,ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
sn: User
cn: Test2
title: Test2 Title
mail: success+testtwo@simulator.amazonses.com
userPassword: Password1

dn: uid=dev.one,ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
sn: User
cn: Dev1
title: Senior Software Design Engineer
mail: success+devone@simulator.amazonses.com
userPassword: Password1

dn: ou=testgroups,dc=mm,dc=test,dc=com
changetype: add
objectclass: organizationalunit

dn: cn=developers,ou=testgroups,dc=mm,dc=test,dc=com
changetype: add
objectclass: groupOfUniqueNames
uniqueMember: uid=dev.one,ou=testusers,dc=mm,dc=test,dc=com
uniqueMember: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com`;
async function createOpenLdapContainer(network, config = {}) {
    const image = config.image ?? getOpenLdapImage();
    const adminPassword = config.adminPassword ?? DEFAULT_CREDENTIALS.openldap.adminPassword;
    const domain = config.domain ?? DEFAULT_CREDENTIALS.openldap.domain;
    const organisation = config.organisation ?? DEFAULT_CREDENTIALS.openldap.organisation;
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('openldap')
        .withEnvironment({
        LDAP_TLS_VERIFY_CLIENT: 'never',
        LDAP_ORGANISATION: organisation,
        LDAP_DOMAIN: domain,
        LDAP_ADMIN_PASSWORD: adminPassword,
    })
        .withCopyContentToContainer([
        {
            content: CUSTOM_SCHEMA_OBJECT_ID,
            target: '/container/service/slapd/assets/test/custom-schema-objectID.ldif',
        },
        { content: CUSTOM_SCHEMA_CPA, target: '/container/service/slapd/assets/test/custom-schema-cpa.ldif' },
        { content: TEST_DATA_LDIF, target: '/container/service/slapd/assets/test/test-data.ldif' },
    ])
        .withExposedPorts(INTERNAL_PORTS.openldap.ldap, INTERNAL_PORTS.openldap.ldaps)
        .withLogConsumer(createFileLogConsumer('openldap'))
        .withWaitStrategy(testcontainers.Wait.forLogMessage(/slapd starting/))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getOpenLdapConnectionInfo(container, image) {
    const host = container.getHost();
    const domain = DEFAULT_CREDENTIALS.openldap.domain;
    const domainParts = domain.split('.');
    const baseDN = domainParts.map((part) => `dc=${part}`).join(',');
    return {
        host,
        port: container.getMappedPort(INTERNAL_PORTS.openldap.ldap),
        tlsPort: container.getMappedPort(INTERNAL_PORTS.openldap.ldaps),
        baseDN,
        bindDN: `cn=admin,${baseDN}`,
        bindPassword: DEFAULT_CREDENTIALS.openldap.adminPassword,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createMinioContainer(network, config = {}) {
    const image = config.image ?? getMinioImage();
    const accessKey = config.accessKey ?? DEFAULT_CREDENTIALS.minio.accessKey;
    const secretKey = config.secretKey ?? DEFAULT_CREDENTIALS.minio.secretKey;
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('minio')
        .withEnvironment({
        MINIO_ROOT_USER: accessKey,
        MINIO_ROOT_PASSWORD: secretKey,
    })
        .withCommand(['server', '/data', '--console-address', `:${INTERNAL_PORTS.minio.console}`])
        .withExposedPorts(INTERNAL_PORTS.minio.api, INTERNAL_PORTS.minio.console)
        .withLogConsumer(createFileLogConsumer('minio'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/minio/health/ready', INTERNAL_PORTS.minio.api))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getMinioConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.minio.api);
    const consolePort = container.getMappedPort(INTERNAL_PORTS.minio.console);
    return {
        host,
        port,
        consolePort,
        accessKey: DEFAULT_CREDENTIALS.minio.accessKey,
        secretKey: DEFAULT_CREDENTIALS.minio.secretKey,
        endpoint: `http://${host}:${port}`,
        consoleUrl: `http://${host}:${consolePort}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createElasticsearchContainer(network, config = {}) {
    const image = config.image ?? getElasticsearchImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('elasticsearch')
        .withEnvironment({
        'http.host': '0.0.0.0',
        'http.port': String(INTERNAL_PORTS.elasticsearch),
        'http.cors.enabled': 'true',
        'http.cors.allow-origin': 'http://localhost:1358,http://127.0.0.1:1358',
        'http.cors.allow-headers': 'X-Requested-With,X-Auth-Token,Content-Type,Content-Length,Authorization',
        'http.cors.allow-credentials': 'true',
        'transport.host': '127.0.0.1',
        'xpack.security.enabled': 'false',
        'action.destructive_requires_name': 'false',
        ES_JAVA_OPTS: '-Xms512m -Xmx512m',
    })
        .withExposedPorts(INTERNAL_PORTS.elasticsearch)
        .withLogConsumer(createFileLogConsumer('elasticsearch'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/_cluster/health', INTERNAL_PORTS.elasticsearch))
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getElasticsearchConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.elasticsearch);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createOpenSearchContainer(network, config = {}) {
    const image = config.image ?? getOpenSearchImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('opensearch')
        .withEnvironment({
        'http.host': '0.0.0.0',
        'http.cors.enabled': 'true',
        'http.cors.allow-origin': 'http://localhost:1358,http://127.0.0.1:1358',
        'http.cors.allow-headers': 'X-Requested-With,X-Auth-Token,Content-Type,Content-Length,Authorization',
        'http.cors.allow-credentials': 'true',
        'transport.host': '127.0.0.1',
        'discovery.type': 'single-node',
        'plugins.security.disabled': 'true',
        ES_JAVA_OPTS: '-Xms512m -Xmx512m',
    })
        .withExposedPorts(INTERNAL_PORTS.opensearch)
        .withLogConsumer(createFileLogConsumer('opensearch'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/_cluster/health', INTERNAL_PORTS.opensearch).withStartupTimeout(120_000))
        .start();
    return container;
}
function getOpenSearchConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.opensearch);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Mattermost realm configuration for Keycloak
// Includes SAML client (mattermost) and OpenID Connect client (mattermost-openid)
const MATTERMOST_REALM = JSON.stringify({
    realm: 'mattermost',
    enabled: true,
    sslRequired: 'none',
    registrationAllowed: false,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    resetPasswordAllowed: false,
    editUsernameAllowed: false,
    bruteForceProtected: false,
    clients: [
        {
            clientId: 'mattermost',
            name: 'Mattermost SAML',
            enabled: true,
            protocol: 'saml',
            publicClient: true,
            frontchannelLogout: true,
            // Permissive defaults - will be updated dynamically after containers start
            // via updateKeycloakSamlClient() with the actual Mattermost URL and port
            rootUrl: '',
            baseUrl: '',
            redirectUris: ['*'],
            webOrigins: ['*'],
            attributes: {
                'saml.assertion.signature': 'false',
                'saml.force.post.binding': 'true',
                'saml.encrypt': 'false',
                'saml.server.signature': 'false',
                'saml.client.signature': 'false',
                'saml.authnstatement': 'true',
                saml_name_id_format: 'email',
                saml_force_name_id_format: 'true',
            },
            protocolMappers: [
                {
                    name: 'email',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'email',
                        'friendly.name': 'email',
                        'attribute.name': 'email',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'firstName',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'firstName',
                        'friendly.name': 'firstName',
                        'attribute.name': 'firstName',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'lastName',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'lastName',
                        'friendly.name': 'lastName',
                        'attribute.name': 'lastName',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'username',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'username',
                        'friendly.name': 'username',
                        'attribute.name': 'username',
                        'attribute.nameformat': 'Basic',
                    },
                },
                {
                    name: 'id',
                    protocol: 'saml',
                    protocolMapper: 'saml-user-property-mapper',
                    config: {
                        'user.attribute': 'id',
                        'friendly.name': 'id',
                        'attribute.name': 'id',
                        'attribute.nameformat': 'Basic',
                    },
                },
            ],
        },
        {
            clientId: 'mattermost-openid',
            name: 'Mattermost OpenID Connect',
            enabled: true,
            protocol: 'openid-connect',
            publicClient: false,
            secret: 'mattermost-openid-secret',
            standardFlowEnabled: true,
            directAccessGrantsEnabled: true,
            serviceAccountsEnabled: true,
            redirectUris: ['*'],
            webOrigins: ['*'],
            attributes: {
                'post.logout.redirect.uris': '*',
            },
        },
    ],
    users: [
        {
            username: 'user-1',
            email: 'user-1@sample.mattermost.com',
            firstName: 'User',
            lastName: 'One',
            enabled: true,
            emailVerified: true,
            credentials: [{ type: 'password', value: 'Password1!', temporary: false }],
        },
        {
            username: 'user-2',
            email: 'user-2@sample.mattermost.com',
            firstName: 'User',
            lastName: 'Two',
            enabled: true,
            emailVerified: true,
            credentials: [{ type: 'password', value: 'Password1!', temporary: false }],
        },
    ],
});
async function createKeycloakContainer(network, config = {}) {
    const image = config.image ?? getKeycloakImage();
    const adminUser = config.adminUser ?? DEFAULT_CREDENTIALS.keycloak.adminUser;
    const adminPassword = config.adminPassword ?? DEFAULT_CREDENTIALS.keycloak.adminPassword;
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('keycloak')
        .withEnvironment({
        KEYCLOAK_ADMIN: adminUser,
        KEYCLOAK_ADMIN_PASSWORD: adminPassword,
        KC_HOSTNAME_STRICT: 'false',
        KC_HOSTNAME_STRICT_HTTPS: 'false',
        KC_HTTP_ENABLED: 'true',
    })
        .withCopyContentToContainer([
        { content: MATTERMOST_REALM, target: '/opt/keycloak/data/import/mattermost-realm.json' },
    ])
        .withCommand(['start-dev', '--import-realm', '--health-enabled=true'])
        .withExposedPorts(INTERNAL_PORTS.keycloak)
        .withLogConsumer(createFileLogConsumer('keycloak'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/health/ready', INTERNAL_PORTS.keycloak).withStartupTimeout(120_000))
        .start();
    return container;
}
function getKeycloakConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.keycloak);
    return {
        host,
        port,
        adminUrl: `http://${host}:${port}/admin`,
        realmUrl: `http://${host}:${port}/realms/mattermost`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createRedisContainer(network, config = {}) {
    const image = config.image ?? getRedisImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('redis')
        .withExposedPorts(INTERNAL_PORTS.redis)
        .withLogConsumer(createFileLogConsumer('redis'))
        .withWaitStrategy(testcontainers.Wait.forLogMessage(/Ready to accept connections/))
        .withStartupTimeout(30_000)
        .start();
    return container;
}
function getRedisConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.redis);
    return {
        host,
        port,
        url: `redis://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createDejavuContainer(network, config = {}) {
    const image = config.image ?? getDejavuImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('dejavu')
        .withExposedPorts(INTERNAL_PORTS.dejavu)
        .withLogConsumer(createFileLogConsumer('dejavu'))
        .withWaitStrategy(testcontainers.Wait.forListeningPorts())
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getDejavuConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.dejavu);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Prometheus configuration for scraping Mattermost metrics
const PROMETHEUS_CONFIG = `
global:
  scrape_interval: 5s
  evaluation_interval: 60s

scrape_configs:
  - job_name: 'mattermost'
    static_configs:
      - targets: ['mattermost:8067']
`;
async function createPrometheusContainer(network, config = {}) {
    const image = config.image ?? getPrometheusImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('prometheus')
        .withCopyContentToContainer([{ content: PROMETHEUS_CONFIG, target: '/etc/prometheus/prometheus.yml' }])
        .withExposedPorts(INTERNAL_PORTS.prometheus)
        .withLogConsumer(createFileLogConsumer('prometheus'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/-/ready', INTERNAL_PORTS.prometheus).withStartupTimeout(60_000))
        .start();
    return container;
}
function getPrometheusConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.prometheus);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Grafana configuration with anonymous access enabled
const GRAFANA_INI = `
[auth]
disable_login_form = false

[auth.anonymous]
enabled = true
org_role = Editor
`;
// Datasources provisioning for Prometheus and Loki
const DATASOURCES_YAML = `
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
`;
async function createGrafanaContainer(network, config = {}) {
    const image = config.image ?? getGrafanaImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('grafana')
        .withCopyContentToContainer([
        { content: GRAFANA_INI, target: '/etc/grafana/grafana.ini' },
        { content: DATASOURCES_YAML, target: '/etc/grafana/provisioning/datasources/datasources.yaml' },
    ])
        .withExposedPorts(INTERNAL_PORTS.grafana)
        .withLogConsumer(createFileLogConsumer('grafana'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/api/health', INTERNAL_PORTS.grafana).withStartupTimeout(60_000))
        .start();
    return container;
}
function getGrafanaConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.grafana);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
async function createLokiContainer(network, config = {}) {
    const image = config.image ?? getLokiImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('loki')
        .withExposedPorts(INTERNAL_PORTS.loki)
        .withLogConsumer(createFileLogConsumer('loki'))
        .withWaitStrategy(testcontainers.Wait.forHttp('/ready', INTERNAL_PORTS.loki).withStartupTimeout(60_000))
        .start();
    return container;
}
function getLokiConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.loki);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Promtail configuration for collecting logs and sending to Loki
const PROMTAIL_CONFIG = `
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: mattermost
    pipeline_stages:
      - match:
          selector: '{job="mattermost"}'
          stages:
            - json:
                expressions:
                  timestamp: timestamp
                  level: level
      - labels:
          level:
      - timestamp:
          format: '2006-01-02 15:04:05.999 -07:00'
          source: timestamp
    static_configs:
    - targets:
        - localhost
      labels:
        job: mattermost
        app: mattermost
        __path__: /logs/*.log
`;
async function createPromtailContainer(network, config = {}) {
    const image = config.image ?? getPromtailImage();
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('promtail')
        .withCopyContentToContainer([{ content: PROMTAIL_CONFIG, target: '/etc/promtail/config.yaml' }])
        .withCommand(['-config.file=/etc/promtail/config.yaml'])
        .withExposedPorts(INTERNAL_PORTS.promtail)
        .withLogConsumer(createFileLogConsumer('promtail'))
        // Use port check instead of /ready endpoint (which requires Loki connectivity)
        .withWaitStrategy(testcontainers.Wait.forListeningPorts())
        .withStartupTimeout(60_000)
        .start();
    return container;
}
function getPromtailConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.promtail);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Default max age for images before forcing a pull (24 hours in milliseconds)
const DEFAULT_IMAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * Format elapsed time in a human-readable format.
 * Shows decimal if < 10s, whole seconds if < 60s, otherwise minutes and seconds.
 */
function formatElapsed$1(ms) {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 10) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    if (totalSeconds < 60) {
        return `${Math.round(totalSeconds)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
}
/**
 * Check if a Docker image exists locally and get its creation timestamp.
 * @returns The image creation date, or null if image doesn't exist locally.
 */
function getLocalImageCreatedDate(imageName) {
    try {
        const result = child_process.execSync(`docker image inspect --format '{{.Created}}' "${imageName}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return new Date(result.trim());
    }
    catch {
        // Image doesn't exist locally
        return null;
    }
}
/**
 * Pull a Docker image using docker CLI.
 * Mattermost images are only published for linux/amd64.
 * Shows progress every 5 seconds while pulling.
 * @param imageName The full image name including tag
 */
async function pullImage(imageName) {
    log(`Pulling image ${imageName} (platform: linux/amd64)`);
    const pullStart = Date.now();
    // Log progress every 5 seconds while pulling
    const progressInterval = setInterval(() => {
        const elapsed = formatElapsed$1(Date.now() - pullStart);
        log(`Still pulling ${imageName} (${elapsed})`);
    }, 5000);
    try {
        await new Promise((resolve, reject) => {
            // Mattermost images are only published for linux/amd64
            const proc = child_process.spawn('docker', ['pull', '--platform', 'linux/amd64', imageName], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`docker pull exited with code ${code}`));
                }
            });
            proc.on('error', (err) => {
                reject(err);
            });
        });
        clearInterval(progressInterval);
        const elapsed = formatElapsed$1(Date.now() - pullStart);
        log(`✓ Image ${imageName} pulled (${elapsed})`);
    }
    catch (error) {
        clearInterval(progressInterval);
        throw new Error(`Failed to pull image ${imageName}: ${error}`);
    }
}
/**
 * Determine if an image should be pulled and pull it if needed.
 * - Always pull if image doesn't exist locally
 * - For :master tag, pull if older than maxAgeMs
 * - For other tags, use default policy (already exists = don't pull)
 *
 * @param imageName The full image name including tag
 * @param maxAgeMs Maximum age in milliseconds before forcing a pull (default: 24 hours)
 */
async function ensureImageAvailable(imageName, maxAgeMs = DEFAULT_IMAGE_MAX_AGE_MS) {
    const createdDate = getLocalImageCreatedDate(imageName);
    // Image doesn't exist locally - pull it
    if (!createdDate) {
        log(`Image ${imageName} not found locally`);
        await pullImage(imageName);
        return;
    }
    // Only apply age-based pulling for Mattermost :master tag
    const isMattermostMaster = imageName.includes('mattermost') && imageName.endsWith(':master');
    if (!isMattermostMaster) {
        // For other images, don't force pull (image exists)
        return;
    }
    // Check age for :master tag
    const ageMs = Date.now() - createdDate.getTime();
    const shouldPull = ageMs > maxAgeMs;
    if (shouldPull) {
        const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
        const maxAgeHours = (maxAgeMs / (60 * 60 * 1000)).toFixed(1);
        log(`Image ${imageName} is ${ageHours}h old (max: ${maxAgeHours}h)`);
        await pullImage(imageName);
    }
}
function buildMattermostEnv(deps, config) {
    // Build internal connection string (container-to-container via network alias)
    const internalDbUrl = `postgres://${deps.postgres.username}:${deps.postgres.password}@postgres:${INTERNAL_PORTS.postgres}/${deps.postgres.database}?sslmode=disable`;
    const env = {
        // Database configuration (using MM_CONFIG for database-driven config)
        MM_CONFIG: internalDbUrl,
        MM_SQLSETTINGS_DRIVERNAME: 'postgres',
        MM_SQLSETTINGS_DATASOURCE: internalDbUrl,
        // Server settings (required for container operation)
        // Note: SiteURL is set via mmctl after container starts to use the actual mapped port
        // Note: Other settings are set via mmctl so they can be changed in System Console
        MM_SERVICESETTINGS_LISTENADDRESS: `:${INTERNAL_PORTS.mattermost}`,
        // Allow config changes via System Console (must be set via env var, not mmctl)
        MM_CLUSTERSETTINGS_READONLYCONFIG: 'false',
    };
    // Configure email if inbucket is available (required settings only)
    // Other email settings are applied via mmctl after server starts
    if (deps.inbucket) {
        env.MM_EMAILSETTINGS_SMTPSERVER = 'inbucket';
        env.MM_EMAILSETTINGS_SMTPPORT = String(INTERNAL_PORTS.inbucket.smtp);
    }
    // Add license if provided via environment variable (skip for team edition or entry tier)
    const edition = process.env.TC_EDITION?.toLowerCase();
    const entry = process.env.TC_ENTRY?.toLowerCase() === 'true';
    if (process.env.MM_LICENSE && edition !== 'team' && !entry) {
        env.MM_LICENSE = process.env.MM_LICENSE;
    }
    // Configure cluster settings for HA mode
    if (config.cluster?.enable) {
        env.MM_CLUSTERSETTINGS_ENABLE = 'true';
        env.MM_CLUSTERSETTINGS_CLUSTERNAME = config.cluster.clusterName;
        // Use the node name for log file location to separate logs
        env.MM_LOGSETTINGS_FILELOCATION = `./logs/${config.cluster.nodeName}`;
    }
    // Apply user overrides
    if (config.envOverrides) {
        Object.assign(env, config.envOverrides);
    }
    return env;
}
async function createMattermostContainer(network, deps, config = {}) {
    const image = config.image ?? getMattermostImage();
    const env = buildMattermostEnv(deps, config);
    const maxAgeMs = config.imageMaxAgeMs ?? DEFAULT_IMAGE_MAX_AGE_MS;
    // Ensure image is available (pull if needed)
    await ensureImageAvailable(image, maxAgeMs);
    // Determine network alias - use cluster node alias or default to 'mattermost'
    const networkAlias = config.cluster?.networkAlias ?? 'mattermost';
    const logName = config.cluster?.nodeName ? `mattermost-${config.cluster.nodeName}` : 'mattermost';
    // Health check URL - include subpath if configured
    const healthCheckPath = config.subpath ? `${config.subpath}/api/v4/system/ping` : '/api/v4/system/ping';
    // Mattermost images are only published for linux/amd64
    let containerBuilder = new testcontainers.GenericContainer(image)
        .withPlatform('linux/amd64')
        .withNetwork(network)
        .withNetworkAliases(networkAlias)
        .withEnvironment(env)
        .withExposedPorts(INTERNAL_PORTS.mattermost)
        .withLogConsumer(createFileLogConsumer(logName))
        .withWaitStrategy(testcontainers.Wait.forHttp(healthCheckPath, INTERNAL_PORTS.mattermost).withStartupTimeout(60_000));
    // Copy any additional files (e.g., SAML certificates)
    if (config.filesToCopy && config.filesToCopy.length > 0) {
        containerBuilder = containerBuilder.withCopyContentToContainer(config.filesToCopy);
    }
    const container = await containerBuilder.start();
    return container;
}
function getMattermostConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.mattermost);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        internalUrl: `http://mattermost:${INTERNAL_PORTS.mattermost}`,
        image,
    };
}
/**
 * Get connection info for a Mattermost cluster node in HA mode.
 */
function getMattermostNodeConnectionInfo(container, image, nodeName, networkAlias) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.mattermost);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        internalUrl: `http://${networkAlias}:${INTERNAL_PORTS.mattermost}`,
        image,
        nodeName,
        networkAlias,
    };
}
/**
 * Generate node names for HA cluster.
 * Returns ['leader', 'follower', 'follower2'] for 3 nodes, etc.
 */
function generateNodeNames(nodeCount) {
    const names = ['leader'];
    for (let i = 1; i < nodeCount; i++) {
        names.push(i === 1 ? 'follower' : `follower${i}`);
    }
    return names;
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Generate nginx configuration for load balancing Mattermost nodes.
 * Based on server/build/docker/nginx/default.conf
 */
function generateNginxConfig(nodeAliases) {
    const upstreamServers = nodeAliases
        .map((alias) => `  server ${alias}:${INTERNAL_PORTS.mattermost} fail_timeout=10s max_fails=10;`)
        .join('\n');
    return `upstream app_cluster {
${upstreamServers}
}

server {
  listen ${INTERNAL_PORTS.nginx};

  location ~ /api/v[0-9]+/(users/)?websocket$ {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    client_max_body_size 50M;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_buffers 256 16k;
    proxy_buffer_size 16k;
    proxy_read_timeout 600s;
    proxy_pass http://app_cluster;
  }

  location / {
    client_max_body_size 100M;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_pass http://app_cluster;
  }
}
`;
}
/**
 * Generate upstream block for subpath nginx config
 */
function generateUpstreamBlock(name, nodeAliases) {
    const servers = nodeAliases.map((alias) => `  server ${alias}:${INTERNAL_PORTS.mattermost};`).join('\n');
    return `upstream ${name} {
${servers}
  keepalive 32;
}`;
}
/**
 * Generate location blocks for a subpath server.
 * Passes requests with the full subpath to Mattermost (no stripping).
 * Mattermost handles subpath natively via SiteURL configuration.
 */
function generateSubpathLocationBlocks(subpath, upstream) {
    return `
  # WebSocket endpoint for ${subpath}
  location ~ ^${subpath}/api/v[0-9]+/(users/)?websocket$ {
    client_body_timeout 60;
    client_max_body_size 50M;
    lingering_timeout 5;
    proxy_buffer_size 16k;
    proxy_buffers 256 16k;
    proxy_connect_timeout 90;
    proxy_pass http://${upstream};
    proxy_read_timeout 90s;
    proxy_send_timeout 300;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_set_header X-Real-IP $remote_addr;
    send_timeout 300;
  }

  # Main location for ${subpath} - passes full path to Mattermost
  location ${subpath}/ {
    client_max_body_size 50M;
    proxy_buffer_size 16k;
    proxy_buffers 256 16k;
    proxy_http_version 1.1;
    proxy_pass http://${upstream};
    proxy_read_timeout 600s;
    proxy_set_header Connection "";
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Frame-Options SAMEORIGIN;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Redirect ${subpath} to ${subpath}/ for consistent behavior
  location = ${subpath} {
    return 301 ${subpath}/;
  }`;
}
/**
 * Generate the landing page HTML for subpath mode.
 */
function generateSubpathLandingPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mattermost Subpath Test Environment</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #1e325c;
      color: #fff;
    }
    h1 { color: #fff; margin-bottom: 10px; }
    .subtitle { color: #aab8d1; margin-bottom: 40px; }
    .servers { display: flex; gap: 20px; flex-wrap: wrap; }
    .server-card {
      flex: 1;
      min-width: 280px;
      background: #2d4073;
      border-radius: 8px;
      padding: 24px;
      text-decoration: none;
      color: #fff;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .server-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .server-card h2 { margin: 0 0 8px 0; color: #fff; }
    .server-card .path { color: #5d9cec; font-family: monospace; font-size: 14px; }
    .server-card .desc { color: #aab8d1; margin-top: 12px; font-size: 14px; }
    .info {
      margin-top: 40px;
      padding: 20px;
      background: #2d4073;
      border-radius: 8px;
      font-size: 14px;
      color: #aab8d1;
    }
    .info code { background: #1e325c; padding: 2px 6px; border-radius: 4px; color: #5d9cec; }
  </style>
</head>
<body>
  <h1>Mattermost Subpath Test Environment</h1>
  <p class="subtitle">Two Mattermost servers running behind nginx with subpath routing</p>

  <div class="servers">
    <a href="/mattermost1" class="server-card">
      <h2>Server 1</h2>
      <div class="path">/mattermost1</div>
      <div class="desc">First Mattermost instance with its own database</div>
    </a>
    <a href="/mattermost2" class="server-card">
      <h2>Server 2</h2>
      <div class="path">/mattermost2</div>
      <div class="desc">Second Mattermost instance with its own database</div>
    </a>
  </div>

  <div class="info">
    <strong>Test Environment Info:</strong><br><br>
    This environment runs two independent Mattermost servers behind an nginx reverse proxy.
    Each server has its own database and can be accessed via its subpath.<br><br>
    Use <code>mm-tc stop</code> to stop all containers.
  </div>
</body>
</html>`;
}
/**
 * Generate nginx configuration for subpath mode with two Mattermost servers.
 * Based on e2e-tests/cypress/README-Subpath.md
 */
function generateSubpathNginxConfig(server1Aliases, server2Aliases) {
    const upstream1 = generateUpstreamBlock('backend1', server1Aliases);
    const upstream2 = generateUpstreamBlock('backend2', server2Aliases);
    const locations1 = generateSubpathLocationBlocks('/mattermost1', 'backend1');
    const locations2 = generateSubpathLocationBlocks('/mattermost2', 'backend2');
    // Escape the HTML for nginx config (single quotes need escaping)
    const landingPage = generateSubpathLandingPage().replace(/'/g, "\\'");
    return `${upstream1}

${upstream2}

server {
  listen ${INTERNAL_PORTS.nginx} default_server;

  location = / {
    default_type text/html;
    return 200 '${landingPage}';
  }
${locations1}
${locations2}
}
`;
}
async function createNginxContainer(network, config) {
    const image = config.image ?? getNginxImage();
    const nginxConfig = generateNginxConfig(config.nodeAliases);
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('nginx')
        .withCopyContentToContainer([{ content: nginxConfig, target: '/etc/nginx/conf.d/default.conf' }])
        .withExposedPorts(INTERNAL_PORTS.nginx)
        .withLogConsumer(createFileLogConsumer('nginx'))
        .withWaitStrategy(testcontainers.Wait.forListeningPorts())
        .start();
    return container;
}
async function createSubpathNginxContainer(network, config) {
    const image = config.image ?? getNginxImage();
    const nginxConfig = generateSubpathNginxConfig(config.server1Aliases, config.server2Aliases);
    const container = await new testcontainers.GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('nginx')
        .withCopyContentToContainer([{ content: nginxConfig, target: '/etc/nginx/conf.d/default.conf' }])
        .withExposedPorts(INTERNAL_PORTS.nginx)
        .withLogConsumer(createFileLogConsumer('nginx'))
        .withWaitStrategy(testcontainers.Wait.forListeningPorts())
        .start();
    return container;
}
function getNginxConnectionInfo(container, image) {
    const host = container.getHost();
    const port = container.getMappedPort(INTERNAL_PORTS.nginx);
    return {
        host,
        port,
        url: `http://${host}:${port}`,
        image,
    };
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Check if a Docker image exists locally.
 *
 * @param image The image name (e.g., 'postgres:14')
 * @returns true if the image exists locally, false otherwise
 */
function imageExistsLocally(image) {
    try {
        const result = child_process.execSync(`docker images -q "${image}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim().length > 0;
    }
    catch {
        return false;
    }
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Print connection info for all dependencies in the test environment.
 * @param info Service connection information
 * @param logger Optional custom logger function (defaults to console.log)
 */
function printConnectionInfo(info, logger = console.log) {
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
function writeEnvFile(info, outputDir, options = {}) {
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
    const filePath = path__namespace.join(outputDir, filename);
    fs__namespace.writeFileSync(filePath, lines.join('\n'));
    return filePath;
}
/**
 * Write server configuration to a JSON file.
 * @param config Server configuration object (from mmctl config show)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: .tc.server.config.json)
 * @returns The full path to the written file
 */
function writeServerConfig(config, outputDir, filename = '.tc.server.config.json') {
    const filePath = path__namespace.join(outputDir, filename);
    fs__namespace.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n');
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
function buildDockerInfo(info, metadata) {
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
function writeDockerInfo(info, metadata, outputDir, filename = '.tc.docker.json') {
    const dockerInfo = buildDockerInfo(info, metadata);
    const filePath = path__namespace.join(outputDir, filename);
    fs__namespace.writeFileSync(filePath, JSON.stringify(dockerInfo, null, 2) + '\n');
    return filePath;
}
// Keycloak SAML certificate (from server/build/docker/keycloak/keycloak.crt)
// This certificate is used by Mattermost to verify SAML assertions from Keycloak
const KEYCLOAK_SAML_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0MB4XDTI0MDIyMTIwNDA0OFoXDTM0MDIyMTIwNDIyOFowFTETMBEGA1UEAwwKbWF0dGVybW9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOnsgNexkO5tbKkFXN+SdMUuLHbqdjZ9/JSnKrYPHLarf8801YDDzV8wI9jjdCCgq+xtKFKWlwU2rGpjPbefDLV1m7CSu0Iq+hNxDiBdX3wkEIK98piDpx+xYGL0aAbXn3nAlqFOWQJLKLM1I65ZmK31YZeVj4Kn01W4WfsvKHoxPjLPwPTug4HB6vaQXqEpzYYYHyuJKvIYNuVwo0WQdaPRXb0poZoYzOnoB6tOFrim6B7/chqtZeXQc7h6/FejBsV59aO5uATI0aAJw1twzjCNIiOeJLB2jlLuIMR3/Yaqr8IRpRXzcRPETpisWNilhV07ZBW0YL9ZwuU4sHWy+iMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW4I1egm+czdnnZxTtth3cjCmLg/UsalUDKSfFOLAlnbe6TtVhP4DpAl+OaQO4+kdEKemLENPmh4ddaHUjSSbbCQZo8B7IjByEe7x3kQdj2ucQpA4bh0vGZ11pVhk5HfkGqAO+UVNQsyLpTmWXQ8SEbxcw6mlTM4SjuybqaGOva1LBscI158Uq5FOVT6TJaxCt3dQkBH0tK+vhRtIM13pNZ/+SFgecn16AuVdBfjjqXynefrSihQ20BZ3NTyjs/N5J2qvSwQ95JARZrlhfiS++L81u2N/0WWni9cXmHsdTLxRrDZjz2CXBNeFOBRio74klSx8tMK27/2lxMsEC7R+DA==
-----END CERTIFICATE-----`;
/**
 * Write Keycloak SAML certificate to the output directory.
 * This certificate can be uploaded to Mattermost via System Console or API.
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: saml-idp.crt)
 * @returns The full path to the written file
 */
function writeKeycloakCertificate(outputDir, filename = 'saml-idp.crt') {
    const filePath = path__namespace.join(outputDir, filename);
    fs__namespace.writeFileSync(filePath, KEYCLOAK_SAML_CERTIFICATE);
    return filePath;
}
/**
 * Write OpenLDAP setup documentation to the output directory.
 * @param info Service connection information (must include openldap)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: openldap_setup.md)
 * @returns The full path to the written file, or null if openldap not configured
 */
function writeOpenLdapSetup(info, outputDir, filename = 'openldap_setup.md') {
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
    const filePath = path__namespace.join(outputDir, filename);
    fs__namespace.writeFileSync(filePath, content);
    return filePath;
}
/**
 * Write Keycloak setup documentation to the output directory.
 * @param info Service connection information (must include keycloak)
 * @param outputDir Directory to write the file to
 * @param filename Filename (default: keycloak_setup.md)
 * @returns The full path to the written file, or null if keycloak not configured
 */
function writeKeycloakSetup(info, outputDir, filename = 'keycloak_setup.md') {
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
    const filePath = path__namespace.join(outputDir, filename);
    fs__namespace.writeFileSync(filePath, content);
    return filePath;
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Make an HTTP POST request.
 * @param host Hostname
 * @param port Port number
 * @param path URL path
 * @param body Request body
 * @param headers Request headers
 * @returns Result object with success status, response body, token (from header), and optional error
 */
function httpPost(host, port, path, body, headers = {}) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port,
            path,
            method: 'POST',
            headers: {
                'Content-Length': Buffer.byteLength(body),
                ...headers,
            },
        };
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk.toString();
            });
            res.on('end', () => {
                // Extract token from response header (used by login endpoint)
                const token = res.headers['token'];
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, body: responseBody, token });
                }
                else {
                    resolve({
                        success: false,
                        body: responseBody,
                        error: `HTTP ${res.statusCode}: ${responseBody}`,
                    });
                }
            });
        });
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        req.write(body);
        req.end();
    });
}
/**
 * Make an HTTP GET request.
 */
function httpGet(host, port, path, headers = {}) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port,
            path,
            method: 'GET',
            headers,
        };
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk.toString();
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, body: responseBody });
                }
                else {
                    resolve({
                        success: false,
                        body: responseBody,
                        error: `HTTP ${res.statusCode}: ${responseBody}`,
                    });
                }
            });
        });
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        req.end();
    });
}
/**
 * Make an HTTP PUT request.
 */
function httpPut(host, port, path, body, headers = {}) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port,
            path,
            method: 'PUT',
            headers: {
                'Content-Length': Buffer.byteLength(body),
                ...headers,
            },
        };
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk.toString();
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, body: responseBody });
                }
                else {
                    resolve({
                        success: false,
                        body: responseBody,
                        error: `HTTP ${res.statusCode}: ${responseBody}`,
                    });
                }
            });
        });
        req.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
        req.write(body);
        req.end();
    });
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Client for executing mmctl commands inside a Mattermost container.
 * Uses --local flag to communicate via Unix socket (no authentication required).
 */
class MmctlClient {
    container;
    constructor(container) {
        this.container = container;
    }
    /**
     * Execute an mmctl command inside the container.
     * The --local flag is automatically added to use Unix socket communication.
     *
     * @param command - The mmctl command to execute (without 'mmctl' prefix)
     * @returns Promise<MmctlExecResult> - The result of the command execution
     *
     * @example
     * // Create a user
     * await mmctl.exec('user create --email test@test.com --username testuser --password Test123!');
     *
     * @example
     * // Get system info
     * const result = await mmctl.exec('system version');
     * console.log(result.stdout);
     *
     * @example
     * // Run a test command
     * await mmctl.exec('sampledata --teams 5 --users 100');
     */
    async exec(command) {
        // Split the command into arguments
        const args = this.parseCommand(command);
        // Execute mmctl with --local flag inside the container
        const result = await this.container.exec(['mmctl', '--local', ...args]);
        return {
            exitCode: result.exitCode,
            stdout: result.output,
            stderr: '', // testcontainers combines stdout/stderr in output
        };
    }
    /**
     * Parse a command string into an array of arguments.
     * Handles quoted strings properly.
     */
    parseCommand(command) {
        const args = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';
        for (const char of command) {
            if ((char === '"' || char === "'") && !inQuote) {
                inQuote = true;
                quoteChar = char;
            }
            else if (char === quoteChar && inQuote) {
                inQuote = false;
                quoteChar = '';
            }
            else if (char === ' ' && !inQuote) {
                if (current) {
                    args.push(current);
                    current = '';
                }
            }
            else {
                current += char;
            }
        }
        if (current) {
            args.push(current);
        }
        return args;
    }
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Default test settings applied via mmctl.
 * These settings can be changed in System Console (not locked by env vars).
 */
const DEFAULT_TEST_SETTINGS = {
    // Service settings
    'ServiceSettings.EnableLocalMode': true,
    'ServiceSettings.EnableTesting': true,
    'ServiceSettings.EnableDeveloper': true,
    'ServiceSettings.AllowCorsFrom': '*',
    'ServiceSettings.EnableSecurityFixAlert': false,
    // Note: ServiceEnvironment is set via env var only (not mmctl)
    // Note: ClusterSettings.ReadOnlyConfig is set via env var to avoid cluster instability warnings
    // Plugin settings
    'PluginSettings.EnableUploads': true,
    'PluginSettings.AutomaticPrepackagedPlugins': true,
    // Log settings
    'LogSettings.EnableConsole': true,
    'LogSettings.ConsoleLevel': 'DEBUG',
    'LogSettings.EnableDiagnostics': false,
    // Team settings
    'TeamSettings.EnableOpenServer': true,
    'TeamSettings.MaxUsersPerTeam': '10000',
    // Email settings (test defaults for inbucket)
    'EmailSettings.EnableSMTPAuth': false,
    'EmailSettings.SendEmailNotifications': true,
    'EmailSettings.FeedbackEmail': 'test@localhost.com',
    'EmailSettings.FeedbackName': 'Mattermost Test',
    'EmailSettings.ReplyToAddress': 'test@localhost.com',
};
/**
 * Format a config value for mmctl config set command.
 * - Strings: double-quoted (escaped internal quotes)
 * - Numbers/booleans: as-is (mmctl handles these)
 * - Arrays of strings: multiple double-quoted values
 * - Objects/complex: single-quoted JSON string
 */
function formatConfigValue(value) {
    if (typeof value === 'string') {
        // Double-quote strings, escape internal double quotes
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        // Numbers and booleans can be passed directly
        return String(value);
    }
    if (Array.isArray(value)) {
        // Arrays of primitives: pass as multiple quoted arguments
        // e.g., mmctl config set Key "value1" "value2"
        if (value.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
            return value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(' ');
        }
        // Complex arrays: use JSON
        return `'${JSON.stringify(value)}'`;
    }
    if (typeof value === 'object' && value !== null) {
        // Objects: use single-quoted JSON string
        return `'${JSON.stringify(value)}'`;
    }
    // Fallback for null/undefined
    return '""';
}
/**
 * Apply default test settings via mmctl.
 */
async function applyDefaultTestSettings(mmctl, log) {
    for (const [key, value] of Object.entries(DEFAULT_TEST_SETTINGS)) {
        const formattedValue = formatConfigValue(value);
        const result = await mmctl.exec(`config set ${key} ${formattedValue}`);
        if (result.exitCode !== 0) {
            log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
        }
    }
}
/**
 * Patch server configuration via mmctl.
 */
async function patchServerConfig(config, mmctl, log) {
    log('Patching server configuration via mmctl');
    for (const [section, settings] of Object.entries(config)) {
        if (typeof settings === 'object' && settings !== null) {
            for (const [key, value] of Object.entries(settings)) {
                const configKey = `${section}.${key}`;
                const configValue = formatConfigValue(value);
                const result = await mmctl.exec(`config set ${configKey} ${configValue}`);
                if (result.exitCode !== 0) {
                    log(`⚠ Failed to set ${configKey}: ${result.stdout || result.stderr}`);
                }
            }
        }
    }
    log('✓ Server configuration patched');
}
/**
 * Build base environment overrides for Mattermost containers.
 * Handles dependency-specific settings, service environment, MM_* passthrough, and user config.
 *
 * Priority (lowest to highest):
 * 1. Dependency-specific env vars (minio, elasticsearch, opensearch, redis)
 * 2. MM_SERVICEENVIRONMENT based on serverMode
 * 3. MM_* environment variables from host (includes MM_LICENSE)
 * 4. User-provided server.env from config
 *
 * Note: MM_SERVICESETTINGS_SITEURL is always excluded - it's set via mmctl after startup.
 * Note: MM_LICENSE cannot be set in config file - must come from environment variable.
 */
function buildBaseEnvOverrides(connectionInfo, config, serverMode) {
    const envOverrides = {};
    // Dependency-specific environment variables
    if (connectionInfo.minio) {
        envOverrides.MM_FILESETTINGS_DRIVERNAME = 'amazons3';
        envOverrides.MM_FILESETTINGS_AMAZONS3ACCESSKEYID = connectionInfo.minio.accessKey;
        envOverrides.MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY = connectionInfo.minio.secretKey;
        envOverrides.MM_FILESETTINGS_AMAZONS3BUCKET = 'mattermost-test';
        envOverrides.MM_FILESETTINGS_AMAZONS3ENDPOINT = 'minio:9000';
        envOverrides.MM_FILESETTINGS_AMAZONS3SSL = 'false';
    }
    if (connectionInfo.elasticsearch) {
        // Note: EnableIndexing/EnableSearching are set via mmctl after startup
        envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://elasticsearch:9200';
    }
    if (connectionInfo.opensearch) {
        // Note: EnableIndexing/EnableSearching are set via mmctl after startup
        envOverrides.MM_ELASTICSEARCHSETTINGS_CONNECTIONURL = 'http://opensearch:9200';
        envOverrides.MM_ELASTICSEARCHSETTINGS_BACKEND = 'opensearch';
    }
    if (connectionInfo.redis) {
        // Note: CacheType is set via mmctl after startup
        envOverrides.MM_CACHESETTINGS_REDISADDRESS = 'redis:6379';
        envOverrides.MM_CACHESETTINGS_REDISDB = '0';
    }
    // Set default MM_SERVICEENVIRONMENT based on serverMode
    // 'test' for container mode, 'dev' for local mode
    const defaultServiceEnv = serverMode === 'local' ? 'dev' : 'test';
    envOverrides.MM_SERVICEENVIRONMENT = config.server.serviceEnvironment || defaultServiceEnv;
    // Pass all MM_* environment variables from host (includes MM_LICENSE, except for team edition or entry tier)
    const isTeamEdition = config.server.edition === 'team';
    const isEntryTier = config.server.entry;
    for (const [key, value] of Object.entries(process.env)) {
        // Skip MM_LICENSE for team edition or entry tier (entry uses built-in Entry license)
        if (key === 'MM_LICENSE' && (isTeamEdition || isEntryTier)) {
            continue;
        }
        if (key.startsWith('MM_') && key !== 'MM_SERVICESETTINGS_SITEURL' && value !== undefined) {
            envOverrides[key] = value;
        }
    }
    // For entry tier, force enable the Mattermost Entry feature flag
    if (isEntryTier) {
        envOverrides.MM_FEATUREFLAGS_ENABLEMATTERMOSTENTRY = 'true';
    }
    // Apply user-provided server environment variables (highest priority)
    // Excluded: MM_SERVICESETTINGS_SITEURL (set via mmctl after startup)
    // Forbidden: MM_LICENSE (must come from env var only to prevent leaks in config files)
    if (config.server.env) {
        if (config.server.env.MM_LICENSE) {
            throw new Error('MM_LICENSE cannot be set in config file (server.env)');
        }
        const { MM_SERVICESETTINGS_SITEURL: _siteUrl, ...restEnv } = config.server.env;
        Object.assign(envOverrides, restEnv);
    }
    return envOverrides;
}
/**
 * Configure server via mmctl after it's running.
 * Handles default test settings, LDAP, Elasticsearch, Redis, and server config patch.
 */
async function configureServerViaMmctl(mmctl, connectionInfo, config, log, loadLdapTestData) {
    // Apply default test settings
    await applyDefaultTestSettings(mmctl, log);
    // Configure LDAP settings if openldap is connected (via mmctl so they persist in DB)
    if (connectionInfo.openldap) {
        const ldapAttributes = {
            'LdapSettings.LdapServer': 'openldap',
            'LdapSettings.LdapPort': '389',
            'LdapSettings.BaseDN': connectionInfo.openldap.baseDN,
            'LdapSettings.BindUsername': connectionInfo.openldap.bindDN,
            'LdapSettings.BindPassword': connectionInfo.openldap.bindPassword,
            'LdapSettings.EmailAttribute': 'mail',
            'LdapSettings.UsernameAttribute': 'uid',
            'LdapSettings.IdAttribute': 'uid',
            'LdapSettings.LoginIdAttribute': 'uid',
            'LdapSettings.FirstNameAttribute': 'cn',
            'LdapSettings.LastNameAttribute': 'sn',
            'LdapSettings.NicknameAttribute': 'cn',
            'LdapSettings.PositionAttribute': 'title',
            'LdapSettings.GroupDisplayNameAttribute': 'cn',
            'LdapSettings.GroupIdAttribute': 'entryUUID',
        };
        for (const [key, value] of Object.entries(ldapAttributes)) {
            const result = await mmctl.exec(`config set ${key} "${value}"`);
            if (result.exitCode !== 0) {
                log(`⚠ Failed to set ${key}: ${result.stdout || result.stderr}`);
            }
        }
        // Now enable LDAP
        const ldapResult = await mmctl.exec('config set LdapSettings.Enable true');
        if (ldapResult.exitCode !== 0) {
            log(`⚠ Failed to enable LDAP: ${ldapResult.stdout || ldapResult.stderr}`);
        }
        // Load LDAP test data
        await loadLdapTestData();
    }
    // Enable Elasticsearch/OpenSearch if configured (via mmctl so it can be changed in System Console)
    if (connectionInfo.elasticsearch || connectionInfo.opensearch) {
        const indexingResult = await mmctl.exec('config set ElasticsearchSettings.EnableIndexing true');
        if (indexingResult.exitCode !== 0) {
            log(`⚠ Failed to enable Elasticsearch indexing: ${indexingResult.stdout || indexingResult.stderr}`);
        }
        const searchingResult = await mmctl.exec('config set ElasticsearchSettings.EnableSearching true');
        if (searchingResult.exitCode !== 0) {
            log(`⚠ Failed to enable Elasticsearch searching: ${searchingResult.stdout || searchingResult.stderr}`);
        }
    }
    // Enable Redis cache if configured (via mmctl so it can be changed in System Console)
    if (connectionInfo.redis) {
        const redisResult = await mmctl.exec('config set CacheSettings.CacheType redis');
        if (redisResult.exitCode !== 0) {
            log(`⚠ Failed to set Redis cache type: ${redisResult.stdout || redisResult.stderr}`);
        }
    }
    // Note: Keycloak SAML and OpenID settings are NOT pre-configured automatically
    // because SAML requires certificate upload which doesn't work with database config.
    // Users can configure SAML/OpenID manually via System Console or server.config in mm-tc.config.mjs.
    // The Keycloak container has pre-configured clients: 'mattermost' (SAML) and 'mattermost-openid' (OpenID).
    // See .env.tc output for example settings when keycloak is enabled.
    // Apply server config patch via mmctl if provided (overrides defaults)
    if (config.server.config) {
        await patchServerConfig(config.server.config, mmctl, log);
    }
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Format elapsed time in a human-readable format.
 * Shows decimal if < 10s, whole seconds if < 60s, otherwise minutes and seconds.
 */
function formatElapsed(ms) {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 10) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    if (totalSeconds < 60) {
        return `${Math.round(totalSeconds)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Disable Ryuk (testcontainers cleanup container) so containers persist after CLI exits.
// Containers should only be cleaned up via `mm-tc stop`.
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
const DEFAULT_DEPENDENCIES = ['postgres', 'inbucket'];
/**
 * MattermostTestEnvironment orchestrates all test containers for E2E testing.
 * It manages the lifecycle of containers and provides connection information.
 */
class MattermostTestEnvironment {
    config;
    serverMode;
    network = null;
    // Container references
    postgresContainer = null;
    inbucketContainer = null;
    openldapContainer = null;
    minioContainer = null;
    elasticsearchContainer = null;
    opensearchContainer = null;
    keycloakContainer = null;
    redisContainer = null;
    dejavuContainer = null;
    prometheusContainer = null;
    grafanaContainer = null;
    lokiContainer = null;
    promtailContainer = null;
    mattermostContainer = null;
    // HA mode containers
    nginxContainer = null;
    mattermostNodes = new Map();
    // Subpath mode containers
    mattermostServer1 = null;
    mattermostServer2 = null;
    // For subpath + HA mode
    server1Nodes = new Map();
    server2Nodes = new Map();
    // Connection info cache
    connectionInfo = {};
    /**
     * Create a new MattermostTestEnvironment.
     * @param config Resolved testcontainers configuration
     * @param serverMode Server mode: 'container' (default) or 'local'
     */
    constructor(config, serverMode = 'container') {
        this.config = config;
        this.serverMode = serverMode;
    }
    /**
     * Start all enabled dependencies and the Mattermost server.
     */
    async start() {
        // Set output directory from config
        setOutputDir(this.config.outputDir);
        const startTime = Date.now();
        if (this.serverMode === 'local') {
            this.log('Starting Mattermost dependencies');
        }
        else {
            this.log('Starting Mattermost test environment');
        }
        // Create network
        this.log('Creating Docker network');
        try {
            this.network = await new testcontainers.Network().start();
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Could not find a working container runtime')) {
                throw new Error('Docker is not running. Please start Docker and try again.');
            }
            throw error;
        }
        this.log('Network created');
        // Start dependencies in order
        // Ensure required dependencies (postgres, inbucket) are always included
        const REQUIRED_DEPS = ['postgres', 'inbucket'];
        const configuredDeps = this.config.dependencies ?? DEFAULT_DEPENDENCIES;
        const dependencies = [...new Set([...REQUIRED_DEPS, ...configuredDeps])];
        this.log(`Enabled dependencies: ${dependencies.join(', ')}`);
        // Validate: only one search engine can be enabled at a time
        const hasElasticsearch = dependencies.includes('elasticsearch');
        const hasOpensearch = dependencies.includes('opensearch');
        if (hasElasticsearch && hasOpensearch) {
            throw new Error('Cannot enable both elasticsearch and opensearch. Only one search engine can be used at a time.');
        }
        // Validate: dejavu requires a search engine (elasticsearch or opensearch)
        const hasDejavu = dependencies.includes('dejavu');
        if (hasDejavu && !hasElasticsearch && !hasOpensearch) {
            throw new Error('Cannot enable dejavu without a search engine. Enable elasticsearch or opensearch with dejavu.');
        }
        // Validate: promtail and loki must be enabled together
        const hasLoki = dependencies.includes('loki');
        const hasPromtail = dependencies.includes('promtail');
        if (hasPromtail && !hasLoki) {
            throw new Error('Cannot enable promtail without loki. Promtail requires Loki to send logs to.');
        }
        if (hasLoki && !hasPromtail) {
            throw new Error('Cannot enable loki without promtail. Enable both for log aggregation: -D loki,promtail');
        }
        // Validate: grafana requires at least one data source (prometheus or loki)
        const hasGrafana = dependencies.includes('grafana');
        const hasPrometheus = dependencies.includes('prometheus');
        if (hasGrafana && !hasPrometheus && !hasLoki) {
            throw new Error('Cannot enable grafana without a data source. Enable prometheus and/or loki,promtail with grafana.');
        }
        // Validate: redis requires a license with clustering support (not available in team edition)
        const hasRedis = dependencies.includes('redis');
        const isTeamEdition = this.config.server.edition === 'team';
        if (hasRedis && (isTeamEdition || !process.env.MM_LICENSE)) {
            throw new Error('Cannot enable redis without MM_LICENSE. Redis requires a Mattermost license with clustering support (not available in team edition).');
        }
        // Validate: HA mode requires a license with clustering support (not available in team edition)
        if (this.config.server.ha && (isTeamEdition || !process.env.MM_LICENSE)) {
            throw new Error('Cannot enable HA mode without MM_LICENSE. HA mode requires a Mattermost license with clustering support (not available in team edition).');
        }
        // Validate: Entry tier is only applicable to enterprise and fips editions (not team edition)
        if (this.config.server.entry && isTeamEdition) {
            throw new Error('Cannot use --entry (or TC_ENTRY=true) with team edition. Entry tier is only applicable to enterprise and fips editions.');
        }
        // Start all dependencies in parallel (Mattermost will wait for postgres)
        const parallelDeps = [];
        const pendingDeps = new Set();
        const depsStartTime = Date.now();
        // Log progress every 5 seconds while dependencies are starting
        const progressInterval = setInterval(() => {
            if (pendingDeps.size > 0) {
                const elapsed = formatElapsed(Date.now() - depsStartTime);
                this.log(`Still starting: ${[...pendingDeps].join(', ')} (${elapsed})`);
            }
        }, 5000);
        const wrapService = (name, image, startFn, getReadyMessage) => {
            const serviceStartTime = Date.now();
            const needsPull = !imageExistsLocally(image);
            if (needsPull) {
                this.log(`Pulling image ${image}`);
            }
            pendingDeps.add(name);
            return startFn().then(() => {
                pendingDeps.delete(name);
                const elapsed = formatElapsed(Date.now() - serviceStartTime);
                this.log(`✓ ${getReadyMessage()} (${elapsed})`);
            });
        };
        if (dependencies.includes('postgres')) {
            const image = getPostgresImage();
            parallelDeps.push(wrapService('postgres', image, () => this.startPostgres(), () => `PostgreSQL ready on port ${this.connectionInfo.postgres?.port}`));
        }
        if (dependencies.includes('inbucket')) {
            const image = getInbucketImage();
            parallelDeps.push(wrapService('inbucket', image, () => this.startInbucket(), () => `Inbucket ready on port ${this.connectionInfo.inbucket?.webPort}`));
        }
        if (dependencies.includes('openldap')) {
            const image = getOpenLdapImage();
            parallelDeps.push(wrapService('openldap', image, () => this.startOpenLdap(), () => `OpenLDAP ready on port ${this.connectionInfo.openldap?.port}`));
        }
        if (dependencies.includes('minio')) {
            const image = getMinioImage();
            parallelDeps.push(wrapService('minio', image, () => this.startMinio(), () => `MinIO ready on port ${this.connectionInfo.minio?.port}`));
        }
        if (dependencies.includes('elasticsearch')) {
            const image = getElasticsearchImage();
            parallelDeps.push(wrapService('elasticsearch', image, () => this.startElasticsearch(), () => `Elasticsearch ready on port ${this.connectionInfo.elasticsearch?.port}`));
        }
        if (dependencies.includes('opensearch')) {
            const image = getOpenSearchImage();
            parallelDeps.push(wrapService('opensearch', image, () => this.startOpenSearch(), () => `OpenSearch ready on port ${this.connectionInfo.opensearch?.port}`));
        }
        if (dependencies.includes('keycloak')) {
            const image = getKeycloakImage();
            parallelDeps.push(wrapService('keycloak', image, () => this.startKeycloak(), () => `Keycloak ready on port ${this.connectionInfo.keycloak?.port}`));
        }
        if (dependencies.includes('redis')) {
            const image = getRedisImage();
            parallelDeps.push(wrapService('redis', image, () => this.startRedis(), () => `Redis ready on port ${this.connectionInfo.redis?.port}`));
        }
        if (dependencies.includes('dejavu')) {
            const image = getDejavuImage();
            parallelDeps.push(wrapService('dejavu', image, () => this.startDejavu(), () => `Dejavu ready on port ${this.connectionInfo.dejavu?.port}`));
        }
        if (dependencies.includes('prometheus')) {
            const image = getPrometheusImage();
            parallelDeps.push(wrapService('prometheus', image, () => this.startPrometheus(), () => `Prometheus ready on port ${this.connectionInfo.prometheus?.port}`));
        }
        if (dependencies.includes('grafana')) {
            const image = getGrafanaImage();
            parallelDeps.push(wrapService('grafana', image, () => this.startGrafana(), () => `Grafana ready on port ${this.connectionInfo.grafana?.port}`));
        }
        if (dependencies.includes('loki')) {
            const image = getLokiImage();
            parallelDeps.push(wrapService('loki', image, () => this.startLoki(), () => `Loki ready on port ${this.connectionInfo.loki?.port}`));
        }
        if (dependencies.includes('promtail')) {
            const image = getPromtailImage();
            parallelDeps.push(wrapService('promtail', image, () => this.startPromtail(), () => `Promtail ready on port ${this.connectionInfo.promtail?.port}`));
        }
        if (parallelDeps.length > 0) {
            this.log(`Starting dependencies: ${dependencies.join(', ')}`);
            await Promise.all(parallelDeps);
        }
        clearInterval(progressInterval);
        // Start Mattermost server (depends on postgres and optionally inbucket)
        if (this.serverMode === 'container') {
            if (this.config.server.subpath) {
                // Subpath mode: two servers behind nginx with /mattermost1 and /mattermost2
                // Can be combined with HA mode (6 total nodes)
                await this.startMattermostSubpath();
            }
            else if (this.config.server.ha) {
                // HA mode: start multiple nodes + nginx load balancer
                await this.startMattermostHA();
            }
            else {
                // Single node mode
                await this.startMattermost();
            }
        }
        const elapsed = formatElapsed(Date.now() - startTime);
        this.log(`✓ Test environment ready in ${elapsed}`);
    }
    log(message) {
        log(message);
    }
    /**
     * Stop all running containers and clean up resources.
     */
    async stop() {
        this.log('Stopping Mattermost test environment');
        const stopPromises = [];
        // Stop nginx load balancer first (HA mode)
        if (this.nginxContainer) {
            stopPromises.push(this.nginxContainer.stop().then(() => this.log('Nginx stopped')));
        }
        // Stop HA cluster nodes
        for (const [nodeName, container] of this.mattermostNodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost ${nodeName} stopped`)));
        }
        // Stop subpath mode containers
        if (this.mattermostServer1) {
            stopPromises.push(this.mattermostServer1.stop().then(() => this.log('Mattermost server1 stopped')));
        }
        if (this.mattermostServer2) {
            stopPromises.push(this.mattermostServer2.stop().then(() => this.log('Mattermost server2 stopped')));
        }
        for (const [nodeName, container] of this.server1Nodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost server1-${nodeName} stopped`)));
        }
        for (const [nodeName, container] of this.server2Nodes) {
            stopPromises.push(container.stop().then(() => this.log(`Mattermost server2-${nodeName} stopped`)));
        }
        // Stop containers in reverse order
        if (this.mattermostContainer) {
            stopPromises.push(this.mattermostContainer.stop().then(() => this.log('Mattermost stopped')));
        }
        if (this.promtailContainer) {
            stopPromises.push(this.promtailContainer.stop().then(() => this.log('Promtail stopped')));
        }
        if (this.lokiContainer) {
            stopPromises.push(this.lokiContainer.stop().then(() => this.log('Loki stopped')));
        }
        if (this.grafanaContainer) {
            stopPromises.push(this.grafanaContainer.stop().then(() => this.log('Grafana stopped')));
        }
        if (this.prometheusContainer) {
            stopPromises.push(this.prometheusContainer.stop().then(() => this.log('Prometheus stopped')));
        }
        if (this.dejavuContainer) {
            stopPromises.push(this.dejavuContainer.stop().then(() => this.log('Dejavu stopped')));
        }
        if (this.redisContainer) {
            stopPromises.push(this.redisContainer.stop().then(() => this.log('Redis stopped')));
        }
        if (this.keycloakContainer) {
            stopPromises.push(this.keycloakContainer.stop().then(() => this.log('Keycloak stopped')));
        }
        if (this.elasticsearchContainer) {
            stopPromises.push(this.elasticsearchContainer.stop().then(() => this.log('Elasticsearch stopped')));
        }
        if (this.opensearchContainer) {
            stopPromises.push(this.opensearchContainer.stop().then(() => this.log('OpenSearch stopped')));
        }
        if (this.minioContainer) {
            stopPromises.push(this.minioContainer.stop().then(() => this.log('MinIO stopped')));
        }
        if (this.openldapContainer) {
            stopPromises.push(this.openldapContainer.stop().then(() => this.log('OpenLDAP stopped')));
        }
        if (this.inbucketContainer) {
            stopPromises.push(this.inbucketContainer.stop().then(() => this.log('Inbucket stopped')));
        }
        if (this.postgresContainer) {
            stopPromises.push(this.postgresContainer.stop().then(() => this.log('PostgreSQL stopped')));
        }
        await Promise.all(stopPromises);
        // Stop network
        if (this.network) {
            await this.network.stop();
            this.log('Network stopped');
        }
        // Clear state
        this.postgresContainer = null;
        this.inbucketContainer = null;
        this.openldapContainer = null;
        this.minioContainer = null;
        this.elasticsearchContainer = null;
        this.opensearchContainer = null;
        this.keycloakContainer = null;
        this.redisContainer = null;
        this.dejavuContainer = null;
        this.prometheusContainer = null;
        this.grafanaContainer = null;
        this.lokiContainer = null;
        this.promtailContainer = null;
        this.mattermostContainer = null;
        this.nginxContainer = null;
        this.mattermostNodes.clear();
        this.mattermostServer1 = null;
        this.mattermostServer2 = null;
        this.server1Nodes.clear();
        this.server2Nodes.clear();
        this.network = null;
        this.connectionInfo = {};
        this.log('Mattermost test environment stopped');
    }
    /**
     * Get connection information for all dependencies.
     */
    getConnectionInfo() {
        if (!this.connectionInfo.postgres) {
            throw new Error('Environment not started. Call start() first.');
        }
        return this.connectionInfo;
    }
    /**
     * Print connection information for all dependencies to console.
     */
    printConnectionInfo() {
        const info = this.getConnectionInfo();
        printConnectionInfo(info);
    }
    /**
     * Get the MmctlClient for executing mmctl commands.
     * In HA mode, connects to the leader node.
     * In subpath mode, connects to server1 (leader node if HA).
     */
    getMmctl() {
        // In subpath mode, use server1
        if (this.config.server.subpath) {
            // Subpath + HA mode: use server1 leader
            const server1Leader = this.server1Nodes.get('leader');
            if (server1Leader) {
                return new MmctlClient(server1Leader);
            }
            // Subpath single node mode: use server1
            if (this.mattermostServer1) {
                return new MmctlClient(this.mattermostServer1);
            }
        }
        // In HA mode, use the leader node
        const leaderContainer = this.mattermostNodes.get('leader');
        if (leaderContainer) {
            return new MmctlClient(leaderContainer);
        }
        // Single node mode
        if (!this.mattermostContainer) {
            throw new Error('Mattermost container not running. Start with serverMode: "container".');
        }
        return new MmctlClient(this.mattermostContainer);
    }
    /**
     * Get the Mattermost server URL.
     * In HA mode, returns the nginx load balancer URL.
     * In subpath mode, returns the nginx URL (use getSubpathInfo() for server-specific URLs).
     */
    getServerUrl() {
        if (this.serverMode === 'local') {
            return 'http://localhost:8065';
        }
        // In subpath mode, return the load balancer URL
        if (this.connectionInfo.subpath) {
            return this.connectionInfo.subpath.url;
        }
        // In HA mode, return the load balancer URL
        if (this.connectionInfo.haCluster) {
            return this.connectionInfo.haCluster.url;
        }
        if (!this.connectionInfo.mattermost) {
            throw new Error('Mattermost not running');
        }
        return this.connectionInfo.mattermost.url;
    }
    /**
     * Get HA cluster connection info (only available in HA mode).
     */
    getHAClusterInfo() {
        return this.connectionInfo.haCluster;
    }
    /**
     * Get subpath connection info (only available in subpath mode).
     */
    getSubpathInfo() {
        return this.connectionInfo.subpath;
    }
    /**
     * Create admin user based on config.
     * Returns the admin credentials used.
     */
    async createAdminUser() {
        if (!this.config.admin) {
            return { success: false, error: 'Admin config not provided' };
        }
        const mmctl = this.getMmctl();
        const username = this.config.admin.username;
        const password = this.config.admin.password || 'Sys@dmin-sample1';
        const email = `${username}@sample.mattermost.com`;
        // Create user via mmctl (local mode, no auth needed)
        // Ignore error if user already exists
        const createResult = await mmctl.exec(`user create --email "${email}" --username "${username}" --password "${password}" --system-admin`);
        if (createResult.exitCode !== 0 && !createResult.stdout.includes('already exists')) {
            this.log(`⚠ Failed to create admin user: ${createResult.stdout || createResult.stderr}`);
            return { success: false, error: `Failed to create admin user: ${createResult.stdout}` };
        }
        this.log(`✓ Admin user created: ${username} / ${password} (${email})`);
        return { success: true, username, password, email };
    }
    // Individual service getters for more granular access
    getPostgresInfo() {
        if (!this.connectionInfo.postgres) {
            throw new Error('PostgreSQL not running');
        }
        return this.connectionInfo.postgres;
    }
    getInbucketInfo() {
        return this.connectionInfo.inbucket;
    }
    getOpenLdapInfo() {
        return this.connectionInfo.openldap;
    }
    getMinioInfo() {
        return this.connectionInfo.minio;
    }
    getElasticsearchInfo() {
        return this.connectionInfo.elasticsearch;
    }
    getOpenSearchInfo() {
        return this.connectionInfo.opensearch;
    }
    getKeycloakInfo() {
        return this.connectionInfo.keycloak;
    }
    getRedisInfo() {
        return this.connectionInfo.redis;
    }
    getMattermostInfo() {
        return this.connectionInfo.mattermost;
    }
    getDejavuInfo() {
        return this.connectionInfo.dejavu;
    }
    getPrometheusInfo() {
        return this.connectionInfo.prometheus;
    }
    getGrafanaInfo() {
        return this.connectionInfo.grafana;
    }
    getLokiInfo() {
        return this.connectionInfo.loki;
    }
    getPromtailInfo() {
        return this.connectionInfo.promtail;
    }
    /**
     * Get the Docker network. Useful for adding custom containers to the network.
     */
    getNetwork() {
        if (!this.network) {
            throw new Error('Network not initialized. Call start() first.');
        }
        return this.network;
    }
    /**
     * Extract metadata from a container.
     */
    getContainerMetadataFrom(container, image) {
        if (!container)
            return undefined;
        return {
            id: container.getId(),
            name: container.getName(),
            image,
            labels: container.getLabels(),
        };
    }
    /**
     * Get metadata for all running containers.
     */
    getContainerMetadata() {
        const metadata = {};
        if (this.postgresContainer && this.connectionInfo.postgres) {
            metadata.postgres = this.getContainerMetadataFrom(this.postgresContainer, this.connectionInfo.postgres.image);
        }
        if (this.inbucketContainer && this.connectionInfo.inbucket) {
            metadata.inbucket = this.getContainerMetadataFrom(this.inbucketContainer, this.connectionInfo.inbucket.image);
        }
        if (this.openldapContainer && this.connectionInfo.openldap) {
            metadata.openldap = this.getContainerMetadataFrom(this.openldapContainer, this.connectionInfo.openldap.image);
        }
        if (this.minioContainer && this.connectionInfo.minio) {
            metadata.minio = this.getContainerMetadataFrom(this.minioContainer, this.connectionInfo.minio.image);
        }
        if (this.elasticsearchContainer && this.connectionInfo.elasticsearch) {
            metadata.elasticsearch = this.getContainerMetadataFrom(this.elasticsearchContainer, this.connectionInfo.elasticsearch.image);
        }
        if (this.opensearchContainer && this.connectionInfo.opensearch) {
            metadata.opensearch = this.getContainerMetadataFrom(this.opensearchContainer, this.connectionInfo.opensearch.image);
        }
        if (this.keycloakContainer && this.connectionInfo.keycloak) {
            metadata.keycloak = this.getContainerMetadataFrom(this.keycloakContainer, this.connectionInfo.keycloak.image);
        }
        if (this.redisContainer && this.connectionInfo.redis) {
            metadata.redis = this.getContainerMetadataFrom(this.redisContainer, this.connectionInfo.redis.image);
        }
        if (this.mattermostContainer && this.connectionInfo.mattermost) {
            metadata.mattermost = this.getContainerMetadataFrom(this.mattermostContainer, this.connectionInfo.mattermost.image);
        }
        if (this.dejavuContainer && this.connectionInfo.dejavu) {
            metadata.dejavu = this.getContainerMetadataFrom(this.dejavuContainer, this.connectionInfo.dejavu.image);
        }
        if (this.prometheusContainer && this.connectionInfo.prometheus) {
            metadata.prometheus = this.getContainerMetadataFrom(this.prometheusContainer, this.connectionInfo.prometheus.image);
        }
        if (this.grafanaContainer && this.connectionInfo.grafana) {
            metadata.grafana = this.getContainerMetadataFrom(this.grafanaContainer, this.connectionInfo.grafana.image);
        }
        if (this.lokiContainer && this.connectionInfo.loki) {
            metadata.loki = this.getContainerMetadataFrom(this.lokiContainer, this.connectionInfo.loki.image);
        }
        if (this.promtailContainer && this.connectionInfo.promtail) {
            metadata.promtail = this.getContainerMetadataFrom(this.promtailContainer, this.connectionInfo.promtail.image);
        }
        // HA mode containers
        if (this.nginxContainer && this.connectionInfo.haCluster) {
            metadata.nginx = this.getContainerMetadataFrom(this.nginxContainer, this.connectionInfo.haCluster.nginx.image);
        }
        if (this.connectionInfo.haCluster) {
            for (const nodeInfo of this.connectionInfo.haCluster.nodes) {
                const container = this.mattermostNodes.get(nodeInfo.nodeName);
                if (container) {
                    metadata[`mattermost-${nodeInfo.nodeName}`] = this.getContainerMetadataFrom(container, nodeInfo.image);
                }
            }
        }
        // Subpath mode containers
        if (this.nginxContainer && this.connectionInfo.subpath) {
            metadata.nginx = this.getContainerMetadataFrom(this.nginxContainer, this.connectionInfo.subpath.nginx.image);
        }
        if (this.mattermostServer1 && this.connectionInfo.mattermost) {
            metadata['mattermost-server1'] = this.getContainerMetadataFrom(this.mattermostServer1, this.connectionInfo.mattermost.image);
        }
        if (this.mattermostServer2 && this.connectionInfo.mattermost) {
            metadata['mattermost-server2'] = this.getContainerMetadataFrom(this.mattermostServer2, this.connectionInfo.mattermost.image);
        }
        // Subpath + HA mode containers
        const serverImage = this.config.server.image ?? getMattermostImage();
        for (const [nodeName, container] of this.server1Nodes) {
            metadata[`mattermost-server1-${nodeName}`] = this.getContainerMetadataFrom(container, serverImage);
        }
        for (const [nodeName, container] of this.server2Nodes) {
            metadata[`mattermost-server2-${nodeName}`] = this.getContainerMetadataFrom(container, serverImage);
        }
        return metadata;
    }
    // Private methods for starting individual dependencies
    async startPostgres() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getPostgresImage();
        this.postgresContainer = await createPostgresContainer(this.network);
        this.connectionInfo.postgres = getPostgresConnectionInfo(this.postgresContainer, image);
    }
    async startInbucket() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getInbucketImage();
        this.inbucketContainer = await createInbucketContainer(this.network);
        this.connectionInfo.inbucket = getInbucketConnectionInfo(this.inbucketContainer, image);
    }
    async startOpenLdap() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getOpenLdapImage();
        this.openldapContainer = await createOpenLdapContainer(this.network);
        this.connectionInfo.openldap = getOpenLdapConnectionInfo(this.openldapContainer, image);
    }
    async startMinio() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getMinioImage();
        this.minioContainer = await createMinioContainer(this.network);
        this.connectionInfo.minio = getMinioConnectionInfo(this.minioContainer, image);
    }
    async startElasticsearch() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getElasticsearchImage();
        this.elasticsearchContainer = await createElasticsearchContainer(this.network);
        this.connectionInfo.elasticsearch = getElasticsearchConnectionInfo(this.elasticsearchContainer, image);
    }
    async startOpenSearch() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getOpenSearchImage();
        this.opensearchContainer = await createOpenSearchContainer(this.network);
        this.connectionInfo.opensearch = getOpenSearchConnectionInfo(this.opensearchContainer, image);
    }
    async startKeycloak() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getKeycloakImage();
        this.keycloakContainer = await createKeycloakContainer(this.network);
        this.connectionInfo.keycloak = getKeycloakConnectionInfo(this.keycloakContainer, image);
    }
    async startRedis() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getRedisImage();
        this.redisContainer = await createRedisContainer(this.network);
        this.connectionInfo.redis = getRedisConnectionInfo(this.redisContainer, image);
    }
    async startDejavu() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getDejavuImage();
        this.dejavuContainer = await createDejavuContainer(this.network);
        this.connectionInfo.dejavu = getDejavuConnectionInfo(this.dejavuContainer, image);
    }
    async startPrometheus() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getPrometheusImage();
        this.prometheusContainer = await createPrometheusContainer(this.network);
        this.connectionInfo.prometheus = getPrometheusConnectionInfo(this.prometheusContainer, image);
    }
    async startGrafana() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getGrafanaImage();
        this.grafanaContainer = await createGrafanaContainer(this.network);
        this.connectionInfo.grafana = getGrafanaConnectionInfo(this.grafanaContainer, image);
    }
    async startLoki() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getLokiImage();
        this.lokiContainer = await createLokiContainer(this.network);
        this.connectionInfo.loki = getLokiConnectionInfo(this.lokiContainer, image);
    }
    async startPromtail() {
        if (!this.network)
            throw new Error('Network not initialized');
        const image = getPromtailImage();
        this.promtailContainer = await createPromtailContainer(this.network);
        this.connectionInfo.promtail = getPromtailConnectionInfo(this.promtailContainer, image);
    }
    async startMattermost() {
        if (!this.network)
            throw new Error('Network not initialized');
        if (!this.connectionInfo.postgres)
            throw new Error('PostgreSQL must be started first');
        const deps = {
            postgres: this.connectionInfo.postgres,
            inbucket: this.connectionInfo.inbucket,
        };
        // Build environment overrides (dependencies, service env, MM_* passthrough, user config)
        const envOverrides = this.buildEnvOverrides();
        const serverImage = this.config.server.image ?? getMattermostImage();
        const mmStartTime = Date.now();
        this.log(`Starting Mattermost (${serverImage})`);
        this.mattermostContainer = await createMattermostContainer(this.network, deps, {
            image: this.config.server.image,
            envOverrides,
            imageMaxAgeMs: this.config.server.imageMaxAgeHours * 60 * 60 * 1000,
        });
        this.connectionInfo.mattermost = getMattermostConnectionInfo(this.mattermostContainer, serverImage);
        const mmElapsed = formatElapsed(Date.now() - mmStartTime);
        this.log(`✓ Mattermost ready at ${this.connectionInfo.mattermost.url} (${mmElapsed})`);
        // Update SiteURL to use the actual mapped port (required for emails, OAuth, etc.)
        const mmctl = new MmctlClient(this.mattermostContainer);
        const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${this.connectionInfo.mattermost.url}"`);
        if (siteUrlResult.exitCode !== 0) {
            this.log(`⚠ Failed to set SiteURL: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
        }
        // Configure server via mmctl (LDAP, Elasticsearch, Redis, server config)
        await this.configureServer(mmctl);
    }
    /**
     * Start Mattermost in HA mode (multi-node cluster with nginx load balancer).
     */
    async startMattermostHA() {
        if (!this.network)
            throw new Error('Network not initialized');
        if (!this.connectionInfo.postgres)
            throw new Error('PostgreSQL must be started first');
        const clusterName = DEFAULT_HA_SETTINGS.clusterName;
        const nodeNames = generateNodeNames(HA_NODE_COUNT);
        const serverImage = this.config.server.image ?? getMattermostImage();
        this.log(`Starting Mattermost HA cluster (${HA_NODE_COUNT} nodes, cluster: ${clusterName})`);
        const deps = {
            postgres: this.connectionInfo.postgres,
            inbucket: this.connectionInfo.inbucket,
        };
        // Build environment overrides (dependencies, service env, MM_* passthrough, user config)
        const envOverrides = this.buildEnvOverrides();
        // Start all Mattermost nodes in sequence (leader first, then followers)
        const nodeInfos = [];
        for (let i = 0; i < nodeNames.length; i++) {
            const nodeName = nodeNames[i];
            const nodeStartTime = Date.now();
            this.log(`Starting Mattermost ${nodeName}...`);
            const container = await createMattermostContainer(this.network, deps, {
                image: this.config.server.image,
                envOverrides,
                imageMaxAgeMs: this.config.server.imageMaxAgeHours * 60 * 60 * 1000,
                cluster: {
                    enable: true,
                    clusterName,
                    nodeName,
                    networkAlias: nodeName,
                },
            });
            this.mattermostNodes.set(nodeName, container);
            const nodeInfo = getMattermostNodeConnectionInfo(container, serverImage, nodeName, nodeName);
            nodeInfos.push(nodeInfo);
            const nodeElapsed = formatElapsed(Date.now() - nodeStartTime);
            this.log(`✓ Mattermost ${nodeName} ready at ${nodeInfo.url} (${nodeElapsed})`);
        }
        // Start nginx load balancer
        const nginxStartTime = Date.now();
        this.log('Starting nginx load balancer...');
        const nginxImage = getNginxImage();
        this.nginxContainer = await createNginxContainer(this.network, {
            nodeAliases: nodeNames,
        });
        const nginxInfo = getNginxConnectionInfo(this.nginxContainer, nginxImage);
        const nginxElapsed = formatElapsed(Date.now() - nginxStartTime);
        this.log(`✓ Nginx load balancer ready at ${nginxInfo.url} (${nginxElapsed})`);
        // Store HA cluster connection info
        this.connectionInfo.haCluster = {
            url: nginxInfo.url,
            nginx: nginxInfo,
            nodes: nodeInfos,
            clusterName,
        };
        // Also set mattermost info to leader node for backwards compatibility
        this.connectionInfo.mattermost = nodeInfos[0];
        // Configure the cluster via mmctl on the leader node
        const leaderContainer = this.mattermostNodes.get('leader');
        if (leaderContainer) {
            const mmctl = new MmctlClient(leaderContainer);
            // Set SiteURL to the load balancer URL
            const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${nginxInfo.url}"`);
            if (siteUrlResult.exitCode !== 0) {
                this.log(`⚠ Failed to set SiteURL: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
            }
            // Configure server via mmctl (LDAP, Elasticsearch, Redis, server config)
            await this.configureServer(mmctl);
        }
        this.log(`✓ Mattermost HA cluster ready (${HA_NODE_COUNT} nodes)`);
    }
    /**
     * Start Mattermost in subpath mode (two servers behind nginx with /mattermost1 and /mattermost2).
     * Can be combined with HA mode for 6 total nodes (3 per server).
     */
    async startMattermostSubpath() {
        if (!this.network)
            throw new Error('Network not initialized');
        if (!this.connectionInfo.postgres)
            throw new Error('PostgreSQL must be started first');
        const isHA = this.config.server.ha ?? false;
        const serverImage = this.config.server.image ?? getMattermostImage();
        if (isHA) {
            this.log('Starting Mattermost subpath + HA mode (2 servers x 3 nodes each)');
        }
        else {
            this.log('Starting Mattermost subpath mode (2 servers)');
        }
        // Create second database for server2
        await this.createSubpathDatabase();
        // Build environment overrides (dependencies, service env, MM_* passthrough, user config)
        const baseEnvOverrides = this.buildEnvOverrides();
        // Server 1 and Server 2 configuration
        const servers = [
            {
                name: 'server1',
                subpath: '/mattermost1',
                database: this.connectionInfo.postgres.database, // Use existing database
                networkAlias: 'mattermost1',
            },
            {
                name: 'server2',
                subpath: '/mattermost2',
                database: 'mattermost_test_2', // Use second database
                networkAlias: 'mattermost2',
            },
        ];
        // Track server URLs for later nginx configuration
        const server1Aliases = [];
        const server2Aliases = [];
        if (isHA) {
            // HA + Subpath: Start 3 nodes per server (6 total)
            const clusterName = DEFAULT_HA_SETTINGS.clusterName;
            const nodeNames = generateNodeNames(HA_NODE_COUNT);
            for (const server of servers) {
                const aliases = server.name === 'server1' ? server1Aliases : server2Aliases;
                const nodes = server.name === 'server1' ? this.server1Nodes : this.server2Nodes;
                // NOTE: We do NOT set MM_SERVICESETTINGS_SITEURL via env var because env vars
                // override database config, preventing mmctl from updating SiteURL later.
                // SiteURL is set via mmctl after nginx starts with the correct external URL.
                for (let i = 0; i < nodeNames.length; i++) {
                    const nodeName = nodeNames[i];
                    const nodeAlias = `${server.networkAlias}-${nodeName}`;
                    aliases.push(nodeAlias);
                    const nodeStartTime = Date.now();
                    this.log(`Starting Mattermost ${server.name}-${nodeName}...`);
                    // Build database URL for this server
                    const dbUrl = `postgres://${this.connectionInfo.postgres.username}:${this.connectionInfo.postgres.password}@postgres:${INTERNAL_PORTS.postgres}/${server.database}?sslmode=disable`;
                    const container = await createMattermostContainer(this.network, this.buildSubpathDeps(server.database), {
                        image: this.config.server.image,
                        envOverrides: {
                            ...baseEnvOverrides,
                            MM_CONFIG: dbUrl,
                            MM_SQLSETTINGS_DATASOURCE: dbUrl,
                            // SiteURL set via mmctl after nginx starts
                        },
                        imageMaxAgeMs: this.config.server.imageMaxAgeHours * 60 * 60 * 1000,
                        cluster: {
                            enable: true,
                            clusterName: `${clusterName}_${server.name}`,
                            nodeName,
                            networkAlias: nodeAlias,
                        },
                        // No subpath for health check - SiteURL not set yet
                    });
                    nodes.set(nodeName, container);
                    const nodeElapsed = formatElapsed(Date.now() - nodeStartTime);
                    this.log(`✓ Mattermost ${server.name}-${nodeName} ready (${nodeElapsed})`);
                }
            }
        }
        else {
            // Single node per server
            for (const server of servers) {
                const aliases = server.name === 'server1' ? server1Aliases : server2Aliases;
                aliases.push(server.networkAlias);
                const serverStartTime = Date.now();
                this.log(`Starting Mattermost ${server.name}...`);
                // Build database URL for this server
                const dbUrl = `postgres://${this.connectionInfo.postgres.username}:${this.connectionInfo.postgres.password}@postgres:${INTERNAL_PORTS.postgres}/${server.database}?sslmode=disable`;
                // NOTE: We do NOT set MM_SERVICESETTINGS_SITEURL via env var because env vars
                // override database config, preventing mmctl from updating SiteURL later.
                // SiteURL is set via mmctl after nginx starts with the correct external URL.
                const container = await createMattermostContainer(this.network, this.buildSubpathDeps(server.database), {
                    image: this.config.server.image,
                    envOverrides: {
                        ...baseEnvOverrides,
                        MM_CONFIG: dbUrl,
                        MM_SQLSETTINGS_DATASOURCE: dbUrl,
                        // SiteURL set via mmctl after nginx starts
                    },
                    imageMaxAgeMs: this.config.server.imageMaxAgeHours * 60 * 60 * 1000,
                    cluster: {
                        enable: false,
                        clusterName: '',
                        nodeName: server.name,
                        networkAlias: server.networkAlias,
                    },
                    // No subpath for health check - SiteURL not set yet
                });
                if (server.name === 'server1') {
                    this.mattermostServer1 = container;
                }
                else {
                    this.mattermostServer2 = container;
                }
                const serverElapsed = formatElapsed(Date.now() - serverStartTime);
                const host = container.getHost();
                const port = container.getMappedPort(INTERNAL_PORTS.mattermost);
                this.log(`✓ Mattermost ${server.name} ready at http://${host}:${port} (${serverElapsed})`);
            }
        }
        // Start nginx load balancer with subpath configuration
        const nginxStartTime = Date.now();
        this.log('Starting nginx with subpath routing...');
        const nginxImage = getNginxImage();
        this.nginxContainer = await createSubpathNginxContainer(this.network, {
            server1Aliases,
            server2Aliases,
        });
        const nginxInfo = getNginxConnectionInfo(this.nginxContainer, nginxImage);
        const nginxElapsed = formatElapsed(Date.now() - nginxStartTime);
        this.log(`✓ Nginx ready at ${nginxInfo.url} (${nginxElapsed})`);
        // Get direct URLs for each server
        let server1DirectUrl;
        let server2DirectUrl;
        if (isHA) {
            // In HA mode, use leader node URL
            const server1Leader = this.server1Nodes.get('leader');
            const server2Leader = this.server2Nodes.get('leader');
            if (!server1Leader || !server2Leader) {
                throw new Error('Failed to get leader nodes for subpath servers');
            }
            server1DirectUrl = `http://${server1Leader.getHost()}:${server1Leader.getMappedPort(INTERNAL_PORTS.mattermost)}`;
            server2DirectUrl = `http://${server2Leader.getHost()}:${server2Leader.getMappedPort(INTERNAL_PORTS.mattermost)}`;
        }
        else {
            if (!this.mattermostServer1 || !this.mattermostServer2) {
                throw new Error('Failed to start subpath servers');
            }
            server1DirectUrl = `http://${this.mattermostServer1.getHost()}:${this.mattermostServer1.getMappedPort(INTERNAL_PORTS.mattermost)}`;
            server2DirectUrl = `http://${this.mattermostServer2.getHost()}:${this.mattermostServer2.getMappedPort(INTERNAL_PORTS.mattermost)}`;
        }
        // Store subpath connection info
        this.connectionInfo.subpath = {
            url: nginxInfo.url,
            server1Url: `${nginxInfo.url}/mattermost1`,
            server2Url: `${nginxInfo.url}/mattermost2`,
            server1DirectUrl,
            server2DirectUrl,
            nginx: nginxInfo,
        };
        // Configure each server via mmctl
        await this.configureSubpathServer('server1', server1Aliases, nginxInfo.url);
        await this.configureSubpathServer('server2', server2Aliases, nginxInfo.url);
        // Set mattermost info to server1 for backwards compatibility
        this.connectionInfo.mattermost = {
            host: this.connectionInfo.subpath.nginx.host,
            port: this.connectionInfo.subpath.nginx.port,
            url: this.connectionInfo.subpath.server1Url,
            internalUrl: `http://mattermost1:${INTERNAL_PORTS.mattermost}`,
            image: serverImage,
        };
        if (isHA) {
            this.log('✓ Mattermost subpath + HA mode ready (6 nodes)');
        }
        else {
            this.log('✓ Mattermost subpath mode ready (2 servers)');
        }
    }
    /**
     * Create second database for subpath server2.
     */
    async createSubpathDatabase() {
        if (!this.postgresContainer) {
            throw new Error('PostgreSQL container not running');
        }
        this.log('Creating second database for server2...');
        const username = this.connectionInfo.postgres.username;
        const password = this.connectionInfo.postgres.password;
        // Execute SQL to create second database using bash with PGPASSWORD
        const result = await this.postgresContainer.exec([
            'bash',
            '-c',
            `PGPASSWORD='${password}' psql -U ${username} -d postgres -c "CREATE DATABASE mattermost_test_2;"`,
        ]);
        if (result.exitCode !== 0 && !result.output.includes('already exists')) {
            throw new Error(`Failed to create second database: ${result.output}`);
        }
        // Grant privileges
        const grantResult = await this.postgresContainer.exec([
            'bash',
            '-c',
            `PGPASSWORD='${password}' psql -U ${username} -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE mattermost_test_2 TO ${username};"`,
        ]);
        if (grantResult.exitCode !== 0) {
            throw new Error(`Failed to grant privileges on second database: ${grantResult.output}`);
        }
        this.log('✓ Second database created');
    }
    /**
     * Build dependencies for subpath server.
     */
    buildSubpathDeps(database) {
        return {
            postgres: {
                ...this.connectionInfo.postgres,
                database,
            },
            inbucket: this.connectionInfo.inbucket,
        };
    }
    /**
     * Build base environment overrides for Mattermost containers.
     * Delegates to the standalone buildBaseEnvOverrides function.
     */
    buildEnvOverrides() {
        return buildBaseEnvOverrides(this.connectionInfo, this.config, this.serverMode);
    }
    /**
     * Configure server via mmctl after it's running.
     * Delegates to the standalone configureServerViaMmctl function.
     */
    async configureServer(mmctl) {
        await configureServerViaMmctl(mmctl, this.connectionInfo, this.config, (msg) => this.log(msg), () => this.loadLdapTestData());
    }
    /**
     * Configure a subpath server via mmctl.
     */
    async configureSubpathServer(serverName, _nodeAliases, nginxUrl) {
        const isHA = this.config.server.ha ?? false;
        const subpath = serverName === 'server1' ? '/mattermost1' : '/mattermost2';
        const siteUrl = `${nginxUrl}${subpath}`;
        // Get the container to run mmctl on
        let container = null;
        if (isHA) {
            const nodes = serverName === 'server1' ? this.server1Nodes : this.server2Nodes;
            container = nodes.get('leader') || null;
        }
        else {
            container = serverName === 'server1' ? this.mattermostServer1 : this.mattermostServer2;
        }
        if (!container) {
            this.log(`⚠ Could not configure ${serverName}: container not found`);
            return;
        }
        const mmctl = new MmctlClient(container);
        // Set SiteURL with subpath
        const siteUrlResult = await mmctl.exec(`config set ServiceSettings.SiteURL "${siteUrl}"`);
        if (siteUrlResult.exitCode !== 0) {
            this.log(`⚠ Failed to set SiteURL for ${serverName}: ${siteUrlResult.stdout || siteUrlResult.stderr}`);
        }
        // Verify SiteURL was actually set by reading it back
        const verifyResult = await mmctl.exec('config get ServiceSettings.SiteURL');
        if (verifyResult.exitCode === 0) {
            const actualSiteUrl = verifyResult.stdout.trim();
            if (!actualSiteUrl.includes(siteUrl)) {
                this.log(`⚠ SiteURL verification failed for ${serverName}: expected "${siteUrl}", got "${actualSiteUrl}"`);
            }
        }
        // Configure server via mmctl (LDAP, Elasticsearch, Redis, server config)
        await this.configureServer(mmctl);
        this.log(`✓ ${serverName} configured with SiteURL: ${siteUrl}`);
    }
    /**
     * Load LDAP test data (schemas and users) into the OpenLDAP container.
     * This mirrors what server/Makefile does in start-docker-openldap-test-data.
     */
    async loadLdapTestData() {
        if (!this.openldapContainer) {
            throw new Error('OpenLDAP container not running');
        }
        this.log('Loading LDAP test data...');
        // Schema files that need to be loaded via ldapadd -Y EXTERNAL
        const schemaFiles = ['custom-schema-objectID.ldif', 'custom-schema-cpa.ldif'];
        // Test data file loaded via ldapadd -x -D "cn=admin,dc=mm,dc=test,dc=com"
        const dataFile = 'test-data.ldif';
        // Load schema files
        for (const schemaFile of schemaFiles) {
            const result = await this.openldapContainer.exec([
                'ldapadd',
                '-Y',
                'EXTERNAL',
                '-H',
                'ldapi:///',
                '-f',
                `/container/service/slapd/assets/test/${schemaFile}`,
            ]);
            if (result.exitCode !== 0 && !result.output.includes('Already exists')) {
                this.log(`⚠ Failed to load ${schemaFile}: ${result.output}`);
            }
        }
        // Load test data
        const dataResult = await this.openldapContainer.exec([
            'ldapadd',
            '-x',
            '-D',
            'cn=admin,dc=mm,dc=test,dc=com',
            '-w',
            'mostest',
            '-f',
            `/container/service/slapd/assets/test/${dataFile}`,
        ]);
        if (dataResult.exitCode !== 0 && !dataResult.output.includes('Already exists')) {
            this.log(`⚠ Failed to load ${dataFile}: ${dataResult.output}`);
        }
        this.log('✓ LDAP test data loaded');
    }
    /**
     * Upload SAML IDP certificate and configure SAML settings for Keycloak.
     * This fully configures SAML authentication with Keycloak.
     * @returns Result object with success status and optional error message
     */
    async uploadSamlIdpCertificate() {
        // Check for Mattermost container (single node, HA leader, or subpath server1)
        const hasMattermost = this.mattermostContainer ||
            this.mattermostNodes.get('leader') ||
            this.mattermostServer1 ||
            this.server1Nodes.get('leader');
        if (!hasMattermost || !this.connectionInfo.mattermost || !this.connectionInfo.keycloak) {
            return { success: false, error: 'Mattermost or Keycloak container not running' };
        }
        try {
            this.log('Configuring SAML with Keycloak...');
            // In subpath mode, configure SAML on both servers
            if (this.connectionInfo.subpath) {
                // Configure server1
                const result1 = await this.configureSamlForServer('server1', this.connectionInfo.subpath.server1DirectUrl, this.connectionInfo.subpath.server1Url);
                if (!result1.success) {
                    return result1;
                }
                // Configure server2
                const result2 = await this.configureSamlForServer('server2', this.connectionInfo.subpath.server2DirectUrl, this.connectionInfo.subpath.server2Url);
                if (!result2.success) {
                    return result2;
                }
                // Update Keycloak SAML client with both server URLs
                await this.updateKeycloakSamlClientForSubpath();
                return { success: true };
            }
            else {
                // Single server or HA mode
                const serverUrl = this.connectionInfo.mattermost.url;
                const directUrl = serverUrl; // Same URL for non-subpath mode
                const result = await this.configureSamlForServer('mattermost', directUrl, serverUrl);
                if (!result.success) {
                    return result;
                }
                // Update Keycloak SAML client
                await this.updateKeycloakSamlClient(serverUrl);
                return { success: true };
            }
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    }
    /**
     * Configure SAML for a single Mattermost server.
     */
    async configureSamlForServer(serverName, directUrl, siteUrl) {
        const certificate = `-----BEGIN CERTIFICATE-----
MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0MB4XDTI0MDIyMTIwNDA0OFoXDTM0MDIyMTIwNDIyOFowFTETMBEGA1UEAwwKbWF0dGVybW9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOnsgNexkO5tbKkFXN+SdMUuLHbqdjZ9/JSnKrYPHLarf8801YDDzV8wI9jjdCCgq+xtKFKWlwU2rGpjPbefDLV1m7CSu0Iq+hNxDiBdX3wkEIK98piDpx+xYGL0aAbXn3nAlqFOWQJLKLM1I65ZmK31YZeVj4Kn01W4WfsvKHoxPjLPwPTug4HB6vaQXqEpzYYYHyuJKvIYNuVwo0WQdaPRXb0poZoYzOnoB6tOFrim6B7/chqtZeXQc7h6/FejBsV59aO5uATI0aAJw1twzjCNIiOeJLB2jlLuIMR3/Yaqr8IRpRXzcRPETpisWNilhV07ZBW0YL9ZwuU4sHWy+iMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW4I1egm+czdnnZxTtth3cjCmLg/UsalUDKSfFOLAlnbe6TtVhP4DpAl+OaQO4+kdEKemLENPmh4ddaHUjSSbbCQZo8B7IjByEe7x3kQdj2ucQpA4bh0vGZ11pVhk5HfkGqAO+UVNQsyLpTmWXQ8SEbxcw6mlTM4SjuybqaGOva1LBscI158Uq5FOVT6TJaxCt3dQkBH0tK+vhRtIM13pNZ/+SFgecn16AuVdBfjjqXynefrSihQ20BZ3NTyjs/N5J2qvSwQ95JARZrlhfiS++L81u2N/0WWni9cXmHsdTLxRrDZjz2CXBNeFOBRio74klSx8tMK27/2lxMsEC7R+DA==
-----END CERTIFICATE-----`;
        // Get mmctl client for this server
        const mmctl = this.getMmctlForServer(serverName);
        if (!mmctl) {
            return { success: false, error: `Could not get mmctl client for ${serverName}` };
        }
        // Admin credentials
        const adminUsername = this.config.admin?.username || 'sysadmin';
        const adminPassword = this.config.admin?.password || 'Sys@dmin-sample1';
        const adminEmail = `${adminUsername}@sample.mattermost.com`;
        // Step 1: Create admin user
        const createResult = await mmctl.exec(`user create --email "${adminEmail}" --username "${adminUsername}" --password "${adminPassword}" --system-admin`);
        if (createResult.exitCode !== 0 && !createResult.stdout.includes('already exists')) {
            this.log(`⚠ Failed to create admin user on ${serverName}: ${createResult.stdout || createResult.stderr}`);
            return { success: false, error: `Failed to create admin user on ${serverName}: ${createResult.stdout}` };
        }
        this.log(`✓ Admin user ready on ${serverName} (${adminUsername})`);
        // Step 2: Login to get a token
        // Use directUrl for API calls - no subpath needed when accessing container directly
        // The subpath is only for nginx routing, not for direct container access
        const parsedUrl = new URL(directUrl);
        const apiHost = parsedUrl.hostname;
        const apiPort = parseInt(parsedUrl.port, 10) || 80;
        const loginResult = await httpPost(apiHost, apiPort, '/api/v4/users/login', JSON.stringify({ login_id: adminUsername, password: adminPassword }), { 'Content-Type': 'application/json' });
        if (!loginResult.success || !loginResult.token) {
            this.log(`⚠ Failed to login on ${serverName}: ${loginResult.error || 'No token received'}`);
            return {
                success: false,
                error: `Failed to login on ${serverName}: ${loginResult.error || 'No token received'}`,
            };
        }
        // Step 3: Upload the certificate
        const uploadResult = await httpPost(apiHost, apiPort, '/api/v4/saml/certificate/idp', certificate, {
            'Content-Type': 'application/x-pem-file',
            Authorization: `Bearer ${loginResult.token}`,
        });
        if (!uploadResult.success) {
            return { success: false, error: `Failed to upload certificate on ${serverName}: ${uploadResult.error}` };
        }
        this.log(`✓ SAML IDP certificate uploaded on ${serverName}`);
        // Step 4: Configure SAML settings via mmctl
        const keycloakExternalUrl = `http://${this.connectionInfo.keycloak.host}:${this.connectionInfo.keycloak.port}`;
        const samlSettings = {
            'SamlSettings.IdpURL': `${keycloakExternalUrl}/realms/mattermost/protocol/saml`,
            'SamlSettings.IdpDescriptorURL': `${keycloakExternalUrl}/realms/mattermost`,
            'SamlSettings.ServiceProviderIdentifier': 'mattermost',
            'SamlSettings.AssertionConsumerServiceURL': `${siteUrl}/login/sso/saml`,
            'SamlSettings.SignatureAlgorithm': 'RSAwithSHA256',
            'SamlSettings.CanonicalAlgorithm': 'Canonical1.0',
            'SamlSettings.IdAttribute': 'id',
            'SamlSettings.FirstNameAttribute': 'firstName',
            'SamlSettings.LastNameAttribute': 'lastName',
            'SamlSettings.EmailAttribute': 'email',
            'SamlSettings.UsernameAttribute': 'username',
            'SamlSettings.Verify': false,
            'SamlSettings.Encrypt': false,
            'SamlSettings.SignRequest': false,
            'SamlSettings.LoginButtonText': 'SAML',
            'SamlSettings.LoginButtonColor': '#34a28b',
            'SamlSettings.LoginButtonTextColor': '#ffffff',
        };
        for (const [key, value] of Object.entries(samlSettings)) {
            const formattedValue = formatConfigValue(value);
            await mmctl.exec(`config set ${key} ${formattedValue}`);
        }
        // Enable SAML
        const enableResult = await mmctl.exec('config set SamlSettings.Enable true');
        if (enableResult.exitCode !== 0) {
            this.log(`⚠ Failed to enable SAML on ${serverName}: ${enableResult.stdout || enableResult.stderr}`);
            return { success: false, error: `Failed to enable SAML on ${serverName}` };
        }
        this.log(`✓ SAML enabled on ${serverName}`);
        return { success: true };
    }
    /**
     * Get mmctl client for a specific server in subpath mode.
     */
    getMmctlForServer(serverName) {
        if (serverName === 'mattermost') {
            // Non-subpath mode
            return this.getMmctl();
        }
        if (serverName === 'server1') {
            // Subpath + HA mode
            const leader = this.server1Nodes.get('leader');
            if (leader)
                return new MmctlClient(leader);
            // Subpath single node mode
            if (this.mattermostServer1)
                return new MmctlClient(this.mattermostServer1);
        }
        if (serverName === 'server2') {
            // Subpath + HA mode
            const leader = this.server2Nodes.get('leader');
            if (leader)
                return new MmctlClient(leader);
            // Subpath single node mode
            if (this.mattermostServer2)
                return new MmctlClient(this.mattermostServer2);
        }
        return null;
    }
    /**
     * Update Keycloak SAML client for subpath mode with both server URLs.
     */
    async updateKeycloakSamlClientForSubpath() {
        if (!this.connectionInfo.keycloak || !this.connectionInfo.subpath) {
            return;
        }
        const { host, port } = this.connectionInfo.keycloak;
        const { server1Url, server2Url, url: nginxUrl } = this.connectionInfo.subpath;
        try {
            // Get Keycloak admin token
            const tokenResult = await httpPost(host, port, '/realms/master/protocol/openid-connect/token', 'grant_type=password&client_id=admin-cli&username=admin&password=admin', { 'Content-Type': 'application/x-www-form-urlencoded' });
            if (!tokenResult.success || !tokenResult.body) {
                this.log(`⚠ Failed to get Keycloak admin token: ${tokenResult.error}`);
                return;
            }
            const tokenData = JSON.parse(tokenResult.body);
            const accessToken = tokenData.access_token;
            // Get the SAML client ID
            const clientsResult = await httpGet(host, port, '/admin/realms/mattermost/clients?clientId=mattermost', {
                Authorization: `Bearer ${accessToken}`,
            });
            if (!clientsResult.success || !clientsResult.body) {
                this.log(`⚠ Failed to get Keycloak clients: ${clientsResult.error}`);
                return;
            }
            const clients = JSON.parse(clientsResult.body);
            if (!clients || clients.length === 0) {
                this.log('⚠ SAML client not found in Keycloak');
                return;
            }
            const clientId = clients[0].id;
            // Update the client with both server URLs
            const updatedClient = {
                ...clients[0],
                rootUrl: nginxUrl,
                baseUrl: nginxUrl,
                redirectUris: [
                    `${server1Url}/login/sso/saml`,
                    `${server1Url}/*`,
                    `${server2Url}/login/sso/saml`,
                    `${server2Url}/*`,
                ],
                webOrigins: [nginxUrl, server1Url, server2Url],
            };
            const updateResult = await httpPut(host, port, `/admin/realms/mattermost/clients/${clientId}`, JSON.stringify(updatedClient), {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            });
            if (!updateResult.success) {
                this.log(`⚠ Failed to update Keycloak SAML client: ${updateResult.error}`);
                return;
            }
            this.log(`✓ Keycloak SAML client updated for subpath mode`);
        }
        catch (err) {
            this.log(`⚠ Failed to update Keycloak SAML client: ${err}`);
        }
    }
    /**
     * Update Keycloak SAML client configuration with the correct Mattermost URL.
     * This sets the proper rootUrl, redirectUris, and webOrigins instead of wildcards.
     */
    async updateKeycloakSamlClient(mattermostUrl) {
        if (!this.connectionInfo.keycloak) {
            this.log('⚠ Keycloak not available, skipping client update');
            return;
        }
        const { host, port } = this.connectionInfo.keycloak;
        try {
            // Step 1: Get Keycloak admin token
            const tokenResult = await httpPost(host, port, '/realms/master/protocol/openid-connect/token', 'grant_type=password&client_id=admin-cli&username=admin&password=admin', { 'Content-Type': 'application/x-www-form-urlencoded' });
            if (!tokenResult.success || !tokenResult.body) {
                this.log(`⚠ Failed to get Keycloak admin token: ${tokenResult.error}`);
                return;
            }
            const tokenData = JSON.parse(tokenResult.body);
            const accessToken = tokenData.access_token;
            // Step 2: Get the SAML client ID
            const clientsResult = await httpGet(host, port, '/admin/realms/mattermost/clients?clientId=mattermost', {
                Authorization: `Bearer ${accessToken}`,
            });
            if (!clientsResult.success || !clientsResult.body) {
                this.log(`⚠ Failed to get Keycloak clients: ${clientsResult.error}`);
                return;
            }
            const clients = JSON.parse(clientsResult.body);
            if (!clients || clients.length === 0) {
                this.log('⚠ SAML client not found in Keycloak');
                return;
            }
            const clientId = clients[0].id;
            // Step 3: Update the client with correct Mattermost URL
            const updatedClient = {
                ...clients[0],
                rootUrl: mattermostUrl,
                baseUrl: mattermostUrl,
                redirectUris: [`${mattermostUrl}/login/sso/saml`, `${mattermostUrl}/*`],
                webOrigins: [mattermostUrl],
            };
            const updateResult = await httpPut(host, port, `/admin/realms/mattermost/clients/${clientId}`, JSON.stringify(updatedClient), {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            });
            if (!updateResult.success) {
                this.log(`⚠ Failed to update Keycloak SAML client: ${updateResult.error}`);
                return;
            }
            this.log(`✓ Keycloak SAML client updated with Mattermost URL: ${mattermostUrl}`);
        }
        catch (err) {
            this.log(`⚠ Failed to update Keycloak SAML client: ${err}`);
        }
    }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Creates a JSON scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
function createScanner(text, ignoreTrivia = false) {
    const len = text.length;
    let pos = 0, value = '', tokenOffset = 0, token = 16 /* SyntaxKind.Unknown */, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0 /* ScanError.None */;
    function scanHexDigits(count, exact) {
        let digits = 0;
        let value = 0;
        while (digits < count || false) {
            let ch = text.charCodeAt(pos);
            if (ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */) {
                value = value * 16 + ch - 48 /* CharacterCodes._0 */;
            }
            else if (ch >= 65 /* CharacterCodes.A */ && ch <= 70 /* CharacterCodes.F */) {
                value = value * 16 + ch - 65 /* CharacterCodes.A */ + 10;
            }
            else if (ch >= 97 /* CharacterCodes.a */ && ch <= 102 /* CharacterCodes.f */) {
                value = value * 16 + ch - 97 /* CharacterCodes.a */ + 10;
            }
            else {
                break;
            }
            pos++;
            digits++;
        }
        if (digits < count) {
            value = -1;
        }
        return value;
    }
    function setPosition(newPosition) {
        pos = newPosition;
        value = '';
        tokenOffset = 0;
        token = 16 /* SyntaxKind.Unknown */;
        scanError = 0 /* ScanError.None */;
    }
    function scanNumber() {
        let start = pos;
        if (text.charCodeAt(pos) === 48 /* CharacterCodes._0 */) {
            pos++;
        }
        else {
            pos++;
            while (pos < text.length && isDigit(text.charCodeAt(pos))) {
                pos++;
            }
        }
        if (pos < text.length && text.charCodeAt(pos) === 46 /* CharacterCodes.dot */) {
            pos++;
            if (pos < text.length && isDigit(text.charCodeAt(pos))) {
                pos++;
                while (pos < text.length && isDigit(text.charCodeAt(pos))) {
                    pos++;
                }
            }
            else {
                scanError = 3 /* ScanError.UnexpectedEndOfNumber */;
                return text.substring(start, pos);
            }
        }
        let end = pos;
        if (pos < text.length && (text.charCodeAt(pos) === 69 /* CharacterCodes.E */ || text.charCodeAt(pos) === 101 /* CharacterCodes.e */)) {
            pos++;
            if (pos < text.length && text.charCodeAt(pos) === 43 /* CharacterCodes.plus */ || text.charCodeAt(pos) === 45 /* CharacterCodes.minus */) {
                pos++;
            }
            if (pos < text.length && isDigit(text.charCodeAt(pos))) {
                pos++;
                while (pos < text.length && isDigit(text.charCodeAt(pos))) {
                    pos++;
                }
                end = pos;
            }
            else {
                scanError = 3 /* ScanError.UnexpectedEndOfNumber */;
            }
        }
        return text.substring(start, end);
    }
    function scanString() {
        let result = '', start = pos;
        while (true) {
            if (pos >= len) {
                result += text.substring(start, pos);
                scanError = 2 /* ScanError.UnexpectedEndOfString */;
                break;
            }
            const ch = text.charCodeAt(pos);
            if (ch === 34 /* CharacterCodes.doubleQuote */) {
                result += text.substring(start, pos);
                pos++;
                break;
            }
            if (ch === 92 /* CharacterCodes.backslash */) {
                result += text.substring(start, pos);
                pos++;
                if (pos >= len) {
                    scanError = 2 /* ScanError.UnexpectedEndOfString */;
                    break;
                }
                const ch2 = text.charCodeAt(pos++);
                switch (ch2) {
                    case 34 /* CharacterCodes.doubleQuote */:
                        result += '\"';
                        break;
                    case 92 /* CharacterCodes.backslash */:
                        result += '\\';
                        break;
                    case 47 /* CharacterCodes.slash */:
                        result += '/';
                        break;
                    case 98 /* CharacterCodes.b */:
                        result += '\b';
                        break;
                    case 102 /* CharacterCodes.f */:
                        result += '\f';
                        break;
                    case 110 /* CharacterCodes.n */:
                        result += '\n';
                        break;
                    case 114 /* CharacterCodes.r */:
                        result += '\r';
                        break;
                    case 116 /* CharacterCodes.t */:
                        result += '\t';
                        break;
                    case 117 /* CharacterCodes.u */:
                        const ch3 = scanHexDigits(4);
                        if (ch3 >= 0) {
                            result += String.fromCharCode(ch3);
                        }
                        else {
                            scanError = 4 /* ScanError.InvalidUnicode */;
                        }
                        break;
                    default:
                        scanError = 5 /* ScanError.InvalidEscapeCharacter */;
                }
                start = pos;
                continue;
            }
            if (ch >= 0 && ch <= 0x1f) {
                if (isLineBreak(ch)) {
                    result += text.substring(start, pos);
                    scanError = 2 /* ScanError.UnexpectedEndOfString */;
                    break;
                }
                else {
                    scanError = 6 /* ScanError.InvalidCharacter */;
                    // mark as error but continue with string
                }
            }
            pos++;
        }
        return result;
    }
    function scanNext() {
        value = '';
        scanError = 0 /* ScanError.None */;
        tokenOffset = pos;
        lineStartOffset = lineNumber;
        prevTokenLineStartOffset = tokenLineStartOffset;
        if (pos >= len) {
            // at the end
            tokenOffset = len;
            return token = 17 /* SyntaxKind.EOF */;
        }
        let code = text.charCodeAt(pos);
        // trivia: whitespace
        if (isWhiteSpace(code)) {
            do {
                pos++;
                value += String.fromCharCode(code);
                code = text.charCodeAt(pos);
            } while (isWhiteSpace(code));
            return token = 15 /* SyntaxKind.Trivia */;
        }
        // trivia: newlines
        if (isLineBreak(code)) {
            pos++;
            value += String.fromCharCode(code);
            if (code === 13 /* CharacterCodes.carriageReturn */ && text.charCodeAt(pos) === 10 /* CharacterCodes.lineFeed */) {
                pos++;
                value += '\n';
            }
            lineNumber++;
            tokenLineStartOffset = pos;
            return token = 14 /* SyntaxKind.LineBreakTrivia */;
        }
        switch (code) {
            // tokens: []{}:,
            case 123 /* CharacterCodes.openBrace */:
                pos++;
                return token = 1 /* SyntaxKind.OpenBraceToken */;
            case 125 /* CharacterCodes.closeBrace */:
                pos++;
                return token = 2 /* SyntaxKind.CloseBraceToken */;
            case 91 /* CharacterCodes.openBracket */:
                pos++;
                return token = 3 /* SyntaxKind.OpenBracketToken */;
            case 93 /* CharacterCodes.closeBracket */:
                pos++;
                return token = 4 /* SyntaxKind.CloseBracketToken */;
            case 58 /* CharacterCodes.colon */:
                pos++;
                return token = 6 /* SyntaxKind.ColonToken */;
            case 44 /* CharacterCodes.comma */:
                pos++;
                return token = 5 /* SyntaxKind.CommaToken */;
            // strings
            case 34 /* CharacterCodes.doubleQuote */:
                pos++;
                value = scanString();
                return token = 10 /* SyntaxKind.StringLiteral */;
            // comments
            case 47 /* CharacterCodes.slash */:
                const start = pos - 1;
                // Single-line comment
                if (text.charCodeAt(pos + 1) === 47 /* CharacterCodes.slash */) {
                    pos += 2;
                    while (pos < len) {
                        if (isLineBreak(text.charCodeAt(pos))) {
                            break;
                        }
                        pos++;
                    }
                    value = text.substring(start, pos);
                    return token = 12 /* SyntaxKind.LineCommentTrivia */;
                }
                // Multi-line comment
                if (text.charCodeAt(pos + 1) === 42 /* CharacterCodes.asterisk */) {
                    pos += 2;
                    const safeLength = len - 1; // For lookahead.
                    let commentClosed = false;
                    while (pos < safeLength) {
                        const ch = text.charCodeAt(pos);
                        if (ch === 42 /* CharacterCodes.asterisk */ && text.charCodeAt(pos + 1) === 47 /* CharacterCodes.slash */) {
                            pos += 2;
                            commentClosed = true;
                            break;
                        }
                        pos++;
                        if (isLineBreak(ch)) {
                            if (ch === 13 /* CharacterCodes.carriageReturn */ && text.charCodeAt(pos) === 10 /* CharacterCodes.lineFeed */) {
                                pos++;
                            }
                            lineNumber++;
                            tokenLineStartOffset = pos;
                        }
                    }
                    if (!commentClosed) {
                        pos++;
                        scanError = 1 /* ScanError.UnexpectedEndOfComment */;
                    }
                    value = text.substring(start, pos);
                    return token = 13 /* SyntaxKind.BlockCommentTrivia */;
                }
                // just a single slash
                value += String.fromCharCode(code);
                pos++;
                return token = 16 /* SyntaxKind.Unknown */;
            // numbers
            case 45 /* CharacterCodes.minus */:
                value += String.fromCharCode(code);
                pos++;
                if (pos === len || !isDigit(text.charCodeAt(pos))) {
                    return token = 16 /* SyntaxKind.Unknown */;
                }
            // found a minus, followed by a number so
            // we fall through to proceed with scanning
            // numbers
            case 48 /* CharacterCodes._0 */:
            case 49 /* CharacterCodes._1 */:
            case 50 /* CharacterCodes._2 */:
            case 51 /* CharacterCodes._3 */:
            case 52 /* CharacterCodes._4 */:
            case 53 /* CharacterCodes._5 */:
            case 54 /* CharacterCodes._6 */:
            case 55 /* CharacterCodes._7 */:
            case 56 /* CharacterCodes._8 */:
            case 57 /* CharacterCodes._9 */:
                value += scanNumber();
                return token = 11 /* SyntaxKind.NumericLiteral */;
            // literals and unknown symbols
            default:
                // is a literal? Read the full word.
                while (pos < len && isUnknownContentCharacter(code)) {
                    pos++;
                    code = text.charCodeAt(pos);
                }
                if (tokenOffset !== pos) {
                    value = text.substring(tokenOffset, pos);
                    // keywords: true, false, null
                    switch (value) {
                        case 'true': return token = 8 /* SyntaxKind.TrueKeyword */;
                        case 'false': return token = 9 /* SyntaxKind.FalseKeyword */;
                        case 'null': return token = 7 /* SyntaxKind.NullKeyword */;
                    }
                    return token = 16 /* SyntaxKind.Unknown */;
                }
                // some
                value += String.fromCharCode(code);
                pos++;
                return token = 16 /* SyntaxKind.Unknown */;
        }
    }
    function isUnknownContentCharacter(code) {
        if (isWhiteSpace(code) || isLineBreak(code)) {
            return false;
        }
        switch (code) {
            case 125 /* CharacterCodes.closeBrace */:
            case 93 /* CharacterCodes.closeBracket */:
            case 123 /* CharacterCodes.openBrace */:
            case 91 /* CharacterCodes.openBracket */:
            case 34 /* CharacterCodes.doubleQuote */:
            case 58 /* CharacterCodes.colon */:
            case 44 /* CharacterCodes.comma */:
            case 47 /* CharacterCodes.slash */:
                return false;
        }
        return true;
    }
    function scanNextNonTrivia() {
        let result;
        do {
            result = scanNext();
        } while (result >= 12 /* SyntaxKind.LineCommentTrivia */ && result <= 15 /* SyntaxKind.Trivia */);
        return result;
    }
    return {
        setPosition: setPosition,
        getPosition: () => pos,
        scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
        getToken: () => token,
        getTokenValue: () => value,
        getTokenOffset: () => tokenOffset,
        getTokenLength: () => pos - tokenOffset,
        getTokenStartLine: () => lineStartOffset,
        getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
        getTokenError: () => scanError,
    };
}
function isWhiteSpace(ch) {
    return ch === 32 /* CharacterCodes.space */ || ch === 9 /* CharacterCodes.tab */;
}
function isLineBreak(ch) {
    return ch === 10 /* CharacterCodes.lineFeed */ || ch === 13 /* CharacterCodes.carriageReturn */;
}
function isDigit(ch) {
    return ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */;
}
var CharacterCodes;
(function (CharacterCodes) {
    CharacterCodes[CharacterCodes["lineFeed"] = 10] = "lineFeed";
    CharacterCodes[CharacterCodes["carriageReturn"] = 13] = "carriageReturn";
    CharacterCodes[CharacterCodes["space"] = 32] = "space";
    CharacterCodes[CharacterCodes["_0"] = 48] = "_0";
    CharacterCodes[CharacterCodes["_1"] = 49] = "_1";
    CharacterCodes[CharacterCodes["_2"] = 50] = "_2";
    CharacterCodes[CharacterCodes["_3"] = 51] = "_3";
    CharacterCodes[CharacterCodes["_4"] = 52] = "_4";
    CharacterCodes[CharacterCodes["_5"] = 53] = "_5";
    CharacterCodes[CharacterCodes["_6"] = 54] = "_6";
    CharacterCodes[CharacterCodes["_7"] = 55] = "_7";
    CharacterCodes[CharacterCodes["_8"] = 56] = "_8";
    CharacterCodes[CharacterCodes["_9"] = 57] = "_9";
    CharacterCodes[CharacterCodes["a"] = 97] = "a";
    CharacterCodes[CharacterCodes["b"] = 98] = "b";
    CharacterCodes[CharacterCodes["c"] = 99] = "c";
    CharacterCodes[CharacterCodes["d"] = 100] = "d";
    CharacterCodes[CharacterCodes["e"] = 101] = "e";
    CharacterCodes[CharacterCodes["f"] = 102] = "f";
    CharacterCodes[CharacterCodes["g"] = 103] = "g";
    CharacterCodes[CharacterCodes["h"] = 104] = "h";
    CharacterCodes[CharacterCodes["i"] = 105] = "i";
    CharacterCodes[CharacterCodes["j"] = 106] = "j";
    CharacterCodes[CharacterCodes["k"] = 107] = "k";
    CharacterCodes[CharacterCodes["l"] = 108] = "l";
    CharacterCodes[CharacterCodes["m"] = 109] = "m";
    CharacterCodes[CharacterCodes["n"] = 110] = "n";
    CharacterCodes[CharacterCodes["o"] = 111] = "o";
    CharacterCodes[CharacterCodes["p"] = 112] = "p";
    CharacterCodes[CharacterCodes["q"] = 113] = "q";
    CharacterCodes[CharacterCodes["r"] = 114] = "r";
    CharacterCodes[CharacterCodes["s"] = 115] = "s";
    CharacterCodes[CharacterCodes["t"] = 116] = "t";
    CharacterCodes[CharacterCodes["u"] = 117] = "u";
    CharacterCodes[CharacterCodes["v"] = 118] = "v";
    CharacterCodes[CharacterCodes["w"] = 119] = "w";
    CharacterCodes[CharacterCodes["x"] = 120] = "x";
    CharacterCodes[CharacterCodes["y"] = 121] = "y";
    CharacterCodes[CharacterCodes["z"] = 122] = "z";
    CharacterCodes[CharacterCodes["A"] = 65] = "A";
    CharacterCodes[CharacterCodes["B"] = 66] = "B";
    CharacterCodes[CharacterCodes["C"] = 67] = "C";
    CharacterCodes[CharacterCodes["D"] = 68] = "D";
    CharacterCodes[CharacterCodes["E"] = 69] = "E";
    CharacterCodes[CharacterCodes["F"] = 70] = "F";
    CharacterCodes[CharacterCodes["G"] = 71] = "G";
    CharacterCodes[CharacterCodes["H"] = 72] = "H";
    CharacterCodes[CharacterCodes["I"] = 73] = "I";
    CharacterCodes[CharacterCodes["J"] = 74] = "J";
    CharacterCodes[CharacterCodes["K"] = 75] = "K";
    CharacterCodes[CharacterCodes["L"] = 76] = "L";
    CharacterCodes[CharacterCodes["M"] = 77] = "M";
    CharacterCodes[CharacterCodes["N"] = 78] = "N";
    CharacterCodes[CharacterCodes["O"] = 79] = "O";
    CharacterCodes[CharacterCodes["P"] = 80] = "P";
    CharacterCodes[CharacterCodes["Q"] = 81] = "Q";
    CharacterCodes[CharacterCodes["R"] = 82] = "R";
    CharacterCodes[CharacterCodes["S"] = 83] = "S";
    CharacterCodes[CharacterCodes["T"] = 84] = "T";
    CharacterCodes[CharacterCodes["U"] = 85] = "U";
    CharacterCodes[CharacterCodes["V"] = 86] = "V";
    CharacterCodes[CharacterCodes["W"] = 87] = "W";
    CharacterCodes[CharacterCodes["X"] = 88] = "X";
    CharacterCodes[CharacterCodes["Y"] = 89] = "Y";
    CharacterCodes[CharacterCodes["Z"] = 90] = "Z";
    CharacterCodes[CharacterCodes["asterisk"] = 42] = "asterisk";
    CharacterCodes[CharacterCodes["backslash"] = 92] = "backslash";
    CharacterCodes[CharacterCodes["closeBrace"] = 125] = "closeBrace";
    CharacterCodes[CharacterCodes["closeBracket"] = 93] = "closeBracket";
    CharacterCodes[CharacterCodes["colon"] = 58] = "colon";
    CharacterCodes[CharacterCodes["comma"] = 44] = "comma";
    CharacterCodes[CharacterCodes["dot"] = 46] = "dot";
    CharacterCodes[CharacterCodes["doubleQuote"] = 34] = "doubleQuote";
    CharacterCodes[CharacterCodes["minus"] = 45] = "minus";
    CharacterCodes[CharacterCodes["openBrace"] = 123] = "openBrace";
    CharacterCodes[CharacterCodes["openBracket"] = 91] = "openBracket";
    CharacterCodes[CharacterCodes["plus"] = 43] = "plus";
    CharacterCodes[CharacterCodes["slash"] = 47] = "slash";
    CharacterCodes[CharacterCodes["formFeed"] = 12] = "formFeed";
    CharacterCodes[CharacterCodes["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

new Array(20).fill(0).map((_, index) => {
    return ' '.repeat(index);
});
const maxCachedValues = 200;
({
    ' ': {
        '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\n' + ' '.repeat(index);
        }),
        '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r' + ' '.repeat(index);
        }),
        '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r\n' + ' '.repeat(index);
        }),
    },
    '\t': {
        '\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\n' + '\t'.repeat(index);
        }),
        '\r': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r' + '\t'.repeat(index);
        }),
        '\r\n': new Array(maxCachedValues).fill(0).map((_, index) => {
            return '\r\n' + '\t'.repeat(index);
        }),
    }
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var ParseOptions;
(function (ParseOptions) {
    ParseOptions.DEFAULT = {
        allowTrailingComma: false
    };
})(ParseOptions || (ParseOptions = {}));
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore always check the errors list to find out if the input was valid.
 */
function parse$2(text, errors = [], options = ParseOptions.DEFAULT) {
    let currentProperty = null;
    let currentParent = [];
    const previousParents = [];
    function onValue(value) {
        if (Array.isArray(currentParent)) {
            currentParent.push(value);
        }
        else if (currentProperty !== null) {
            currentParent[currentProperty] = value;
        }
    }
    const visitor = {
        onObjectBegin: () => {
            const object = {};
            onValue(object);
            previousParents.push(currentParent);
            currentParent = object;
            currentProperty = null;
        },
        onObjectProperty: (name) => {
            currentProperty = name;
        },
        onObjectEnd: () => {
            currentParent = previousParents.pop();
        },
        onArrayBegin: () => {
            const array = [];
            onValue(array);
            previousParents.push(currentParent);
            currentParent = array;
            currentProperty = null;
        },
        onArrayEnd: () => {
            currentParent = previousParents.pop();
        },
        onLiteralValue: onValue,
        onError: (error, offset, length) => {
            errors.push({ error, offset, length });
        }
    };
    visit(text, visitor, options);
    return currentParent[0];
}
/**
 * Parses the given text and invokes the visitor functions for each object, array and literal reached.
 */
function visit(text, visitor, options = ParseOptions.DEFAULT) {
    const _scanner = createScanner(text, false);
    // Important: Only pass copies of this to visitor functions to prevent accidental modification, and
    // to not affect visitor functions which stored a reference to a previous JSONPath
    const _jsonPath = [];
    // Depth of onXXXBegin() callbacks suppressed. onXXXEnd() decrements this if it isn't 0 already.
    // Callbacks are only called when this value is 0.
    let suppressedCallbacks = 0;
    function toNoArgVisit(visitFunction) {
        return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
    }
    function toOneArgVisit(visitFunction) {
        return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
    }
    function toOneArgVisitWithPath(visitFunction) {
        return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
    }
    function toBeginVisit(visitFunction) {
        return visitFunction ?
            () => {
                if (suppressedCallbacks > 0) {
                    suppressedCallbacks++;
                }
                else {
                    let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
                    if (cbReturn === false) {
                        suppressedCallbacks = 1;
                    }
                }
            }
            : () => true;
    }
    function toEndVisit(visitFunction) {
        return visitFunction ?
            () => {
                if (suppressedCallbacks > 0) {
                    suppressedCallbacks--;
                }
                if (suppressedCallbacks === 0) {
                    visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
                }
            }
            : () => true;
    }
    const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
    const disallowComments = options && options.disallowComments;
    const allowTrailingComma = options && options.allowTrailingComma;
    function scanNext() {
        while (true) {
            const token = _scanner.scan();
            switch (_scanner.getTokenError()) {
                case 4 /* ScanError.InvalidUnicode */:
                    handleError(14 /* ParseErrorCode.InvalidUnicode */);
                    break;
                case 5 /* ScanError.InvalidEscapeCharacter */:
                    handleError(15 /* ParseErrorCode.InvalidEscapeCharacter */);
                    break;
                case 3 /* ScanError.UnexpectedEndOfNumber */:
                    handleError(13 /* ParseErrorCode.UnexpectedEndOfNumber */);
                    break;
                case 1 /* ScanError.UnexpectedEndOfComment */:
                    if (!disallowComments) {
                        handleError(11 /* ParseErrorCode.UnexpectedEndOfComment */);
                    }
                    break;
                case 2 /* ScanError.UnexpectedEndOfString */:
                    handleError(12 /* ParseErrorCode.UnexpectedEndOfString */);
                    break;
                case 6 /* ScanError.InvalidCharacter */:
                    handleError(16 /* ParseErrorCode.InvalidCharacter */);
                    break;
            }
            switch (token) {
                case 12 /* SyntaxKind.LineCommentTrivia */:
                case 13 /* SyntaxKind.BlockCommentTrivia */:
                    if (disallowComments) {
                        handleError(10 /* ParseErrorCode.InvalidCommentToken */);
                    }
                    else {
                        onComment();
                    }
                    break;
                case 16 /* SyntaxKind.Unknown */:
                    handleError(1 /* ParseErrorCode.InvalidSymbol */);
                    break;
                case 15 /* SyntaxKind.Trivia */:
                case 14 /* SyntaxKind.LineBreakTrivia */:
                    break;
                default:
                    return token;
            }
        }
    }
    function handleError(error, skipUntilAfter = [], skipUntil = []) {
        onError(error);
        if (skipUntilAfter.length + skipUntil.length > 0) {
            let token = _scanner.getToken();
            while (token !== 17 /* SyntaxKind.EOF */) {
                if (skipUntilAfter.indexOf(token) !== -1) {
                    scanNext();
                    break;
                }
                else if (skipUntil.indexOf(token) !== -1) {
                    break;
                }
                token = scanNext();
            }
        }
    }
    function parseString(isValue) {
        const value = _scanner.getTokenValue();
        if (isValue) {
            onLiteralValue(value);
        }
        else {
            onObjectProperty(value);
            // add property name afterwards
            _jsonPath.push(value);
        }
        scanNext();
        return true;
    }
    function parseLiteral() {
        switch (_scanner.getToken()) {
            case 11 /* SyntaxKind.NumericLiteral */:
                const tokenValue = _scanner.getTokenValue();
                let value = Number(tokenValue);
                if (isNaN(value)) {
                    handleError(2 /* ParseErrorCode.InvalidNumberFormat */);
                    value = 0;
                }
                onLiteralValue(value);
                break;
            case 7 /* SyntaxKind.NullKeyword */:
                onLiteralValue(null);
                break;
            case 8 /* SyntaxKind.TrueKeyword */:
                onLiteralValue(true);
                break;
            case 9 /* SyntaxKind.FalseKeyword */:
                onLiteralValue(false);
                break;
            default:
                return false;
        }
        scanNext();
        return true;
    }
    function parseProperty() {
        if (_scanner.getToken() !== 10 /* SyntaxKind.StringLiteral */) {
            handleError(3 /* ParseErrorCode.PropertyNameExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
            return false;
        }
        parseString(false);
        if (_scanner.getToken() === 6 /* SyntaxKind.ColonToken */) {
            onSeparator(':');
            scanNext(); // consume colon
            if (!parseValue()) {
                handleError(4 /* ParseErrorCode.ValueExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
            }
        }
        else {
            handleError(5 /* ParseErrorCode.ColonExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
        }
        _jsonPath.pop(); // remove processed property name
        return true;
    }
    function parseObject() {
        onObjectBegin();
        scanNext(); // consume open brace
        let needsComma = false;
        while (_scanner.getToken() !== 2 /* SyntaxKind.CloseBraceToken */ && _scanner.getToken() !== 17 /* SyntaxKind.EOF */) {
            if (_scanner.getToken() === 5 /* SyntaxKind.CommaToken */) {
                if (!needsComma) {
                    handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
                }
                onSeparator(',');
                scanNext(); // consume comma
                if (_scanner.getToken() === 2 /* SyntaxKind.CloseBraceToken */ && allowTrailingComma) {
                    break;
                }
            }
            else if (needsComma) {
                handleError(6 /* ParseErrorCode.CommaExpected */, [], []);
            }
            if (!parseProperty()) {
                handleError(4 /* ParseErrorCode.ValueExpected */, [], [2 /* SyntaxKind.CloseBraceToken */, 5 /* SyntaxKind.CommaToken */]);
            }
            needsComma = true;
        }
        onObjectEnd();
        if (_scanner.getToken() !== 2 /* SyntaxKind.CloseBraceToken */) {
            handleError(7 /* ParseErrorCode.CloseBraceExpected */, [2 /* SyntaxKind.CloseBraceToken */], []);
        }
        else {
            scanNext(); // consume close brace
        }
        return true;
    }
    function parseArray() {
        onArrayBegin();
        scanNext(); // consume open bracket
        let isFirstElement = true;
        let needsComma = false;
        while (_scanner.getToken() !== 4 /* SyntaxKind.CloseBracketToken */ && _scanner.getToken() !== 17 /* SyntaxKind.EOF */) {
            if (_scanner.getToken() === 5 /* SyntaxKind.CommaToken */) {
                if (!needsComma) {
                    handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
                }
                onSeparator(',');
                scanNext(); // consume comma
                if (_scanner.getToken() === 4 /* SyntaxKind.CloseBracketToken */ && allowTrailingComma) {
                    break;
                }
            }
            else if (needsComma) {
                handleError(6 /* ParseErrorCode.CommaExpected */, [], []);
            }
            if (isFirstElement) {
                _jsonPath.push(0);
                isFirstElement = false;
            }
            else {
                _jsonPath[_jsonPath.length - 1]++;
            }
            if (!parseValue()) {
                handleError(4 /* ParseErrorCode.ValueExpected */, [], [4 /* SyntaxKind.CloseBracketToken */, 5 /* SyntaxKind.CommaToken */]);
            }
            needsComma = true;
        }
        onArrayEnd();
        if (!isFirstElement) {
            _jsonPath.pop(); // remove array index
        }
        if (_scanner.getToken() !== 4 /* SyntaxKind.CloseBracketToken */) {
            handleError(8 /* ParseErrorCode.CloseBracketExpected */, [4 /* SyntaxKind.CloseBracketToken */], []);
        }
        else {
            scanNext(); // consume close bracket
        }
        return true;
    }
    function parseValue() {
        switch (_scanner.getToken()) {
            case 3 /* SyntaxKind.OpenBracketToken */:
                return parseArray();
            case 1 /* SyntaxKind.OpenBraceToken */:
                return parseObject();
            case 10 /* SyntaxKind.StringLiteral */:
                return parseString(true);
            default:
                return parseLiteral();
        }
    }
    scanNext();
    if (_scanner.getToken() === 17 /* SyntaxKind.EOF */) {
        if (options.allowEmptyContent) {
            return true;
        }
        handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
        return false;
    }
    if (!parseValue()) {
        handleError(4 /* ParseErrorCode.ValueExpected */, [], []);
        return false;
    }
    if (_scanner.getToken() !== 17 /* SyntaxKind.EOF */) {
        handleError(9 /* ParseErrorCode.EndOfFileExpected */, [], []);
    }
    return true;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var ScanError;
(function (ScanError) {
    ScanError[ScanError["None"] = 0] = "None";
    ScanError[ScanError["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
    ScanError[ScanError["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
    ScanError[ScanError["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
    ScanError[ScanError["InvalidUnicode"] = 4] = "InvalidUnicode";
    ScanError[ScanError["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
    ScanError[ScanError["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function (SyntaxKind) {
    SyntaxKind[SyntaxKind["OpenBraceToken"] = 1] = "OpenBraceToken";
    SyntaxKind[SyntaxKind["CloseBraceToken"] = 2] = "CloseBraceToken";
    SyntaxKind[SyntaxKind["OpenBracketToken"] = 3] = "OpenBracketToken";
    SyntaxKind[SyntaxKind["CloseBracketToken"] = 4] = "CloseBracketToken";
    SyntaxKind[SyntaxKind["CommaToken"] = 5] = "CommaToken";
    SyntaxKind[SyntaxKind["ColonToken"] = 6] = "ColonToken";
    SyntaxKind[SyntaxKind["NullKeyword"] = 7] = "NullKeyword";
    SyntaxKind[SyntaxKind["TrueKeyword"] = 8] = "TrueKeyword";
    SyntaxKind[SyntaxKind["FalseKeyword"] = 9] = "FalseKeyword";
    SyntaxKind[SyntaxKind["StringLiteral"] = 10] = "StringLiteral";
    SyntaxKind[SyntaxKind["NumericLiteral"] = 11] = "NumericLiteral";
    SyntaxKind[SyntaxKind["LineCommentTrivia"] = 12] = "LineCommentTrivia";
    SyntaxKind[SyntaxKind["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
    SyntaxKind[SyntaxKind["LineBreakTrivia"] = 14] = "LineBreakTrivia";
    SyntaxKind[SyntaxKind["Trivia"] = 15] = "Trivia";
    SyntaxKind[SyntaxKind["Unknown"] = 16] = "Unknown";
    SyntaxKind[SyntaxKind["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore, always check the errors list to find out if the input was valid.
 */
const parse$1 = parse$2;
var ParseErrorCode;
(function (ParseErrorCode) {
    ParseErrorCode[ParseErrorCode["InvalidSymbol"] = 1] = "InvalidSymbol";
    ParseErrorCode[ParseErrorCode["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
    ParseErrorCode[ParseErrorCode["PropertyNameExpected"] = 3] = "PropertyNameExpected";
    ParseErrorCode[ParseErrorCode["ValueExpected"] = 4] = "ValueExpected";
    ParseErrorCode[ParseErrorCode["ColonExpected"] = 5] = "ColonExpected";
    ParseErrorCode[ParseErrorCode["CommaExpected"] = 6] = "CommaExpected";
    ParseErrorCode[ParseErrorCode["CloseBraceExpected"] = 7] = "CloseBraceExpected";
    ParseErrorCode[ParseErrorCode["CloseBracketExpected"] = 8] = "CloseBracketExpected";
    ParseErrorCode[ParseErrorCode["EndOfFileExpected"] = 9] = "EndOfFileExpected";
    ParseErrorCode[ParseErrorCode["InvalidCommentToken"] = 10] = "InvalidCommentToken";
    ParseErrorCode[ParseErrorCode["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
    ParseErrorCode[ParseErrorCode["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
    ParseErrorCode[ParseErrorCode["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
    ParseErrorCode[ParseErrorCode["InvalidUnicode"] = 14] = "InvalidUnicode";
    ParseErrorCode[ParseErrorCode["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
    ParseErrorCode[ParseErrorCode["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));

/** A special constant with type `never` */
function $constructor(name, initializer, params) {
    function init(inst, def) {
        if (!inst._zod) {
            Object.defineProperty(inst, "_zod", {
                value: {
                    def,
                    constr: _,
                    traits: new Set(),
                },
                enumerable: false,
            });
        }
        if (inst._zod.traits.has(name)) {
            return;
        }
        inst._zod.traits.add(name);
        initializer(inst, def);
        // support prototype modifications
        const proto = _.prototype;
        const keys = Object.keys(proto);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!(k in inst)) {
                inst[k] = proto[k].bind(inst);
            }
        }
    }
    // doesn't work if Parent has a constructor with arguments
    const Parent = params?.Parent ?? Object;
    class Definition extends Parent {
    }
    Object.defineProperty(Definition, "name", { value: name });
    function _(def) {
        var _a;
        const inst = params?.Parent ? new Definition() : this;
        init(inst, def);
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        for (const fn of inst._zod.deferred) {
            fn();
        }
        return inst;
    }
    Object.defineProperty(_, "init", { value: init });
    Object.defineProperty(_, Symbol.hasInstance, {
        value: (inst) => {
            if (params?.Parent && inst instanceof params.Parent)
                return true;
            return inst?._zod?.traits?.has(name);
        },
    });
    Object.defineProperty(_, "name", { value: name });
    return _;
}
class $ZodAsyncError extends Error {
    constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
}
class $ZodEncodeError extends Error {
    constructor(name) {
        super(`Encountered unidirectional transform during encode: ${name}`);
        this.name = "ZodEncodeError";
    }
}
const globalConfig = {};
function config(newConfig) {
    return globalConfig;
}

// functions
function getEnumValues(entries) {
    const numericValues = Object.values(entries).filter((v) => typeof v === "number");
    const values = Object.entries(entries)
        .filter(([k, _]) => numericValues.indexOf(+k) === -1)
        .map(([_, v]) => v);
    return values;
}
function jsonStringifyReplacer(_, value) {
    if (typeof value === "bigint")
        return value.toString();
    return value;
}
function cached(getter) {
    return {
        get value() {
            {
                const value = getter();
                Object.defineProperty(this, "value", { value });
                return value;
            }
        },
    };
}
function nullish(input) {
    return input === null || input === undefined;
}
function cleanRegex(source) {
    const start = source.startsWith("^") ? 1 : 0;
    const end = source.endsWith("$") ? source.length - 1 : source.length;
    return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepString = step.toString();
    let stepDecCount = (stepString.split(".")[1] || "").length;
    if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
        const match = stepString.match(/\d?e-(\d?)/);
        if (match?.[1]) {
            stepDecCount = Number.parseInt(match[1]);
        }
    }
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
const EVALUATING = Symbol("evaluating");
function defineLazy(object, key, getter) {
    let value = undefined;
    Object.defineProperty(object, key, {
        get() {
            if (value === EVALUATING) {
                // Circular reference detected, return undefined to break the cycle
                return undefined;
            }
            if (value === undefined) {
                value = EVALUATING;
                value = getter();
            }
            return value;
        },
        set(v) {
            Object.defineProperty(object, key, {
                value: v,
                // configurable: true,
            });
            // object[key] = v;
        },
        configurable: true,
    });
}
function assignProp(target, prop, value) {
    Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
function mergeDefs(...defs) {
    const mergedDescriptors = {};
    for (const def of defs) {
        const descriptors = Object.getOwnPropertyDescriptors(def);
        Object.assign(mergedDescriptors, descriptors);
    }
    return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
    return JSON.stringify(str);
}
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
const captureStackTrace = ("captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => { });
function isObject(data) {
    return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = cached(() => {
    // @ts-ignore
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
        return false;
    }
    try {
        const F = Function;
        new F("");
        return true;
    }
    catch (_) {
        return false;
    }
});
function isPlainObject(o) {
    if (isObject(o) === false)
        return false;
    // modified constructor
    const ctor = o.constructor;
    if (ctor === undefined)
        return true;
    if (typeof ctor !== "function")
        return true;
    // modified prototype
    const prot = ctor.prototype;
    if (isObject(prot) === false)
        return false;
    // ctor doesn't have static `isPrototypeOf`
    if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
        return false;
    }
    return true;
}
function shallowClone(o) {
    if (isPlainObject(o))
        return { ...o };
    if (Array.isArray(o))
        return [...o];
    return o;
}
const propertyKeyTypes = new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// zod-specific utils
function clone(inst, def, params) {
    const cl = new inst._zod.constr(def ?? inst._zod.def);
    if (!def || params?.parent)
        cl._zod.parent = inst;
    return cl;
}
function normalizeParams(_params) {
    const params = _params;
    if (!params)
        return {};
    if (typeof params === "string")
        return { error: () => params };
    if (params?.message !== undefined) {
        if (params?.error !== undefined)
            throw new Error("Cannot specify both `message` and `error` params");
        params.error = params.message;
    }
    delete params.message;
    if (typeof params.error === "string")
        return { ...params, error: () => params.error };
    return params;
}
function optionalKeys(shape) {
    return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
    });
}
const NUMBER_FORMAT_RANGES = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-34028234663852886e22, 3.4028234663852886e38],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
};
function pick(schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error(".pick() cannot be used on object schemas containing refinements");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const newShape = {};
            for (const key in mask) {
                if (!(key in currDef.shape)) {
                    throw new Error(`Unrecognized key: "${key}"`);
                }
                if (!mask[key])
                    continue;
                newShape[key] = currDef.shape[key];
            }
            assignProp(this, "shape", newShape); // self-caching
            return newShape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function omit(schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error(".omit() cannot be used on object schemas containing refinements");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const newShape = { ...schema._zod.def.shape };
            for (const key in mask) {
                if (!(key in currDef.shape)) {
                    throw new Error(`Unrecognized key: "${key}"`);
                }
                if (!mask[key])
                    continue;
                delete newShape[key];
            }
            assignProp(this, "shape", newShape); // self-caching
            return newShape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function extend(schema, shape) {
    if (!isPlainObject(shape)) {
        throw new Error("Invalid input to extend: expected a plain object");
    }
    const checks = schema._zod.def.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        // Only throw if new shape overlaps with existing shape
        // Use getOwnPropertyDescriptor to check key existence without accessing values
        const existingShape = schema._zod.def.shape;
        for (const key in shape) {
            if (Object.getOwnPropertyDescriptor(existingShape, key) !== undefined) {
                throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
            }
        }
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const _shape = { ...schema._zod.def.shape, ...shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
    });
    return clone(schema, def);
}
function safeExtend(schema, shape) {
    if (!isPlainObject(shape)) {
        throw new Error("Invalid input to safeExtend: expected a plain object");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const _shape = { ...schema._zod.def.shape, ...shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
    });
    return clone(schema, def);
}
function merge(a, b) {
    const def = mergeDefs(a._zod.def, {
        get shape() {
            const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
        get catchall() {
            return b._zod.def.catchall;
        },
        checks: [], // delete existing checks
    });
    return clone(a, def);
}
function partial(Class, schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error(".partial() cannot be used on object schemas containing refinements");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const oldShape = schema._zod.def.shape;
            const shape = { ...oldShape };
            if (mask) {
                for (const key in mask) {
                    if (!(key in oldShape)) {
                        throw new Error(`Unrecognized key: "${key}"`);
                    }
                    if (!mask[key])
                        continue;
                    // if (oldShape[key]!._zod.optin === "optional") continue;
                    shape[key] = Class
                        ? new Class({
                            type: "optional",
                            innerType: oldShape[key],
                        })
                        : oldShape[key];
                }
            }
            else {
                for (const key in oldShape) {
                    // if (oldShape[key]!._zod.optin === "optional") continue;
                    shape[key] = Class
                        ? new Class({
                            type: "optional",
                            innerType: oldShape[key],
                        })
                        : oldShape[key];
                }
            }
            assignProp(this, "shape", shape); // self-caching
            return shape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function required(Class, schema, mask) {
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const oldShape = schema._zod.def.shape;
            const shape = { ...oldShape };
            if (mask) {
                for (const key in mask) {
                    if (!(key in shape)) {
                        throw new Error(`Unrecognized key: "${key}"`);
                    }
                    if (!mask[key])
                        continue;
                    // overwrite with non-optional
                    shape[key] = new Class({
                        type: "nonoptional",
                        innerType: oldShape[key],
                    });
                }
            }
            else {
                for (const key in oldShape) {
                    // overwrite with non-optional
                    shape[key] = new Class({
                        type: "nonoptional",
                        innerType: oldShape[key],
                    });
                }
            }
            assignProp(this, "shape", shape); // self-caching
            return shape;
        },
    });
    return clone(schema, def);
}
// invalid_type | too_big | too_small | invalid_format | not_multiple_of | unrecognized_keys | invalid_union | invalid_key | invalid_element | invalid_value | custom
function aborted(x, startIndex = 0) {
    if (x.aborted === true)
        return true;
    for (let i = startIndex; i < x.issues.length; i++) {
        if (x.issues[i]?.continue !== true) {
            return true;
        }
    }
    return false;
}
function prefixIssues(path, issues) {
    return issues.map((iss) => {
        var _a;
        (_a = iss).path ?? (_a.path = []);
        iss.path.unshift(path);
        return iss;
    });
}
function unwrapMessage(message) {
    return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
    const full = { ...iss, path: iss.path ?? [] };
    // for backwards compatibility
    if (!iss.message) {
        const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ??
            unwrapMessage(ctx?.error?.(iss)) ??
            unwrapMessage(config.customError?.(iss)) ??
            unwrapMessage(config.localeError?.(iss)) ??
            "Invalid input";
        full.message = message;
    }
    // delete (full as any).def;
    delete full.inst;
    delete full.continue;
    if (!ctx?.reportInput) {
        delete full.input;
    }
    return full;
}
function getLengthableOrigin(input) {
    if (Array.isArray(input))
        return "array";
    if (typeof input === "string")
        return "string";
    return "unknown";
}
function issue(...args) {
    const [iss, input, inst] = args;
    if (typeof iss === "string") {
        return {
            message: iss,
            code: "custom",
            input,
            inst,
        };
    }
    return { ...iss };
}

const initializer$1 = (inst, def) => {
    inst.name = "$ZodError";
    Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false,
    });
    Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false,
    });
    inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
    Object.defineProperty(inst, "toString", {
        value: () => inst.message,
        enumerable: false,
    });
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of error.issues) {
        if (sub.path.length > 0) {
            fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
            fieldErrors[sub.path[0]].push(mapper(sub));
        }
        else {
            formErrors.push(mapper(sub));
        }
    }
    return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue) => issue.message) {
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
        for (const issue of error.issues) {
            if (issue.code === "invalid_union" && issue.errors.length) {
                issue.errors.map((issues) => processError({ issues }));
            }
            else if (issue.code === "invalid_key") {
                processError({ issues: issue.issues });
            }
            else if (issue.code === "invalid_element") {
                processError({ issues: issue.issues });
            }
            else if (issue.path.length === 0) {
                fieldErrors._errors.push(mapper(issue));
            }
            else {
                let curr = fieldErrors;
                let i = 0;
                while (i < issue.path.length) {
                    const el = issue.path[i];
                    const terminal = i === issue.path.length - 1;
                    if (!terminal) {
                        curr[el] = curr[el] || { _errors: [] };
                    }
                    else {
                        curr[el] = curr[el] || { _errors: [] };
                        curr[el]._errors.push(mapper(issue));
                    }
                    curr = curr[el];
                    i++;
                }
            }
        }
    };
    processError(error);
    return fieldErrors;
}

const _parse = (_Err) => (schema, value, _ctx, _params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, _params?.callee);
        throw e;
    }
    return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, params?.callee);
        throw e;
    }
    return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    return result.issues.length
        ? {
            success: false,
            error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    return result.issues.length
        ? {
            success: false,
            error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
    return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
    return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _safeParseAsync(_Err)(schema, value, _ctx);
};

const cuid = /^[cC][^\s-]{8,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
 *
 * @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
    if (!version)
        return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
    return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
    return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
// https://blog.stevenlevithan.com/archives/validate-phone-number#r4-3 (regex sans spaces)
// E.164: leading digit must be 1-9; total digits (excluding '+') between 7-15
const e164 = /^\+[1-9]\d{6,14}$/;
// const dateSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
function timeSource(args) {
    const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
    const regex = typeof args.precision === "number"
        ? args.precision === -1
            ? `${hhmm}`
            : args.precision === 0
                ? `${hhmm}:[0-5]\\d`
                : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}`
        : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
    return regex;
}
function time$1(args) {
    return new RegExp(`^${timeSource(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetime$1(args) {
    const time = timeSource({ precision: args.precision });
    const opts = ["Z"];
    if (args.local)
        opts.push("");
    // if (args.offset) opts.push(`([+-]\\d{2}:\\d{2})`);
    if (args.offset)
        opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
    const timeRegex = `${time}(?:${opts.join("|")})`;
    return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
    const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
    return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
// regex for string with no uppercase letters
const lowercase = /^[^A-Z]*$/;
// regex for string with no lowercase letters
const uppercase = /^[^a-z]*$/;

// import { $ZodType } from "./schemas.js";
const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
    var _a;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a = inst._zod).onattach ?? (_a.onattach = []);
});
const numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date",
};
const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
        if (def.value < curr) {
            if (def.inclusive)
                bag.maximum = def.value;
            else
                bag.exclusiveMaximum = def.value;
        }
    });
    inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
            return;
        }
        payload.issues.push({
            origin,
            code: "too_big",
            maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
            input: payload.value,
            inclusive: def.inclusive,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
        if (def.value > curr) {
            if (def.inclusive)
                bag.minimum = def.value;
            else
                bag.exclusiveMinimum = def.value;
        }
    });
    inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
            return;
        }
        payload.issues.push({
            origin,
            code: "too_small",
            minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
            input: payload.value,
            inclusive: def.inclusive,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMultipleOf = 
/*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst) => {
        var _a;
        (_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
    });
    inst._zod.check = (payload) => {
        if (typeof payload.value !== typeof def.value)
            throw new Error("Cannot mix number and bigint in multiple_of check.");
        const isMultiple = typeof payload.value === "bigint"
            ? payload.value % def.value === BigInt(0)
            : floatSafeRemainder(payload.value, def.value) === 0;
        if (isMultiple)
            return;
        payload.issues.push({
            origin: typeof payload.value,
            code: "not_multiple_of",
            divisor: def.value,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def); // no format checks
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
        if (isInt)
            bag.pattern = integer;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        if (isInt) {
            if (!Number.isInteger(input)) {
                // invalid_format issue
                // payload.issues.push({
                //   expected: def.format,
                //   format: def.format,
                //   code: "invalid_format",
                //   input,
                //   inst,
                // });
                // invalid_type issue
                payload.issues.push({
                    expected: origin,
                    format: def.format,
                    code: "invalid_type",
                    continue: false,
                    input,
                    inst,
                });
                return;
                // not_multiple_of issue
                // payload.issues.push({
                //   code: "not_multiple_of",
                //   origin: "number",
                //   input,
                //   inst,
                //   divisor: 1,
                // });
            }
            if (!Number.isSafeInteger(input)) {
                if (input > 0) {
                    // too_big
                    payload.issues.push({
                        input,
                        code: "too_big",
                        maximum: Number.MAX_SAFE_INTEGER,
                        note: "Integers must be within the safe integer range.",
                        inst,
                        origin,
                        inclusive: true,
                        continue: !def.abort,
                    });
                }
                else {
                    // too_small
                    payload.issues.push({
                        input,
                        code: "too_small",
                        minimum: Number.MIN_SAFE_INTEGER,
                        note: "Integers must be within the safe integer range.",
                        inst,
                        origin,
                        inclusive: true,
                        continue: !def.abort,
                    });
                }
                return;
            }
        }
        if (input < minimum) {
            payload.issues.push({
                origin: "number",
                input,
                code: "too_small",
                minimum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
        if (input > maximum) {
            payload.issues.push({
                origin: "number",
                input,
                code: "too_big",
                maximum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY);
        if (def.maximum < curr)
            inst._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length <= def.maximum)
            return;
        const origin = getLengthableOrigin(input);
        payload.issues.push({
            origin,
            code: "too_big",
            maximum: def.maximum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY);
        if (def.minimum > curr)
            inst._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length >= def.minimum)
            return;
        const origin = getLengthableOrigin(input);
        payload.issues.push({
            origin,
            code: "too_small",
            minimum: def.minimum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.minimum = def.length;
        bag.maximum = def.length;
        bag.length = def.length;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length === def.length)
            return;
        const origin = getLengthableOrigin(input);
        const tooBig = length > def.length;
        payload.issues.push({
            origin,
            ...(tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length }),
            inclusive: true,
            exact: true,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a, _b;
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        if (def.pattern) {
            bag.patterns ?? (bag.patterns = new Set());
            bag.patterns.add(def.pattern);
        }
    });
    if (def.pattern)
        (_a = inst._zod).check ?? (_a.check = (payload) => {
            def.pattern.lastIndex = 0;
            if (def.pattern.test(payload.value))
                return;
            payload.issues.push({
                origin: "string",
                code: "invalid_format",
                format: def.format,
                input: payload.value,
                ...(def.pattern ? { pattern: def.pattern.toString() } : {}),
                inst,
                continue: !def.abort,
            });
        });
    else
        (_b = inst._zod).check ?? (_b.check = () => { });
});
const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "regex",
            input: payload.value,
            pattern: def.pattern.toString(),
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = lowercase);
    $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = uppercase);
    $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.includes(def.includes, def.position))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "includes",
            includes: def.includes,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.startsWith(def.prefix))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "starts_with",
            prefix: def.prefix,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.endsWith(def.suffix))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "ends_with",
            suffix: def.suffix,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
        payload.value = def.tx(payload.value);
    };
});

class Doc {
    constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
            this.args = args;
    }
    indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
    }
    write(arg) {
        if (typeof arg === "function") {
            arg(this, { execution: "sync" });
            arg(this, { execution: "async" });
            return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
            this.content.push(line);
        }
    }
    compile() {
        const F = Function;
        const args = this?.args;
        const content = this?.content ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        // console.log(lines.join("\n"));
        return new F(...args, lines.join("\n"));
    }
}

const version = {
    major: 4,
    minor: 3,
    patch: 6,
};

const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def; // set _def property
    inst._zod.bag = inst._zod.bag || {}; // initialize _bag object
    inst._zod.version = version;
    const checks = [...(inst._zod.def.checks ?? [])];
    // if inst is itself a checks.$ZodCheck, run it as a check
    if (inst._zod.traits.has("$ZodCheck")) {
        checks.unshift(inst);
    }
    for (const ch of checks) {
        for (const fn of ch._zod.onattach) {
            fn(inst);
        }
    }
    if (checks.length === 0) {
        // deferred initializer
        // inst._zod.parse is not yet defined
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        inst._zod.deferred?.push(() => {
            inst._zod.run = inst._zod.parse;
        });
    }
    else {
        const runChecks = (payload, checks, ctx) => {
            let isAborted = aborted(payload);
            let asyncResult;
            for (const ch of checks) {
                if (ch._zod.def.when) {
                    const shouldRun = ch._zod.def.when(payload);
                    if (!shouldRun)
                        continue;
                }
                else if (isAborted) {
                    continue;
                }
                const currLen = payload.issues.length;
                const _ = ch._zod.check(payload);
                if (_ instanceof Promise && ctx?.async === false) {
                    throw new $ZodAsyncError();
                }
                if (asyncResult || _ instanceof Promise) {
                    asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                        await _;
                        const nextLen = payload.issues.length;
                        if (nextLen === currLen)
                            return;
                        if (!isAborted)
                            isAborted = aborted(payload, currLen);
                    });
                }
                else {
                    const nextLen = payload.issues.length;
                    if (nextLen === currLen)
                        continue;
                    if (!isAborted)
                        isAborted = aborted(payload, currLen);
                }
            }
            if (asyncResult) {
                return asyncResult.then(() => {
                    return payload;
                });
            }
            return payload;
        };
        const handleCanaryResult = (canary, payload, ctx) => {
            // abort if the canary is aborted
            if (aborted(canary)) {
                canary.aborted = true;
                return canary;
            }
            // run checks first, then
            const checkResult = runChecks(payload, checks, ctx);
            if (checkResult instanceof Promise) {
                if (ctx.async === false)
                    throw new $ZodAsyncError();
                return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
            }
            return inst._zod.parse(checkResult, ctx);
        };
        inst._zod.run = (payload, ctx) => {
            if (ctx.skipChecks) {
                return inst._zod.parse(payload, ctx);
            }
            if (ctx.direction === "backward") {
                // run canary
                // initial pass (no checks)
                const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
                if (canary instanceof Promise) {
                    return canary.then((canary) => {
                        return handleCanaryResult(canary, payload, ctx);
                    });
                }
                return handleCanaryResult(canary, payload, ctx);
            }
            // forward
            const result = inst._zod.parse(payload, ctx);
            if (result instanceof Promise) {
                if (ctx.async === false)
                    throw new $ZodAsyncError();
                return result.then((result) => runChecks(result, checks, ctx));
            }
            return runChecks(result, checks, ctx);
        };
    }
    // Lazy initialize ~standard to avoid creating objects for every schema
    defineLazy(inst, "~standard", () => ({
        validate: (value) => {
            try {
                const r = safeParse$1(inst, value);
                return r.success ? { value: r.data } : { issues: r.error?.issues };
            }
            catch (_) {
                return safeParseAsync$1(inst, value).then((r) => (r.success ? { value: r.data } : { issues: r.error?.issues }));
            }
        },
        vendor: "zod",
        version: 1,
    }));
});
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...(inst?._zod.bag?.patterns ?? [])].pop() ?? string$1(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
        if (def.coerce)
            try {
                payload.value = String(payload.value);
            }
            catch (_) { }
        if (typeof payload.value === "string")
            return payload;
        payload.issues.push({
            expected: "string",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
    // check initialization must come first
    $ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
});
const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = guid);
    $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
        const versionMap = {
            v1: 1,
            v2: 2,
            v3: 3,
            v4: 4,
            v5: 5,
            v6: 6,
            v7: 7,
            v8: 8,
        };
        const v = versionMap[def.version];
        if (v === undefined)
            throw new Error(`Invalid UUID version: "${def.version}"`);
        def.pattern ?? (def.pattern = uuid(v));
    }
    else
        def.pattern ?? (def.pattern = uuid());
    $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = email);
    $ZodStringFormat.init(inst, def);
});
const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        try {
            // Trim whitespace from input
            const trimmed = payload.value.trim();
            // @ts-ignore
            const url = new URL(trimmed);
            if (def.hostname) {
                def.hostname.lastIndex = 0;
                if (!def.hostname.test(url.hostname)) {
                    payload.issues.push({
                        code: "invalid_format",
                        format: "url",
                        note: "Invalid hostname",
                        pattern: def.hostname.source,
                        input: payload.value,
                        inst,
                        continue: !def.abort,
                    });
                }
            }
            if (def.protocol) {
                def.protocol.lastIndex = 0;
                if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
                    payload.issues.push({
                        code: "invalid_format",
                        format: "url",
                        note: "Invalid protocol",
                        pattern: def.protocol.source,
                        input: payload.value,
                        inst,
                        continue: !def.abort,
                    });
                }
            }
            // Set the output value based on normalize flag
            if (def.normalize) {
                // Use normalized URL
                payload.value = url.href;
            }
            else {
                // Preserve the original input (trimmed)
                payload.value = trimmed;
            }
            return;
        }
        catch (_) {
            payload.issues.push({
                code: "invalid_format",
                format: "url",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = emoji());
    $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
    def.pattern ?? (def.pattern = nanoid);
    $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = cuid);
    $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = cuid2);
    $ZodStringFormat.init(inst, def);
});
const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = ulid);
    $ZodStringFormat.init(inst, def);
});
const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = xid);
    $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = ksuid);
    $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = datetime$1(def));
    $ZodStringFormat.init(inst, def);
});
const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = date$1);
    $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = time$1(def));
    $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = duration$1);
    $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = ipv4);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `ipv6`;
    inst._zod.check = (payload) => {
        try {
            // @ts-ignore
            new URL(`http://[${payload.value}]`);
            // return;
        }
        catch {
            payload.issues.push({
                code: "invalid_format",
                format: "ipv6",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv4);
    $ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv6); // not used for validation
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        const parts = payload.value.split("/");
        try {
            if (parts.length !== 2)
                throw new Error();
            const [address, prefix] = parts;
            if (!prefix)
                throw new Error();
            const prefixNum = Number(prefix);
            if (`${prefixNum}` !== prefix)
                throw new Error();
            if (prefixNum < 0 || prefixNum > 128)
                throw new Error();
            // @ts-ignore
            new URL(`http://[${address}]`);
        }
        catch {
            payload.issues.push({
                code: "invalid_format",
                format: "cidrv6",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
//////////////////////////////   ZodBase64   //////////////////////////////
function isValidBase64(data) {
    if (data === "")
        return true;
    if (data.length % 4 !== 0)
        return false;
    try {
        // @ts-ignore
        atob(data);
        return true;
    }
    catch {
        return false;
    }
}
const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = base64);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.contentEncoding = "base64";
    inst._zod.check = (payload) => {
        if (isValidBase64(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "base64",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
//////////////////////////////   ZodBase64   //////////////////////////////
function isValidBase64URL(data) {
    if (!base64url.test(data))
        return false;
    const base64 = data.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return isValidBase64(padded);
}
const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = base64url);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.contentEncoding = "base64url";
    inst._zod.check = (payload) => {
        if (isValidBase64URL(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "base64url",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = e164);
    $ZodStringFormat.init(inst, def);
});
//////////////////////////////   ZodJWT   //////////////////////////////
function isValidJWT(token, algorithm = null) {
    try {
        const tokensParts = token.split(".");
        if (tokensParts.length !== 3)
            return false;
        const [header] = tokensParts;
        if (!header)
            return false;
        // @ts-ignore
        const parsedHeader = JSON.parse(atob(header));
        if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
            return false;
        if (!parsedHeader.alg)
            return false;
        if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        if (isValidJWT(payload.value, def.alg))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "jwt",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Number(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
            return payload;
        }
        const received = typeof input === "number"
            ? Number.isNaN(input)
                ? "NaN"
                : !Number.isFinite(input)
                    ? "Infinity"
                    : undefined
            : undefined;
        payload.issues.push({
            expected: "number",
            code: "invalid_type",
            input,
            inst,
            ...(received ? { received } : {}),
        });
        return payload;
    };
});
const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
    $ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def); // no format checks
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Boolean(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "boolean")
            return payload;
        payload.issues.push({
            expected: "boolean",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
});
const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        payload.issues.push({
            expected: "never",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
function handleArrayResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                expected: "array",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const result = def.element._zod.run({
                value: item,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleArrayResult(result, payload, i)));
            }
            else {
                handleArrayResult(result, payload, i);
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload; //handleArrayResultsAsync(parseResults, final);
    };
});
function handlePropertyResult(result, final, key, input, isOptionalOut) {
    if (result.issues.length) {
        // For optional-out schemas, ignore errors on absent keys
        if (isOptionalOut && !(key in input)) {
            return;
        }
        final.issues.push(...prefixIssues(key, result.issues));
    }
    if (result.value === undefined) {
        if (key in input) {
            final.value[key] = undefined;
        }
    }
    else {
        final.value[key] = result.value;
    }
}
function normalizeDef(def) {
    const keys = Object.keys(def.shape);
    for (const k of keys) {
        if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
            throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
        }
    }
    const okeys = optionalKeys(def.shape);
    return {
        ...def,
        keys,
        keySet: new Set(keys),
        numKeys: keys.length,
        optionalKeys: new Set(okeys),
    };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
    const unrecognized = [];
    // iterate over input keys
    const keySet = def.keySet;
    const _catchall = def.catchall._zod;
    const t = _catchall.def.type;
    const isOptionalOut = _catchall.optout === "optional";
    for (const key in input) {
        if (keySet.has(key))
            continue;
        if (t === "never") {
            unrecognized.push(key);
            continue;
        }
        const r = _catchall.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
            proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalOut)));
        }
        else {
            handlePropertyResult(r, payload, key, input, isOptionalOut);
        }
    }
    if (unrecognized.length) {
        payload.issues.push({
            code: "unrecognized_keys",
            keys: unrecognized,
            input,
            inst,
        });
    }
    if (!proms.length)
        return payload;
    return Promise.all(proms).then(() => {
        return payload;
    });
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodType.init(inst, def);
    // const sh = def.shape;
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    if (!desc?.get) {
        const sh = def.shape;
        Object.defineProperty(def, "shape", {
            get: () => {
                const newSh = { ...sh };
                Object.defineProperty(def, "shape", {
                    value: newSh,
                });
                return newSh;
            },
        });
    }
    const _normalized = cached(() => normalizeDef(def));
    defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
            const field = shape[key]._zod;
            if (field.values) {
                propValues[key] ?? (propValues[key] = new Set());
                for (const v of field.values)
                    propValues[key].add(v);
            }
        }
        return propValues;
    });
    const isObject$1 = isObject;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = {};
        const proms = [];
        const shape = value.shape;
        for (const key of value.keys) {
            const el = shape[key];
            const isOptionalOut = el._zod.optout === "optional";
            const r = el._zod.run({ value: input[key], issues: [] }, ctx);
            if (r instanceof Promise) {
                proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalOut)));
            }
            else {
                handlePropertyResult(r, payload, key, input, isOptionalOut);
            }
        }
        if (!catchall) {
            return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
    };
});
const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodObject.init(inst, def);
    const superParse = inst._zod.parse;
    const _normalized = cached(() => normalizeDef(def));
    const generateFastpass = (shape) => {
        const doc = new Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = (key) => {
            const k = esc(key);
            return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        };
        doc.write(`const input = payload.value;`);
        const ids = Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
            ids[key] = `key_${counter++}`;
        }
        // A: preserve key order {
        doc.write(`const newResult = {};`);
        for (const key of normalized.keys) {
            const id = ids[key];
            const k = esc(key);
            const schema = shape[key];
            const isOptionalOut = schema?._zod?.optout === "optional";
            doc.write(`const ${id} = ${parseStr(key)};`);
            if (isOptionalOut) {
                // For optional-out schemas, ignore errors on absent keys
                doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
            }
            else {
                doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
            }
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject$1 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval$1 = allowsEval;
    const fastEnabled = jit && allowsEval$1.value; // && !def.catchall;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
            // always synchronous
            if (!fastpass)
                fastpass = generateFastpass(def.shape);
            payload = fastpass(payload, ctx);
            if (!catchall)
                return payload;
            return handleCatchall([], input, payload, ctx, value, inst);
        }
        return superParse(payload, ctx);
    };
});
function handleUnionResults(results, final, inst, ctx) {
    for (const result of results) {
        if (result.issues.length === 0) {
            final.value = result.value;
            return final;
        }
    }
    const nonaborted = results.filter((r) => !aborted(r));
    if (nonaborted.length === 1) {
        final.value = nonaborted[0].value;
        return nonaborted[0];
    }
    final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
    });
    return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
            return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
            const patterns = def.options.map((o) => o._zod.pattern);
            return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
        }
        return undefined;
    });
    const single = def.options.length === 1;
    const first = def.options[0]._zod.run;
    inst._zod.parse = (payload, ctx) => {
        if (single) {
            return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
            const result = option._zod.run({
                value: payload.value,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                results.push(result);
                async = true;
            }
            else {
                if (result.issues.length === 0)
                    return result;
                results.push(result);
            }
        }
        if (!async)
            return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results) => {
            return handleUnionResults(results, payload, inst, ctx);
        });
    };
});
const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        const left = def.left._zod.run({ value: input, issues: [] }, ctx);
        const right = def.right._zod.run({ value: input, issues: [] }, ctx);
        const async = left instanceof Promise || right instanceof Promise;
        if (async) {
            return Promise.all([left, right]).then(([left, right]) => {
                return handleIntersectionResults(payload, left, right);
            });
        }
        return handleIntersectionResults(payload, left, right);
    };
});
function mergeValues(a, b) {
    // const aType = parse.t(a);
    // const bType = parse.t(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    if (a instanceof Date && b instanceof Date && +a === +b) {
        return { valid: true, data: a };
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const bKeys = Object.keys(b);
        const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return {
                    valid: false,
                    mergeErrorPath: [key, ...sharedValue.mergeErrorPath],
                };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return { valid: false, mergeErrorPath: [] };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return {
                    valid: false,
                    mergeErrorPath: [index, ...sharedValue.mergeErrorPath],
                };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
    // Track which side(s) report each key as unrecognized
    const unrecKeys = new Map();
    let unrecIssue;
    for (const iss of left.issues) {
        if (iss.code === "unrecognized_keys") {
            unrecIssue ?? (unrecIssue = iss);
            for (const k of iss.keys) {
                if (!unrecKeys.has(k))
                    unrecKeys.set(k, {});
                unrecKeys.get(k).l = true;
            }
        }
        else {
            result.issues.push(iss);
        }
    }
    for (const iss of right.issues) {
        if (iss.code === "unrecognized_keys") {
            for (const k of iss.keys) {
                if (!unrecKeys.has(k))
                    unrecKeys.set(k, {});
                unrecKeys.get(k).r = true;
            }
        }
        else {
            result.issues.push(iss);
        }
    }
    // Report only keys unrecognized by BOTH sides
    const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
    if (bothKeys.length && unrecIssue) {
        result.issues.push({ ...unrecIssue, keys: bothKeys });
    }
    if (aborted(result))
        return result;
    const merged = mergeValues(left.value, right.value);
    if (!merged.valid) {
        throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
    }
    result.value = merged.data;
    return result;
}
const $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!isPlainObject(input)) {
            payload.issues.push({
                expected: "record",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        const proms = [];
        const values = def.keyType._zod.values;
        if (values) {
            payload.value = {};
            const recordKeys = new Set();
            for (const key of values) {
                if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
                    recordKeys.add(typeof key === "number" ? key.toString() : key);
                    const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
                    if (result instanceof Promise) {
                        proms.push(result.then((result) => {
                            if (result.issues.length) {
                                payload.issues.push(...prefixIssues(key, result.issues));
                            }
                            payload.value[key] = result.value;
                        }));
                    }
                    else {
                        if (result.issues.length) {
                            payload.issues.push(...prefixIssues(key, result.issues));
                        }
                        payload.value[key] = result.value;
                    }
                }
            }
            let unrecognized;
            for (const key in input) {
                if (!recordKeys.has(key)) {
                    unrecognized = unrecognized ?? [];
                    unrecognized.push(key);
                }
            }
            if (unrecognized && unrecognized.length > 0) {
                payload.issues.push({
                    code: "unrecognized_keys",
                    input,
                    inst,
                    keys: unrecognized,
                });
            }
        }
        else {
            payload.value = {};
            for (const key of Reflect.ownKeys(input)) {
                if (key === "__proto__")
                    continue;
                let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
                if (keyResult instanceof Promise) {
                    throw new Error("Async schemas not supported in object keys currently");
                }
                // Numeric string fallback: if key is a numeric string and failed, retry with Number(key)
                // This handles z.number(), z.literal([1, 2, 3]), and unions containing numeric literals
                const checkNumericKey = typeof key === "string" && number$1.test(key) && keyResult.issues.length;
                if (checkNumericKey) {
                    const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
                    if (retryResult instanceof Promise) {
                        throw new Error("Async schemas not supported in object keys currently");
                    }
                    if (retryResult.issues.length === 0) {
                        keyResult = retryResult;
                    }
                }
                if (keyResult.issues.length) {
                    if (def.mode === "loose") {
                        // Pass through unchanged
                        payload.value[key] = input[key];
                    }
                    else {
                        // Default "strict" behavior: error on invalid key
                        payload.issues.push({
                            code: "invalid_key",
                            origin: "record",
                            issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                            input: key,
                            path: [key],
                            inst,
                        });
                    }
                    continue;
                }
                const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
                if (result instanceof Promise) {
                    proms.push(result.then((result) => {
                        if (result.issues.length) {
                            payload.issues.push(...prefixIssues(key, result.issues));
                        }
                        payload.value[keyResult.value] = result.value;
                    }));
                }
                else {
                    if (result.issues.length) {
                        payload.issues.push(...prefixIssues(key, result.issues));
                    }
                    payload.value[keyResult.value] = result.value;
                }
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload;
    };
});
const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = getEnumValues(def.entries);
    const valuesSet = new Set(values);
    inst._zod.values = valuesSet;
    inst._zod.pattern = new RegExp(`^(${values
        .filter((k) => propertyKeyTypes.has(typeof k))
        .map((o) => (typeof o === "string" ? escapeRegex(o) : o.toString()))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (valuesSet.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            throw new $ZodEncodeError(inst.constructor.name);
        }
        const _out = def.transform(payload.value, payload);
        if (ctx.async) {
            const output = _out instanceof Promise ? _out : Promise.resolve(_out);
            return output.then((output) => {
                payload.value = output;
                return payload;
            });
        }
        if (_out instanceof Promise) {
            throw new $ZodAsyncError();
        }
        payload.value = _out;
        return payload;
    };
});
function handleOptionalResult(result, input) {
    if (result.issues.length && input === undefined) {
        return { issues: [], value: undefined };
    }
    return result;
}
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
            const result = def.innerType._zod.run(payload, ctx);
            if (result instanceof Promise)
                return result.then((r) => handleOptionalResult(r, payload.value));
            return handleOptionalResult(result, payload.value);
        }
        if (payload.value === undefined) {
            return payload;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
    // Call parent init - inherits optin/optout = "optional"
    $ZodOptional.init(inst, def);
    // Override values/pattern to NOT add undefined
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
    // Override parse to just delegate (no undefined handling)
    inst._zod.parse = (payload, ctx) => {
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
    });
    defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        // Forward direction (decode): allow null to pass through
        if (payload.value === null)
            return payload;
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    // inst._zod.qin = "true";
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply defaults for undefined input
        if (payload.value === undefined) {
            payload.value = def.defaultValue;
            /**
             * $ZodDefault returns the default value immediately in forward direction.
             * It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
            return payload;
        }
        // Forward direction: continue with default handling
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => handleDefaultResult(result, def));
        }
        return handleDefaultResult(result, def);
    };
});
function handleDefaultResult(payload, def) {
    if (payload.value === undefined) {
        payload.value = def.defaultValue;
    }
    return payload;
}
const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply prefault for undefined input
        if (payload.value === undefined) {
            payload.value = def.defaultValue;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => {
        const v = def.innerType._zod.values;
        return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => handleNonOptionalResult(result, inst));
        }
        return handleNonOptionalResult(result, inst);
    };
});
function handleNonOptionalResult(payload, inst) {
    if (!payload.issues.length && payload.value === undefined) {
        payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: payload.value,
            inst,
        });
    }
    return payload;
}
const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply catch logic
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => {
                payload.value = result.value;
                if (result.issues.length) {
                    payload.value = def.catchValue({
                        ...payload,
                        error: {
                            issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                        },
                        input: payload.value,
                    });
                    payload.issues = [];
                }
                return payload;
            });
        }
        payload.value = result.value;
        if (result.issues.length) {
            payload.value = def.catchValue({
                ...payload,
                error: {
                    issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                },
                input: payload.value,
            });
            payload.issues = [];
        }
        return payload;
    };
});
const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => def.in._zod.values);
    defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            const right = def.out._zod.run(payload, ctx);
            if (right instanceof Promise) {
                return right.then((right) => handlePipeResult(right, def.in, ctx));
            }
            return handlePipeResult(right, def.in, ctx);
        }
        const left = def.in._zod.run(payload, ctx);
        if (left instanceof Promise) {
            return left.then((left) => handlePipeResult(left, def.out, ctx));
        }
        return handlePipeResult(left, def.out, ctx);
    };
});
function handlePipeResult(left, next, ctx) {
    if (left.issues.length) {
        // prevent further checks
        left.aborted = true;
        return left;
    }
    return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
    defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then(handleReadonlyResult);
        }
        return handleReadonlyResult(result);
    };
});
function handleReadonlyResult(payload) {
    payload.value = Object.freeze(payload.value);
    return payload;
}
const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
    $ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
        return payload;
    };
    inst._zod.check = (payload) => {
        const input = payload.value;
        const r = def.fn(input);
        if (r instanceof Promise) {
            return r.then((r) => handleRefineResult(r, payload, input, inst));
        }
        handleRefineResult(r, payload, input, inst);
        return;
    };
});
function handleRefineResult(result, payload, input, inst) {
    if (!result) {
        const _iss = {
            code: "custom",
            input,
            inst, // incorporates params.error into issue reporting
            path: [...(inst._zod.def.path ?? [])], // incorporates params.error into issue reporting
            continue: !inst._zod.def.abort,
            // params: inst._zod.def.params,
        };
        if (inst._zod.def.params)
            _iss.params = inst._zod.def.params;
        payload.issues.push(issue(_iss));
    }
}

var _a;
class $ZodRegistry {
    constructor() {
        this._map = new WeakMap();
        this._idmap = new Map();
    }
    add(schema, ..._meta) {
        const meta = _meta[0];
        this._map.set(schema, meta);
        if (meta && typeof meta === "object" && "id" in meta) {
            this._idmap.set(meta.id, schema);
        }
        return this;
    }
    clear() {
        this._map = new WeakMap();
        this._idmap = new Map();
        return this;
    }
    remove(schema) {
        const meta = this._map.get(schema);
        if (meta && typeof meta === "object" && "id" in meta) {
            this._idmap.delete(meta.id);
        }
        this._map.delete(schema);
        return this;
    }
    get(schema) {
        // return this._map.get(schema) as any;
        // inherit metadata
        const p = schema._zod.parent;
        if (p) {
            const pm = { ...(this.get(p) ?? {}) };
            delete pm.id; // do not inherit id
            const f = { ...pm, ...this._map.get(schema) };
            return Object.keys(f).length ? f : undefined;
        }
        return this._map.get(schema);
    }
    has(schema) {
        return this._map.has(schema);
    }
}
// registries
function registry() {
    return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;

// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
    return new Class({
        type: "string",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
    return new Class({
        type: "string",
        format: "email",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
    return new Class({
        type: "string",
        format: "guid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v4",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v6",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v7",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
    return new Class({
        type: "string",
        format: "url",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
    return new Class({
        type: "string",
        format: "emoji",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
    return new Class({
        type: "string",
        format: "nanoid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
    return new Class({
        type: "string",
        format: "cuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
    return new Class({
        type: "string",
        format: "cuid2",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
    return new Class({
        type: "string",
        format: "ulid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
    return new Class({
        type: "string",
        format: "xid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
    return new Class({
        type: "string",
        format: "ksuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
    return new Class({
        type: "string",
        format: "ipv4",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
    return new Class({
        type: "string",
        format: "ipv6",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
    return new Class({
        type: "string",
        format: "cidrv4",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
    return new Class({
        type: "string",
        format: "cidrv6",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
    return new Class({
        type: "string",
        format: "base64",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
    return new Class({
        type: "string",
        format: "base64url",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
    return new Class({
        type: "string",
        format: "e164",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
    return new Class({
        type: "string",
        format: "jwt",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
    return new Class({
        type: "string",
        format: "datetime",
        check: "string_format",
        offset: false,
        local: false,
        precision: null,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
    return new Class({
        type: "string",
        format: "date",
        check: "string_format",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
    return new Class({
        type: "string",
        format: "time",
        check: "string_format",
        precision: null,
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
    return new Class({
        type: "string",
        format: "duration",
        check: "string_format",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
    return new Class({
        type: "number",
        checks: [],
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "safeint",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
    return new Class({
        type: "boolean",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
    return new Class({
        type: "unknown",
    });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
    return new Class({
        type: "never",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
    return new $ZodCheckLessThan({
        check: "less_than",
        ...normalizeParams(params),
        value,
        inclusive: false,
    });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
    return new $ZodCheckLessThan({
        check: "less_than",
        ...normalizeParams(params),
        value,
        inclusive: true,
    });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
    return new $ZodCheckGreaterThan({
        check: "greater_than",
        ...normalizeParams(params),
        value,
        inclusive: false,
    });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
    return new $ZodCheckGreaterThan({
        check: "greater_than",
        ...normalizeParams(params),
        value,
        inclusive: true,
    });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
    return new $ZodCheckMultipleOf({
        check: "multiple_of",
        ...normalizeParams(params),
        value,
    });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
    const ch = new $ZodCheckMaxLength({
        check: "max_length",
        ...normalizeParams(params),
        maximum,
    });
    return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
    return new $ZodCheckMinLength({
        check: "min_length",
        ...normalizeParams(params),
        minimum,
    });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
    return new $ZodCheckLengthEquals({
        check: "length_equals",
        ...normalizeParams(params),
        length,
    });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
    return new $ZodCheckRegex({
        check: "string_format",
        format: "regex",
        ...normalizeParams(params),
        pattern,
    });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
    return new $ZodCheckLowerCase({
        check: "string_format",
        format: "lowercase",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
    return new $ZodCheckUpperCase({
        check: "string_format",
        format: "uppercase",
        ...normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
    return new $ZodCheckIncludes({
        check: "string_format",
        format: "includes",
        ...normalizeParams(params),
        includes,
    });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
    return new $ZodCheckStartsWith({
        check: "string_format",
        format: "starts_with",
        ...normalizeParams(params),
        prefix,
    });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
    return new $ZodCheckEndsWith({
        check: "string_format",
        format: "ends_with",
        ...normalizeParams(params),
        suffix,
    });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
    return new $ZodCheckOverwrite({
        check: "overwrite",
        tx,
    });
}
// normalize
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
    return _overwrite((input) => input.normalize(form));
}
// trim
// @__NO_SIDE_EFFECTS__
function _trim() {
    return _overwrite((input) => input.trim());
}
// toLowerCase
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
    return _overwrite((input) => input.toLowerCase());
}
// toUpperCase
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
    return _overwrite((input) => input.toUpperCase());
}
// slugify
// @__NO_SIDE_EFFECTS__
function _slugify() {
    return _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
    return new Class({
        type: "array",
        element,
        // get element() {
        //   return element;
        // },
        ...normalizeParams(params),
    });
}
// same as _custom but defaults to abort:false
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
    const schema = new Class({
        type: "custom",
        check: "custom",
        fn: fn,
        ...normalizeParams(_params),
    });
    return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn) {
    const ch = _check((payload) => {
        payload.addIssue = (issue$1) => {
            if (typeof issue$1 === "string") {
                payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
            }
            else {
                // for Zod 3 backwards compatibility
                const _issue = issue$1;
                if (_issue.fatal)
                    _issue.continue = false;
                _issue.code ?? (_issue.code = "custom");
                _issue.input ?? (_issue.input = payload.value);
                _issue.inst ?? (_issue.inst = ch);
                _issue.continue ?? (_issue.continue = !ch._zod.def.abort); // abort is always undefined, so this is always true...
                payload.issues.push(issue(_issue));
            }
        };
        return fn(payload.value, payload);
    });
    return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
    const ch = new $ZodCheck({
        check: "custom",
        ...normalizeParams(params),
    });
    ch._zod.check = fn;
    return ch;
}

// function initializeContext<T extends schemas.$ZodType>(inputs: JSONSchemaGeneratorParams<T>): ToJSONSchemaContext<T> {
//   return {
//     processor: inputs.processor,
//     metadataRegistry: inputs.metadata ?? globalRegistry,
//     target: inputs.target ?? "draft-2020-12",
//     unrepresentable: inputs.unrepresentable ?? "throw",
//   };
// }
function initializeContext(params) {
    // Normalize target: convert old non-hyphenated versions to hyphenated versions
    let target = params?.target ?? "draft-2020-12";
    if (target === "draft-4")
        target = "draft-04";
    if (target === "draft-7")
        target = "draft-07";
    return {
        processors: params.processors ?? {},
        metadataRegistry: params?.metadata ?? globalRegistry,
        target,
        unrepresentable: params?.unrepresentable ?? "throw",
        override: params?.override ?? (() => { }),
        io: params?.io ?? "output",
        counter: 0,
        seen: new Map(),
        cycles: params?.cycles ?? "ref",
        reused: params?.reused ?? "inline",
        external: params?.external ?? undefined,
    };
}
function process$1(schema, ctx, _params = { path: [], schemaPath: [] }) {
    var _a;
    const def = schema._zod.def;
    // check for schema in seens
    const seen = ctx.seen.get(schema);
    if (seen) {
        seen.count++;
        // check if cycle
        const isCycle = _params.schemaPath.includes(schema);
        if (isCycle) {
            seen.cycle = _params.path;
        }
        return seen.schema;
    }
    // initialize
    const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
    ctx.seen.set(schema, result);
    // custom method overrides default behavior
    const overrideSchema = schema._zod.toJSONSchema?.();
    if (overrideSchema) {
        result.schema = overrideSchema;
    }
    else {
        const params = {
            ..._params,
            schemaPath: [..._params.schemaPath, schema],
            path: _params.path,
        };
        if (schema._zod.processJSONSchema) {
            schema._zod.processJSONSchema(ctx, result.schema, params);
        }
        else {
            const _json = result.schema;
            const processor = ctx.processors[def.type];
            if (!processor) {
                throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
            }
            processor(schema, ctx, _json, params);
        }
        const parent = schema._zod.parent;
        if (parent) {
            // Also set ref if processor didn't (for inheritance)
            if (!result.ref)
                result.ref = parent;
            process$1(parent, ctx, params);
            ctx.seen.get(parent).isParent = true;
        }
    }
    // metadata
    const meta = ctx.metadataRegistry.get(schema);
    if (meta)
        Object.assign(result.schema, meta);
    if (ctx.io === "input" && isTransforming(schema)) {
        // examples/defaults only apply to output type of pipe
        delete result.schema.examples;
        delete result.schema.default;
    }
    // set prefault as default
    if (ctx.io === "input" && result.schema._prefault)
        (_a = result.schema).default ?? (_a.default = result.schema._prefault);
    delete result.schema._prefault;
    // pulling fresh from ctx.seen in case it was overwritten
    const _result = ctx.seen.get(schema);
    return _result.schema;
}
function extractDefs(ctx, schema
// params: EmitParams
) {
    // iterate over seen map;
    const root = ctx.seen.get(schema);
    if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
    // Track ids to detect duplicates across different schemas
    const idToSchema = new Map();
    for (const entry of ctx.seen.entries()) {
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
            const existing = idToSchema.get(id);
            if (existing && existing !== entry[0]) {
                throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
            }
            idToSchema.set(id, entry[0]);
        }
    }
    // returns a ref to the schema
    // defId will be empty if the ref points to an external schema (or #)
    const makeURI = (entry) => {
        // comparing the seen objects because sometimes
        // multiple schemas map to the same seen object.
        // e.g. lazy
        // external is configured
        const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
        if (ctx.external) {
            const externalId = ctx.external.registry.get(entry[0])?.id; // ?? "__shared";// `__schema${ctx.counter++}`;
            // check if schema is in the external registry
            const uriGenerator = ctx.external.uri ?? ((id) => id);
            if (externalId) {
                return { ref: uriGenerator(externalId) };
            }
            // otherwise, add to __shared
            const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
            entry[1].defId = id; // set defId so it will be reused if needed
            return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
        }
        if (entry[1] === root) {
            return { ref: "#" };
        }
        // self-contained schema
        const uriPrefix = `#`;
        const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
        const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
        return { defId, ref: defUriPrefix + defId };
    };
    // stored cached version in `def` property
    // remove all properties, set $ref
    const extractToDef = (entry) => {
        // if the schema is already a reference, do not extract it
        if (entry[1].schema.$ref) {
            return;
        }
        const seen = entry[1];
        const { ref, defId } = makeURI(entry);
        seen.def = { ...seen.schema };
        // defId won't be set if the schema is a reference to an external schema
        // or if the schema is the root schema
        if (defId)
            seen.defId = defId;
        // wipe away all properties except $ref
        const schema = seen.schema;
        for (const key in schema) {
            delete schema[key];
        }
        schema.$ref = ref;
    };
    // throw on cycles
    // break cycles
    if (ctx.cycles === "throw") {
        for (const entry of ctx.seen.entries()) {
            const seen = entry[1];
            if (seen.cycle) {
                throw new Error("Cycle detected: " +
                    `#/${seen.cycle?.join("/")}/<root>` +
                    '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
            }
        }
    }
    // extract schemas into $defs
    for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        // convert root schema to # $ref
        if (schema === entry[0]) {
            extractToDef(entry); // this has special handling for the root schema
            continue;
        }
        // extract schemas that are in the external registry
        if (ctx.external) {
            const ext = ctx.external.registry.get(entry[0])?.id;
            if (schema !== entry[0] && ext) {
                extractToDef(entry);
                continue;
            }
        }
        // extract schemas with `id` meta
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
            extractToDef(entry);
            continue;
        }
        // break cycles
        if (seen.cycle) {
            // any
            extractToDef(entry);
            continue;
        }
        // extract reused schemas
        if (seen.count > 1) {
            if (ctx.reused === "ref") {
                extractToDef(entry);
                // biome-ignore lint:
                continue;
            }
        }
    }
}
function finalize(ctx, schema) {
    const root = ctx.seen.get(schema);
    if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
    // flatten refs - inherit properties from parent schemas
    const flattenRef = (zodSchema) => {
        const seen = ctx.seen.get(zodSchema);
        // already processed
        if (seen.ref === null)
            return;
        const schema = seen.def ?? seen.schema;
        const _cached = { ...schema };
        const ref = seen.ref;
        seen.ref = null; // prevent infinite recursion
        if (ref) {
            flattenRef(ref);
            const refSeen = ctx.seen.get(ref);
            const refSchema = refSeen.schema;
            // merge referenced schema into current
            if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
                // older drafts can't combine $ref with other properties
                schema.allOf = schema.allOf ?? [];
                schema.allOf.push(refSchema);
            }
            else {
                Object.assign(schema, refSchema);
            }
            // restore child's own properties (child wins)
            Object.assign(schema, _cached);
            const isParentRef = zodSchema._zod.parent === ref;
            // For parent chain, child is a refinement - remove parent-only properties
            if (isParentRef) {
                for (const key in schema) {
                    if (key === "$ref" || key === "allOf")
                        continue;
                    if (!(key in _cached)) {
                        delete schema[key];
                    }
                }
            }
            // When ref was extracted to $defs, remove properties that match the definition
            if (refSchema.$ref && refSeen.def) {
                for (const key in schema) {
                    if (key === "$ref" || key === "allOf")
                        continue;
                    if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) {
                        delete schema[key];
                    }
                }
            }
        }
        // If parent was extracted (has $ref), propagate $ref to this schema
        // This handles cases like: readonly().meta({id}).describe()
        // where processor sets ref to innerType but parent should be referenced
        const parent = zodSchema._zod.parent;
        if (parent && parent !== ref) {
            // Ensure parent is processed first so its def has inherited properties
            flattenRef(parent);
            const parentSeen = ctx.seen.get(parent);
            if (parentSeen?.schema.$ref) {
                schema.$ref = parentSeen.schema.$ref;
                // De-duplicate with parent's definition
                if (parentSeen.def) {
                    for (const key in schema) {
                        if (key === "$ref" || key === "allOf")
                            continue;
                        if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) {
                            delete schema[key];
                        }
                    }
                }
            }
        }
        // execute overrides
        ctx.override({
            zodSchema: zodSchema,
            jsonSchema: schema,
            path: seen.path ?? [],
        });
    };
    for (const entry of [...ctx.seen.entries()].reverse()) {
        flattenRef(entry[0]);
    }
    const result = {};
    if (ctx.target === "draft-2020-12") {
        result.$schema = "https://json-schema.org/draft/2020-12/schema";
    }
    else if (ctx.target === "draft-07") {
        result.$schema = "http://json-schema.org/draft-07/schema#";
    }
    else if (ctx.target === "draft-04") {
        result.$schema = "http://json-schema.org/draft-04/schema#";
    }
    else if (ctx.target === "openapi-3.0") ;
    else ;
    if (ctx.external?.uri) {
        const id = ctx.external.registry.get(schema)?.id;
        if (!id)
            throw new Error("Schema is missing an `id` property");
        result.$id = ctx.external.uri(id);
    }
    Object.assign(result, root.def ?? root.schema);
    // build defs object
    const defs = ctx.external?.defs ?? {};
    for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.def && seen.defId) {
            defs[seen.defId] = seen.def;
        }
    }
    // set definitions in result
    if (ctx.external) ;
    else {
        if (Object.keys(defs).length > 0) {
            if (ctx.target === "draft-2020-12") {
                result.$defs = defs;
            }
            else {
                result.definitions = defs;
            }
        }
    }
    try {
        // this "finalizes" this schema and ensures all cycles are removed
        // each call to finalize() is functionally independent
        // though the seen map is shared
        const finalized = JSON.parse(JSON.stringify(result));
        Object.defineProperty(finalized, "~standard", {
            value: {
                ...schema["~standard"],
                jsonSchema: {
                    input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
                    output: createStandardJSONSchemaMethod(schema, "output", ctx.processors),
                },
            },
            enumerable: false,
            writable: false,
        });
        return finalized;
    }
    catch (_err) {
        throw new Error("Error converting schema to JSON.");
    }
}
function isTransforming(_schema, _ctx) {
    const ctx = _ctx ?? { seen: new Set() };
    if (ctx.seen.has(_schema))
        return false;
    ctx.seen.add(_schema);
    const def = _schema._zod.def;
    if (def.type === "transform")
        return true;
    if (def.type === "array")
        return isTransforming(def.element, ctx);
    if (def.type === "set")
        return isTransforming(def.valueType, ctx);
    if (def.type === "lazy")
        return isTransforming(def.getter(), ctx);
    if (def.type === "promise" ||
        def.type === "optional" ||
        def.type === "nonoptional" ||
        def.type === "nullable" ||
        def.type === "readonly" ||
        def.type === "default" ||
        def.type === "prefault") {
        return isTransforming(def.innerType, ctx);
    }
    if (def.type === "intersection") {
        return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
    }
    if (def.type === "record" || def.type === "map") {
        return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
    }
    if (def.type === "pipe") {
        return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
    }
    if (def.type === "object") {
        for (const key in def.shape) {
            if (isTransforming(def.shape[key], ctx))
                return true;
        }
        return false;
    }
    if (def.type === "union") {
        for (const option of def.options) {
            if (isTransforming(option, ctx))
                return true;
        }
        return false;
    }
    if (def.type === "tuple") {
        for (const item of def.items) {
            if (isTransforming(item, ctx))
                return true;
        }
        if (def.rest && isTransforming(def.rest, ctx))
            return true;
        return false;
    }
    return false;
}
/**
 * Creates a toJSONSchema method for a schema instance.
 * This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
 */
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
    const ctx = initializeContext({ ...params, processors });
    process$1(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
    const { libraryOptions, target } = params ?? {};
    const ctx = initializeContext({ ...(libraryOptions ?? {}), target, io, processors });
    process$1(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
};

const formatMap = {
    guid: "uuid",
    url: "uri",
    datetime: "date-time",
    json_string: "json-string",
    regex: "", // do not set
};
// ==================== SIMPLE TYPE PROCESSORS ====================
const stringProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    json.type = "string";
    const { minimum, maximum, format, patterns, contentEncoding } = schema._zod
        .bag;
    if (typeof minimum === "number")
        json.minLength = minimum;
    if (typeof maximum === "number")
        json.maxLength = maximum;
    // custom pattern overrides format
    if (format) {
        json.format = formatMap[format] ?? format;
        if (json.format === "")
            delete json.format; // empty format is not valid
        // JSON Schema format: "time" requires a full time with offset or Z
        // z.iso.time() does not include timezone information, so format: "time" should never be used
        if (format === "time") {
            delete json.format;
        }
    }
    if (contentEncoding)
        json.contentEncoding = contentEncoding;
    if (patterns && patterns.size > 0) {
        const regexes = [...patterns];
        if (regexes.length === 1)
            json.pattern = regexes[0].source;
        else if (regexes.length > 1) {
            json.allOf = [
                ...regexes.map((regex) => ({
                    ...(ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0"
                        ? { type: "string" }
                        : {}),
                    pattern: regex.source,
                })),
            ];
        }
    }
};
const numberProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
    if (typeof format === "string" && format.includes("int"))
        json.type = "integer";
    else
        json.type = "number";
    if (typeof exclusiveMinimum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.minimum = exclusiveMinimum;
            json.exclusiveMinimum = true;
        }
        else {
            json.exclusiveMinimum = exclusiveMinimum;
        }
    }
    if (typeof minimum === "number") {
        json.minimum = minimum;
        if (typeof exclusiveMinimum === "number" && ctx.target !== "draft-04") {
            if (exclusiveMinimum >= minimum)
                delete json.minimum;
            else
                delete json.exclusiveMinimum;
        }
    }
    if (typeof exclusiveMaximum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.maximum = exclusiveMaximum;
            json.exclusiveMaximum = true;
        }
        else {
            json.exclusiveMaximum = exclusiveMaximum;
        }
    }
    if (typeof maximum === "number") {
        json.maximum = maximum;
        if (typeof exclusiveMaximum === "number" && ctx.target !== "draft-04") {
            if (exclusiveMaximum <= maximum)
                delete json.maximum;
            else
                delete json.exclusiveMaximum;
        }
    }
    if (typeof multipleOf === "number")
        json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
    json.type = "boolean";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
    json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
    // empty schema accepts anything
};
const enumProcessor = (schema, _ctx, json, _params) => {
    const def = schema._zod.def;
    const values = getEnumValues(def.entries);
    // Number enums can have both string and number values
    if (values.every((v) => typeof v === "number"))
        json.type = "number";
    if (values.every((v) => typeof v === "string"))
        json.type = "string";
    json.enum = values;
};
const customProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Custom types cannot be represented in JSON Schema");
    }
};
const transformProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Transforms cannot be represented in JSON Schema");
    }
};
// ==================== COMPOSITE TYPE PROCESSORS ====================
const arrayProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    const { minimum, maximum } = schema._zod.bag;
    if (typeof minimum === "number")
        json.minItems = minimum;
    if (typeof maximum === "number")
        json.maxItems = maximum;
    json.type = "array";
    json.items = process$1(def.element, ctx, { ...params, path: [...params.path, "items"] });
};
const objectProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    json.properties = {};
    const shape = def.shape;
    for (const key in shape) {
        json.properties[key] = process$1(shape[key], ctx, {
            ...params,
            path: [...params.path, "properties", key],
        });
    }
    // required keys
    const allKeys = new Set(Object.keys(shape));
    const requiredKeys = new Set([...allKeys].filter((key) => {
        const v = def.shape[key]._zod;
        if (ctx.io === "input") {
            return v.optin === undefined;
        }
        else {
            return v.optout === undefined;
        }
    }));
    if (requiredKeys.size > 0) {
        json.required = Array.from(requiredKeys);
    }
    // catchall
    if (def.catchall?._zod.def.type === "never") {
        // strict
        json.additionalProperties = false;
    }
    else if (!def.catchall) {
        // regular
        if (ctx.io === "output")
            json.additionalProperties = false;
    }
    else if (def.catchall) {
        json.additionalProperties = process$1(def.catchall, ctx, {
            ...params,
            path: [...params.path, "additionalProperties"],
        });
    }
};
const unionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    // Exclusive unions (inclusive === false) use oneOf (exactly one match) instead of anyOf (one or more matches)
    // This includes both z.xor() and discriminated unions
    const isExclusive = def.inclusive === false;
    const options = def.options.map((x, i) => process$1(x, ctx, {
        ...params,
        path: [...params.path, isExclusive ? "oneOf" : "anyOf", i],
    }));
    if (isExclusive) {
        json.oneOf = options;
    }
    else {
        json.anyOf = options;
    }
};
const intersectionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const a = process$1(def.left, ctx, {
        ...params,
        path: [...params.path, "allOf", 0],
    });
    const b = process$1(def.right, ctx, {
        ...params,
        path: [...params.path, "allOf", 1],
    });
    const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
    const allOf = [
        ...(isSimpleIntersection(a) ? a.allOf : [a]),
        ...(isSimpleIntersection(b) ? b.allOf : [b]),
    ];
    json.allOf = allOf;
};
const recordProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    // For looseRecord with regex patterns, use patternProperties
    // This correctly represents "only validate keys matching the pattern" semantics
    // and composes well with allOf (intersections)
    const keyType = def.keyType;
    const keyBag = keyType._zod.bag;
    const patterns = keyBag?.patterns;
    if (def.mode === "loose" && patterns && patterns.size > 0) {
        // Use patternProperties for looseRecord with regex patterns
        const valueSchema = process$1(def.valueType, ctx, {
            ...params,
            path: [...params.path, "patternProperties", "*"],
        });
        json.patternProperties = {};
        for (const pattern of patterns) {
            json.patternProperties[pattern.source] = valueSchema;
        }
    }
    else {
        // Default behavior: use propertyNames + additionalProperties
        if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
            json.propertyNames = process$1(def.keyType, ctx, {
                ...params,
                path: [...params.path, "propertyNames"],
            });
        }
        json.additionalProperties = process$1(def.valueType, ctx, {
            ...params,
            path: [...params.path, "additionalProperties"],
        });
    }
    // Add required for keys with discrete values (enum, literal, etc.)
    const keyValues = keyType._zod.values;
    if (keyValues) {
        const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
        if (validKeyValues.length > 0) {
            json.required = validKeyValues;
        }
    }
};
const nullableProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const inner = process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    if (ctx.target === "openapi-3.0") {
        seen.ref = def.innerType;
        json.nullable = true;
    }
    else {
        json.anyOf = [inner, { type: "null" }];
    }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    if (ctx.io === "input")
        json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    let catchValue;
    try {
        catchValue = def.catchValue(undefined);
    }
    catch {
        throw new Error("Dynamic catch values are not supported in JSON Schema");
    }
    json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    const innerType = ctx.io === "input" ? (def.in._zod.def.type === "transform" ? def.out : def.in) : def.out;
    process$1(innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};

const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
    $ZodISODateTime.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function datetime(params) {
    return _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
    $ZodISODate.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function date(params) {
    return _isoDate(ZodISODate, params);
}
const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
    $ZodISOTime.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function time(params) {
    return _isoTime(ZodISOTime, params);
}
const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
    $ZodISODuration.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function duration(params) {
    return _isoDuration(ZodISODuration, params);
}

const initializer = (inst, issues) => {
    $ZodError.init(inst, issues);
    inst.name = "ZodError";
    Object.defineProperties(inst, {
        format: {
            value: (mapper) => formatError(inst, mapper),
            // enumerable: false,
        },
        flatten: {
            value: (mapper) => flattenError(inst, mapper),
            // enumerable: false,
        },
        addIssue: {
            value: (issue) => {
                inst.issues.push(issue);
                inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
            },
            // enumerable: false,
        },
        addIssues: {
            value: (issues) => {
                inst.issues.push(...issues);
                inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
            },
            // enumerable: false,
        },
        isEmpty: {
            get() {
                return inst.issues.length === 0;
            },
            // enumerable: false,
        },
    });
    // Object.defineProperty(inst, "isEmpty", {
    //   get() {
    //     return inst.issues.length === 0;
    //   },
    // });
};
const ZodRealError = $constructor("ZodError", initializer, {
    Parent: Error,
});
// /** @deprecated Use `z.core.$ZodErrorMapCtx` instead. */
// export type ErrorMapCtx = core.$ZodErrorMapCtx;

const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
// Codec functions
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
    $ZodType.init(inst, def);
    Object.assign(inst["~standard"], {
        jsonSchema: {
            input: createStandardJSONSchemaMethod(inst, "input"),
            output: createStandardJSONSchemaMethod(inst, "output"),
        },
    });
    inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
    inst.def = def;
    inst.type = def.type;
    Object.defineProperty(inst, "_def", { value: def });
    // base methods
    inst.check = (...checks) => {
        return inst.clone(mergeDefs(def, {
            checks: [
                ...(def.checks ?? []),
                ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch),
            ],
        }), {
            parent: true,
        });
    };
    inst.with = inst.check;
    inst.clone = (def, params) => clone(inst, def, params);
    inst.brand = () => inst;
    inst.register = ((reg, meta) => {
        reg.add(inst, meta);
        return inst;
    });
    // parsing
    inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => safeParse(inst, data, params);
    inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
    inst.spa = inst.safeParseAsync;
    // encoding/decoding
    inst.encode = (data, params) => encode(inst, data, params);
    inst.decode = (data, params) => decode(inst, data, params);
    inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
    inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
    inst.safeEncode = (data, params) => safeEncode(inst, data, params);
    inst.safeDecode = (data, params) => safeDecode(inst, data, params);
    inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
    inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
    // refinements
    inst.refine = (check, params) => inst.check(refine(check, params));
    inst.superRefine = (refinement) => inst.check(superRefine(refinement));
    inst.overwrite = (fn) => inst.check(_overwrite(fn));
    // wrappers
    inst.optional = () => optional(inst);
    inst.exactOptional = () => exactOptional(inst);
    inst.nullable = () => nullable(inst);
    inst.nullish = () => optional(nullable(inst));
    inst.nonoptional = (params) => nonoptional(inst, params);
    inst.array = () => array(inst);
    inst.or = (arg) => union([inst, arg]);
    inst.and = (arg) => intersection(inst, arg);
    inst.transform = (tx) => pipe(inst, transform(tx));
    inst.default = (def) => _default(inst, def);
    inst.prefault = (def) => prefault(inst, def);
    // inst.coalesce = (def, params) => coalesce(inst, def, params);
    inst.catch = (params) => _catch(inst, params);
    inst.pipe = (target) => pipe(inst, target);
    inst.readonly = () => readonly(inst);
    // meta
    inst.describe = (description) => {
        const cl = inst.clone();
        globalRegistry.add(cl, { description });
        return cl;
    };
    Object.defineProperty(inst, "description", {
        get() {
            return globalRegistry.get(inst)?.description;
        },
        configurable: true,
    });
    inst.meta = (...args) => {
        if (args.length === 0) {
            return globalRegistry.get(inst);
        }
        const cl = inst.clone();
        globalRegistry.add(cl, args[0]);
        return cl;
    };
    // helpers
    inst.isOptional = () => inst.safeParse(undefined).success;
    inst.isNullable = () => inst.safeParse(null).success;
    inst.apply = (fn) => fn(inst);
    return inst;
});
/** @internal */
const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
    const bag = inst._zod.bag;
    inst.format = bag.format ?? null;
    inst.minLength = bag.minimum ?? null;
    inst.maxLength = bag.maximum ?? null;
    // validations
    inst.regex = (...args) => inst.check(_regex(...args));
    inst.includes = (...args) => inst.check(_includes(...args));
    inst.startsWith = (...args) => inst.check(_startsWith(...args));
    inst.endsWith = (...args) => inst.check(_endsWith(...args));
    inst.min = (...args) => inst.check(_minLength(...args));
    inst.max = (...args) => inst.check(_maxLength(...args));
    inst.length = (...args) => inst.check(_length(...args));
    inst.nonempty = (...args) => inst.check(_minLength(1, ...args));
    inst.lowercase = (params) => inst.check(_lowercase(params));
    inst.uppercase = (params) => inst.check(_uppercase(params));
    // transforms
    inst.trim = () => inst.check(_trim());
    inst.normalize = (...args) => inst.check(_normalize(...args));
    inst.toLowerCase = () => inst.check(_toLowerCase());
    inst.toUpperCase = () => inst.check(_toUpperCase());
    inst.slugify = () => inst.check(_slugify());
});
const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    _ZodString.init(inst, def);
    inst.email = (params) => inst.check(_email(ZodEmail, params));
    inst.url = (params) => inst.check(_url(ZodURL, params));
    inst.jwt = (params) => inst.check(_jwt(ZodJWT, params));
    inst.emoji = (params) => inst.check(_emoji(ZodEmoji, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.uuid = (params) => inst.check(_uuid(ZodUUID, params));
    inst.uuidv4 = (params) => inst.check(_uuidv4(ZodUUID, params));
    inst.uuidv6 = (params) => inst.check(_uuidv6(ZodUUID, params));
    inst.uuidv7 = (params) => inst.check(_uuidv7(ZodUUID, params));
    inst.nanoid = (params) => inst.check(_nanoid(ZodNanoID, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.cuid = (params) => inst.check(_cuid(ZodCUID, params));
    inst.cuid2 = (params) => inst.check(_cuid2(ZodCUID2, params));
    inst.ulid = (params) => inst.check(_ulid(ZodULID, params));
    inst.base64 = (params) => inst.check(_base64(ZodBase64, params));
    inst.base64url = (params) => inst.check(_base64url(ZodBase64URL, params));
    inst.xid = (params) => inst.check(_xid(ZodXID, params));
    inst.ksuid = (params) => inst.check(_ksuid(ZodKSUID, params));
    inst.ipv4 = (params) => inst.check(_ipv4(ZodIPv4, params));
    inst.ipv6 = (params) => inst.check(_ipv6(ZodIPv6, params));
    inst.cidrv4 = (params) => inst.check(_cidrv4(ZodCIDRv4, params));
    inst.cidrv6 = (params) => inst.check(_cidrv6(ZodCIDRv6, params));
    inst.e164 = (params) => inst.check(_e164(ZodE164, params));
    // iso
    inst.datetime = (params) => inst.check(datetime(params));
    inst.date = (params) => inst.check(date(params));
    inst.time = (params) => inst.check(time(params));
    inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
    return _string(ZodString, params);
}
const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
});
const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
    $ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
    $ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json);
    inst.gt = (value, params) => inst.check(_gt(value, params));
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.lt = (value, params) => inst.check(_lt(value, params));
    inst.lte = (value, params) => inst.check(_lte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    inst.int = (params) => inst.check(int(params));
    inst.safe = (params) => inst.check(int(params));
    inst.positive = (params) => inst.check(_gt(0, params));
    inst.nonnegative = (params) => inst.check(_gte(0, params));
    inst.negative = (params) => inst.check(_lt(0, params));
    inst.nonpositive = (params) => inst.check(_lte(0, params));
    inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
    inst.step = (value, params) => inst.check(_multipleOf(value, params));
    // inst.finite = (params) => inst.check(core.finite(params));
    inst.finite = () => inst;
    const bag = inst._zod.bag;
    inst.minValue =
        Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
    inst.maxValue =
        Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
    inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
    inst.isFinite = true;
    inst.format = bag.format ?? null;
});
function number(params) {
    return _number(ZodNumber, params);
}
const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
    $ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
});
function int(params) {
    return _int(ZodNumberFormat, params);
}
const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json);
});
function boolean(params) {
    return _boolean(ZodBoolean, params);
}
const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
    $ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
});
function unknown() {
    return _unknown(ZodUnknown);
}
const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
    $ZodNever.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
});
function never(params) {
    return _never(ZodNever, params);
}
const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
    $ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
    inst.element = def.element;
    inst.min = (minLength, params) => inst.check(_minLength(minLength, params));
    inst.nonempty = (params) => inst.check(_minLength(1, params));
    inst.max = (maxLength, params) => inst.check(_maxLength(maxLength, params));
    inst.length = (len, params) => inst.check(_length(len, params));
    inst.unwrap = () => inst.element;
});
function array(element, params) {
    return _array(ZodArray, element, params);
}
const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
    $ZodObjectJIT.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
    defineLazy(inst, "shape", () => {
        return def.shape;
    });
    inst.keyof = () => _enum(Object.keys(inst._zod.def.shape));
    inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall: catchall });
    inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
    inst.strip = () => inst.clone({ ...inst._zod.def, catchall: undefined });
    inst.extend = (incoming) => {
        return extend(inst, incoming);
    };
    inst.safeExtend = (incoming) => {
        return safeExtend(inst, incoming);
    };
    inst.merge = (other) => merge(inst, other);
    inst.pick = (mask) => pick(inst, mask);
    inst.omit = (mask) => omit(inst, mask);
    inst.partial = (...args) => partial(ZodOptional, inst, args[0]);
    inst.required = (...args) => required(ZodNonOptional, inst, args[0]);
});
function object(shape, params) {
    const def = {
        type: "object",
        shape: shape ?? {},
        ...normalizeParams(params),
    };
    return new ZodObject(def);
}
const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
    inst.options = def.options;
});
function union(options, params) {
    return new ZodUnion({
        type: "union",
        options: options,
        ...normalizeParams(params),
    });
}
const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
    $ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
    return new ZodIntersection({
        type: "intersection",
        left: left,
        right: right,
    });
}
const ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
    $ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
    return new ZodRecord({
        type: "record",
        keyType,
        valueType: valueType,
        ...normalizeParams(params),
    });
}
const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
    $ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
    inst.enum = def.entries;
    inst.options = Object.values(def.entries);
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
        const newEntries = {};
        for (const value of values) {
            if (keys.has(value)) {
                newEntries[value] = def.entries[value];
            }
            else
                throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
            ...def,
            checks: [],
            ...normalizeParams(params),
            entries: newEntries,
        });
    };
    inst.exclude = (values, params) => {
        const newEntries = { ...def.entries };
        for (const value of values) {
            if (keys.has(value)) {
                delete newEntries[value];
            }
            else
                throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
            ...def,
            checks: [],
            ...normalizeParams(params),
            entries: newEntries,
        });
    };
});
function _enum(values, params) {
    const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
    return new ZodEnum({
        type: "enum",
        entries,
        ...normalizeParams(params),
    });
}
const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
    $ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx);
    inst._zod.parse = (payload, _ctx) => {
        if (_ctx.direction === "backward") {
            throw new $ZodEncodeError(inst.constructor.name);
        }
        payload.addIssue = (issue$1) => {
            if (typeof issue$1 === "string") {
                payload.issues.push(issue(issue$1, payload.value, def));
            }
            else {
                // for Zod 3 backwards compatibility
                const _issue = issue$1;
                if (_issue.fatal)
                    _issue.continue = false;
                _issue.code ?? (_issue.code = "custom");
                _issue.input ?? (_issue.input = payload.value);
                _issue.inst ?? (_issue.inst = inst);
                // _issue.continue ??= true;
                payload.issues.push(issue(_issue));
            }
        };
        const output = def.transform(payload.value, payload);
        if (output instanceof Promise) {
            return output.then((output) => {
                payload.value = output;
                return payload;
            });
        }
        payload.value = output;
        return payload;
    };
});
function transform(fn) {
    return new ZodTransform({
        type: "transform",
        transform: fn,
    });
}
const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
    return new ZodOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
    $ZodExactOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
    return new ZodExactOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
    $ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
    return new ZodNullable({
        type: "nullable",
        innerType: innerType,
    });
}
const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
    $ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
    return new ZodDefault({
        type: "default",
        innerType: innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
        },
    });
}
const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
    $ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
    return new ZodPrefault({
        type: "prefault",
        innerType: innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
        },
    });
}
const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
    $ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
    return new ZodNonOptional({
        type: "nonoptional",
        innerType: innerType,
        ...normalizeParams(params),
    });
}
const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
    $ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
    return new ZodCatch({
        type: "catch",
        innerType: innerType,
        catchValue: (typeof catchValue === "function" ? catchValue : () => catchValue),
    });
}
const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
    $ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
    inst.in = def.in;
    inst.out = def.out;
});
function pipe(in_, out) {
    return new ZodPipe({
        type: "pipe",
        in: in_,
        out: out,
        // ...util.normalizeParams(params),
    });
}
const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
    $ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
    return new ZodReadonly({
        type: "readonly",
        innerType: innerType,
    });
}
const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
    $ZodCustom.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx);
});
function refine(fn, _params = {}) {
    return _refine(ZodCustom, fn, _params);
}
// superRefine
function superRefine(fn) {
    return _superRefine(fn);
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/**
 * Supported config file names in priority order.
 * .mjs is preferred for flexibility (dynamic config, environment-based logic).
 * .jsonc is supported for simpler static configurations.
 */
const CONFIG_FILE_NAMES = ['mm-tc.config.mjs', 'mm-tc.config.jsonc'];
/**
 * Define a testcontainers configuration with full type inference.
 * Recommended for .mjs config files.
 *
 * @example
 * // mm-tc.config.mjs
 * import {defineConfig} from '@mattermost/testcontainers';
 *
 * export default defineConfig({
 *     server: {
 *         edition: 'enterprise',
 *         tag: 'release-11.4',
 *         ha: false,
 *         subpath: false,
 *     },
 *     dependencies: ['postgres', 'inbucket', 'minio'],
 * });
 *
 * @param config The configuration object
 * @returns The same configuration (for type inference)
 */
function defineConfig(config) {
    return config;
}
/**
 * Base image names for Mattermost editions.
 */
const MATTERMOST_EDITION_IMAGES = {
    enterprise: 'mattermostdevelopment/mattermost-enterprise-edition',
    fips: 'mattermostdevelopment/mattermost-enterprise-fips-edition',
    team: 'mattermostdevelopment/mattermost-team-edition',
};
/**
 * Default server tag.
 */
const DEFAULT_SERVER_TAG = 'master';
/**
 * Default image max age in hours.
 */
const DEFAULT_IMAGE_MAX_AGE_HOURS = 24;
/**
 * Default output directory for all testcontainers artifacts.
 */
const DEFAULT_OUTPUT_DIR = '.tc.out';
/**
 * Default admin credentials.
 */
const DEFAULT_ADMIN = {
    username: 'sysadmin',
    password: 'Sys@dmin-sample1',
};
/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
    server: {
        edition: 'enterprise',
        tag: DEFAULT_SERVER_TAG,
        image: `${MATTERMOST_EDITION_IMAGES.enterprise}:${DEFAULT_SERVER_TAG}`,
        imageMaxAgeHours: DEFAULT_IMAGE_MAX_AGE_HOURS,
        ha: false,
        subpath: false,
        entry: false,
    },
    dependencies: ['postgres', 'inbucket'],
    images: {
        postgres: DEFAULT_IMAGES.postgres,
        inbucket: DEFAULT_IMAGES.inbucket,
        openldap: DEFAULT_IMAGES.openldap,
        keycloak: DEFAULT_IMAGES.keycloak,
        minio: DEFAULT_IMAGES.minio,
        elasticsearch: DEFAULT_IMAGES.elasticsearch,
        opensearch: DEFAULT_IMAGES.opensearch,
        redis: DEFAULT_IMAGES.redis,
        dejavu: DEFAULT_IMAGES.dejavu,
        prometheus: DEFAULT_IMAGES.prometheus,
        grafana: DEFAULT_IMAGES.grafana,
        loki: DEFAULT_IMAGES.loki,
        promtail: DEFAULT_IMAGES.promtail,
        nginx: DEFAULT_IMAGES.nginx,
    },
    outputDir: DEFAULT_OUTPUT_DIR,
};
let cachedConfigSchema = null;
function getConfigSchema() {
    if (cachedConfigSchema) {
        return cachedConfigSchema;
    }
    const MattermostEditionSchema = _enum(['enterprise', 'fips', 'team']);
    const ServiceEnvironmentSchema = _enum(['test', 'production', 'dev']);
    const AdminConfigSchema = object({
        username: string().min(1, 'admin.username must be non-empty'),
        password: string().optional(),
    })
        .strict();
    const ServerConfigSchema = object({
        edition: MattermostEditionSchema.optional(),
        entry: boolean().optional(),
        tag: string().min(1).optional(),
        serviceEnvironment: ServiceEnvironmentSchema.optional(),
        env: record(string(), string()).optional(),
        config: record(string(), unknown()).optional(),
        imageMaxAgeHours: number().nonnegative().optional(),
        ha: boolean().optional(),
        subpath: boolean().optional(),
    })
        .strict();
    const ImagesSchema = object({
        postgres: string(),
        inbucket: string(),
        openldap: string(),
        keycloak: string(),
        minio: string(),
        elasticsearch: string(),
        opensearch: string(),
        redis: string(),
        dejavu: string(),
        prometheus: string(),
        grafana: string(),
        loki: string(),
        promtail: string(),
        nginx: string(),
    })
        .partial()
        .strict();
    cachedConfigSchema = object({
        server: ServerConfigSchema.optional(),
        dependencies: array(string()).optional(),
        images: ImagesSchema.optional(),
        outputDir: string().optional(),
        admin: AdminConfigSchema.optional(),
    })
        .strict();
    return cachedConfigSchema;
}
function formatZodError(error) {
    return error.issues
        .map((issue) => {
        const p = issue.path.length ? issue.path.join('.') : '<root>';
        return `- ${p}: ${issue.message}`;
    })
        .join('\n');
}
function validateUserConfigOrThrow(config, sourcePath) {
    const schema = getConfigSchema();
    const parsed = schema.safeParse(config);
    if (!parsed.success) {
        const timestamp = new Date().toISOString();
        const details = formatZodError(parsed.error);
        const msg = `[${timestamp}] [tc] Invalid testcontainers config: ${sourcePath}\n` +
            `${details}\n` +
            'Fix the config file or remove it to fall back to defaults.';
        throw new Error(msg);
    }
    return parsed.data;
}
/**
 * Helper to parse boolean from environment variable.
 */
function parseBoolEnv(value) {
    if (value === undefined)
        return undefined;
    return value.toLowerCase() === 'true';
}
/**
 * Resolve configuration by merging (in priority order, highest to lowest):
 * 1. Environment variables (highest priority)
 * 2. User-provided config (from config file)
 * 3. Default values (lowest priority)
 *
 * Note: CLI flags are applied separately by the CLI and have the highest priority.
 *
 * @param userConfig Optional user configuration to merge with defaults
 * @returns Fully resolved configuration
 */
function resolveConfig(userConfig) {
    // Start with defaults
    const resolved = {
        ...DEFAULT_CONFIG,
        server: { ...DEFAULT_CONFIG.server },
        images: { ...DEFAULT_CONFIG.images },
    };
    // ============================================
    // Layer 1: Apply config file values (lowest priority after defaults)
    // ============================================
    if (userConfig) {
        // Server config
        if (userConfig.server) {
            if (userConfig.server.edition) {
                resolved.server.edition = userConfig.server.edition;
            }
            if (userConfig.server.tag) {
                resolved.server.tag = userConfig.server.tag;
            }
            if (userConfig.server.imageMaxAgeHours !== undefined) {
                resolved.server.imageMaxAgeHours = userConfig.server.imageMaxAgeHours;
            }
            if (userConfig.server.serviceEnvironment) {
                resolved.server.serviceEnvironment = userConfig.server.serviceEnvironment;
            }
            if (userConfig.server.env) {
                resolved.server.env = { ...userConfig.server.env };
            }
            if (userConfig.server.config) {
                resolved.server.config = { ...userConfig.server.config };
            }
            if (userConfig.server.ha !== undefined) {
                resolved.server.ha = userConfig.server.ha;
            }
            if (userConfig.server.subpath !== undefined) {
                resolved.server.subpath = userConfig.server.subpath;
            }
            if (userConfig.server.entry !== undefined) {
                resolved.server.entry = userConfig.server.entry;
            }
        }
        // Dependencies
        if (userConfig.dependencies) {
            resolved.dependencies = userConfig.dependencies;
        }
        // Images
        if (userConfig.images) {
            resolved.images = { ...resolved.images, ...userConfig.images };
        }
        // Output directory
        if (userConfig.outputDir) {
            resolved.outputDir = userConfig.outputDir;
        }
        // Admin config
        if (userConfig.admin) {
            resolved.admin = {
                username: userConfig.admin.username,
                password: userConfig.admin.password || DEFAULT_ADMIN.password,
                email: `${userConfig.admin.username}@sample.mattermost.com`,
            };
        }
    }
    // ============================================
    // Layer 2: Apply environment variables (higher priority than config file)
    // ============================================
    // Server edition
    if (process.env.TC_EDITION) {
        const edition = process.env.TC_EDITION.toLowerCase();
        if (edition === 'enterprise' || edition === 'fips' || edition === 'team') {
            resolved.server.edition = edition;
        }
    }
    // Server tag
    if (process.env.TC_SERVER_TAG) {
        resolved.server.tag = process.env.TC_SERVER_TAG;
    }
    // Image max age
    if (process.env.TC_IMAGE_MAX_AGE_HOURS) {
        resolved.server.imageMaxAgeHours = parseFloat(process.env.TC_IMAGE_MAX_AGE_HOURS);
    }
    // Service environment (MM_SERVICEENVIRONMENT)
    if (process.env.MM_SERVICEENVIRONMENT) {
        const env = process.env.MM_SERVICEENVIRONMENT.toLowerCase();
        if (env === 'test' || env === 'production' || env === 'dev') {
            resolved.server.serviceEnvironment = env;
        }
    }
    // Dependencies (accepts comma-separated, space-separated, or both)
    if (process.env.TC_DEPENDENCIES) {
        resolved.dependencies = process.env.TC_DEPENDENCIES.split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    // Output directory
    if (process.env.TC_OUTPUT_DIR) {
        resolved.outputDir = process.env.TC_OUTPUT_DIR;
    }
    // HA mode
    const haEnv = parseBoolEnv(process.env.TC_HA);
    if (haEnv !== undefined) {
        resolved.server.ha = haEnv;
    }
    // Subpath mode
    const subpathEnv = parseBoolEnv(process.env.TC_SUBPATH);
    if (subpathEnv !== undefined) {
        resolved.server.subpath = subpathEnv;
    }
    // Entry tier mode
    const entryEnv = parseBoolEnv(process.env.TC_ENTRY);
    if (entryEnv !== undefined) {
        resolved.server.entry = entryEnv;
    }
    // Admin config from environment
    if (process.env.TC_ADMIN_USERNAME) {
        const username = process.env.TC_ADMIN_USERNAME;
        resolved.admin = {
            username,
            password: process.env.TC_ADMIN_PASSWORD || resolved.admin?.password || DEFAULT_ADMIN.password,
            email: `${username}@sample.mattermost.com`,
        };
    }
    else if (resolved.admin) {
        // Update existing admin config with env overrides
        if (process.env.TC_ADMIN_PASSWORD) {
            resolved.admin.password = process.env.TC_ADMIN_PASSWORD;
        }
        // Re-derive email from username in case username changed
        resolved.admin.email = `${resolved.admin.username}@sample.mattermost.com`;
    }
    // Apply image overrides from environment
    const imageKeys = Object.keys(resolved.images);
    for (const key of imageKeys) {
        const envVar = IMAGE_ENV_VARS[key];
        if (envVar && process.env[envVar]) {
            resolved.images[key] = process.env[envVar];
        }
    }
    // ============================================
    // Validation and derived values
    // ============================================
    // Validate --subpath cannot be used with --ha (they're mutually exclusive in CLI)
    // Note: This is enforced at CLI level, not here, to allow programmatic use
    // Build the full server image from edition and tag (can be overridden by TC_SERVER_IMAGE)
    resolved.server.image = `${MATTERMOST_EDITION_IMAGES[resolved.server.edition]}:${resolved.server.tag}`;
    // Allow full image override via TC_SERVER_IMAGE (highest priority for image)
    if (process.env.TC_SERVER_IMAGE) {
        resolved.server.image = process.env.TC_SERVER_IMAGE;
    }
    return resolved;
}
/**
 * Load a config file based on its extension.
 * Supports .mjs (ES module) and .jsonc (JSON with comments).
 *
 * @param configPath Path to the config file
 * @returns The config or undefined if loading fails
 */
async function loadConfigFile(configPath) {
    try {
        if (configPath.endsWith('.jsonc')) {
            const content = fs__namespace.readFileSync(configPath, 'utf-8');
            return parse$1(content);
        }
        // Default: treat as ES module (.mjs)
        const module = await import(url.pathToFileURL(configPath).href);
        return module.default || module;
    }
    catch {
        return undefined;
    }
}
/**
 * Find a config file in the given directory.
 * Searches for supported config file names in priority order.
 *
 * @param dir Directory to search in
 * @returns Path to config file if found, undefined otherwise
 */
function findConfigFile(dir) {
    for (const fileName of CONFIG_FILE_NAMES) {
        const filePath = path__namespace.join(dir, fileName);
        if (fs__namespace.existsSync(filePath)) {
            return filePath;
        }
    }
    return undefined;
}
/**
 * Find the git repository root by walking up until a directory contains a .git entry.
 * Returns undefined if no git root is found before reaching the filesystem root.
 */
function findGitRoot(startDir) {
    let currentDir = startDir;
    // Guard: if startDir doesn't exist (edge case), bail out
    if (!fs__namespace.existsSync(currentDir)) {
        return undefined;
    }
    // Walk up to filesystem root
    // Stop when .git exists (file or directory)
    // If not found, return undefined
    while (true) {
        const gitPath = path__namespace.join(currentDir, '.git');
        if (fs__namespace.existsSync(gitPath)) {
            return currentDir;
        }
        const parentDir = path__namespace.dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
}
/**
 * Discover and load the testcontainers configuration.
 *
 * If configFile is provided, loads that specific file.
 * Otherwise, searches for a config file in the following locations (in order):
 * 1. Path provided via TC_CONFIG environment variable
 * 2. Current working directory
 * 3. Parent directories up to the repository root (detected via .git), otherwise up to filesystem root
 *
 * If no config file is found, returns resolved default configuration.
 *
 * @param options Configuration options (configFile or searchDir)
 * @returns Resolved configuration
 *
 * @example
 * // Automatically discovers mm-tc.config.mjs or mm-tc.config.jsonc
 * const config = await discoverAndLoadConfig();
 *
 * @example
 * // Load a specific config file
 * const config = await discoverAndLoadConfig({ configFile: './custom-config.mjs' });
 */
async function discoverAndLoadConfig(options) {
    let configPath;
    // If explicit config file is provided, use it directly
    if (options?.configFile) {
        configPath = path__namespace.resolve(options.configFile);
        if (!fs__namespace.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }
    }
    else if (process.env.TC_CONFIG) {
        // Environment override for config path
        configPath = path__namespace.resolve(process.env.TC_CONFIG);
        if (!fs__namespace.existsSync(configPath)) {
            throw new Error(`Config file not found from TC_CONFIG: ${configPath}`);
        }
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] Using config from TC_CONFIG: ${configPath}\n`);
    }
    else {
        // Auto-discover config file
        const startDir = options?.searchDir || process.cwd();
        let currentDir = startDir;
        const gitRoot = findGitRoot(startDir);
        // Search current and parent directories, stopping at git root (if found) or filesystem root
        while (true) {
            configPath = findConfigFile(currentDir);
            if (configPath) {
                break;
            }
            // Stop at git root boundary if detected
            if (gitRoot && currentDir === gitRoot) {
                break;
            }
            const parentDir = path__namespace.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached root
            }
            currentDir = parentDir;
        }
    }
    let userConfig;
    if (configPath) {
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] Found config: ${configPath}\n`);
        userConfig = await loadConfigFile(configPath);
        if (!userConfig) {
            throw new Error(`Failed to load config: ${configPath}`);
        }
        // Validate schema for user-provided config
        userConfig = validateUserConfigOrThrow(userConfig, configPath);
    }
    else {
        const timestamp = new Date().toISOString();
        process.stderr.write(`[${timestamp}] [tc] No config found. Using defaults (env overrides may still apply).\n`);
    }
    return resolveConfig(userConfig);
}

exports.DEFAULT_ADMIN = DEFAULT_ADMIN;
exports.DEFAULT_OUTPUT_DIR = DEFAULT_OUTPUT_DIR;
exports.MATTERMOST_EDITION_IMAGES = MATTERMOST_EDITION_IMAGES;
exports.MattermostTestEnvironment = MattermostTestEnvironment;
exports.defineConfig = defineConfig;
exports.discoverAndLoadConfig = discoverAndLoadConfig;
exports.log = log;
exports.setOutputDir = setOutputDir;
exports.writeDockerInfo = writeDockerInfo;
exports.writeEnvFile = writeEnvFile;
exports.writeKeycloakCertificate = writeKeycloakCertificate;
exports.writeKeycloakSetup = writeKeycloakSetup;
exports.writeOpenLdapSetup = writeOpenLdapSetup;
exports.writeServerConfig = writeServerConfig;
//# sourceMappingURL=config.js.map
