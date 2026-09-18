// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestRuleAppliesTo(t *testing.T) {
	t.Parallel()

	cloudRule := validRule("CLOUD")
	cloudRule.AppliesToCloud = true

	onPremRule := validRule("ONPREM")
	onPremRule.AppliesToCloud = false

	require.True(t, cloudRule.AppliesTo(Deployment{IsCloud: true}))
	require.False(t, onPremRule.AppliesTo(Deployment{IsCloud: true}))
	require.True(t, onPremRule.AppliesTo(Deployment{IsCloud: false}))
	require.True(t, cloudRule.AppliesTo(Deployment{IsCloud: false}))
}

func validRule(code string) Rule {
	return Rule{
		Code:       code,
		Area:       model.AreaPlatform,
		Severity:   SeverityWarning,
		RuleText:   model.RuleText{SummaryID: "health.rule." + strings.ToLower(code) + ".summary", RemediationID: "health.rule." + strings.ToLower(code) + ".remediation"},
		Surface:    SurfaceProduct,
		Volatility: VolatilityStable,
		Subject:    "ServiceSettings.SiteURL",
		Eval:       func(*Snapshot) []Result { return []Result{Resolved()} },
	}
}
