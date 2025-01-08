// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ClientConfig = {
    AboutLink: string;
    AllowBannerDismissal: string;
    AllowCustomThemes: string;
    AllowSyncedDrafts: string;
    AllowedThemes: string;
    AndroidAppDownloadLink: string;
    AndroidLatestVersion: string;
    AndroidMinVersion: string;
    AppDownloadLink: string;
    AppsPluginEnabled: string;
    AsymmetricSigningPublicKey: string;
    AvailableLocales: string;
    BannerColor: string;
    BannerText: string;
    BannerTextColor: string;
    BuildDate: string;
    BuildEnterpriseReady: string;
    BuildHash: string;
    BuildHashEnterprise: string;
    BuildNumber: string;
    CollapsedThreads: CollapsedThreads;
    CustomBrandText: string;
    CustomDescriptionText: string;
    CustomTermsOfServiceId: string;
    CustomTermsOfServiceReAcceptancePeriod: string;
    CustomUrlSchemes: string;
    CWSURL: string;
    CWSMock: string;
    DataRetentionEnableFileDeletion: string;
    DataRetentionEnableMessageDeletion: string;
    DataRetentionFileRetentionHours: string;
    DataRetentionMessageRetentionHours: string;
    DefaultClientLocale: string;
    DefaultTheme: string;
    DiagnosticId: string;
    DiagnosticsEnabled: string;
    DisableRefetchingOnBrowserFocus: string;
    DisableWakeUpReconnectHandler: string;
    EmailLoginButtonBorderColor: string;
    EmailLoginButtonColor: string;
    EmailLoginButtonTextColor: string;
    EmailNotificationContentsType: string;
    EnableAskCommunityLink: string;
    EnableBanner: string;
    EnableBotAccountCreation: string;
    EnableChannelViewedMessages: string;
    EnableClientMetrics: string;
    EnableClientPerformanceDebugging: string;
    EnableCluster: string;
    EnableCommands: string;
    EnableCompliance: string;
    EnableConfirmNotificationsToChannel: string;
    EnableCustomBrand: string;
    EnableCustomEmoji: string;
    EnableCustomGroups: string;
    EnableCustomUserStatuses: string;
    EnableExperimentalLocales: string;
    EnableUserStatuses: string;
    EnableLastActiveTime: string;
    EnableTimedDND: string;
    EnableCustomTermsOfService: string;
    EnableDeveloper: string;
    EnableDiagnostics: string;
    EnableDesktopLandingPage: 'true' | 'false';
    EnableEmailBatching: string;
    EnableEmailInvitations: string;
    EnableEmojiPicker: string;
    EnableFileAttachments: string;
    EnableFile: string;
    EnableGifPicker: string;
    EnableGuestAccounts: string;
    EnableIncomingWebhooks: string;
    EnableJoinLeaveMessageByDefault: string;
    EnableLatex: string;
    EnableInlineLatex: string;
    EnableLdap: string;
    EnableLinkPreviews: string;
    EnableMarketplace: string;
    EnableMetrics: string;
    EnableMobileFileDownload: string;
    EnableMobileFileUpload: string;
    EnableMultifactorAuthentication: string;
    EnableOAuthServiceProvider: string;
    EnableOutgoingOAuthConnections: string;
    EnableOpenServer: string;
    EnableOutgoingWebhooks: string;
    EnablePostIconOverride: string;
    EnablePostUsernameOverride: string;
    EnablePreviewModeBanner: string;
    EnablePublicLink: string;
    EnableReliableWebSockets: string;
    EnableSaml: string;
    EnableSignInWithEmail: string;
    EnableSignInWithUsername: string;
    EnableSignUpWithEmail: string;
    EnableSignUpWithGitLab: string;
    EnableSignUpWithGoogle: string;
    EnableSignUpWithOffice365: string;
    EnableSignUpWithOpenId: string;
    EnableSVGs: string;
    EnableTesting: string;
    EnableThemeSelection: string;
    EnableTutorial: string;
    EnableOnboardingFlow: string;
    EnableUserAccessTokens: string;
    EnableUserCreation: string;
    EnableUserDeactivation: string;
    EnableUserTypingMessages: string;
    EnforceMultifactorAuthentication: string;
    ExperimentalClientSideCertCheck: string;
    ExperimentalClientSideCertEnable: string;
    ExperimentalEnableAuthenticationTransfer: string;
    ExperimentalEnableAutomaticReplies: string;
    ExperimentalEnableDefaultChannelLeaveJoinMessages: string;
    ExperimentalEnablePostMetadata: string;
    ExperimentalGroupUnreadChannels: string;
    ExperimentalPrimaryTeam: string;
    ExperimentalViewArchivedChannels: string;
    FileLevel: string;
    FeatureFlagAppsEnabled: string;
    FeatureFlagCallsEnabled: string;
    FeatureFlagWebSocketEventScope: string;
    ForgotPasswordLink: string;
    GiphySdkKey: string;
    GoogleDeveloperKey: string;
    GuestAccountsEnforceMultifactorAuthentication: string;
    HasImageProxy: string;
    HelpLink: string;
    HideGuestTags: string;
    IosAppDownloadLink: string;
    IosLatestVersion: string;
    IosMinVersion: string;
    InstallationDate: string;
    IsDefaultMarketplace: string;
    LdapFirstNameAttributeSet: string;
    LdapLastNameAttributeSet: string;
    LdapLoginButtonBorderColor: string;
    LdapLoginButtonColor: string;
    LdapLoginButtonTextColor: string;
    LdapLoginFieldName: string;
    LdapNicknameAttributeSet: string;
    LdapPositionAttributeSet: string;
    LdapPictureAttributeSet: string;
    LockTeammateNameDisplay: string;
    ManagedResourcePaths: string;
    MaxFileSize: string;
    MaxPostSize: string;
    MaxNotificationsPerChannel: string;
    MinimumHashtagLength: string;
    NoAccounts: string;
    GitLabButtonText: string;
    GitLabButtonColor: string;
    OpenIdButtonText: string;
    OpenIdButtonColor: string;
    PasswordEnableForgotLink: string;
    PasswordMinimumLength: string;
    PasswordRequireLowercase: string;
    PasswordRequireNumber: string;
    PasswordRequireSymbol: string;
    PasswordRequireUppercase: string;
    PluginsEnabled: string;
    PostEditTimeLimit: string;
    PrivacyPolicyLink: string;
    ReportAProblemLink: string;
    RequireEmailVerification: string;
    RestrictDirectMessage: string;
    RunJobs: string;
    SamlFirstNameAttributeSet: string;
    SamlLastNameAttributeSet: string;
    SamlLoginButtonBorderColor: string;
    SamlLoginButtonColor: string;
    SamlLoginButtonText: string;
    SamlLoginButtonTextColor: string;
    SamlNicknameAttributeSet: string;
    SamlPositionAttributeSet: string;
    SchemaVersion: string;
    SendEmailNotifications: string;
    SendPushNotifications: string;
    ShowEmailAddress: string;
    SiteName: string;
    SiteURL: string;
    SQLDriverName: string;
    SupportEmail: string;
    TelemetryId: string;
    TeammateNameDisplay: string;
    TermsOfServiceLink: string;
    TimeBetweenUserTypingUpdatesMilliseconds: string;
    UpgradedFromTE: string;
    Version: string;
    WebsocketPort: string;
    WebsocketSecurePort: string;
    WebsocketURL: string;
    ExperimentalSharedChannels: string;
    DisableAppBar: string;
    EnableComplianceExport: string;
    PostPriority: string;
    PostAcknowledgements: string;
    AllowPersistentNotifications: string;
    PersistentNotificationMaxRecipients: string;
    PersistentNotificationIntervalMinutes: string;
    AllowPersistentNotificationsForGuests: string;
    DelayChannelAutocomplete: 'true' | 'false';
    WranglerPermittedWranglerRoles: string;
    WranglerAllowedEmailDomain: string;
    WranglerMoveThreadMaxCount: string;
    WranglerMoveThreadFromPrivateChannelEnable: string;
    WranglerMoveThreadFromDirectMessageChannelEnable: string;
    WranglerMoveThreadFromGroupMessageChannelEnable: string;
    ServiceEnvironment: string;
    UniqueEmojiReactionLimitPerPost: string;
    UsersStatusAndProfileFetchingPollIntervalMilliseconds: string;
    YoutubeReferrerPolicy: 'true' | 'false';
    ScheduledPosts: string;
};

export type License = {
    id: string;
    issued_at: number;
    starts_at: number;
    expires_at: string;
    customer: LicenseCustomer;
    features: LicenseFeatures;
    sku_name: string;
    short_sku_name: string;
};

export type LicenseCustomer = {
    id: string;
    name: string;
    email: string;
    company: string;
};

export type LicenseFeatures = {
    users?: number;
    ldap?: boolean;
    ldap_groups?: boolean;
    mfa?: boolean;
    google_oauth?: boolean;
    office365_oauth?: boolean;
    compliance?: boolean;
    cluster?: boolean;
    metrics?: boolean;
    mhpns?: boolean;
    saml?: boolean;
    elastic_search?: boolean;
    announcement?: boolean;
    theme_management?: boolean;
    email_notification_contents?: boolean;
    data_retention?: boolean;
    message_export?: boolean;
    custom_permissions_schemes?: boolean;
    custom_terms_of_service?: boolean;
    guest_accounts?: boolean;
    guest_accounts_permissions?: boolean;
    id_loaded?: boolean;
    lock_teammate_name_display?: boolean;
    cloud?: boolean;
    future_features?: boolean;
};

export type ClientLicense = Record<string, string>;

export type RequestLicenseBody = {
    users: number;
    terms_accepted: boolean;
    receive_emails_accepted: boolean;
    contact_name: string;
    contact_email: string;
    company_name: string;
    company_size: string;
    company_country: string;
}

export type DataRetentionPolicy = {
    message_deletion_enabled: boolean;
    file_deletion_enabled: boolean;
    message_retention_cutoff: number;
    file_retention_cutoff: number;
    boards_retention_cutoff: number;
    boards_deletion_enabled: boolean;
};

export type ServiceSettings = {
    SiteURL: string;
    WebsocketURL: string;
    LicenseFileLocation: string;
    ListenAddress: string;
    ConnectionSecurity: string;
    TLSCertFile: string;
    TLSKeyFile: string;
    TLSMinVer: string;
    TLSStrictTransport: boolean;
    TLSStrictTransportMaxAge: number;
    TLSOverwriteCiphers: string[];
    UseLetsEncrypt: boolean;
    LetsEncryptCertificateCacheFile: string;
    Forward80To443: boolean;
    TrustedProxyIPHeader: string[];
    ReadTimeout: number;
    WriteTimeout: number;
    IdleTimeout: number;
    MaximumLoginAttempts: number;
    GoroutineHealthThreshold: number;
    GoogleDeveloperKey: string;
    EnableOAuthServiceProvider: boolean;
    EnableIncomingWebhooks: boolean;
    EnableOutgoingWebhooks: boolean;
    EnableOutgoingOAuthConnections: boolean;
    EnableCommands: boolean;
    OutgoingIntegrationRequestsTimeout: number;
    EnablePostUsernameOverride: boolean;
    EnablePostIconOverride: boolean;
    EnableLinkPreviews: boolean;
    EnablePermalinkPreviews: boolean;
    RestrictLinkPreviews: string;
    EnableTesting: boolean;
    EnableDeveloper: boolean;
    DeveloperFlags: string;
    EnableClientPerformanceDebugging: boolean;
    EnableOpenTracing: boolean;
    EnableSecurityFixAlert: boolean;
    EnableInsecureOutgoingConnections: boolean;
    AllowedUntrustedInternalConnections: string;
    EnableMultifactorAuthentication: boolean;
    EnforceMultifactorAuthentication: boolean;
    EnableUserAccessTokens: boolean;
    AllowCorsFrom: string;
    CorsExposedHeaders: string;
    CorsAllowCredentials: boolean;
    CorsDebug: boolean;
    AllowCookiesForSubdomains: boolean;
    ExtendSessionLengthWithActivity: boolean;
    TerminateSessionsOnPasswordChange: boolean;
    SessionLengthWebInDays: number;
    SessionLengthWebInHours: number;
    SessionLengthMobileInDays: number;
    SessionLengthMobileInHours: number;
    SessionLengthSSOInDays: number;
    SessionLengthSSOInHours: number;
    SessionCacheInMinutes: number;
    SessionIdleTimeoutInMinutes: number;
    WebsocketSecurePort: number;
    WebsocketPort: number;
    WebserverMode: string;
    EnableCustomEmoji: boolean;
    EnableEmojiPicker: boolean;
    EnableGifPicker: boolean;
    GiphySdkKey: string;
    PostEditTimeLimit: number;
    TimeBetweenUserTypingUpdatesMilliseconds: number;
    EnablePostSearch: boolean;
    EnableFileSearch: boolean;
    MinimumHashtagLength: number;
    EnableUserTypingMessages: boolean;
    EnableChannelViewedMessages: boolean;
    EnableUserStatuses: boolean;
    ExperimentalEnableAuthenticationTransfer: boolean;
    ClusterLogTimeoutMilliseconds: number;
    EnableTutorial: boolean;
    EnableOnboardingFlow: boolean;
    ExperimentalEnableDefaultChannelLeaveJoinMessages: boolean;
    ExperimentalGroupUnreadChannels: string;
    EnableAPITeamDeletion: boolean;
    EnableAPITriggerAdminNotifications: boolean;
    EnableAPIUserDeletion: boolean;
    ExperimentalEnableHardenedMode: boolean;
    ExperimentalStrictCSRFEnforcement: boolean;
    EnableEmailInvitations: boolean;
    DisableBotsWhenOwnerIsDeactivated: boolean;
    EnableBotAccountCreation: boolean;
    EnableSVGs: boolean;
    EnableLatex: boolean;
    EnableInlineLatex: boolean;
    EnableLocalMode: boolean;
    LocalModeSocketLocation: string;
    CollapsedThreads: CollapsedThreads;
    ThreadAutoFollow: boolean;
    PostPriority: boolean;
    EnableAPIChannelDeletion: boolean;
    EnableAWSMetering: boolean;
    SplitKey: string;
    FeatureFlagSyncIntervalSeconds: number;
    DebugSplit: boolean;
    ManagedResourcePaths: string;
    EnableCustomGroups: boolean;
    AllowSyncedDrafts: boolean;
    AllowPersistentNotifications: boolean;
    AllowPersistentNotificationsForGuests: boolean;
    PersistentNotificationIntervalMinutes: number;
    PersistentNotificationMaxCount: number;
    PersistentNotificationMaxRecipients: number;
    UniqueEmojiReactionLimitPerPost: number;
    RefreshPostStatsRunTime: string;
    MaximumPayloadSizeBytes: number;
    EnableAPIPostDeletion: boolean;
    EnableDesktopLandingPage: boolean;
    MaximumURLLength: number;
    ScheduledPosts: boolean;
};

export type TeamSettings = {
    SiteName: string;
    MaxUsersPerTeam: number;
    EnableCustomUserStatuses: boolean;
    EnableUserCreation: boolean;
    EnableOpenServer: boolean;
    EnableUserDeactivation: boolean;
    RestrictCreationToDomains: string;
    EnableCustomBrand: boolean;
    CustomBrandText: string;
    CustomDescriptionText: string;
    RestrictDirectMessage: string;
    UserStatusAwayTimeout: number;
    MaxChannelsPerTeam: number;
    MaxNotificationsPerChannel: number;
    EnableConfirmNotificationsToChannel: boolean;
    TeammateNameDisplay: string;
    ExperimentalViewArchivedChannels: boolean;
    ExperimentalEnableAutomaticReplies: boolean;
    LockTeammateNameDisplay: boolean;
    ExperimentalPrimaryTeam: string;
    ExperimentalDefaultChannels: string[];
    EnableLastActiveTime: boolean;
    EnableJoinLeaveMessageByDefault: boolean;
};

export type ClientRequirements = {
    AndroidLatestVersion: string;
    AndroidMinVersion: string;
    IosLatestVersion: string;
    IosMinVersion: string;
};

export type SqlSettings = {
    DriverName: string;
    DataSource: string;
    DataSourceReplicas: string[];
    DataSourceSearchReplicas: string[];
    MaxIdleConns: number;
    ConnMaxLifetimeMilliseconds: number;
    ConnMaxIdleTimeMilliseconds: number;
    MaxOpenConns: number;
    Trace: boolean;
    AtRestEncryptKey: string;
    QueryTimeout: number;
    DisableDatabaseSearch: boolean;
    MigrationsStatementTimeoutSeconds: number;
    ReplicaLagSettings: ReplicaLagSetting[];
    ReplicaMonitorIntervalSeconds: number;
};

export type LogSettings = {
    EnableConsole: boolean;
    ConsoleLevel: string;
    ConsoleJson: boolean;
    EnableColor: boolean;
    EnableFile: boolean;
    FileLevel: string;
    FileJson: boolean;
    FileLocation: string;
    EnableWebhookDebugging: boolean;
    EnableDiagnostics: boolean;
    VerboseDiagnostics: boolean;
    EnableSentry: boolean;
    AdvancedLoggingJSON: Record<string, any>;
    MaxFieldSize: number;
};

export type ExperimentalAuditSettings = {
    FileEnabled: boolean;
    FileName: string;
    FileMaxSizeMB: number;
    FileMaxAgeDays: number;
    FileMaxBackups: number;
    FileCompress: boolean;
    FileMaxQueueSize: number;
    AdvancedLoggingJSON: Record<string, any>;
};

export type NotificationLogSettings = {
    EnableConsole: boolean;
    ConsoleLevel: string;
    ConsoleJson: boolean;
    EnableColor: boolean;
    EnableFile: boolean;
    FileLevel: string;
    FileJson: boolean;
    FileLocation: string;
    AdvancedLoggingJSON: Record<string, any>;
};

export type PasswordSettings = {
    MinimumLength: number;
    Lowercase: boolean;
    Number: boolean;
    Uppercase: boolean;
    Symbol: boolean;
    EnableForgotLink: boolean;
};

export type WranglerSettings = {
    PermittedWranglerRoles: string[];
    AllowedEmailDomain: string[];
    MoveThreadMaxCount: number;
    MoveThreadToAnotherTeamEnable: boolean;
    MoveThreadFromPrivateChannelEnable: boolean;
    MoveThreadFromDirectMessageChannelEnable: boolean;
    MoveThreadFromGroupMessageChannelEnable: boolean;
};

export type ConnectedWorkspacesSettings = {
    EnableSharedChannels: boolean;
    EnableRemoteClusterService: boolean;
    DisableSharedChannelsStatusSync: boolean;
    MaxPostsPerSync: number;
}

export type FileSettings = {
    EnableFileAttachments: boolean;
    EnableMobileUpload: boolean;
    EnableMobileDownload: boolean;
    MaxFileSize: number;
    MaxImageResolution: number;
    MaxImageDecoderConcurrency: number;
    DriverName: string;
    Directory: string;
    EnablePublicLink: boolean;
    ExtractContent: boolean;
    ArchiveRecursion: boolean;
    PublicLinkSalt: string;
    InitialFont: string;
    AmazonS3AccessKeyId: string;
    AmazonS3SecretAccessKey: string;
    AmazonS3Bucket: string;
    AmazonS3PathPrefix: string;
    AmazonS3Region: string;
    AmazonS3Endpoint: string;
    AmazonS3SSL: boolean;
    AmazonS3SignV2: boolean;
    AmazonS3SSE: boolean;
    AmazonS3Trace: boolean;
    AmazonS3RequestTimeoutMilliseconds: number;
    AmazonS3UploadPartSizeBytes: number;
    AmazonS3StorageClass: string;
    DedicatedExportStore: boolean;
    ExportDriverName: string;
    ExportDirectory: string;
    ExportAmazonS3AccessKeyId: string;
    ExportAmazonS3SecretAccessKey: string;
    ExportAmazonS3Bucket: string;
    ExportAmazonS3PathPrefix: string;
    ExportAmazonS3Region: string;
    ExportAmazonS3Endpoint: string;
    ExportAmazonS3SSL: boolean;
    ExportAmazonS3SignV2: boolean;
    ExportAmazonS3SSE: boolean;
    ExportAmazonS3Trace: boolean;
    ExportAmazonS3RequestTimeoutMilliseconds: number;
    ExportAmazonS3PresignExpiresSeconds: number;
    ExportAmazonS3UploadPartSizeBytes: number;
    ExportAmazonS3StorageClass: string;
};

export type EmailSettings = {
    EnableSignUpWithEmail: boolean;
    EnableSignInWithEmail: boolean;
    EnableSignInWithUsername: boolean;
    SendEmailNotifications: boolean;
    UseChannelInEmailNotifications: boolean;
    RequireEmailVerification: boolean;
    FeedbackName: string;
    FeedbackEmail: string;
    ReplyToAddress: string;
    FeedbackOrganization: string;
    EnableSMTPAuth: boolean;
    SMTPUsername: string;
    SMTPPassword: string;
    SMTPServer: string;
    SMTPPort: string;
    SMTPServerTimeout: number;
    ConnectionSecurity: string;
    SendPushNotifications: boolean;
    PushNotificationServer: string;
    PushNotificationServerType: 'off' | 'mhpns' | 'mtpns' | 'custom';
    PushNotificationServerLocation: 'us' | 'de';
    PushNotificationContents: string;
    PushNotificationBuffer: number;
    EnableEmailBatching: boolean;
    EmailBatchingBufferSize: number;
    EmailBatchingInterval: number;
    EnablePreviewModeBanner: boolean;
    SkipServerCertificateVerification: boolean;
    EmailNotificationContentsType: string;
    LoginButtonColor: string;
    LoginButtonBorderColor: string;
    LoginButtonTextColor: string;
};

export type RateLimitSettings = {
    Enable: boolean;
    PerSec: number;
    MaxBurst: number;
    MemoryStoreSize: number;
    VaryByRemoteAddr: boolean;
    VaryByUser: boolean;
    VaryByHeader: string;
};

export type PrivacySettings = {
    ShowEmailAddress: boolean;
    ShowFullName: boolean;
};

export type SupportSettings = {
    TermsOfServiceLink: string;
    PrivacyPolicyLink: string;
    AboutLink: string;
    HelpLink: string;
    ReportAProblemLink: string;
    ForgotPasswordLink: string;
    SupportEmail: string;
    CustomTermsOfServiceEnabled: boolean;
    CustomTermsOfServiceReAcceptancePeriod: number;
    EnableAskCommunityLink: boolean;
};

export type AnnouncementSettings = {
    EnableBanner: boolean;
    BannerText: string;
    BannerColor: string;
    BannerTextColor: string;
    AllowBannerDismissal: boolean;
    AdminNoticesEnabled: boolean;
    UserNoticesEnabled: boolean;
    NoticesURL: string;
    NoticesFetchFrequency: number;
    NoticesSkipCache: boolean;
};

export type ThemeSettings = {
    EnableThemeSelection: boolean;
    DefaultTheme: string;
    AllowCustomThemes: boolean;
    AllowedThemes: string[];
};

export type SSOSettings = {
    Enable: boolean;
    Secret: string;
    Id: string;
    Scope: string;
    AuthEndpoint: string;
    TokenEndpoint: string;
    UserAPIEndpoint: string;
    DiscoveryEndpoint: string;
    ButtonText: string;
    ButtonColor: string;
};

export type Office365Settings = {
    Enable: boolean;
    Secret: string;
    Id: string;
    Scope: string;
    AuthEndpoint: string;
    TokenEndpoint: string;
    UserAPIEndpoint: string;
    DiscoveryEndpoint: string;
    DirectoryId: string;
};

export type LdapSettings = {
    Enable: boolean;
    EnableSync: boolean;
    LdapServer: string;
    LdapPort: number;
    ConnectionSecurity: string;
    BaseDN: string;
    BindUsername: string;
    BindPassword: string;
    UserFilter: string;
    GroupFilter: string;
    GuestFilter: string;
    EnableAdminFilter: boolean;
    AdminFilter: string;
    GroupDisplayNameAttribute: string;
    GroupIdAttribute: string;
    FirstNameAttribute: string;
    LastNameAttribute: string;
    EmailAttribute: string;
    UsernameAttribute: string;
    NicknameAttribute: string;
    IdAttribute: string;
    PositionAttribute: string;
    LoginIdAttribute: string;
    PictureAttribute: string;
    SyncIntervalMinutes: number;
    SkipCertificateVerification: boolean;
    PublicCertificateFile: string;
    PrivateKeyFile: string;
    QueryTimeout: number;
    MaxPageSize: number;
    LoginFieldName: string;
    LoginButtonColor: string;
    LoginButtonBorderColor: string;
    LoginButtonTextColor: string;
};

export type ComplianceSettings = {
    Enable: boolean;
    Directory: string;
    EnableDaily: boolean;
    BatchSize: number;
};

export type LocalizationSettings = {
    DefaultServerLocale: string;
    DefaultClientLocale: string;
    AvailableLocales: string;
    EnableExperimentalLocales: boolean;
};

export type SamlSettings = {
    Enable: boolean;
    EnableSyncWithLdap: boolean;
    EnableSyncWithLdapIncludeAuth: boolean;
    IgnoreGuestsLdapSync: boolean;
    Verify: boolean;
    Encrypt: boolean;
    SignRequest: boolean;
    IdpURL: string;
    IdpDescriptorURL: string;
    IdpMetadataURL: string;
    ServiceProviderIdentifier: string;
    AssertionConsumerServiceURL: string;
    SignatureAlgorithm: string;
    CanonicalAlgorithm: string;
    ScopingIDPProviderId: string;
    ScopingIDPName: string;
    IdpCertificateFile: string;
    PublicCertificateFile: string;
    PrivateKeyFile: string;
    IdAttribute: string;
    GuestAttribute: string;
    EnableAdminAttribute: boolean;
    AdminAttribute: string;
    FirstNameAttribute: string;
    LastNameAttribute: string;
    EmailAttribute: string;
    UsernameAttribute: string;
    NicknameAttribute: string;
    LocaleAttribute: string;
    PositionAttribute: string;
    LoginButtonText: string;
    LoginButtonColor: string;
    LoginButtonBorderColor: string;
    LoginButtonTextColor: string;
};

export type NativeAppSettings = {
    AppCustomURLSchemes: string[];
    AppDownloadLink: string;
    AndroidAppDownloadLink: string;
    IosAppDownloadLink: string;
    MobileExternalBrowser: boolean;
};

export type ClusterSettings = {
    Enable: boolean;
    ClusterName: string;
    OverrideHostname: string;
    NetworkInterface: string;
    BindAddress: string;
    AdvertiseAddress: string;
    UseIPAddress: boolean;
    EnableGossipCompression: boolean;
    EnableExperimentalGossipEncryption: boolean;
    ReadOnlyConfig: boolean;
    GossipPort: number;
};

export type MetricsSettings = {
    Enable: boolean;
    BlockProfileRate: number;
    ListenAddress: string;
    EnableClientMetrics: boolean;
    EnableNotificationMetrics: boolean;
};

export type ExperimentalSettings = {
    ClientSideCertEnable: boolean;
    ClientSideCertCheck: string;
    LinkMetadataTimeoutMilliseconds: number;
    RestrictSystemAdmin: boolean;
    EnableSharedChannels: boolean;
    EnableRemoteClusterService: boolean;
    DisableAppBar: boolean;
    DisableRefetchingOnBrowserFocus: boolean;
    DelayChannelAutocomplete: boolean;
    DisableWakeUpReconnectHandler: boolean;
    UsersStatusAndProfileFetchingPollIntervalMilliseconds: number;
    YoutubeReferrerPolicy: boolean;
};

export type AnalyticsSettings = {
    MaxUsersForStatistics: number;
};

export type CacheSettings = {
    CacheType: string;
    RedisAddress: string;
    RedisPassword: string;
    RedisDB: number;
    DisableClientCache: boolean;
};

export type ElasticsearchSettings = {
    ConnectionURL: string;
    Backend: string;
    Username: string;
    Password: string;
    EnableIndexing: boolean;
    EnableSearching: boolean;
    EnableAutocomplete: boolean;
    Sniff: boolean;
    PostIndexReplicas: number;
    PostIndexShards: number;
    ChannelIndexReplicas: number;
    ChannelIndexShards: number;
    UserIndexReplicas: number;
    UserIndexShards: number;
    AggregatePostsAfterDays: number;
    PostsAggregatorJobStartTime: string;
    IndexPrefix: string;
    LiveIndexingBatchSize: number;
    BatchSize: number;
    RequestTimeoutSeconds: number;
    SkipTLSVerification: boolean;
    CA: string;
    ClientCert: string;
    ClientKey: string;
    Trace: string;
    IgnoredPurgeIndexes: string;
};

export type BleveSettings = {
    IndexDir: string;
    EnableIndexing: boolean;
    EnableSearching: boolean;
    EnableAutocomplete: boolean;
    BatchSize: number;
};

export type DataRetentionSettings = {
    EnableMessageDeletion: boolean;
    EnableFileDeletion: boolean;
    MessageRetentionDays: number;
    MessageRetentionHours: number;
    FileRetentionDays: number;
    FileRetentionHours: number;
    DeletionJobStartTime: string;
    BatchSize: number;
    EnableBoardsDeletion: boolean;
    BoardsRetentionDays: number;
    TimeBetweenBatchesMilliseconds: number;
    RetentionIdsBatchSize: number;
};

export type MessageExportSettings = {
    EnableExport: boolean;
    DownloadExportResults: boolean;
    ExportFormat: string;
    DailyRunTime: string;
    ExportFromTimestamp: number;
    BatchSize: number;
    GlobalRelaySettings: {
        CustomerType: string;
        SMTPUsername: string;
        SMTPPassword: string;
        EmailAddress: string;
        SMTPServerTimeout: number;
        CustomSMTPServerName: string;
        CustomSMTPPort: string;
    };
};

export type JobSettings = {
    RunJobs: boolean;
    RunScheduler: boolean;
    CleanupJobsThresholdDays: number;
    CleanupConfigThresholdDays: number;
};

export type PluginSettings = {
    Enable: boolean;
    EnableUploads: boolean;
    AllowInsecureDownloadURL: boolean;
    EnableHealthCheck: boolean;
    Directory: string;
    ClientDirectory: string;
    Plugins: Record<string, any>;
    PluginStates: Record<string, { Enable: boolean }>;
    EnableMarketplace: boolean;
    EnableRemoteMarketplace: boolean;
    AutomaticPrepackagedPlugins: boolean;
    RequirePluginSignature: boolean;
    MarketplaceURL: string;
    SignaturePublicKeyFiles: string[];
    ChimeraOAuthProxyURL: string;
};

export type DisplaySettings = {
    CustomURLSchemes: string[];
    MaxMarkdownNodes: number;
};

export type GuestAccountsSettings = {
    Enable: boolean;
    HideTags: boolean;
    AllowEmailAccounts: boolean;
    EnforceMultifactorAuthentication: boolean;
    RestrictCreationToDomains: string;
};

export type ImageProxySettings = {
    Enable: boolean;
    ImageProxyType: string;
    RemoteImageProxyURL: string;
    RemoteImageProxyOptions: string;
};

export type CloudSettings = {
    CWSURL: string;
    CWSAPIURL: string;
    CWSMock: boolean;
    Disable: boolean;
};

export type FeatureFlags = Record<string, string | boolean>;

export type ImportSettings = {
    Directory: string;
    RetentionDays: number;
};

export type ExportSettings = {
    Directory: string;
    RetentionDays: number;
};

export type AdminConfig = {
    ServiceSettings: ServiceSettings;
    TeamSettings: TeamSettings;
    ClientRequirements: ClientRequirements;
    SqlSettings: SqlSettings;
    LogSettings: LogSettings;
    ExperimentalAuditSettings: ExperimentalAuditSettings;
    NotificationLogSettings: NotificationLogSettings;
    PasswordSettings: PasswordSettings;
    FileSettings: FileSettings;
    EmailSettings: EmailSettings;
    RateLimitSettings: RateLimitSettings;
    PrivacySettings: PrivacySettings;
    SupportSettings: SupportSettings;
    AnnouncementSettings: AnnouncementSettings;
    ThemeSettings: ThemeSettings;
    GitLabSettings: SSOSettings;
    GoogleSettings: SSOSettings;
    Office365Settings: Office365Settings;
    OpenIdSettings: SSOSettings;
    LdapSettings: LdapSettings;
    ComplianceSettings: ComplianceSettings;
    LocalizationSettings: LocalizationSettings;
    SamlSettings: SamlSettings;
    NativeAppSettings: NativeAppSettings;
    ClusterSettings: ClusterSettings;
    MetricsSettings: MetricsSettings;
    ExperimentalSettings: ExperimentalSettings;
    AnalyticsSettings: AnalyticsSettings;
    CacheSettings: CacheSettings;
    ElasticsearchSettings: ElasticsearchSettings;
    BleveSettings: BleveSettings;
    DataRetentionSettings: DataRetentionSettings;
    MessageExportSettings: MessageExportSettings;
    JobSettings: JobSettings;
    PluginSettings: PluginSettings;
    DisplaySettings: DisplaySettings;
    GuestAccountsSettings: GuestAccountsSettings;
    ImageProxySettings: ImageProxySettings;
    CloudSettings: CloudSettings;
    FeatureFlags: FeatureFlags;
    ImportSettings: ImportSettings;
    ExportSettings: ExportSettings;
    WranglerSettings: WranglerSettings;
    ConnectedWorkspacesSettings: ConnectedWorkspacesSettings;
};

export type ReplicaLagSetting = {
    DataSource: string;
    QueryAbsoluteLag: string;
    QueryTimeLag: string;
}

export type EnvironmentConfigSettings<T> = {
    [P in keyof T]: boolean;
}

export type EnvironmentConfig = {
    [P in keyof AdminConfig]: EnvironmentConfigSettings<AdminConfig[P]>;
}

export type WarnMetricStatus = {
    id: string;
    limit: number;
    acked: boolean;
    store_status: string;
};

export enum CollapsedThreads {
    DISABLED = 'disabled',
    DEFAULT_ON = 'default_on',
    DEFAULT_OFF = 'default_off',
    ALWAYS_ON = 'always_on',
}

export enum ServiceEnvironment {
    PRODUCTION = 'production',
    TEST = 'test',
    DEV = 'dev',
}

export type AllowedIPRange = {
    cidr_block: string;
    description: string;
    enabled: boolean;
    owner_id: string;
}

export type AllowedIPRanges = AllowedIPRange[];

export type FetchIPResponse = {
    ip: string;
}
