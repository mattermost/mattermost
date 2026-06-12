// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

// BuiltinRules is the in-repo baseline rule catalog. Rules are expressed as
// CEL expressions over the snapshot vocabulary defined in engine.go.
//
// Each entry is one finding code. Multi-finding Python rules are split into
// one Rule per finding code so the state machine (WS4) can track and mute
// them independently.
//
// Design note: DESIGN.md leans toward YAML for the catalog once the P2
// remote feed lands (rules authored in a repo, CI-validated, signed). Go
// literals are used here for the P1 baseline because they are compiled and
// type-checked at build time (renamed model fields = compile errors in the
// CEL env registration). The YAML-based feed loader will use the same Rule
// struct. No migration needed at P2 — just add the loader alongside.
//
// Rule sourcing: each rule shows the originating Python function and finding
// code from mattermost_healthcheck.py so diffs stay auditable.
var BuiltinRules = []Rule{

	// -----------------------------------------------------------------------
	// check_push_notifications (bucket A — pure config)
	// Source: check_push_notifications / PUSH_EMPTY_URL
	// -----------------------------------------------------------------------
	{
		Code:       "PUSH_EMPTY_URL",
		Severity:   SeverityCritical,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "push",
		Scope:      ScopeAll,
		Expr:       `config.EmailSettings.SendPushNotifications && config.EmailSettings.PushNotificationServer == ""`,
		Title:      "Push enabled but PushNotificationServer is blank",
		Detail:     "Every push attempt will fail with 'unsupported protocol scheme'.",
		Remediation: "Point EmailSettings.PushNotificationServer to https://push.mattermost.com " +
			"or your self-hosted push proxy.",
		DocsURL: "https://docs.mattermost.com/deploy/mobile-hpns.html",
	},

	// Source: check_push_notifications / PUSH_BAD_SCHEME
	{
		Code:       "PUSH_BAD_SCHEME",
		Severity:   SeverityCritical,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "push",
		Scope:      ScopeAll,
		Expr: `config.EmailSettings.SendPushNotifications` +
			` && config.EmailSettings.PushNotificationServer != ""` +
			` && !config.EmailSettings.PushNotificationServer.startsWith("http://")` +
			` && !config.EmailSettings.PushNotificationServer.startsWith("https://")`,
		Title:       "PushNotificationServer has an invalid URL scheme",
		Detail:      "The push server URL must start with http:// or https://. Mobile users will not receive notifications.",
		Remediation: "Prefix PushNotificationServer with https:// and verify reachability from the app node.",
		DocsURL:     "https://docs.mattermost.com/deploy/mobile-hpns.html",
	},

	// Source: check_push_notifications / PUSH_TEST_PROXY
	{
		Code:       "PUSH_TEST_PROXY",
		Severity:   SeverityWarning,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "push",
		Scope:      ScopeAll,
		Expr:       `config.EmailSettings.SendPushNotifications && config.EmailSettings.PushNotificationServer.contains("push-test.mattermost.com")`,
		Title:      "PushNotificationServer points at the test push proxy",
		Detail:     "push-test.mattermost.com has no SLA or throughput guarantee and is not intended for production use.",
		Remediation: "Switch to https://push.mattermost.com (production HPNS, included with Enterprise) " +
			"or a self-hosted push proxy.",
		DocsURL: "https://docs.mattermost.com/deploy/mobile-hpns.html",
	},

	// -----------------------------------------------------------------------
	// check_ping_status (bucket B — probe.dbWrite)
	// Source: check_ping_status / DB_HEALTHCHECK_FAIL
	// -----------------------------------------------------------------------
	{
		Code:        "DB_HEALTHCHECK_FAIL",
		Severity:    SeverityCritical,
		Volatility:  VolatilityProbe,
		Surface:     SurfaceProduct,
		Area:        "database",
		Scope:       ScopeAll,
		Expr:        `!probe.dbWrite()`,
		Title:       "Database health-check write is failing",
		Detail:      "DBHealthCheckWrite/Delete failed against the primary database.",
		Remediation: "Verify primary DB connectivity, disk space, long-running transactions, and max_connections on the DB server.",
		DocsURL:     "https://docs.mattermost.com/install/troubleshooting.html",
	},

	// -----------------------------------------------------------------------
	// check_site_url (bucket A — pure config)
	// Source: check_site_url / CORE_SITE_URL_EMPTY
	// -----------------------------------------------------------------------
	{
		Code:       "CORE_SITE_URL_EMPTY",
		Severity:   SeverityCritical,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "core",
		Scope:      ScopeAll,
		Expr:       `config.ServiceSettings.SiteURL == ""`,
		Title:      "ServiceSettings.SiteURL is empty",
		Detail:     "SiteURL is required for webhook URLs, OAuth callbacks, mobile push payloads, and email links. Empty = broken integrations.",
		Remediation: "Set SiteURL to the public HTTPS URL of the server " +
			"(e.g. https://mattermost.example.com).",
		DocsURL: "https://docs.mattermost.com/configure/environment-configuration-settings.html#site-url",
	},

	// Source: check_site_url / CORE_SITE_URL_HTTP
	{
		Code:        "CORE_SITE_URL_HTTP",
		Severity:    SeverityWarning,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "core",
		Scope:       ScopeAll,
		Expr:        `config.ServiceSettings.SiteURL.startsWith("http://")`,
		Title:       "SiteURL uses http:// (not https://)",
		Detail:      "Session cookies and auth tokens traverse cleartext when SiteURL uses http://.",
		Remediation: "Serve Mattermost via HTTPS and update ServiceSettings.SiteURL to use https://.",
		DocsURL:     "https://docs.mattermost.com/configure/environment-configuration-settings.html#site-url",
	},

	// -----------------------------------------------------------------------
	// check_logging (bucket A — pure config)
	// Source: check_logging / LOG_DEBUG_PROD
	// -----------------------------------------------------------------------
	{
		Code:        "LOG_DEBUG_PROD",
		Severity:    SeverityWarning,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "logging",
		Scope:       ScopeAll,
		Expr:        `config.LogSettings.FileLevel == "DEBUG"`,
		Title:       "LogSettings.FileLevel is DEBUG",
		Detail:      "Debug logs fill disk quickly and may leak structured payloads. Use DEBUG only while actively diagnosing an issue.",
		Remediation: "Set LogSettings.FileLevel to INFO or WARN.",
		DocsURL:     "https://docs.mattermost.com/configure/environment-configuration-settings.html#file-log-level",
	},

	// Source: check_logging / LOG_FILE_OFF
	{
		Code:        "LOG_FILE_OFF",
		Severity:    SeverityWarning,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "logging",
		Scope:       ScopeAll,
		Expr:        `!config.LogSettings.EnableFile`,
		Title:       "File logging is disabled",
		Detail:      "LogSettings.EnableFile=false. If logs are not captured by an external collector (stdout/journald/sidecar), post-mortem support becomes nearly impossible.",
		Remediation: "Verify logs are captured by an external collector. If not, set LogSettings.EnableFile=true and configure a rotating FileLocation.",
		DocsURL:     "https://docs.mattermost.com/configure/environment-configuration-settings.html#enable-file",
	},

	// -----------------------------------------------------------------------
	// check_saml (bucket A — pure config)
	// Source: check_saml / SAML_SHA1
	// -----------------------------------------------------------------------
	{
		Code:       "SAML_SHA1",
		Severity:   SeverityCritical,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "saml",
		Scope:      ScopeAll,
		Expr: `config.SamlSettings.Enable` +
			` && (config.SamlSettings.SignatureAlgorithm == "RSAwithSHA1"` +
			` || config.SamlSettings.SignatureAlgorithm == "http://www.w3.org/2000/09/xmldsig#rsa-sha1")`,
		Title: "SAML SignatureAlgorithm is set to SHA1",
		Detail: "Many IdPs (Okta, Azure AD, ADFS) reject SHA1-signed AuthnRequests. " +
			"This is behind a large share of 'SAML login suddenly broken' support tickets.",
		Remediation: "Set SamlSettings.SignatureAlgorithm to RSAwithSHA256.",
		DocsURL:     "https://docs.mattermost.com/configure/authentication-configuration-settings.html#signature-algorithm",
	},

	// Source: check_saml / SAML_VERIFY_OFF
	{
		Code:        "SAML_VERIFY_OFF",
		Severity:    SeverityCritical,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "saml",
		Scope:       ScopeAll,
		Expr:        `config.SamlSettings.Enable && !config.SamlSettings.Verify`,
		Title:       "SAML assertion verification is disabled",
		Detail:      "SamlSettings.Verify=false. IdP assertion signatures are not being validated — authentication is trusting unverified SAML responses.",
		Remediation: "Set SamlSettings.Verify=true and install the IdP signing certificate.",
		DocsURL:     "https://docs.mattermost.com/configure/authentication-configuration-settings.html#verify-signature",
	},

	// Source: check_saml / SAML_MISSING_IDPURL
	{
		Code:        "SAML_MISSING_IDPURL",
		Severity:    SeverityCritical,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "saml",
		Scope:       ScopeAll,
		Expr:        `config.SamlSettings.Enable && config.SamlSettings.IdpURL == ""`,
		Title:       "SamlSettings.IdpURL is empty",
		Detail:      "SAML login cannot complete without the IdP SSO URL.",
		Remediation: "Populate SamlSettings.IdpURL from your IdP metadata XML (SingleSignOnService Location).",
		DocsURL:     "https://docs.mattermost.com/configure/authentication-configuration-settings.html#identity-provider-sso-url",
	},

	// -----------------------------------------------------------------------
	// check_filestore (bucket A — pure config)
	// Source: check_filestore / FS_LOCAL_UNDER_HA
	// -----------------------------------------------------------------------
	{
		Code:        "FS_LOCAL_UNDER_HA",
		Severity:    SeverityCritical,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "filestore",
		Scope:       ScopeAll,
		Expr:        `config.FileSettings.DriverName == "local" && config.ClusterSettings.Enable`,
		Title:       "Local filestore is configured with HA clustering enabled",
		Detail:      "FileSettings.DriverName=local with ClusterSettings.Enable=true. Files uploaded to one node will not be accessible from other nodes unless the directory is a shared network mount.",
		Remediation: "Migrate to an object store (amazons3 / Azure Blob) or confirm all nodes mount the same shared POSIX directory.",
		DocsURL:     "https://docs.mattermost.com/scale/high-availability-cluster.html",
	},

	// Source: check_filestore / FS_S3_NO_BUCKET
	{
		Code:        "FS_S3_NO_BUCKET",
		Severity:    SeverityCritical,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "filestore",
		Scope:       ScopeAll,
		Expr:        `config.FileSettings.DriverName == "amazons3" && config.FileSettings.AmazonS3Bucket == ""`,
		Title:       "S3 filestore driver selected but bucket name is empty",
		Detail:      "FileSettings.AmazonS3Bucket is empty — all file uploads will fail.",
		Remediation: "Populate FileSettings.AmazonS3Bucket, AmazonS3Region, and verify IAM credentials.",
		DocsURL:     "https://docs.mattermost.com/configure/environment-configuration-settings.html#amazon-s3-bucket",
	},

	// -----------------------------------------------------------------------
	// check_compliance (bucket A — pure config)
	// Source: check_compliance / COMPLIANCE_NO_DIR
	// -----------------------------------------------------------------------
	{
		Code:        "COMPLIANCE_NO_DIR",
		Severity:    SeverityCritical,
		Volatility:  VolatilityStable,
		Surface:     SurfaceProduct,
		Area:        "compliance",
		Scope:       ScopeAll,
		Expr:        `config.ComplianceSettings.Enable && config.ComplianceSettings.Directory == ""`,
		Title:       "Compliance export enabled but Directory is empty",
		Detail:      "ComplianceSettings.Directory is empty — compliance exports have nowhere to write.",
		Remediation: "Set ComplianceSettings.Directory to a writable path on the server.",
		DocsURL:     "https://docs.mattermost.com/comply/compliance-export.html",
	},

	// -----------------------------------------------------------------------
	// check_data_retention (bucket A — pure config)
	// Source: check_data_retention / RETENTION_DEPRECATED_DAYS
	// -----------------------------------------------------------------------
	{
		Code:       "RETENTION_DEPRECATED_DAYS",
		Severity:   SeverityWarning,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "retention",
		Scope:      ScopeAll,
		Expr: `(config.DataRetentionSettings.EnableMessageDeletion || config.DataRetentionSettings.EnableFileDeletion)` +
			` && config.DataRetentionSettings.MessageRetentionDays > 0` +
			` && config.DataRetentionSettings.MessageRetentionHours == 0`,
		Title:       "Data retention is using the deprecated MessageRetentionDays field",
		Detail:      "MessageRetentionDays is deprecated; the server now prefers MessageRetentionHours. Mixed or unset values can produce surprising deletion windows.",
		Remediation: "Migrate to DataRetentionSettings.MessageRetentionHours (set to days × 24) and leave MessageRetentionDays at its default.",
		DocsURL:     "https://docs.mattermost.com/comply/data-retention-policy.html",
	},

	// Source: check_data_retention / RETENTION_BATCH_ZERO
	{
		Code:       "RETENTION_BATCH_ZERO",
		Severity:   SeverityCritical,
		Volatility: VolatilityStable,
		Surface:    SurfaceProduct,
		Area:       "retention",
		Scope:      ScopeAll,
		Expr: `(config.DataRetentionSettings.EnableMessageDeletion || config.DataRetentionSettings.EnableFileDeletion)` +
			` && config.DataRetentionSettings.BatchSize == 0`,
		Title:       "Data retention BatchSize is zero — no rows will be deleted",
		Detail:      "DataRetentionSettings.BatchSize=0 means the retention job processes zero rows per run. All retention jobs will be no-ops.",
		Remediation: "Set DataRetentionSettings.BatchSize to 1000 or higher (default is 3000).",
		DocsURL:     "https://docs.mattermost.com/comply/data-retention-policy.html",
	},
}
