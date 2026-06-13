// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package healthcheck implements the Built-in Health Dashboard rule engine
// (WS1 + WS2 + WS3). It is intentionally self-contained so that both the
// server runtime and mmctl can import it without pulling in app-layer state.
//
// The probe.* functions (e.g. probe.dbWrite()) require side-effecting calls
// that live in the app layer. Callers supply a [ProbeProvider] interface; for
// tests a fake implementation is sufficient.
//
// Out of scope for this package (later work items):
//   - WS4 findings store / state machine (DB + migrations)
//   - WS5 evaluation job (leader-elected periodic job)
//   - WS6 REST API + mmctl command surface
//   - WS7 System Console UI
//   - P2 signed remote rule feed
package healthcheck

// Severity classifies how urgent a finding is.
type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

// Volatility describes how a rule's inputs change over time, which determines
// the debounce / hysteresis policy the findings store (WS4) will apply.
type Volatility string

const (
	// VolatilityStable — config-derived; fires immediately, no debounce.
	VolatilityStable Volatility = "stable"
	// VolatilityProbe — transient/network; consecutive-failure debounce.
	VolatilityProbe Volatility = "probe"
	// VolatilityBoundary — threshold-crossing; separate fire/clear thresholds.
	VolatilityBoundary Volatility = "boundary"
	// VolatilityClusterMembership — cluster topology; debounce for deploys.
	VolatilityClusterMembership Volatility = "cluster_membership"
	// VolatilityFeed — depends on external feed; unknown when feed unreachable.
	VolatilityFeed Volatility = "feed"
)

// Surface indicates whether a finding is shown in the in-product dashboard
// ("product") or only to CSE tooling / mmctl ("internal").
type Surface string

const (
	SurfaceProduct  Surface = "product"
	SurfaceInternal Surface = "internal"
)

// DeploymentScope controls on which deployment types a rule fires.
type DeploymentScope string

const (
	ScopeAll        DeploymentScope = "all"
	ScopeOnPrem     DeploymentScope = "on_prem"
	ScopeCloud      DeploymentScope = "cloud"
	ScopeSelfHosted DeploymentScope = "self_hosted"
)

// FindingState is the three-valued state of a finding, per DESIGN.md §Flapping.
// "unknown ≠ resolved" is load-bearing: a temporarily unavailable section must
// never produce a spurious resolution.
type FindingState string

const (
	// FindingStateFiring — rule expression evaluated to true this cycle.
	FindingStateFiring FindingState = "firing"
	// FindingStateResolved — rule expression evaluated to false this cycle,
	// and the finding had a prior firing row. Rules that never fired produce
	// no row; this state only appears after at least one firing.
	FindingStateResolved FindingState = "resolved"
	// FindingStateUnknown — rule could not be evaluated this cycle (section
	// unavailable, probe not collected, eval error). Neither firing nor
	// resolved; the prior state is preserved in the store.
	FindingStateUnknown FindingState = "unknown"
)

// EvalOutcome is the three-valued result of evaluating a single rule.
// Every rule in the catalog produces one EvalOutcome per evaluation cycle;
// [Engine.EvaluateAll] returns one per compiled rule. The reconciler (WS4)
// consumes this to drive state-machine transitions.
type EvalOutcome struct {
	// RuleCode identifies the rule.
	RuleCode string
	// Fingerprint is the stable identity key for the findings store. For P1
	// it is equal to RuleCode. Future rules with multiple simultaneous
	// instances (e.g. per-plugin, per-DB-replica) will set a distinct
	// fingerprint per instance.
	Fingerprint string
	// State is the outcome of this evaluation cycle.
	State FindingState
	// Finding is populated when State == FindingStateFiring.
	Finding *Finding
}

// Finding is a single diagnostic result produced when a rule's condition is
// true. The engine produces one [Finding] per fired rule code.
//
// NOTE: WS4 will add state-machine fields (State, FirstSeenAt, LastSeenAt,
// MutedAt, Fingerprint) around this value when persisted to the store.
type Finding struct {
	// Code is the stable, unique identifier for this type of finding (e.g.
	// "PUSH_EMPTY_URL"). Used as the mute key and finding-store primary key.
	Code string
	// RuleCode is the rule that produced this finding (same as Code for
	// single-finding rules; different for rules that emit multiple codes).
	RuleCode string
	Severity Severity
	Area     string
	Title    string
	Detail   string
	// Remediation is a plain-language fix description.
	Remediation string
	// DocsURL is a deep link to the relevant docs page.
	DocsURL string
}

// Rule is a single health-check rule. Rules are compiled once and evaluated
// per snapshot. The CEL expression must evaluate to bool; true means the
// condition is firing.
//
// Design note: future P2 work will load rules from a signed remote YAML feed
// as well as from the in-repo catalog. The in-repo catalog uses Go literals;
// the feed path will add a YAML deserialiser. The Rule struct is the common
// in-memory form for both.
type Rule struct {
	// Code is the stable, unique rule identifier.
	Code string
	// Expr is a CEL expression that evaluates to bool.
	// true = finding is firing.
	Expr string

	Severity    Severity
	Volatility  Volatility
	Surface     Surface
	Area        string
	Scope       DeploymentScope
	Title       string
	Detail      string
	Remediation string
	DocsURL     string

	// MinServerVersion is the minimum server version that supports all
	// accessors this rule references. The engine skips rules that require
	// a newer server version. Empty = no minimum.
	MinServerVersion string
}
