// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {makeClient} from './client';
export {PlaywrightClient4} from './playwright_client';
export {createRandomChannel} from './channel';
export {getOnPremServerConfig, mergeWithOnPremServerConfig, getOnPremServerConfigPatch} from './default_config';
export {initSetup, getAdminClient} from './init';
export {createRandomPost} from './post';
export {createNewTeam, createRandomTeam} from './team';
export {createNewUserProfile, createRandomUser, getDefaultAdminUser, isOutsideRemoteUserHour} from './user';
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
export {
    defaultEnabledPluginIds,
    disableUnexpectedPlugins,
    installAndEnablePlugin,
    isPluginActive,
    getPluginStatus,
} from './plugin';
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
export {ensureLocalFile, listMattermostDataFiles} from './filestore';
export {ensurePostgresSearch} from './postgres_search';
export {ensureFeatureFlag} from './feature_flags';
export {runMmctl, runMmctlLocal, ensureMmctl} from './mmctl';
export type {MmctlResult} from './mmctl';
export {upgradeServerImage} from './version';
export {saveUpgradePhaseLogs} from './upgrade_logs';
export type {UpgradeLogPhase} from './upgrade_logs';
