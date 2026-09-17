// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const ReasonRulePanicked = "health.reason.rule_panicked"

type Evaluation struct {
	Code        string
	Result      Result
	Fingerprint string
	EvaluatedAt time.Time
}

type EngineOpts struct {
	Registry *Registry
	Logger   mlog.LoggerIFace
	Now      func() time.Time
}

type Engine struct {
	registry *Registry
	logger   mlog.LoggerIFace
	now      func() time.Time
}

func NewEngine(opts EngineOpts) *Engine {
	registry := opts.Registry
	if registry == nil {
		registry = Builtin()
	}

	now := opts.Now
	if now == nil {
		now = time.Now
	}

	return &Engine{
		registry: registry,
		logger:   opts.Logger,
		now:      now,
	}
}

func (e *Engine) Evaluate(s *Snapshot) []Evaluation {
	if e == nil || e.registry == nil {
		return nil
	}

	evaluatedAt := e.now()
	evaluations := []Evaluation{}
	for _, rule := range e.registry.Rules() {
		evaluations = append(evaluations, e.evaluateRule(s, rule, evaluatedAt)...)
	}

	return evaluations
}

func (e *Engine) EvaluateRule(s *Snapshot, code string) ([]Evaluation, error) {
	if e == nil || e.registry == nil {
		return nil, fmt.Errorf("rule %q not found", code)
	}

	rule, ok := e.registry.Get(code)
	if !ok {
		return nil, fmt.Errorf("rule %q not found", code)
	}

	return e.evaluateRule(s, rule, e.now()), nil
}

func (e *Engine) evaluateRule(s *Snapshot, rule Rule, evaluatedAt time.Time) []Evaluation {
	deployment := Deployment{}
	if s != nil {
		deployment = s.Deployment
	}

	if !rule.AppliesTo(deployment) {
		return nil
	}

	evaluations := []Evaluation{}

	if rule.Eval != nil {
		results := e.callSafely(rule.Code, func() []Result {
			return rule.Eval(s)
		})
		results = stampSubject(results, rule.Subject)
		evaluations = append(evaluations, toEvaluations(rule.Code, results, evaluatedAt)...)
	}

	if rule.EvalNode != nil {
		for _, node := range s.Nodes() {
			if node == nil {
				continue
			}

			results := e.callSafely(rule.Code, func() []Result {
				return rule.EvalNode(s, node)
			})
			results = stampScope(results, node.Hostname)
			results = stampSubject(results, rule.Subject)
			evaluations = append(evaluations, toEvaluations(rule.Code, results, evaluatedAt)...)
		}
	}

	return evaluations
}

func (e *Engine) callSafely(code string, eval func() []Result) (results []Result) {
	defer func() {
		if recovered := recover(); recovered != nil {
			if e.logger != nil {
				e.logger.Error("health check rule panicked", mlog.String("rule_code", code), mlog.Any("panic", recovered))
			}
			results = []Result{Unknown(ReasonRulePanicked)}
		}
	}()

	return eval()
}

func stampScope(results []Result, hostname string) []Result {
	for i := range results {
		results[i].Scope = hostname
	}

	return results
}

func stampSubject(results []Result, ruleSubject string) []Result {
	for i := range results {
		if results[i].Subject == "" {
			results[i].Subject = ruleSubject
		}
	}

	return results
}

func toEvaluations(code string, results []Result, evaluatedAt time.Time) []Evaluation {
	evaluations := make([]Evaluation, 0, len(results))
	for _, result := range results {
		evaluations = append(evaluations, Evaluation{
			Code:        code,
			Result:      result,
			Fingerprint: Fingerprint(code, result.Subject, result.Scope),
			EvaluatedAt: evaluatedAt,
		})
	}

	return evaluations
}
