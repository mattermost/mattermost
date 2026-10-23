// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRuleAppliesTo(t *testing.T) {
	t.Parallel()

	cloudRule := validRule("CLOUD")
	cloudRule.AppliesToCloud = true

	onPremRule := validRule("ONPREM")
	onPremRule.AppliesToCloud = false

	require.True(t, cloudRule.AppliesTo(true))
	require.False(t, onPremRule.AppliesTo(true))
	require.True(t, onPremRule.AppliesTo(false))
	require.True(t, cloudRule.AppliesTo(false))
}

func validRule(code string) Rule {
	return Rule{
		Code:       code,
		Area:       model.AreaPlatform,
		Severity:   SeverityWarning,
		RuleText:   model.RuleText{TitleID: "health.rule." + strings.ToLower(code) + ".title", RemediationID: "health.rule." + strings.ToLower(code) + ".remediation"},
		Surface:    SurfaceProduct,
		Volatility: VolatilityStable,
		Subject:    "ServiceSettings.SiteURL",
		Eval:       func(*Snapshot) []Result { return []Result{Resolved()} },
	}
}

func TestRuleIsNodeScoped(t *testing.T) {
	t.Parallel()

	require.False(t, validRule("WORKSPACE").IsNodeScoped())

	nodeRule := validRule("NODE")
	nodeRule.EvalNode = func(*Snapshot, *NodeSnapshot) []Result { return nil }
	require.True(t, nodeRule.IsNodeScoped())
}

func TestGate(t *testing.T) {
	t.Parallel()

	firing := Firing("message")
	check := func(*Snapshot) Result { return firing }
	nodeCheck := func(*Snapshot, *NodeSnapshot) Result { return firing }

	testCases := []struct {
		name     string
		enabled  bool
		ok       bool
		expected Result
	}{
		{name: "gate unknown", ok: false, expected: Unknown(ReasonLicenseUnavailable)},
		{name: "gate off", enabled: false, ok: true, expected: Resolved()},
		{name: "gate on", enabled: true, ok: true, expected: firing},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			gate := func(*Snapshot) (bool, bool) { return tc.enabled, tc.ok }
			assert.Equal(t, []Result{tc.expected}, Gate(gate, ReasonLicenseUnavailable, check)(&Snapshot{}))
			assert.Equal(t, []Result{tc.expected}, GateNode(gate, ReasonLicenseUnavailable, nodeCheck)(&Snapshot{}, &NodeSnapshot{}))
		})
	}
}

func TestLicensed(t *testing.T) {
	t.Parallel()

	firing := []Result{Firing("message")}
	eval := func(*Snapshot) []Result { return firing }
	nodeEval := func(*Snapshot, *NodeSnapshot) []Result { return firing }
	cluster := func(f *model.Features) *bool { return f.Cluster }

	testCases := []struct {
		name     string
		license  model.SupportPacketLicense
		expected []Result
	}{
		{name: "unlicensed", expected: []Result{Resolved()}},
		{name: "licensed packet without features runs the rule", license: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise}, expected: firing},
		{name: "feature not recorded runs the rule", license: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: &model.Features{}}, expected: firing},
		{name: "feature off", license: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuProfessional, Features: &model.Features{Cluster: new(false)}}, expected: []Result{Resolved()}},
		{name: "feature on", license: model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise, Features: &model.Features{Cluster: new(true)}}, expected: firing},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			s := licensedSnapshot(tc.license)
			assert.Equal(t, tc.expected, Licensed(cluster, eval)(s))
			assert.Equal(t, tc.expected, LicensedNode(cluster, nodeEval)(s, &NodeSnapshot{}))
		})
	}

	t.Run("license section missing", func(t *testing.T) {
		assert.Equal(t, []Result{Unknown(ReasonLicenseUnavailable)}, Licensed(cluster, eval)(&Snapshot{}))
	})

	t.Run("resolved rule ignores missing license data", func(t *testing.T) {
		resolved := []Result{Resolved().WithValue(1)}
		assert.Equal(t, resolved, Licensed(cluster, func(*Snapshot) []Result { return resolved })(&Snapshot{}))
	})
}
