// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {makeClient} from './client';
export {PlaywrightClient4} from './playwright_client';
export {createRandomChannel} from './channel';
export {getOnPremServerConfig, mergeWithOnPremServerConfig} from './default_config';
export {initSetup, getAdminClient} from './init';
export {createRandomPost} from './post';
export {createNewTeam, createRandomTeam} from './team';
export {createNewUserProfile, createRandomUser, getDefaultAdminUser, isOutsideRemoteUserHour} from './user';
export {extractEmailLink, getRecentEmail} from './email';
export type {InbucketEmail} from './email';
export {
    enableAIBridgeTestMode,
    configureAIBridgeMock,
    getAIBridgeMock,
    resetAIBridgeMock,
    createMockAIAgent,
    rewriteCompletion,
    recapCompletion,
} from './ai_bridge';
export {
    createUserWithAttributes,
    enableABAC,
    disableABAC,
    navigateToABACPage,
    navigateToPermissionPoliciesPage,
    navigateToAttributeBasedAccessPage,
    createBasicPolicy,
    createAdvancedPolicy,
    editPolicy,
    deletePolicy,
    runSyncJob,
    verifyUserInChannel,
    verifyUserNotInChannel,
    updateUserAttributes,
} from './abac_helpers';
export {installAndEnablePlugin, isPluginActive, getPluginStatus} from './plugin';
export {isWebhookTestServerReachable, setupWebhookTestServer} from './webhook_server';
export {
    generateLdapUser,
    createLdapUser,
    updateLdapUser,
    deleteLdapUser,
    ldapServerConfig,
    ensureOpenldap,
} from './openldap';
export type {LdapUser} from './openldap';
export {createKeycloakUser, deleteKeycloakUser, samlServerConfig, ensureKeycloak} from './keycloak';
export type {KeycloakUser} from './keycloak';
export {listMinioObjectKeys, ensureMinio} from './minio';
export {elasticsearchServerConfig, ensureElasticsearch} from './elasticsearch';
export {opensearchServerConfig, ensureOpensearch} from './opensearch';
export {ensureAzurite, listAzuriteBlobNames} from './azurite';
export {ensureLocalFile, listLocalStorageFiles} from './filestore';
export {ensurePostgresSearch} from './postgres_search';
export {ensureFeatureFlag} from './feature_flags';
export {runMmctl, ensureMmctl} from './mmctl';
export type {MmctlResult} from './mmctl';
export {upgradeServerImage} from './version';
