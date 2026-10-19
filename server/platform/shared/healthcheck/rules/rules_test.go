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

	// One block per rule package, in rules.go import order, so concurrent rule PRs insert in different places.
	for _, code := range []string{
		// cluster
		"CLUSTER_SINGLE_NODE",
		"CLUSTER_VERSION_SKEW",

		// compliance
		"COMPLIANCE_NO_DIR",
		"AUDIT_LOG_OFF",
		"RETENTION_TIGHT_BATCHES",
		"EXPORT_GR_TIMEOUT_LOW",

		// jobs
		"JOB_STUCK",
		"JOB_WEDGED_AT_ZERO",
		"JOB_FAILED",

		// notifications
		"PUSH_EMPTY_URL",
		"PUSH_BAD_SCHEME",
		"PUSH_TEST_PROXY",

		// platform
		"SITE_URL_EMPTY",
		"SITE_URL_HTTP",
		"RATELIMIT_OFF_LARGE",
	} {
		_, ok := registry.Get(code)
		assert.True(t, ok, code)
	}
}

func TestBuiltinRulesOnCloud(t *testing.T) {
	var cloud []string
	for _, rule := range healthcheck.Builtin().Rules() {
		if rule.AppliesTo(true) {
			cloud = append(cloud, rule.Code)
		}
	}

	assert.ElementsMatch(t, []string{
		"PLUGIN_NOT_RUNNING",
		"PUSH_BAD_SCHEME",
		"PUSH_EMPTY_URL",
		"PUSH_ID_ONLY",
		"PUSH_TEST_PROXY",
	}, cloud)
}
