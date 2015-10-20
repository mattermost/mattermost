## Configuration Upgrades

This page will document the changes in `config.json` from version to version. For the full documentation on the latest version's `config.json` please go [here](./Configuration-Settings.md).

### Changes from 1.0 to 1.1

#### Service Settings
1. `EnablePostUsernameOverride` added to control whether webhooks can override usernames
2. `EnablePostIconOverride` added to control whether webhooks can override display pictures
3. `EnableSecurityFixAlert` added to control whether the system is alerted to security updates

### Changes from 0.7 to 1.0

#### Service Settings
1. `SiteName` moved to _TeamSettings_
2. `Mode` removed
3. `AllowTesting` renamed `EnableTesting`
4. `UseSSL` removed
5. `Port` renamed `ListenAddress` and must be prepended with a colon
6. `Version` removed
1. `Shards` removed
1. `InviteSalt` moved to _EmailSettings_
2. `PublicLinkSalt` moved to _FileSettings_
3. `ResetSalt` renamed `PasswordResetSalt` was moved to _EmailSettings_
4. `AnalyticsUrl` removed
5. `UseLocalStorage` removed and replaced in _FileSettings_ by `DriverName`
6. `StorageDirectory` renamed `Directory` was moved to _FileSettings_
7. `AllowedLoginAttempts` renamed `MaximumLoginAttempts`
8. `DisableEmailSignUp` renamed `EnableSignUpWithEmail`, reversed and moved to _EmailSettings_
9. `EnableOAuthServiceProvider` added to control whether OAuth2 service provider functionality is turned on
10. `EnableIncomingWebhooks` added to control whether incoming webhooks are turned on

#### Team Settings
1. `AllowPublicLink` renamed `EnablePublicLink` and moved to _FileSettings_
2. `AllowValetDefault` removed
3. `TermsLink` removed
3. `PrivacyLink` removed
3. `AboutLink` removed
3. `HelpLink` removed
3. `ReportProblemLink` removed
3. `TourLink` removed
4. `DefaultThemeColor` removed
5. `DisableTeamCreation` renamed `EnableTeamCreation` and reversed
6. `EnableUserCreation` added to control whether new users can be created

#### SSO Settings
1. Renamed to _GitLabSettings_
2. Formatted to only hold a single SSO setting for GitLab

#### AWS Settings
1. Section removed
2. `S3AccessKeyId` renamed `AmazonS3AccessKeyId` and moved to _FileSettings_
2. `S3SecretAccessKey` renamed `AmazonS3SecretAccessKey` and moved to _FileSettings_
2. `S3Bucket` renamed `AmazonS3Bucket` and moved to _FileSettings_
2. `S3Region` renamed `AmazonS3Region` and moved to _FileSettings_

#### Image Settings
1. Section renamed _FileSettings_
2. `DriverName` added to specify file storage method

#### Email Settings
1. `ByPassEmail` removed
2. `SendEmailNotifications` added to control if email notifications are sent
3. `RequireEmailVerification` added to control if users need to verify their emails
4. `UseTLS` replaced by `ConnectionSecurity`
5. `UseStartTLS` removed

#### Privacy Settings
1. `ShowPhoneNumber` removed
1. `ShowSkypeId` removed
