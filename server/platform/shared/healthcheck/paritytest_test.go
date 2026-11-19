// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
)

// The rules register themselves into Builtin, and they import this package, so this test lives in
// healthcheck_test.
func TestSampledCodesAreBuiltinRules(t *testing.T) {
	for _, code := range healthcheck.SampledCodes {
		_, ok := healthcheck.Builtin().Get(code)
		assert.True(t, ok, "SampledCodes lists %s, which is not a built-in rule", code)
	}
}
