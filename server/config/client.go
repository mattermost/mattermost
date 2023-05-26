// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/model"
)

// GenerateClientConfig renders the given configuration for a client.
func GenerateClientConfig(c *model.Config, telemetryID string, license *model.License) map[string]string {
	props := GenerateLimitedClientConfig(c, telemetryID, license)

	props["EnableCustomUserStatuses"] = strconv.FormatBool(*c.TeamSettings.EnableCustomUserStatuses)
	props["EnableLastActiveTime"] = strconv.FormatBool(*c.TeamSettings.EnableLastActiveTime)
	props["EnableUserDeactivation"] = strconv.FormatBool(*c.TeamSettings.EnableUserDeactivation)
	props["RestrictDirectMessage"] = *c.TeamSettings.RestrictDirectMessage
	props["TeammateNameDisplay"] = *c.TeamSettings.TeammateNameDisplay
	props["LockTeammateNameDisplay"] = strconv.FormatBool(*c.TeamSettings.LockTeammateNameDisplay)
	props["ExperimentalPrimaryTeam"] = *c.TeamSettings.ExperimentalPrimaryTeam
	props["ExperimentalViewArchivedChannels"] = strconv.FormatBool(*c.TeamSettings.ExperimentalViewArchivedChannels)

	props["EnableBotAccountCreation"] = strconv.FormatBool(*c.ServiceSettings.EnableBotAccountCreation)
	props["EnableOAuthServiceProvider"] = strconv.FormatBool(*c.ServiceSettings.EnableOAuthServiceProvider)
	props["GoogleDeveloperKey"] = *c.ServiceSettings.GoogleDeveloperKey
	props["EnableIncomingWebhooks"] = strconv.FormatBool(*c.ServiceSettings.EnableIncomingWebhooks)
	props["EnableOutgoingWebhooks"] = strconv.FormatBool(*c.ServiceSettings.EnableOutgoingWebhooks)
	props["EnableCommands"] = strconv.FormatBool(*c.ServiceSettings.EnableCommands)
	props["EnablePostUsernameOverride"] = strconv.FormatBool(*c.ServiceSettings.EnablePostUsernameOverride)
	props["EnablePostIconOverride"] = strconv.FormatBool(*c.ServiceSettings.EnablePostIconOverride)
	props["EnableUserAccessTokens"] = strconv.FormatBool(*c.ServiceSettings.EnableUserAccessTokens)
	props["EnableLinkPreviews"] = strconv.FormatBool(*c.ServiceSettings.EnableLinkPreviews)
	props["EnablePermalinkPreviews"] = strconv.FormatBool(*c.ServiceSettings.EnablePermalinkPreviews)
	props["EnableTesting"] = strconv.FormatBool(*c.ServiceSettings.EnableTesting)
	props["EnableDeveloper"] = strconv.FormatBool(*c.ServiceSettings.EnableDeveloper)
	props["EnableClientPerformanceDebugging"] = strconv.FormatBool(*c.ServiceSettings.EnableClientPerformanceDebugging)
	props["PostEditTimeLimit"] = fmt.Sprintf("%v", *c.ServiceSettings.PostEditTimeLimit)
	props["MinimumHashtagLength"] = fmt.Sprintf("%v", *c.ServiceSettings.MinimumHashtagLength)
	props["EnablePreviewFeatures"] = strconv.FormatBool(*c.ServiceSettings.EnablePreviewFeatures)
	props["EnableTutorial"] = strconv.FormatBool(*c.ServiceSettings.EnableTutorial)
	props["EnableOnboardingFlow"] = strconv.FormatBool(*c.ServiceSettings.EnableOnboardingFlow)
	props["ExperimentalEnableDefaultChannelLeaveJoinMessages"] = strconv.FormatBool(*c.ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages)
	props["ExperimentalGroupUnreadChannels"] = *c.ServiceSettings.ExperimentalGroupUnreadChannels
	props["EnableSVGs"] = strconv.FormatBool(*c.ServiceSettings.EnableSVGs)
	props["EnableMarketplace"] = strconv.FormatBool(*c.PluginSettings.EnableMarketplace)
	props["EnableLatex"] = strconv.FormatBool(*c.ServiceSettings.EnableLatex)
	props["EnableInlineLatex"] = strconv.FormatBool(*c.ServiceSettings.EnableInlineLatex)
	props["ExtendSessionLengthWithActivity"] = strconv.FormatBool(*c.ServiceSettings.ExtendSessionLengthWithActivity)
	props["ManagedResourcePaths"] = *c.ServiceSettings.ManagedResourcePaths

	// This setting is only temporary, so keep using the old setting name for the mobile and web apps
	props["ExperimentalEnablePostMetadata"] = "true"

	props["EnableAppBar"] = strconv.FormatBool(*c.ExperimentalSettings.EnableAppBar)

	props["ExperimentalEnableAutomaticReplies"] = strconv.FormatBool(*c.TeamSettings.ExperimentalEnableAutomaticReplies)
	props["ExperimentalTimezone"] = strconv.FormatBool(*c.DisplaySettings.ExperimentalTimezone)

	props["SendEmailNotifications"] = strconv.FormatBool(*c.EmailSettings.SendEmailNotifications)
	props["SendPushNotifications"] = strconv.FormatBool(*c.EmailSettings.SendPushNotifications)
	props["RequireEmailVerification"] = strconv.FormatBool(*c.EmailSettings.RequireEmailVerification)
	props["EnableEmailBatching"] = strconv.FormatBool(*c.EmailSettings.EnableEmailBatching)
	props["EnablePreviewModeBanner"] = strconv.FormatBool(*c.EmailSettings.EnablePreviewModeBanner)
	props["EmailNotificationContentsType"] = *c.EmailSettings.EmailNotificationContentsType

	props["ShowEmailAddress"] = strconv.FormatBool(*c.PrivacySettings.ShowEmailAddress)
	props["ShowFullName"] = strconv.FormatBool(*c.PrivacySettings.ShowFullName)

	props["EnableFileAttachments"] = strconv.FormatBool(*c.FileSettings.EnableFileAttachments)
	props["EnablePublicLink"] = strconv.FormatBool(*c.FileSettings.EnablePublicLink)

	props["AvailableLocales"] = *c.LocalizationSettings.AvailableLocales
	props["SQLDriverName"] = *c.SqlSettings.DriverName

	props["EnableEmojiPicker"] = strconv.FormatBool(*c.ServiceSettings.EnableEmojiPicker)
	props["EnableGifPicker"] = strconv.FormatBool(*c.ServiceSettings.EnableGifPicker)
	props["GfycatApiKey"] = *c.ServiceSettings.GfycatAPIKey
	props["GfycatApiSecret"] = *c.ServiceSettings.GfycatAPISecret
	props["MaxFileSize"] = strconv.FormatInt(*c.FileSettings.MaxFileSize, 10)

	props["MaxNotificationsPerChannel"] = strconv.FormatInt(*c.TeamSettings.MaxNotificationsPerChannel, 10)
	props["EnableConfirmNotificationsToChannel"] = strconv.FormatBool(*c.TeamSettings.EnableConfirmNotificationsToChannel)
	props["TimeBetweenUserTypingUpdatesMilliseconds"] = strconv.FormatInt(*c.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds, 10)
	props["EnableUserTypingMessages"] = strconv.FormatBool(*c.ServiceSettings.EnableUserTypingMessages)
	props["EnableChannelViewedMessages"] = strconv.FormatBool(*c.ServiceSettings.EnableChannelViewedMessages)

	props["RunJobs"] = strconv.FormatBool(*c.JobSettings.RunJobs)

	props["EnableEmailInvitations"] = strconv.FormatBool(*c.ServiceSettings.EnableEmailInvitations)

	props["CWSURL"] = *c.CloudSettings.CWSURL
	props["CWSMock"] = model.MockCWS

	props["DisableRefetchingOnBrowserFocus"] = strconv.FormatBool(*c.ExperimentalSettings.DisableRefetchingOnBrowserFocus)

	// Set default values for all options that require a license.
	props["ExperimentalEnableAuthenticationTransfer"] = "true"
	props["LdapNicknameAttributeSet"] = "false"
	props["LdapFirstNameAttributeSet"] = "false"
	props["LdapLastNameAttributeSet"] = "false"
	props["LdapPictureAttributeSet"] = "false"
	props["LdapPositionAttributeSet"] = "false"
	props["EnableCompliance"] = "false"
	props["EnableMobileFileDownload"] = "true"
	props["EnableMobileFileUpload"] = "true"
	props["SamlFirstNameAttributeSet"] = "false"
	props["SamlLastNameAttributeSet"] = "false"
	props["SamlNicknameAttributeSet"] = "false"
	props["SamlPositionAttributeSet"] = "false"
	props["EnableCluster"] = "false"
	props["EnableMetrics"] = "false"
	props["EnableBanner"] = "false"
	props["BannerText"] = ""
	props["BannerColor"] = ""
	props["BannerTextColor"] = ""
	props["AllowBannerDismissal"] = "false"
	props["EnableThemeSelection"] = "true"
	props["DefaultTheme"] = ""
	props["AllowCustomThemes"] = "true"
	props["AllowedThemes"] = ""
	props["DataRetentionEnableMessageDeletion"] = "false"
	props["DataRetentionMessageRetentionDays"] = "0"
	props["DataRetentionEnableFileDeletion"] = "false"
	props["DataRetentionFileRetentionDays"] = "0"
	props["DataRetentionEnableBoardsDeletion"] = "false"
	props["DataRetentionBoardsRetentionDays"] = "0"

	props["CustomUrlSchemes"] = strings.Join(c.DisplaySettings.CustomURLSchemes, ",")
	props["IsDefaultMarketplace"] = strconv.FormatBool(*c.PluginSettings.MarketplaceURL == model.PluginSettingsDefaultMarketplaceURL)
	props["ExperimentalSharedChannels"] = "false"
	props["CollapsedThreads"] = *c.ServiceSettings.CollapsedThreads
	props["EnableCustomGroups"] = "false"
	props["InsightsEnabled"] = strconv.FormatBool(c.FeatureFlags.InsightsEnabled)
	props["PostPriority"] = strconv.FormatBool(*c.ServiceSettings.PostPriority)
	props["AllowPersistentNotifications"] = strconv.FormatBool(*c.ServiceSettings.AllowPersistentNotifications)
	props["AllowPersistentNotificationsForGuests"] = strconv.FormatBool(*c.ServiceSettings.AllowPersistentNotificationsForGuests)
	props["PersistentNotificationMaxCount"] = strconv.FormatInt(int64(*c.ServiceSettings.PersistentNotificationMaxCount), 10)
	props["PersistentNotificationIntervalMinutes"] = strconv.FormatInt(int64(*c.ServiceSettings.PersistentNotificationIntervalMinutes), 10)
	props["PersistentNotificationMaxRecipients"] = strconv.FormatInt(int64(*c.ServiceSettings.PersistentNotificationMaxRecipients), 10)
	props["AllowSyncedDrafts"] = strconv.FormatBool(*c.ServiceSettings.AllowSyncedDrafts)
	props["DelayChannelAutocomplete"] = strconv.FormatBool(*c.ExperimentalSettings.DelayChannelAutocomplete)

	props["EnablePlaybooks"] = strconv.FormatBool(*c.ProductSettings.EnablePlaybooks)

	if license != nil {
		props["ExperimentalEnableAuthenticationTransfer"] = strconv.FormatBool(*c.ServiceSettings.ExperimentalEnableAuthenticationTransfer)

		if *license.Features.LDAP {
			props["LdapNicknameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.NicknameAttribute != "")
			props["LdapFirstNameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.FirstNameAttribute != "")
			props["LdapLastNameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.LastNameAttribute != "")
			props["LdapPictureAttributeSet"] = strconv.FormatBool(*c.LdapSettings.PictureAttribute != "")
			props["LdapPositionAttributeSet"] = strconv.FormatBool(*c.LdapSettings.PositionAttribute != "")
		}

		if *license.Features.Compliance {
			props["EnableCompliance"] = strconv.FormatBool(*c.ComplianceSettings.Enable)
			props["EnableMobileFileDownload"] = strconv.FormatBool(*c.FileSettings.EnableMobileDownload)
			props["EnableMobileFileUpload"] = strconv.FormatBool(*c.FileSettings.EnableMobileUpload)
		}

		if *license.Features.SAML {
			props["SamlFirstNameAttributeSet"] = strconv.FormatBool(*c.SamlSettings.FirstNameAttribute != "")
			props["SamlLastNameAttributeSet"] = strconv.FormatBool(*c.SamlSettings.LastNameAttribute != "")
			props["SamlNicknameAttributeSet"] = strconv.FormatBool(*c.SamlSettings.NicknameAttribute != "")
			props["SamlPositionAttributeSet"] = strconv.FormatBool(*c.SamlSettings.PositionAttribute != "")
		}

		if *license.Features.FutureFeatures {
			props["ExperimentalClientSideCertEnable"] = strconv.FormatBool(*c.ExperimentalSettings.ClientSideCertEnable)
			props["ExperimentalClientSideCertCheck"] = *c.ExperimentalSettings.ClientSideCertCheck
		}

		if *license.Features.Cluster {
			props["EnableCluster"] = strconv.FormatBool(*c.ClusterSettings.Enable)
		}

		if *license.Features.Cluster {
			props["EnableMetrics"] = strconv.FormatBool(*c.MetricsSettings.Enable)
		}

		if *license.Features.Announcement {
			props["EnableBanner"] = strconv.FormatBool(*c.AnnouncementSettings.EnableBanner)
			props["BannerText"] = *c.AnnouncementSettings.BannerText
			props["BannerColor"] = *c.AnnouncementSettings.BannerColor
			props["BannerTextColor"] = *c.AnnouncementSettings.BannerTextColor
			props["AllowBannerDismissal"] = strconv.FormatBool(*c.AnnouncementSettings.AllowBannerDismissal)
		}

		if *license.Features.ThemeManagement {
			props["EnableThemeSelection"] = strconv.FormatBool(*c.ThemeSettings.EnableThemeSelection)
			props["DefaultTheme"] = *c.ThemeSettings.DefaultTheme
			props["AllowCustomThemes"] = strconv.FormatBool(*c.ThemeSettings.AllowCustomThemes)
			props["AllowedThemes"] = strings.Join(c.ThemeSettings.AllowedThemes, ",")
		}

		if *license.Features.DataRetention {
			props["DataRetentionEnableMessageDeletion"] = strconv.FormatBool(*c.DataRetentionSettings.EnableMessageDeletion)
			props["DataRetentionMessageRetentionDays"] = strconv.FormatInt(int64(*c.DataRetentionSettings.MessageRetentionDays), 10)
			props["DataRetentionEnableFileDeletion"] = strconv.FormatBool(*c.DataRetentionSettings.EnableFileDeletion)
			props["DataRetentionFileRetentionDays"] = strconv.FormatInt(int64(*c.DataRetentionSettings.FileRetentionDays), 10)
			props["DataRetentionEnableBoardsDeletion"] = strconv.FormatBool(*c.DataRetentionSettings.EnableBoardsDeletion)
			props["DataRetentionBoardsRetentionDays"] = strconv.FormatInt(int64(*c.DataRetentionSettings.BoardsRetentionDays), 10)
		}

		if license.HasSharedChannels() {
			props["ExperimentalSharedChannels"] = strconv.FormatBool(*c.ExperimentalSettings.EnableSharedChannels)
			props["ExperimentalRemoteClusterService"] = strconv.FormatBool(c.FeatureFlags.EnableRemoteClusterService && *c.ExperimentalSettings.EnableRemoteClusterService)
		}

		if license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise {
			props["EnableCustomGroups"] = strconv.FormatBool(*c.ServiceSettings.EnableCustomGroups)
		}

		if (license.SkuShortName == model.LicenseShortSkuProfessional || license.SkuShortName == model.LicenseShortSkuEnterprise) && c.FeatureFlags.PostPriority {
			props["PostAcknowledgements"] = "true"
		}
	}

	return props
}

// GenerateLimitedClientConfig renders the given configuration for an untrusted client.
func GenerateLimitedClientConfig(c *model.Config, telemetryID string, license *model.License) map[string]string {
	props := make(map[string]string)

	props["Version"] = model.CurrentVersion
	props["BuildNumber"] = model.BuildNumber
	props["BuildDate"] = model.BuildDate
	props["BuildHash"] = model.BuildHash
	props["BuildHashEnterprise"] = model.BuildHashEnterprise
	props["BuildEnterpriseReady"] = model.BuildEnterpriseReady

	props["EnableBotAccountCreation"] = strconv.FormatBool(*c.ServiceSettings.EnableBotAccountCreation)
	props["EnableFile"] = strconv.FormatBool(*c.LogSettings.EnableFile)
	props["FileLevel"] = *c.LogSettings.FileLevel

	props["SiteURL"] = strings.TrimRight(*c.ServiceSettings.SiteURL, "/")
	props["SiteName"] = *c.TeamSettings.SiteName
	props["WebsocketURL"] = strings.TrimRight(*c.ServiceSettings.WebsocketURL, "/")
	props["WebsocketPort"] = fmt.Sprintf("%v", *c.ServiceSettings.WebsocketPort)
	props["WebsocketSecurePort"] = fmt.Sprintf("%v", *c.ServiceSettings.WebsocketSecurePort)
	props["EnableUserCreation"] = strconv.FormatBool(*c.TeamSettings.EnableUserCreation)
	props["EnableOpenServer"] = strconv.FormatBool(*c.TeamSettings.EnableOpenServer)

	props["AndroidLatestVersion"] = c.ClientRequirements.AndroidLatestVersion
	props["AndroidMinVersion"] = c.ClientRequirements.AndroidMinVersion
	props["IosLatestVersion"] = c.ClientRequirements.IosLatestVersion
	props["IosMinVersion"] = c.ClientRequirements.IosMinVersion

	props["EnableDiagnostics"] = strconv.FormatBool(*c.LogSettings.EnableDiagnostics)

	props["EnableComplianceExport"] = strconv.FormatBool(*c.MessageExportSettings.EnableExport)

	props["EnableSignUpWithEmail"] = strconv.FormatBool(*c.EmailSettings.EnableSignUpWithEmail)
	props["EnableSignInWithEmail"] = strconv.FormatBool(*c.EmailSettings.EnableSignInWithEmail)
	props["EnableSignInWithUsername"] = strconv.FormatBool(*c.EmailSettings.EnableSignInWithUsername)

	props["EmailLoginButtonColor"] = *c.EmailSettings.LoginButtonColor
	props["EmailLoginButtonBorderColor"] = *c.EmailSettings.LoginButtonBorderColor
	props["EmailLoginButtonTextColor"] = *c.EmailSettings.LoginButtonTextColor

	props["EnableSignUpWithGitLab"] = strconv.FormatBool(*c.GitLabSettings.Enable)
	props["GitLabButtonColor"] = *c.GitLabSettings.ButtonColor
	props["GitLabButtonText"] = *c.GitLabSettings.ButtonText

	props["TermsOfServiceLink"] = *c.SupportSettings.TermsOfServiceLink
	props["PrivacyPolicyLink"] = *c.SupportSettings.PrivacyPolicyLink
	props["AboutLink"] = *c.SupportSettings.AboutLink
	props["HelpLink"] = *c.SupportSettings.HelpLink
	props["ReportAProblemLink"] = *c.SupportSettings.ReportAProblemLink
	props["SupportEmail"] = *c.SupportSettings.SupportEmail
	props["EnableAskCommunityLink"] = strconv.FormatBool(*c.SupportSettings.EnableAskCommunityLink)

	props["DefaultClientLocale"] = *c.LocalizationSettings.DefaultClientLocale

	props["EnableCustomEmoji"] = strconv.FormatBool(*c.ServiceSettings.EnableCustomEmoji)
	props["AppDownloadLink"] = *c.NativeAppSettings.AppDownloadLink
	props["AndroidAppDownloadLink"] = *c.NativeAppSettings.AndroidAppDownloadLink
	props["IosAppDownloadLink"] = *c.NativeAppSettings.IosAppDownloadLink

	props["DiagnosticId"] = telemetryID
	props["TelemetryId"] = telemetryID
	props["DiagnosticsEnabled"] = strconv.FormatBool(*c.LogSettings.EnableDiagnostics)

	props["HasImageProxy"] = strconv.FormatBool(*c.ImageProxySettings.Enable)

	props["PluginsEnabled"] = strconv.FormatBool(*c.PluginSettings.Enable)

	props["PasswordMinimumLength"] = fmt.Sprintf("%v", *c.PasswordSettings.MinimumLength)
	props["PasswordRequireLowercase"] = strconv.FormatBool(*c.PasswordSettings.Lowercase)
	props["PasswordRequireUppercase"] = strconv.FormatBool(*c.PasswordSettings.Uppercase)
	props["PasswordRequireNumber"] = strconv.FormatBool(*c.PasswordSettings.Number)
	props["PasswordRequireSymbol"] = strconv.FormatBool(*c.PasswordSettings.Symbol)

	// Set default values for all options that require a license.
	props["EnableCustomBrand"] = "false"
	props["CustomBrandText"] = ""
	props["CustomDescriptionText"] = ""
	props["EnableLdap"] = "false"
	props["LdapLoginFieldName"] = ""
	props["LdapLoginButtonColor"] = ""
	props["LdapLoginButtonBorderColor"] = ""
	props["LdapLoginButtonTextColor"] = ""
	props["EnableSaml"] = "false"
	props["SamlLoginButtonText"] = ""
	props["SamlLoginButtonColor"] = ""
	props["SamlLoginButtonBorderColor"] = ""
	props["SamlLoginButtonTextColor"] = ""
	props["EnableSignUpWithGoogle"] = "false"
	props["EnableSignUpWithOffice365"] = "false"
	props["EnableSignUpWithOpenId"] = "false"
	props["OpenIdButtonText"] = ""
	props["OpenIdButtonColor"] = ""
	props["CWSURL"] = ""
	props["EnableCustomBrand"] = strconv.FormatBool(*c.TeamSettings.EnableCustomBrand)
	props["CustomBrandText"] = *c.TeamSettings.CustomBrandText
	props["CustomDescriptionText"] = *c.TeamSettings.CustomDescriptionText
	props["EnableMultifactorAuthentication"] = strconv.FormatBool(*c.ServiceSettings.EnableMultifactorAuthentication)
	props["EnforceMultifactorAuthentication"] = "false"
	props["EnableGuestAccounts"] = strconv.FormatBool(*c.GuestAccountsSettings.Enable)
	props["GuestAccountsEnforceMultifactorAuthentication"] = strconv.FormatBool(*c.GuestAccountsSettings.EnforceMultifactorAuthentication)

	if license != nil {
		if *license.Features.LDAP {
			props["EnableLdap"] = strconv.FormatBool(*c.LdapSettings.Enable)
			props["LdapLoginFieldName"] = *c.LdapSettings.LoginFieldName
			props["LdapLoginButtonColor"] = *c.LdapSettings.LoginButtonColor
			props["LdapLoginButtonBorderColor"] = *c.LdapSettings.LoginButtonBorderColor
			props["LdapLoginButtonTextColor"] = *c.LdapSettings.LoginButtonTextColor
		}

		if *license.Features.SAML {
			props["EnableSaml"] = strconv.FormatBool(*c.SamlSettings.Enable)
			props["SamlLoginButtonText"] = *c.SamlSettings.LoginButtonText
			props["SamlLoginButtonColor"] = *c.SamlSettings.LoginButtonColor
			props["SamlLoginButtonBorderColor"] = *c.SamlSettings.LoginButtonBorderColor
			props["SamlLoginButtonTextColor"] = *c.SamlSettings.LoginButtonTextColor
		}

		if *license.Features.CustomTermsOfService {
			props["EnableCustomTermsOfService"] = strconv.FormatBool(*c.SupportSettings.CustomTermsOfServiceEnabled)
			props["CustomTermsOfServiceReAcceptancePeriod"] = strconv.FormatInt(int64(*c.SupportSettings.CustomTermsOfServiceReAcceptancePeriod), 10)
		}

		if *license.Features.MFA {
			props["EnforceMultifactorAuthentication"] = strconv.FormatBool(*c.ServiceSettings.EnforceMultifactorAuthentication)
		}

		if license.IsCloud() {
			// MM-48727: enable SSO options for free cloud - not in self hosted
			*license.Features.GoogleOAuth = true
			*license.Features.Office365OAuth = true
		}

		if *license.Features.GoogleOAuth {
			props["EnableSignUpWithGoogle"] = strconv.FormatBool(*c.GoogleSettings.Enable)
		}

		if *license.Features.Office365OAuth {
			props["EnableSignUpWithOffice365"] = strconv.FormatBool(*c.Office365Settings.Enable)
		}

		if *license.Features.OpenId {
			props["EnableSignUpWithOpenId"] = strconv.FormatBool(*c.OpenIdSettings.Enable)
			props["OpenIdButtonColor"] = *c.OpenIdSettings.ButtonColor
			props["OpenIdButtonText"] = *c.OpenIdSettings.ButtonText
		}
	}

	for key, value := range c.FeatureFlags.ToMap() {
		props["FeatureFlag"+key] = value
	}

	return props
}
