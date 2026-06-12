// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import (
	"fmt"
	"reflect"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/types"
	"github.com/google/cel-go/common/types/ref"
	"github.com/google/cel-go/ext"
	"github.com/google/cel-go/interpreter/functions"

	"github.com/mattermost/mattermost/server/public/model"
)

// buildEnv constructs the shared CEL environment for all rule evaluations.
//
// Accessor vocabulary registered here:
//   - config.*  — typed view over model.Config via ext.NativeTypes.
//     ext.NativeTypes recursively registers all nested struct types, so
//     passing &model.Config{} is sufficient.
//   - probe.dbWrite() — declared (no binding at env level; binding is
//     injected per-program at Evaluate time via cel.Functions).
//
// Spike friction note (pointer fields):
//
//	model.Config uses *bool / *string fields throughout. ext.NativeTypes
//	handles them: a nil pointer becomes the zero value (false/""), a
//	non-nil pointer is dereferenced. Callers MUST call cfg.SetDefaults()
//	before building the snapshot so all pointer fields are non-nil and
//	carry the intended value rather than the zero-value fallback.
//
// TODO (WS1 vocabulary expansion): add license.*, version.*, stats.*,
// jobs.*, cluster.*, plugins.*, db.*, deployment.*, search.*, env.*
// as the corresponding snapshot sections are implemented.
func buildEnv() (*cel.Env, error) {
	env, err := cel.NewEnv(
		// NativeTypes requires reflect.Type arguments (not pointer values).
		// Passing reflect.TypeOf(model.Config{}) triggers recursive
		// discovery of all nested struct types in the Config tree — one
		// call suffices. Passing &model.Config{} directly causes a runtime
		// error ("must be reflect.Type or reflect.Value").
		ext.NativeTypes(reflect.TypeOf(model.Config{})),
		cel.Variable("config", cel.ObjectType("model.Config")),

		// probe.dbWrite() — zero-arg function returning bool.
		// The actual implementation is injected at program-creation time
		// (see Evaluate) via the cel.Functions ProgramOption.
		// We use cel.Functions (deprecated for static implementations) here
		// because our probe results are dynamic per-snapshot — the function
		// implementation varies across evaluations. The deprecation note
		// recommends cel.Function for compile-time-constant implementations;
		// cel.Functions remains correct for this dynamic-injection pattern.
		cel.Function("probe.dbWrite",
			cel.Overload("probe_dbWrite_0", []*cel.Type{}, cel.BoolType),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("healthcheck: build CEL environment: %w", err)
	}
	return env, nil
}

// compiledRule pairs a [Rule] with its compiled CEL AST.
type compiledRule struct {
	rule Rule
	ast  *cel.Ast
}

// Engine compiles rules once and evaluates them per-snapshot. Safe for
// concurrent use after construction.
type Engine struct {
	env           *cel.Env
	compiledRules []compiledRule
}

// NewEngine creates an Engine by compiling all rules in rules.
// Returns an error if any rule fails compilation or references an unknown
// accessor (static validation against the registered vocabulary).
func NewEngine(rules []Rule) (*Engine, error) {
	env, err := buildEnv()
	if err != nil {
		return nil, err
	}

	compiled := make([]compiledRule, 0, len(rules))
	for _, r := range rules {
		ast, issues := env.Compile(r.Expr)
		if issues != nil && issues.Err() != nil {
			return nil, fmt.Errorf("healthcheck: compile rule %q: %w", r.Code, issues.Err())
		}
		if ast.OutputType() != cel.BoolType {
			return nil, fmt.Errorf("healthcheck: rule %q: expression must return bool, got %v", r.Code, ast.OutputType())
		}
		compiled = append(compiled, compiledRule{rule: r, ast: ast})
	}
	return &Engine{env: env, compiledRules: compiled}, nil
}

// Validate compiles all rules and returns all errors. Use in CI / tests to
// catch authoring mistakes. Returns nil on success.
func Validate(rules []Rule) []error {
	env, err := buildEnv()
	if err != nil {
		return []error{err}
	}

	var errs []error
	for _, r := range rules {
		ast, issues := env.Compile(r.Expr)
		if issues != nil && issues.Err() != nil {
			errs = append(errs, fmt.Errorf("rule %q: %w", r.Code, issues.Err()))
			continue
		}
		if ast.OutputType() != cel.BoolType {
			errs = append(errs, fmt.Errorf("rule %q: expression must return bool, got %v", r.Code, ast.OutputType()))
		}
	}
	return errs
}

// Evaluate runs all compiled rules against snap and returns the findings
// currently firing (expression evaluated to true).
//
// A nil snapshot section causes rules that depend solely on that section to
// be skipped, implementing the "unknown ≠ resolved" contract from DESIGN.md:
// a missing section never produces a spurious resolution.
//
// TODO (WS4 state machine): skipped rules should produce an "unknown" state
// record rather than being silently omitted. For P1 we skip to avoid false
// positives.
func (e *Engine) Evaluate(snap *Snapshot) []Finding {
	if snap == nil {
		return nil
	}

	cfg := snap.Config
	if cfg == nil {
		// Use a zero config rather than nil so typed field access in rules
		// doesn't panic. Rules that need a populated config will simply see
		// zero/default values and may or may not fire — acceptable for P1
		// since the live provider always populates this section.
		cfg = &model.Config{}
	}

	probeAvailable := snap.Probes != nil
	probeDBWriteOK := probeAvailable && snap.Probes.DBWriteOK

	// The probe.dbWrite() function implementation is injected per-program
	// call so it captures the snapshot-specific probe result.
	probeDBWriteImpl := &functions.Overload{
		Operator: "probe_dbWrite_0",
		Function: func(_ ...ref.Val) ref.Val {
			return types.Bool(probeDBWriteOK)
		},
	}

	var findings []Finding
	for _, cr := range e.compiledRules {
		// Skip probe-volatility rules when the probe section was not
		// collected this cycle (avoids false-positive "probe failed" findings
		// when the probe simply wasn't run).
		if cr.rule.Volatility == VolatilityProbe && !probeAvailable {
			continue
		}

		prg, err := e.env.Program(cr.ast,
			cel.Functions(probeDBWriteImpl), //nolint:staticcheck // cel.Functions is the correct API for per-snapshot dynamic function injection; the deprecation applies to static compile-time implementations only
		)
		if err != nil {
			// Program creation failure is a programming error. Skip rather
			// than crash so one bad rule doesn't block the rest.
			continue
		}

		out, _, err := prg.Eval(map[string]any{"config": cfg})
		if err != nil {
			// CEL evaluation errors (nil deref, type mismatch) are treated
			// as "unknown" in P1 by silently skipping. WS4 will track these.
			continue
		}

		firing, ok := out.Value().(bool)
		if !ok || !firing {
			continue
		}

		findings = append(findings, Finding{
			Code:        cr.rule.Code,
			RuleCode:    cr.rule.Code,
			Severity:    cr.rule.Severity,
			Area:        cr.rule.Area,
			Title:       cr.rule.Title,
			Detail:      cr.rule.Detail,
			Remediation: cr.rule.Remediation,
			DocsURL:     cr.rule.DocsURL,
		})
	}
	return findings
}
