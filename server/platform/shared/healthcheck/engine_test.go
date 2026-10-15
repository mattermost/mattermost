// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestEngineEvaluateContainsPanicsAndContinues(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
	registry := NewRegistry()
	registry.Register(
		Rule{
			Code:       "ALPHA",
			Area:       model.AreaPlatform,
			Severity:   SeverityWarning,
			RuleText:   model.RuleText{TitleID: "health.rule.alpha.title", RemediationID: "health.rule.alpha.remediation"},
			Surface:    SurfaceProduct,
			Volatility: VolatilityStable,
			Subject:    "ServiceSettings.SiteURL",
			Eval:       func(*Snapshot) []Result { return []Result{Resolved()} },
		},
		Rule{
			Code:       "PANIC_RULE",
			Area:       model.AreaPlatform,
			Severity:   SeverityWarning,
			RuleText:   model.RuleText{TitleID: "health.rule.panic_rule.title", RemediationID: "health.rule.panic_rule.remediation"},
			Surface:    SurfaceProduct,
			Volatility: VolatilityStable,
			Subject:    "ServiceSettings.SiteURL",
			Eval: func(*Snapshot) []Result {
				panic("boom")
			},
		},
	)

	engine := NewEngine(EngineOpts{Registry: registry, Now: func() time.Time { return now }})
	evaluations := engine.Evaluate(&Snapshot{})

	require.Equal(t, []Evaluation{
		{
			Code:        "ALPHA",
			Result:      Result{State: StateResolved, Subject: "ServiceSettings.SiteURL"},
			Fingerprint: Fingerprint("ALPHA", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
		{
			Code: "PANIC_RULE",
			Result: Result{
				State:     StateUnknown,
				Subject:   "ServiceSettings.SiteURL",
				MessageID: ReasonRulePanicked,
			},
			Fingerprint: Fingerprint("PANIC_RULE", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
	}, evaluations)
}

func TestEngineEvaluateSkipsCloudByDefault(t *testing.T) {
	t.Parallel()

	registry := NewRegistry()
	registry.Register(validRule("CLOUD_GATED_DEFAULT"))

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations := engine.Evaluate(&Snapshot{
		Deployment: Deployment{IsCloud: true},
	})

	require.Len(t, evaluations, 0)
}

func TestEngineEvaluateNodeScopeStampingOverwritesRuleScope(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	rule := validRule("NODE_SCOPE")
	rule.Eval = nil
	rule.EvalNode = func(*Snapshot, *NodeSnapshot) []Result {
		return []Result{
			{State: StateFiring, Scope: "rule-authored-scope", MessageID: "health.rule.node_scope.message"},
		}
	}
	registry.Register(rule)

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations := engine.Evaluate(&Snapshot{
		nodes: []*NodeSnapshot{
			{Hostname: "node-1"},
			{Hostname: "node-2"},
			{Hostname: "node-3"},
		},
	})

	require.Equal(t, []Evaluation{
		{
			Code:        "NODE_SCOPE",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", Scope: "node-1", MessageID: "health.rule.node_scope.message"},
			Fingerprint: Fingerprint("NODE_SCOPE", "ServiceSettings.SiteURL", "node-1"),
			EvaluatedAt: now,
		},
		{
			Code:        "NODE_SCOPE",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", Scope: "node-2", MessageID: "health.rule.node_scope.message"},
			Fingerprint: Fingerprint("NODE_SCOPE", "ServiceSettings.SiteURL", "node-2"),
			EvaluatedAt: now,
		},
		{
			Code:        "NODE_SCOPE",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", Scope: "node-3", MessageID: "health.rule.node_scope.message"},
			Fingerprint: Fingerprint("NODE_SCOPE", "ServiceSettings.SiteURL", "node-3"),
			EvaluatedAt: now,
		},
	}, evaluations)

	fingerprints := map[string]struct{}{}
	for _, evaluation := range evaluations {
		fingerprints[evaluation.Fingerprint] = struct{}{}
	}
	require.Len(t, fingerprints, 3)
}

func TestEngineEvaluateFingerprintSeparatesDifferentCodes(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	pushEmptyURL := validRule("PUSH_EMPTY_URL")
	pushBadScheme := validRule("PUSH_BAD_SCHEME")
	registry.Register(pushEmptyURL, pushBadScheme)

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations := engine.Evaluate(&Snapshot{})

	require.Equal(t, []Evaluation{
		{
			Code:        "PUSH_BAD_SCHEME",
			Result:      Result{State: StateResolved, Subject: "ServiceSettings.SiteURL"},
			Fingerprint: Fingerprint("PUSH_BAD_SCHEME", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
		{
			Code:        "PUSH_EMPTY_URL",
			Result:      Result{State: StateResolved, Subject: "ServiceSettings.SiteURL"},
			Fingerprint: Fingerprint("PUSH_EMPTY_URL", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
	}, evaluations)
	require.NotEqual(t, evaluations[0].Fingerprint, evaluations[1].Fingerprint)
}

func TestEngineEvaluateMultiSubjectCreatesDistinctFingerprints(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	rule := validRule("MULTI_SUBJECT")
	rule.Eval = func(*Snapshot) []Result {
		return []Result{
			FiringSubject("job.expiry_notify", "health.rule.multi_subject.message"),
			FiringSubject("job.ldap_sync", "health.rule.multi_subject.message"),
			FiringSubject("job.migrations", "health.rule.multi_subject.message"),
		}
	}
	registry.Register(rule)

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations := engine.Evaluate(&Snapshot{})

	require.Equal(t, []Evaluation{
		{
			Code:        "MULTI_SUBJECT",
			Result:      Result{State: StateFiring, Subject: "job.expiry_notify", MessageID: "health.rule.multi_subject.message"},
			Fingerprint: Fingerprint("MULTI_SUBJECT", "job.expiry_notify", ""),
			EvaluatedAt: now,
		},
		{
			Code:        "MULTI_SUBJECT",
			Result:      Result{State: StateFiring, Subject: "job.ldap_sync", MessageID: "health.rule.multi_subject.message"},
			Fingerprint: Fingerprint("MULTI_SUBJECT", "job.ldap_sync", ""),
			EvaluatedAt: now,
		},
		{
			Code:        "MULTI_SUBJECT",
			Result:      Result{State: StateFiring, Subject: "job.migrations", MessageID: "health.rule.multi_subject.message"},
			Fingerprint: Fingerprint("MULTI_SUBJECT", "job.migrations", ""),
			EvaluatedAt: now,
		},
	}, evaluations)
}

func TestEngineEvaluateNormalizesSubjectFromRuleDefault(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	rule := validRule("SUBJECT_DEFAULT")
	rule.Subject = "TeamSettings.SiteName"
	rule.Eval = func(*Snapshot) []Result {
		return []Result{
			Firing("health.rule.subject_default.message"),
		}
	}
	registry.Register(rule)

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations := engine.Evaluate(&Snapshot{})

	require.Equal(t, []Evaluation{
		{
			Code:        "SUBJECT_DEFAULT",
			Result:      Result{State: StateFiring, Subject: "TeamSettings.SiteName", MessageID: "health.rule.subject_default.message"},
			Fingerprint: Fingerprint("SUBJECT_DEFAULT", "TeamSettings.SiteName", ""),
			EvaluatedAt: now,
		},
	}, evaluations)
	require.Equal(t, "TeamSettings.SiteName", evaluations[0].Result.Subject)
}

func TestEvaluationSliceComparable(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	registry.Register(validRule("COMPARABLE"))

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	left := engine.Evaluate(&Snapshot{})
	right := []Evaluation{
		{
			Code:        "COMPARABLE",
			Result:      Result{State: StateResolved, Subject: "ServiceSettings.SiteURL"},
			Fingerprint: Fingerprint("COMPARABLE", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
	}

	require.Equal(t, right, left)
}

func TestEngineEvaluateWithBothFuncsSet(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	rule := validRule("CLUSTER_NODE_COUNT")
	rule.Eval = func(*Snapshot) []Result {
		return []Result{
			Firing("health.rule.cluster_node_count.message.global"),
		}
	}
	rule.EvalNode = func(*Snapshot, *NodeSnapshot) []Result {
		return []Result{
			Firing("health.rule.cluster_node_count.message.node"),
		}
	}
	registry.Register(rule)

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations := engine.Evaluate(&Snapshot{
		nodes: []*NodeSnapshot{
			{Hostname: "node-1"},
			{Hostname: "node-2"},
			{Hostname: "node-3"},
		},
	})

	require.Equal(t, []Evaluation{
		{
			Code:        "CLUSTER_NODE_COUNT",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", MessageID: "health.rule.cluster_node_count.message.global"},
			Fingerprint: Fingerprint("CLUSTER_NODE_COUNT", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
		{
			Code:        "CLUSTER_NODE_COUNT",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", Scope: "node-1", MessageID: "health.rule.cluster_node_count.message.node"},
			Fingerprint: Fingerprint("CLUSTER_NODE_COUNT", "ServiceSettings.SiteURL", "node-1"),
			EvaluatedAt: now,
		},
		{
			Code:        "CLUSTER_NODE_COUNT",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", Scope: "node-2", MessageID: "health.rule.cluster_node_count.message.node"},
			Fingerprint: Fingerprint("CLUSTER_NODE_COUNT", "ServiceSettings.SiteURL", "node-2"),
			EvaluatedAt: now,
		},
		{
			Code:        "CLUSTER_NODE_COUNT",
			Result:      Result{State: StateFiring, Subject: "ServiceSettings.SiteURL", Scope: "node-3", MessageID: "health.rule.cluster_node_count.message.node"},
			Fingerprint: Fingerprint("CLUSTER_NODE_COUNT", "ServiceSettings.SiteURL", "node-3"),
			EvaluatedAt: now,
		},
	}, evaluations)

	fingerprints := map[string]struct{}{}
	for _, evaluation := range evaluations {
		fingerprints[evaluation.Fingerprint] = struct{}{}
	}
	require.Len(t, fingerprints, 4)
	require.Equal(t, "", evaluations[0].Result.Scope)
}

func TestEngineEvaluateRule(t *testing.T) {
	t.Parallel()

	now := fixedNow()
	registry := NewRegistry()
	registry.Register(validRule("ONLY_THIS_ONE"), validRule("OTHER"))

	engine := NewEngine(EngineOpts{Registry: registry, Now: fixedNow})
	evaluations, err := engine.EvaluateRule(&Snapshot{}, "ONLY_THIS_ONE")
	require.NoError(t, err)
	require.Equal(t, []Evaluation{
		{
			Code:        "ONLY_THIS_ONE",
			Result:      Result{State: StateResolved, Subject: "ServiceSettings.SiteURL"},
			Fingerprint: Fingerprint("ONLY_THIS_ONE", "ServiceSettings.SiteURL", ""),
			EvaluatedAt: now,
		},
	}, evaluations)

	_, err = engine.EvaluateRule(&Snapshot{}, "MISSING")
	require.ErrorContains(t, err, `rule "MISSING" not found`)
}

func fixedNow() time.Time {
	return time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
}
