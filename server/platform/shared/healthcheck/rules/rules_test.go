// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package rules

import (
	"testing"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuiltinRegistry(t *testing.T) {
	registry := healthcheck.Builtin()
	require.NoError(t, registry.Validate())

	var codes []string
	for _, rule := range registry.Rules() {
		codes = append(codes, rule.Code)
	}

	// One block per rule package, in rules.go import order, so concurrent rule PRs insert in different places.
	assert.ElementsMatch(t, []string{
		// auth
		"LDAP_PORT_TLS_MISMATCH",
		"LDAP_PORT_PLAIN_MISMATCH",
		"LDAP_SKIP_CERT",
		"LDAP_QUERY_TIMEOUT_LOW",
		"LDAP_SYNC_NO_BASEDN",
		"LDAP_RECOMMENDED_AT_SCALE",
		"LDAP_ID_IS_EMAIL",
		"LDAP_SYNC_DUTY_CYCLE",
		"LDAP_PROBE_FAILED",
		"SAML_PROBE_FAILED",
		"SAML_SIGNATURE_SHA1",
		"SAML_VERIFY_OFF",
		"SAML_ENCRYPT_OFF",
		"SAML_ID_IS_EMAIL",
		"SAML_ID_MUTABLE",
		"SESSION_EXTEND_OFF",

		// cluster
		"CLUSTER_GOSSIP_UNENCRYPTED",
		"CLUSTER_LRU_CACHE",
		"CLUSTER_SINGLE_NODE",
		"CLUSTER_BAD_ADVERTISE",
		"CLUSTER_CONFIG_WRITABLE",
		"CLUSTER_VERSION_SKEW",

		// compliance
		"AUDIT_LOG_OFF",
		"COMPLIANCE_NO_DIR",
		"RETENTION_TIGHT_BATCHES",
		"EXPORT_GR_TIMEOUT_LOW",

		// database
		"DB_HA_FAILOVER_STORM_RISK",
		"DB_POSTGRES_UNSUPPORTED",
		"DB_POOL_SATURATED",
		"DB_REPLICA_UNUSED",
		"DB_NO_READ_REPLICA",
		"DB_NO_SEARCH_REPLICA",
		"DB_TRACE_ON",
		"DB_MAX_OPEN_CONNS_LOW",
		"DB_QUERY_TIMEOUT_HIGH",
		"DB_IDLE_EXCEEDS_OPEN",

		// jobs
		"JOB_STUCK",
		"JOB_WEDGED_AT_ZERO",
		"JOB_FAILED",

		// license
		"LICENSE_EXPIRED",
		"LICENSE_EXPIRING",
		"SEATS_OVER_DEPLOYED",
		"SEATS_LIMIT_REACHED",
		"SEATS_NEAR_CAPACITY",

		// notifications
		"PUSH_ID_ONLY",
		"MAX_NOTIFICATIONS_PER_CHANNEL",
		"SMTP_UNREACHABLE",
		"PUSH_EMPTY_URL",
		"PUSH_BAD_SCHEME",
		"PUSH_TEST_PROXY",

		// platform
		"FILESTORE_LOCAL_IN_CLUSTER",
		"FILESTORE_S3_NO_BUCKET",
		"FILESTORE_S3_SSL_OFF",
		"FILESTORE_UNREACHABLE",
		"ENV_UNSUPPORTED_OS",
		"BIND_PRIVILEGED_PORT",
		"NODE_FD_EXHAUSTION",
		"LOG_DEBUG_PROD",
		"LOG_FILE_OFF",
		"METRICS_OFF",
		"PLUGINS_OFF",
		"PLUGIN_HEALTH_OFF",
		"PLUGIN_NOT_RUNNING",
		"RATELIMIT_OFF_LARGE",
		"RATELIMIT_STORE_SMALL",
		"SITE_URL_EMPTY",
		"SITE_URL_HTTP",

		// search
		"ES_LOCALHOST_URL",
		"ES_SERVER_ERROR",
		"SEARCH_UNAVAILABLE",
		"SCALE_ES_REQUIRED",
		"SCALE_ES_RECOMMENDED",
		"ES_LIVE_BATCH_SYNC",
		"ES_LIVE_BATCH_TOO_HIGH",
		"ES_VERSION_UNSUPPORTED",
		"ES_MISSING_ICU",
		"ES_SKIP_TLS_VERIFY",

		// version
		"VERSION_BEHIND_ONE",
		"VERSION_BEHIND",
		"VERSION_EOL",
		"VERSION_ESR_NEAR_EOL",
	}, codes)
}

func TestBuiltinRulesOnCloud(t *testing.T) {
	var cloud []string
	for _, rule := range healthcheck.Builtin().Rules() {
		if rule.AppliesTo(true) {
			cloud = append(cloud, rule.Code)
		}
	}

	assert.ElementsMatch(t, []string{
		"LDAP_ID_IS_EMAIL",
		"LDAP_PORT_PLAIN_MISMATCH",
		"LDAP_PORT_TLS_MISMATCH",
		"LDAP_PROBE_FAILED",
		"LDAP_QUERY_TIMEOUT_LOW",
		"LDAP_RECOMMENDED_AT_SCALE",
		"LDAP_SKIP_CERT",
		"LDAP_SYNC_DUTY_CYCLE",
		"LDAP_SYNC_NO_BASEDN",
		"PLUGIN_NOT_RUNNING",
		"PUSH_BAD_SCHEME",
		"PUSH_EMPTY_URL",
		"PUSH_ID_ONLY",
		"PUSH_TEST_PROXY",
		"SAML_ENCRYPT_OFF",
		"SAML_ID_IS_EMAIL",
		"SAML_ID_MUTABLE",
		"SAML_PROBE_FAILED",
		"SAML_SIGNATURE_SHA1",
		"SAML_VERIFY_OFF",
	}, cloud)
}
