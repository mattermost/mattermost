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
