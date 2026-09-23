// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "github.com/mattermost/mattermost/server/public/model"

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

func (r Rule) AppliesTo(d Deployment) bool {
	if d.IsCloud {
		return r.AppliesToCloud
	}

	return true
}
