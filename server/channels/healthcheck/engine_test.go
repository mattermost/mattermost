// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// ---------------------------------------------------------------------------
// Spike exit criterion (Step 0)
// Proves: cel-go NativeTypes over *model.Config, probe.dbWrite() custom
// function, and matches() (regex) are all working end-to-end.
// Two findings must be produced from a crafted snapshot.
// ---------------------------------------------------------------------------

func TestSpike_PushEmptyURL_Fires(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	// Trigger: push enabled with blank server URL.
	*cfg.EmailSettings.SendPushNotifications = true
	*cfg.EmailSettings.PushNotificationServer = ""

	snap := &Snapshot{
		Config: cfg,
		Probes: &ProbeSection{DBWriteOK: true},
	}

	findings := engine.Evaluate(snap)
	codes := findingCodes(findings)
	assert.Contains(t, codes, "PUSH_EMPTY_URL", "PUSH_EMPTY_URL should fire when push is enabled with a blank server URL")
}

func TestSpike_ProbeDBWriteFails_Fires(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()

	snap := &Snapshot{
		Config: cfg,
		// Probe reports DB write failed.
		Probes: &ProbeSection{DBWriteOK: false},
	}

	findings := engine.Evaluate(snap)
	codes := findingCodes(findings)
	assert.Contains(t, codes, "DB_HEALTHCHECK_FAIL", "DB_HEALTHCHECK_FAIL should fire when probe.dbWrite() returns false")
}

// Confirm CEL's built-in matches() (regex) is available. DESIGN.md calls
// this out as a required capability for DSN inspection rules (rules 3, 44).
func TestSpike_CELMatchesAvailable(t *testing.T) {
	env, err := buildEnv()
	require.NoError(t, err)

	ast, issues := env.Compile(`"http://example.com".matches("^https?://")`)
	require.Nil(t, issues, "CEL matches() should compile without errors")
	require.NotNil(t, ast)
	assert.Equal(t, "bool", ast.OutputType().String(), "matches() must return bool")
}

// ---------------------------------------------------------------------------
// Rule compilation / static validator
// ---------------------------------------------------------------------------

func TestValidate_BuiltinRules_AllCompile(t *testing.T) {
	errs := Validate(BuiltinRules)
	require.Empty(t, errs, "all built-in rules must compile without errors: %v", errs)
}

func TestValidate_UnknownAccessor_ReturnsError(t *testing.T) {
	bad := []Rule{{
		Code: "TEST_BAD",
		Expr: `config.NonExistentField == "oops"`,
	}}
	errs := Validate(bad)
	require.NotEmpty(t, errs, "referencing an unknown accessor must fail validation")
}

func TestValidate_NonBoolExpr_ReturnsError(t *testing.T) {
	bad := []Rule{{
		Code: "TEST_NON_BOOL",
		Expr: `config.ServiceSettings.SiteURL`, // returns string, not bool
	}}
	errs := Validate(bad)
	require.NotEmpty(t, errs, "non-bool expression must fail validation")
}

// ---------------------------------------------------------------------------
// Per-rule unit tests (WS3)
// ---------------------------------------------------------------------------

func TestRule_PushBadScheme(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.EmailSettings.SendPushNotifications = true
	*cfg.EmailSettings.PushNotificationServer = "push.example.com" // no scheme

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "PUSH_BAD_SCHEME")
	assert.NotContains(t, findingCodes(findings), "PUSH_EMPTY_URL")
}

func TestRule_PushTestProxy(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.EmailSettings.SendPushNotifications = true
	*cfg.EmailSettings.PushNotificationServer = "https://push-test.mattermost.com"

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "PUSH_TEST_PROXY")
	assert.NotContains(t, findingCodes(findings), "PUSH_EMPTY_URL")
	assert.NotContains(t, findingCodes(findings), "PUSH_BAD_SCHEME")
}

func TestRule_PushDisabled_NoFindings(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.EmailSettings.SendPushNotifications = false

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	for _, f := range findings {
		assert.NotEqual(t, "PUSH_EMPTY_URL", f.Code)
		assert.NotEqual(t, "PUSH_BAD_SCHEME", f.Code)
		assert.NotEqual(t, "PUSH_TEST_PROXY", f.Code)
	}
}

func TestRule_SiteURLEmpty(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.ServiceSettings.SiteURL = ""

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "CORE_SITE_URL_EMPTY")
}

func TestRule_SiteURLHTTP(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.ServiceSettings.SiteURL = "http://mattermost.example.com"

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	codes := findingCodes(findings)
	assert.Contains(t, codes, "CORE_SITE_URL_HTTP")
	assert.NotContains(t, codes, "CORE_SITE_URL_EMPTY")
}

func TestRule_SiteURLHTTPS_NoFinding(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.ServiceSettings.SiteURL = "https://mattermost.example.com"

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	codes := findingCodes(findings)
	assert.NotContains(t, codes, "CORE_SITE_URL_EMPTY")
	assert.NotContains(t, codes, "CORE_SITE_URL_HTTP")
}

func TestRule_LogDebug(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.LogSettings.FileLevel = "DEBUG"

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "LOG_DEBUG_PROD")
}

func TestRule_LogFileOff(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.LogSettings.EnableFile = false

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "LOG_FILE_OFF")
}

func TestRule_SamlSHA1(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.SamlSettings.Enable = true
	*cfg.SamlSettings.SignatureAlgorithm = "RSAwithSHA1"

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "SAML_SHA1")
}

func TestRule_SamlVerifyOff(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.SamlSettings.Enable = true
	*cfg.SamlSettings.Verify = false

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "SAML_VERIFY_OFF")
}

func TestRule_SamlDisabled_NoSamlFindings(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.SamlSettings.Enable = false
	*cfg.SamlSettings.SignatureAlgorithm = "RSAwithSHA1" // would fire if enabled

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	codes := findingCodes(findings)
	assert.NotContains(t, codes, "SAML_SHA1")
	assert.NotContains(t, codes, "SAML_VERIFY_OFF")
	assert.NotContains(t, codes, "SAML_MISSING_IDPURL")
}

func TestRule_FilestoreLocalUnderHA(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.FileSettings.DriverName = "local"
	*cfg.ClusterSettings.Enable = true

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "FS_LOCAL_UNDER_HA")
}

func TestRule_FilestoreS3NoBucket(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.FileSettings.DriverName = "amazons3"
	*cfg.FileSettings.AmazonS3Bucket = ""

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "FS_S3_NO_BUCKET")
}

func TestRule_ComplianceNoDir(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.ComplianceSettings.Enable = true
	*cfg.ComplianceSettings.Directory = ""

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "COMPLIANCE_NO_DIR")
}

func TestRule_RetentionDeprecatedDays(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.DataRetentionSettings.EnableMessageDeletion = true
	*cfg.DataRetentionSettings.MessageRetentionDays = 365
	*cfg.DataRetentionSettings.MessageRetentionHours = 0

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "RETENTION_DEPRECATED_DAYS")
}

func TestRule_RetentionBatchZero(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.DataRetentionSettings.EnableMessageDeletion = true
	*cfg.DataRetentionSettings.BatchSize = 0

	findings := engine.Evaluate(&Snapshot{Config: cfg, Probes: &ProbeSection{DBWriteOK: true}})
	assert.Contains(t, findingCodes(findings), "RETENTION_BATCH_ZERO")
}

// TestProbeSection_Nil_SkipsProbeRules verifies that when the probe section is
// absent the probe-volatility rule (DB_HEALTHCHECK_FAIL) is not fired, even
// though the implicit probe result would be false.
func TestProbeSection_Nil_SkipsProbeRules(t *testing.T) {
	engine, err := NewEngine(BuiltinRules)
	require.NoError(t, err)

	cfg := &model.Config{}
	cfg.SetDefaults()

	snap := &Snapshot{
		Config: cfg,
		Probes: nil, // section not collected
	}

	findings := engine.Evaluate(snap)
	codes := findingCodes(findings)
	assert.NotContains(t, codes, "DB_HEALTHCHECK_FAIL",
		"probe rules must not fire when probe section is not populated")
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func findingCodes(findings []Finding) []string {
	codes := make([]string, 0, len(findings))
	for _, f := range findings {
		codes = append(codes, f.Code)
	}
	return codes
}
