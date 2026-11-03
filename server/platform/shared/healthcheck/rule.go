// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
)

type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

type State string

const (
	StateFiring   State = "firing"
	StateResolved State = "resolved"
	StateUnknown  State = "unknown"
)

type Volatility string

const (
	VolatilityStable    Volatility = "stable"
	VolatilityProbe     Volatility = "probe"
	VolatilityTopology  Volatility = "topology"
	VolatilityThreshold Volatility = "threshold"
	VolatilityFeed      Volatility = "feed"
)

type Surface string

const (
	SurfaceProduct  Surface = "product"
	SurfaceInternal Surface = "internal"
)

type Rule struct {
	Code     string           `json:"code"`
	Area     model.HealthArea `json:"area"`
	Severity Severity         `json:"severity"`
	model.RuleText

	Surface        Surface    `json:"surface"`
	Volatility     Volatility `json:"volatility"`
	AppliesToCloud bool       `json:"applies_to_cloud"`
	Subject        string     `json:"subject,omitempty"`

	Eval     func(*Snapshot) []Result                `json:"-"`
	EvalNode func(*Snapshot, *NodeSnapshot) []Result `json:"-"`
}

func (r Rule) IsNodeScoped() bool {
	return r.EvalNode != nil
}

func (r Rule) AppliesTo(isCloud bool) bool {
	return !isCloud || r.AppliesToCloud
}

// Single adapts a check that yields exactly one result to Rule.Eval.
func Single(check func(*Snapshot) Result) func(*Snapshot) []Result {
	return func(s *Snapshot) []Result {
		return []Result{check(s)}
	}
}

// SingleNode adapts a node check that yields exactly one result to Rule.EvalNode.
func SingleNode(check func(*Snapshot, *NodeSnapshot) Result) func(*Snapshot, *NodeSnapshot) []Result {
	return func(s *Snapshot, n *NodeSnapshot) []Result {
		return []Result{check(s, n)}
	}
}

// Gate resolves the rule while gate reports its feature off, so settings that cannot take effect never fire.
// unknownReason is reported when gate cannot tell.
func Gate(gate func(*Snapshot) (enabled, ok bool), unknownReason string, check func(*Snapshot) Result) func(*Snapshot) []Result {
	return func(s *Snapshot) []Result {
		if r, closed := gateClosed(s, gate, unknownReason); closed {
			return []Result{r}
		}
		return []Result{check(s)}
	}
}

// GateNode is Gate for node-scoped rules.
func GateNode(gate func(*Snapshot) (enabled, ok bool), unknownReason string, check func(*Snapshot, *NodeSnapshot) Result) func(*Snapshot, *NodeSnapshot) []Result {
	return func(s *Snapshot, n *NodeSnapshot) []Result {
		if r, closed := gateClosed(s, gate, unknownReason); closed {
			return []Result{r}
		}
		return []Result{check(s, n)}
	}
}

// Licensed resolves the rule while the license lacks feature, since the server ignores that feature's settings then.
func Licensed(feature func(*model.Features) *bool, eval func(*Snapshot) []Result) func(*Snapshot) []Result {
	return func(s *Snapshot) []Result {
		return licenseGated(s, feature, eval(s))
	}
}

// LicensedNode is Licensed for node-scoped rules.
func LicensedNode(feature func(*model.Features) *bool, eval func(*Snapshot, *NodeSnapshot) []Result) func(*Snapshot, *NodeSnapshot) []Result {
	return func(s *Snapshot, n *NodeSnapshot) []Result {
		return licenseGated(s, feature, eval(s, n))
	}
}

// licenseGated consults the license only when the rule would not resolve anyway, so a feature that is not
// configured stays resolved in packets without license data.
func licenseGated(s *Snapshot, feature func(*model.Features) *bool, results []Result) []Result {
	if !slices.ContainsFunc(results, func(r Result) bool { return r.State != StateResolved }) {
		return results
	}

	allowed, ok := s.LicenseAllows(feature)
	switch {
	case !ok:
		return []Result{Unknown(ReasonLicenseUnavailable)}
	case !allowed:
		return []Result{Resolved()}
	default:
		return results
	}
}

func gateClosed(s *Snapshot, gate func(*Snapshot) (bool, bool), unknownReason string) (Result, bool) {
	enabled, ok := gate(s)
	switch {
	case !ok:
		return Unknown(unknownReason), true
	case !enabled:
		return Resolved(), true
	default:
		return Result{}, false
	}
}
