// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {test, expect, PlaywrightExtended} from './test_fixture';

// The generated page objects (src/ui/generated, from surface/webapp.surface.json) and their runtime. Specs reach page
// objects through `App`; every generated class is under `generated`.
export {Api, App, Msg} from './ui/generated';
export {
    clearBannerText,
    closeChannelSettings,
    insertBannerToken,
    removeBannerToken,
    typeBannerText,
    openChannelSettingsConfigurationTab,
    openChannelSettingsInfoTab,
    type ChannelSettings,
} from './ui/flows/channel_settings';
export * from './ui/generated/sets';
export * as generated from './ui/generated';
export {
    ButtonDriver,
    CheckboxDriver,
    ClickableDriver,
    ComboboxDriver,
    ContainerDriver,
    DestinationError,
    Driver,
    FileInputDriver,
    KeyedList,
    LinkDriver,
    MenuitemCheckDriver,
    MenuitemDriver,
    OptionDriver,
    RadioDriver,
    RadiogroupDriver,
    RUNTIME_API,
    Scope,
    SettleError,
    SurfacePage,
    SwitchDriver,
    TabDriver,
    TextboxDriver,
    TextDriver,
    TogglebuttonDriver,
    VERBS,
    apiOp,
    buildPath,
    defineApi,
    formatMessage,
    keyOf,
    keyOfElement,
    keyOfTestId,
    msg,
    pluginSurfaces,
    registerPluginSurface,
    settle,
    testIdSelector,
    waitForApi,
    withElement,
    type AnyApiOp,
    type AnyDriver,
    type ApiOp,
    type ApiWaitOptions,
    type BodyOf,
    type ClickOptions,
    type ContentFilter,
    type Destination,
    type RootedScope,
    type DriverFor,
    type Keyed,
    type KeyOf,
    type Message,
    type MessageParamsOf,
    type Meta,
    type NotRendered,
    type ParamsOf,
    type Part,
    type PartBinding,
    type PathParamsOf,
    type Plugins,
    type QueryFilter,
    type ReadyPage,
    type Role,
    type RuntimeApiCheck,
    type SettleOptions,
    type ToOptions,
    type Verb,
} from './aria';
export type {ExtendedFixtures} from './test_fixture';
export {testConfig, TESTCONTAINERS_SERVICE_NAMES, SERVER_DEPLOYMENTS} from './test_config';
export type {TestContainersServiceName, ServerDeployment} from './test_config';
export {
    assertUpgradeFromFreshStart,
    assertUpgradeToRequiresPriorFromRun,
    exportUpgradePathProjectSelection,
    getUpgradeFromServerImage,
    getUpgradeToServerImage,
    isUpgradeFromProjectSelected,
    isUpgradePathProjectSelected,
    isUpgradeToPhaseProjectSelected,
    logUpgradeFromServerImage,
    logUpgradeToServerImage,
    UPGRADE_FROM_SERVER_IMAGE_ENV,
} from './upgrade_env';
export {baseGlobalSetup} from './global_setup';
export {clearGlobalSetupFailure, readGlobalSetupFailure, recordGlobalSetupFailure} from './global_setup_failure';
export {TestBrowser} from './browser_context';
export {assetPath, getBlobFromAsset, getFileFromAsset, getFileData, getBlobData} from './file';
export {setupFileServer} from './file_server';
export {decomposeKorean, koreanTestPhrase, typeHangulCharacterWithIme, typeHangulWithIme} from './ime';
export {type SizeObservation, type SizeWatcher, watchElementSize} from './layout_shift';
export {duration, getRandomId, wait, newTestPassword} from './util';
export {
    DefaultChannel,
    LicenseSkus,
    appsPluginId,
    callsPluginId,
    demoPluginId,
    demoPluginUrl,
    playbooksPluginId,
} from './constant';

export {
    getAdminClient,
    getRecentEmail,
    extractEmailLink,
    isWebhookTestServerReachable,
    setupWebhookTestServer,
    PlaywrightClient4,
    generateLdapUser,
    createLdapUser,
    updateLdapUser,
    deleteLdapUser,
    ldapServerConfig,
    ensureOpenldap,
    createKeycloakUser,
    deleteKeycloakUser,
    listMinioObjectKeys,
    ensureMinio,
    samlServerConfig,
    ensureKeycloak,
    elasticsearchServerConfig,
    opensearchServerConfig,
    ensureElasticsearch,
    ensureOpensearch,
    ensureAzurite,
    listAzuriteBlobNames,
    ensureLocalFile,
    listMattermostDataFiles,
    ensurePostgresSearch,
    ensureFeatureFlag,
    fileIdsOf,
    ignoreMissing,
    runCleanups,
    requireSubpathServer,
    runMmctl,
    ensureMmctl,
    upgradeServerImage,
    saveUpgradePhaseLogs,
    ensureDemoPlugin,
    installAndEnablePlugin,
    getPluginStatus,
    isPluginActive,
    buildWebappPluginBundle,
    ensureTestWebappPlugins,
    postAuthTestPluginId,
    preAuthTestPluginId,
    removeTestWebappPlugins,
    testWebappPluginMarkerTestId,
    testWebappPluginRoute,
} from './server';
export type {
    EnsureDemoPluginOptions,
    WebappPluginBundleOptions,
    InbucketEmail,
    LdapUser,
    KeycloakUser,
    MmctlResult,
    UpgradeLogPhase,
} from './server';

export {startStack, stopStack, withStackLock} from './containers';

export {setWysiwygUserPreference, WYSIWYG_PREF_CATEGORY, WYSIWYG_PREF_NAME} from './wysiwyg_helpers';

export {TestArgs, ScreenshotOptions} from './types';

export {
    enableAutotranslationConfig,
    disableAutotranslationConfig,
    enableChannelAutotranslation,
    disableChannelAutotranslation,
    setUserChannelAutotranslation,
    setMockSourceLanguage,
} from './autotranslation_helpers';
export type {EnableAutotranslationOptions} from './autotranslation_helpers';
export {
    hasAutotranslationLicense,
    hasEnterpriseLicense,
    hasSharedChannelsLicense,
    hasCustomPermissionsSchemesLicense,
    licenseTier,
} from './license_helpers';

// ABAC (Attribute-Based Access Control) helpers
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
    deleteAccessControlPolicyIfPresent,
    deleteAccessControlPoliciesNamed,
} from './server';
export * from './flows';
export {pasteHtml} from './paste';
