// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import "github.com/segmentio/analytics-go"

const (
	DIAGNOSTIC_URL = "https://d7zmvsa9e04kk.cloudfront.net"
	SEGMENT_KEY    = "ua1qQtmgOZWIM23YjD842tQAsN7Ydi5X"

	PROP_DIAGNOSTIC_ID                = "id"
	PROP_DIAGNOSTIC_CATEGORY          = "c"
	VAL_DIAGNOSTIC_CATEGORY_DEFAULT   = "d"
	PROP_DIAGNOSTIC_BUILD             = "b"
	PROP_DIAGNOSTIC_ENTERPRISE_READY  = "be"
	PROP_DIAGNOSTIC_DATABASE          = "db"
	PROP_DIAGNOSTIC_OS                = "os"
	PROP_DIAGNOSTIC_USER_COUNT        = "uc"
	PROP_DIAGNOSTIC_TEAM_COUNT        = "tc"
	PROP_DIAGNOSTIC_ACTIVE_USER_COUNT = "auc"
	PROP_DIAGNOSTIC_UNIT_TESTS        = "ut"

	TRACK_CONFIG_SERVICE      = "service"
	TRACK_CONFIG_TEAM         = "team"
	TRACK_CONFIG_SQL          = "sql"
	TRACK_CONFIG_LOG          = "log"
	TRACK_CONFIG_FILE         = "file"
	TRACK_CONFIG_RATE         = "rate"
	TRACK_CONFIG_EMAIL        = "email"
	TRACK_CONFIG_PRIVACY      = "privacy"
	TRACK_CONFIG_OAUTH        = "oauth"
	TRACK_CONFIG_LDAP         = "ldap"
	TRACK_CONFIG_COMPLIANCE   = "compliance"
	TRACK_CONFIG_LOCALIZATION = "localization"
	TRACK_CONFIG_SAML         = "saml"

	TRACK_LICENSE  = "license"
	TRACK_ACTIVITY = "activity"
	TRACK_VERSION  = "version"
)

var client *analytics.Client

func SendGeneralDiagnostics() {
	if *Cfg.LogSettings.EnableDiagnostics {
		initDiagnostics()
		trackConfig()
		trackLicense()
	}
}

func initDiagnostics() {
	if client == nil {
		client = analytics.New(SEGMENT_KEY)
		client.Identify(&analytics.Identify{
			UserId: CfgDiagnosticId,
		})
	}
}

func SendDiagnostic(event string, properties map[string]interface{}) {
	client.Track(&analytics.Track{
		Event:      event,
		UserId:     CfgDiagnosticId,
		Properties: properties,
	})
}

func trackConfig() {
	SendDiagnostic(TRACK_CONFIG_SERVICE, map[string]interface{}{
		"web_server_mode":                      *Cfg.ServiceSettings.WebserverMode,
		"enable_security_fix_alert":            *Cfg.ServiceSettings.EnableSecurityFixAlert,
		"enable_insecure_outgoing_connections": *Cfg.ServiceSettings.EnableInsecureOutgoingConnections,
		"enable_incoming_webhooks":             Cfg.ServiceSettings.EnableIncomingWebhooks,
		"enable_outgoing_webhooks":             Cfg.ServiceSettings.EnableOutgoingWebhooks,
		"enable_commands":                      *Cfg.ServiceSettings.EnableCommands,
		"enable_only_admin_integrations":       *Cfg.ServiceSettings.EnableOnlyAdminIntegrations,
		"enable_post_username_override":        Cfg.ServiceSettings.EnablePostUsernameOverride,
		"enable_post_icon_override":            Cfg.ServiceSettings.EnablePostIconOverride,
		"enable_custom_emoji":                  *Cfg.ServiceSettings.EnableCustomEmoji,
		"restrict_custom_emoji_creation":       *Cfg.ServiceSettings.RestrictCustomEmojiCreation,
		"enable_testing":                       Cfg.ServiceSettings.EnableTesting,
		"enable_developer":                     *Cfg.ServiceSettings.EnableDeveloper,
	})

	SendDiagnostic(TRACK_CONFIG_TEAM, map[string]interface{}{
		"enable_user_creation":                Cfg.TeamSettings.EnableUserCreation,
		"enable_team_creation":                Cfg.TeamSettings.EnableTeamCreation,
		"restrict_team_invite":                *Cfg.TeamSettings.RestrictTeamInvite,
		"restrict_public_channel_management":  *Cfg.TeamSettings.RestrictPublicChannelManagement,
		"restrict_private_channel_management": *Cfg.TeamSettings.RestrictPrivateChannelManagement,
		"enable_open_server":                  *Cfg.TeamSettings.EnableOpenServer,
		"enable_custom_brand":                 *Cfg.TeamSettings.EnableCustomBrand,
	})

	SendDiagnostic(TRACK_CONFIG_SQL, map[string]interface{}{
		"driver_name": Cfg.SqlSettings.DriverName,
	})

	SendDiagnostic(TRACK_CONFIG_LOG, map[string]interface{}{
		"enable_console":           Cfg.LogSettings.EnableConsole,
		"console_level":            Cfg.LogSettings.ConsoleLevel,
		"enable_file":              Cfg.LogSettings.EnableFile,
		"file_level":               Cfg.LogSettings.FileLevel,
		"enable_webhook_debugging": Cfg.LogSettings.EnableWebhookDebugging,
	})

	SendDiagnostic(TRACK_CONFIG_FILE, map[string]interface{}{
		"enable_public_links": Cfg.FileSettings.EnablePublicLink,
	})

	SendDiagnostic(TRACK_CONFIG_RATE, map[string]interface{}{
		"enable_rate_limiter":    *Cfg.RateLimitSettings.Enable,
		"vary_by_remote_address": Cfg.RateLimitSettings.VaryByRemoteAddr,
	})

	SendDiagnostic(TRACK_CONFIG_EMAIL, map[string]interface{}{
		"enable_sign_up_with_email":    Cfg.EmailSettings.EnableSignUpWithEmail,
		"enable_sign_in_with_email":    *Cfg.EmailSettings.EnableSignInWithEmail,
		"enable_sign_in_with_username": *Cfg.EmailSettings.EnableSignInWithUsername,
		"require_email_verification":   Cfg.EmailSettings.RequireEmailVerification,
		"send_email_notifications":     Cfg.EmailSettings.SendEmailNotifications,
		"connection_security":          Cfg.EmailSettings.ConnectionSecurity,
		"send_push_notifications":      *Cfg.EmailSettings.SendPushNotifications,
		"push_notification_contents":   *Cfg.EmailSettings.PushNotificationContents,
	})

	SendDiagnostic(TRACK_CONFIG_PRIVACY, map[string]interface{}{
		"show_email_address": Cfg.PrivacySettings.ShowEmailAddress,
		"show_full_name":     Cfg.PrivacySettings.ShowFullName,
	})

	SendDiagnostic(TRACK_CONFIG_OAUTH, map[string]interface{}{
		"gitlab":    Cfg.GitLabSettings.Enable,
		"google":    Cfg.GoogleSettings.Enable,
		"office365": Cfg.Office365Settings.Enable,
	})

	SendDiagnostic(TRACK_CONFIG_LDAP, map[string]interface{}{
		"enable":                        *Cfg.LdapSettings.Enable,
		"connection_security":           *Cfg.LdapSettings.ConnectionSecurity,
		"skip_certificate_verification": *Cfg.LdapSettings.SkipCertificateVerification,
	})

	SendDiagnostic(TRACK_CONFIG_COMPLIANCE, map[string]interface{}{
		"enable":       *Cfg.ComplianceSettings.Enable,
		"enable_daily": *Cfg.ComplianceSettings.EnableDaily,
	})

	SendDiagnostic(TRACK_CONFIG_LOCALIZATION, map[string]interface{}{
		"default_server_locale": *Cfg.LocalizationSettings.DefaultServerLocale,
		"default_client_locale": *Cfg.LocalizationSettings.DefaultClientLocale,
		"available_locales":     *Cfg.LocalizationSettings.AvailableLocales,
	})

	SendDiagnostic(TRACK_CONFIG_SAML, map[string]interface{}{
		"enable": *Cfg.SamlSettings.Enable,
	})
}

func trackLicense() {
	if IsLicensed {
		SendDiagnostic(TRACK_LICENSE, map[string]interface{}{
			"name":     License.Customer.Name,
			"company":  License.Customer.Company,
			"issued":   License.IssuedAt,
			"start":    License.StartsAt,
			"expire":   License.ExpiresAt,
			"users":    *License.Features.Users,
			"features": License.Features.ToMap(),
		})
	}
}
