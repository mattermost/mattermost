// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

type Registry struct {
	rules  []Rule
	byCode map[string]Rule
}

func NewRegistry() *Registry {
	return &Registry{
		rules:  []Rule{},
		byCode: map[string]Rule{},
	}
}

func (r *Registry) Register(rules ...Rule) {
	for _, rule := range rules {
		r.rules = append(r.rules, rule)
		r.byCode[rule.Code] = rule
	}
}

func (r *Registry) Rules() []Rule {
	rules := make([]Rule, len(r.rules))
	copy(rules, r.rules)

	sort.SliceStable(rules, func(i, j int) bool {
		return rules[i].Code < rules[j].Code
	})

	return rules
}

func (r *Registry) Get(code string) (Rule, bool) {
	rule, ok := r.byCode[code]
	return rule, ok
}

func (r *Registry) Len() int {
	return len(r.rules)
}

func (r *Registry) Validate() error {
	var validationErrs []error

	areas := map[model.HealthArea]struct{}{}
	for _, area := range model.AllHealthAreas() {
		areas[area] = struct{}{}
	}

	seen := map[string]struct{}{}
	for _, rule := range r.rules {
		if rule.Code == "" {
			validationErrs = append(validationErrs, errors.New("rule code cannot be empty"))
		} else {
			if _, ok := seen[rule.Code]; ok {
				validationErrs = append(validationErrs, fmt.Errorf("duplicate rule code %q", rule.Code))
			}
			seen[rule.Code] = struct{}{}
		}

		if rule.Eval == nil && rule.EvalNode == nil {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q must define Eval and/or EvalNode", rule.Code))
		}

		if rule.SummaryID == "" {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q summary id cannot be empty", rule.Code))
		}
		if rule.RemediationID == "" {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q remediation id cannot be empty", rule.Code))
		}

		if _, ok := areas[rule.Area]; !ok {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q has unknown area %q", rule.Code, rule.Area))
		}

		if !isValidSeverity(rule.Severity) {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q has unknown severity %q", rule.Code, rule.Severity))
		}
		if !isValidSurface(rule.Surface) {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q has unknown surface %q", rule.Code, rule.Surface))
		}
		if !isValidVolatility(rule.Volatility) {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q has unknown volatility %q", rule.Code, rule.Volatility))
		}

		expectedSummaryID := "health.rule." + strings.ToLower(rule.Code) + ".summary"
		if rule.SummaryID != "" && rule.SummaryID != expectedSummaryID {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q summary id must be %q", rule.Code, expectedSummaryID))
		}
		expectedRemediationID := "health.rule." + strings.ToLower(rule.Code) + ".remediation"
		if rule.RemediationID != "" && rule.RemediationID != expectedRemediationID {
			validationErrs = append(validationErrs, fmt.Errorf("rule %q remediation id must be %q", rule.Code, expectedRemediationID))
		}
	}

	return errors.Join(validationErrs...)
}

var builtinRegistry = NewRegistry()

func Register(rules ...Rule) {
	builtinRegistry.Register(rules...)
}

func Builtin() *Registry {
	return builtinRegistry
}

func isValidSeverity(severity Severity) bool {
	switch severity {
	case SeverityCritical, SeverityWarning, SeverityInfo:
		return true
	default:
		return false
	}
}

func isValidSurface(surface Surface) bool {
	switch surface {
	case SurfaceProduct, SurfaceInternal:
		return true
	default:
		return false
	}
}

func isValidVolatility(volatility Volatility) bool {
	switch volatility {
	case VolatilityStable, VolatilityProbe, VolatilityTopology, VolatilityThreshold, VolatilityFeed:
		return true
	default:
		return false
	}
}
