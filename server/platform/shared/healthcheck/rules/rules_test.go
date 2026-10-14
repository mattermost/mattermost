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

	for _, code := range []string{"PUSH_EMPTY_URL", "PUSH_BAD_SCHEME", "PUSH_TEST_PROXY", "SITE_URL_EMPTY", "SITE_URL_HTTP"} {
		_, ok := registry.Get(code)
		assert.True(t, ok, code)
	}
}

func TestBuiltinRulesOnCloud(t *testing.T) {
	var cloud []string
	for _, rule := range healthcheck.Builtin().Rules() {
		if rule.AppliesTo(healthcheck.Deployment{IsCloud: true}) {
			cloud = append(cloud, rule.Code)
		}
	}

	assert.ElementsMatch(t, []string{"PUSH_EMPTY_URL", "PUSH_BAD_SCHEME", "PUSH_TEST_PROXY",
		"LDAP_PORT_TLS_MISMATCH", "LDAP_PORT_PLAIN_MISMATCH", "LDAP_SKIP_CERT", "LDAP_QUERY_TIMEOUT_LOW", "LDAP_SYNC_INTERVAL_LOW", "LDAP_SYNC_NO_BASEDN", "LDAP_RECOMMENDED_AT_SCALE", "LDAP_ID_IS_EMAIL", "LDAP_SYNC_DUTY_CYCLE", "LDAP_PROBE_FAILED", "SAML_METADATA_UNREACHABLE", "SAML_SIGNATURE_SHA1", "SAML_VERIFY_OFF", "SAML_ENCRYPT_OFF", "SAML_ID_IS_EMAIL", "SAML_ID_MUTABLE",
	}, cloud)
}
