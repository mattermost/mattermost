// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Single source of truth for the fixed values every container/helper needs to agree on.
// Kept separate from test_config.ts because these are not overridable — they're either
// Testcontainers network aliases (only meaningful inside the Testcontainers network) or
// fixed test-only credentials for a throwaway local service.

export const POSTGRES_ALIAS = 'postgres';
export const POSTGRES_PORT = 5432;
export const POSTGRES_DB = 'mattermost_test';
export const POSTGRES_USER = 'mmuser';
export const POSTGRES_PASSWORD = 'mostest_password';

export const INBUCKET_ALIAS = 'inbucket';
export const INBUCKET_WEB_PORT = 9001;
export const INBUCKET_SMTP_PORT = 10025;
export const INBUCKET_POP3_PORT = 10110;

export const MATTERMOST_ALIAS = 'server';
export const MATTERMOST_PORT = 8065;

// Interactive-message/dialog callback sidecar shared with Cypress. Always started, like
// postgres/inbucket — not gated behind testcontainersServices.
export const WEBHOOK_ALIAS = 'webhook';
export const WEBHOOK_PORT = 3000;

export const OPENLDAP_ALIAS = 'openldap';
export const OPENLDAP_PORT = 389;
export const OPENLDAP_ADMIN_DN = 'cn=admin,dc=mm,dc=test,dc=com';
export const OPENLDAP_ADMIN_PASSWORD = 'mostest_password';
export const OPENLDAP_BASE_DN = 'dc=mm,dc=test,dc=com';

export const KEYCLOAK_ALIAS = 'keycloak';
export const KEYCLOAK_PORT = 8080;
export const KEYCLOAK_REALM = 'mattermost';
export const KEYCLOAK_ADMIN_USER = 'admin';
export const KEYCLOAK_ADMIN_PASSWORD = 'admin';

export const ELASTICSEARCH_ALIAS = 'elasticsearch';
export const ELASTICSEARCH_PORT = 9200;

export const MINIO_ALIAS = 'minio';
export const MINIO_PORT = 9000;
export const MINIO_ACCESS_KEY = 'minioaccesskey';
export const MINIO_SECRET_KEY = 'miniosecretkey';
export const MINIO_BUCKET = 'mattermost-test';

// Alternative to Minio for blob storage.
export const AZURITE_ALIAS = 'azurite';
export const AZURITE_BLOB_PORT = 10000;
// Azurite's well-known default emulator account — published by Microsoft's own docs, not a secret.
export const AZURITE_ACCOUNT_NAME = 'devstoreaccount1';
export const AZURITE_ACCOUNT_KEY =
    'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
export const AZURITE_CONTAINER = 'mattermost-test';

// Alternative to Elasticsearch for search.
export const OPENSEARCH_ALIAS = 'opensearch';
export const OPENSEARCH_PORT = 9201;
export const OPENSEARCH_ADMIN_PASSWORD = 'Test@dmin_123';

// Applied to every container this module starts, so `npm run testcontainers:down` can find and
// remove them from a fresh process — the in-memory `started` state in stack.ts only exists in
// the process that created it.
export const TESTCONTAINERS_LABEL_KEY = 'mm-playwright-testcontainers';
export const TESTCONTAINERS_LABEL_VALUE = 'true';
export const TESTCONTAINERS_LABELS = {[TESTCONTAINERS_LABEL_KEY]: TESTCONTAINERS_LABEL_VALUE};
