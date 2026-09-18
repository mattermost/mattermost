// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestRegistryRulesSortedByCode(t *testing.T) {
	t.Parallel()

	registry := NewRegistry()
	registry.Register(validRule("BETA"), validRule("ALPHA"))

	rules := registry.Rules()
	require.Len(t, rules, 2)
	require.Equal(t, "ALPHA", rules[0].Code)
	require.Equal(t, "BETA", rules[1].Code)
}

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

func TestRegistryValidate(t *testing.T) {
	t.Parallel()

	t.Run("both eval funcs set is valid", func(t *testing.T) {
		registry := NewRegistry()
		rule := validRule("BOTH_EVAL")
		rule.EvalNode = func(*Snapshot, *NodeSnapshot) []Result { return []Result{Resolved()} }

		registry.Register(rule)
		require.NoError(t, registry.Validate())
	})

	testCases := []struct {
		name            string
		rules           []Rule
		expectedSubtext string
	}{
		{
			name: "neither eval func",
			rules: []Rule{
				func() Rule {
					rule := validRule("NO_EVAL")
					rule.Eval = nil
					return rule
				}(),
			},
			expectedSubtext: "must define Eval and/or EvalNode",
		},
		{
			name: "duplicate code",
			rules: []Rule{
				validRule("DUPLICATE"),
				validRule("DUPLICATE"),
			},
			expectedSubtext: "duplicate rule code",
		},
		{
			name: "empty code",
			rules: []Rule{
				func() Rule {
					rule := validRule("EMPTY")
					rule.Code = ""
					return rule
				}(),
			},
			expectedSubtext: "code cannot be empty",
		},
		{
			name: "empty summary id",
			rules: []Rule{
				func() Rule {
					rule := validRule("EMPTY_SUMMARY")
					rule.SummaryID = ""
					return rule
				}(),
			},
			expectedSubtext: "summary id cannot be empty",
		},
		{
			name: "empty remediation id",
			rules: []Rule{
				func() Rule {
					rule := validRule("EMPTY_REMEDIATION")
					rule.RemediationID = ""
					return rule
				}(),
			},
			expectedSubtext: "remediation id cannot be empty",
		},
		{
			name: "invalid area",
			rules: []Rule{
				func() Rule {
					rule := validRule("BAD_AREA")
					rule.Area = model.HealthArea("db")
					return rule
				}(),
			},
			expectedSubtext: "unknown area",
		},
		{
			name: "invalid severity",
			rules: []Rule{
				func() Rule {
					rule := validRule("BAD_SEVERITY")
					rule.Severity = Severity("fatal")
					return rule
				}(),
			},
			expectedSubtext: "unknown severity",
		},
		{
			name: "invalid surface",
			rules: []Rule{
				func() Rule {
					rule := validRule("BAD_SURFACE")
					rule.Surface = Surface("customer")
					return rule
				}(),
			},
			expectedSubtext: "unknown surface",
		},
		{
			name: "invalid volatility",
			rules: []Rule{
				func() Rule {
					rule := validRule("BAD_VOLATILITY")
					rule.Volatility = Volatility("event_window")
					return rule
				}(),
			},
			expectedSubtext: "unknown volatility",
		},
		{
			name: "summary convention",
			rules: []Rule{
				func() Rule {
					rule := validRule("SUMMARY_CONVENTION")
					rule.SummaryID = "health.rule.other_rule.summary"
					return rule
				}(),
			},
			expectedSubtext: "summary id must be",
		},
		{
			name: "remediation convention",
			rules: []Rule{
				func() Rule {
					rule := validRule("REMEDIATION_CONVENTION")
					rule.RemediationID = "health.rule.other_rule.remediation"
					return rule
				}(),
			},
			expectedSubtext: "remediation id must be",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			registry := NewRegistry()
			registry.Register(tc.rules...)

			err := registry.Validate()
			require.Error(t, err)
			require.ErrorContains(t, err, tc.expectedSubtext)
		})
	}
}

func validRule(code string) Rule {
	return Rule{
		Code:       code,
		Area:       model.AreaPlatform,
		Severity:   SeverityWarning,
		RuleText:   model.RuleText{SummaryID: "health.rule." + lower(code) + ".summary", RemediationID: "health.rule." + lower(code) + ".remediation"},
		Surface:    SurfaceProduct,
		Volatility: VolatilityStable,
		Subject:    "ServiceSettings.SiteURL",
		Eval:       func(*Snapshot) []Result { return []Result{Resolved()} },
	}
}

func lower(in string) string {
	out := make([]rune, 0, len(in))
	for _, r := range in {
		if r >= 'A' && r <= 'Z' {
			out = append(out, r+('a'-'A'))
			continue
		}
		out = append(out, r)
	}
	return string(out)
}
