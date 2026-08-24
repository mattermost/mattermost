// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// GetMaskedVisualAST converts the given CEL expression to a VisualExpression and
// filters each condition's literal values to the subset visible to callerID.
//
// Masking is attribute-based, not role-based: every caller (including system
// admins) sees only values they themselves hold for shared_only fields, all
// values for public fields, and no values for source_only fields. Conditions
// whose values are partially or fully filtered get HasMaskedValues=true so the
// client can render the masked-chip UI.
func (a *App) GetMaskedVisualAST(rctx request.CTX, expression string, callerID string) (*model.VisualExpression, *model.AppError) {
	visualAST, appErr := a.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}
	if visualAST == nil || len(visualAST.Conditions) == 0 {
		return visualAST, nil
	}

	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, model.NewAppError("GetMaskedVisualAST", "app.pap.get_masked_visual_ast.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}
	cpaGroupID := cpaGroup.ID

	// Embed callerID in context so GetPropertyFieldByName applies per-caller option filtering.
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	// Pre-fetch all referenced fields once to avoid N+1 DB queries across conditions.
	fieldsByName := a.fetchConditionFields(rctxWithCaller, visualAST.Conditions, cpaGroupID)

	for i := range visualAST.Conditions {
		a.maskConditionValues(rctxWithCaller, callerID, &visualAST.Conditions[i], cpaGroupID, fieldsByName)
	}

	return visualAST, nil
}

// fetchConditionFields collects unique field names from conditions and fetches each once.
// Lookup failures are logged and omitted from the returned map; read-path callers treat
// missing entries as fail-closed (mask the value). Write-path callers should additionally
// call requireAllFieldsResolved to refuse to proceed when any referenced field is missing.
func (a *App) fetchConditionFields(rctx request.CTX, conditions []model.Condition, cpaGroupID string) map[string]*model.PropertyField {
	seen := make(map[string]bool)
	for _, c := range conditions {
		if c.ValueType == model.AttrValue {
			continue
		}
		if name := extractFieldName(c.Attribute); name != "" {
			seen[name] = true
		}
	}

	fields := make(map[string]*model.PropertyField, len(seen))
	for name := range seen {
		// Scope to user CPA fields so a name shared across object types in this
		// group resolves deterministically.
		field, appErr := a.GetPropertyFieldByNameForObjectType(rctx, cpaGroupID, "", model.PropertyFieldObjectTypeUser, name)
		if appErr != nil {
			rctx.Logger().Warn("Failed to look up field for masking, failing closed",
				mlog.String("field_name", name),
				mlog.Err(appErr),
			)
			continue
		}
		fields[name] = field
	}
	return fields
}

// appMaskingResolver implements model.MaskingFieldResolver for the app layer,
// caching resolved fields to avoid N+1 DB lookups within a single request.
type appMaskingResolver struct {
	app            *App
	rctxWithCaller request.CTX
	cpaGroupID     string
	callerID       string
	cache          map[string]*model.MaskingFieldInfo
}

func newMaskingResolver(a *App, rctx request.CTX, callerID string) (*appMaskingResolver, *model.AppError) {
	cpaGroup, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return nil, appErr
	}
	return &appMaskingResolver{
		app:            a,
		rctxWithCaller: RequestContextWithCallerID(rctx, callerID),
		cpaGroupID:     cpaGroup.ID,
		callerID:       callerID,
		cache:          make(map[string]*model.MaskingFieldInfo),
	}, nil
}

func (r *appMaskingResolver) Resolve(fieldName string) (*model.MaskingFieldInfo, error) {
	if info, ok := r.cache[fieldName]; ok {
		return info, nil
	}
	// Scope to user CPA fields so a name shared across object types in this
	// group resolves deterministically.
	field, appErr := r.app.GetPropertyFieldByNameForObjectType(r.rctxWithCaller, r.cpaGroupID, "", model.PropertyFieldObjectTypeUser, fieldName)
	if appErr != nil {
		return nil, appErr
	}
	info := r.fieldToMaskingInfo(field)
	r.cache[fieldName] = info
	return info, nil
}

func (r *appMaskingResolver) fieldToMaskingInfo(field *model.PropertyField) *model.MaskingFieldInfo {
	info := &model.MaskingFieldInfo{}
	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		info.Access = model.MaskingFieldAccessPublic
	case model.PropertyAccessModeSourceOnly:
		info.Access = model.MaskingFieldAccessSourceOnly
	case model.PropertyAccessModeSharedOnly:
		info.Access = model.MaskingFieldAccessSharedOnly
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			info.VisibleValues = extractVisibleOptionNames(field)
		} else {
			info.VisibleValues = r.app.getCallerTextValues(r.rctxWithCaller, r.callerID, field, r.cpaGroupID)
		}
	default:
		info.Access = model.MaskingFieldAccessUnknown
	}
	return info
}

// maskConditionValues applies masking to a single condition in place.
//
// Masking semantics differ by field type:
//
//   - select / multiselect (partial masking): each value in a multi-value
//     condition is independently masked or visible. A row may end up with some
//     visible chips plus the masked-token covering the omitted values.
//   - text (binary masking): a text condition is a single string comparison.
//     The condition's value is either visible in full (the caller's stored
//     text value matches it exactly) or fully masked. No partial chip behavior
//     is possible because there's no multi-value list to filter.
func (a *App) maskConditionValues(rctx request.CTX, callerID string, condition *model.Condition, cpaGroupID string, fieldsByName map[string]*model.PropertyField) {
	// AttrValue conditions compare two attributes (e.g. user.attr1 == user.attr2) — no literal values to mask.
	if condition.ValueType == model.AttrValue {
		return
	}

	fieldName := extractFieldName(condition.Attribute)
	if fieldName == "" {
		return
	}

	field, ok := fieldsByName[fieldName]
	if !ok {
		// Fail closed: field lookup failed at prefetch time.
		condition.Value = nil
		condition.HasMaskedValues = true
		return
	}

	switch field.GetAccessMode() {
	case model.PropertyAccessModePublic:
		// no-op
	case model.PropertyAccessModeSourceOnly:
		condition.Value = nil
		condition.HasMaskedValues = true
	case model.PropertyAccessModeSharedOnly:
		if field.Type.SupportsOptions() {
			filterConditionValues(condition, extractVisibleOptionNames(field))
		} else {
			filterConditionValues(condition, a.getCallerTextValues(rctx, callerID, field, cpaGroupID))
		}
	default:
		// Unknown access mode: fail closed.
		condition.Value = nil
		condition.HasMaskedValues = true
	}
}

// extractFieldName strips the "user.attributes." prefix from a CEL attribute
// reference, returning just the property field name. Returns the empty string
// if the attribute is not a user-attribute reference.
func extractFieldName(attribute string) string {
	const prefix = "user.attributes."
	name := strings.TrimPrefix(attribute, prefix)
	if name == attribute || name == "" {
		return ""
	}
	return name
}

// extractVisibleOptionNames pulls option names from a pre-filtered PropertyField's
// Attrs["options"]. The field is expected to have already been filtered by
// PropertyAccessService.applyFieldReadAccessControl to the caller's holdings,
// so the names returned here are exactly what the caller can see.
func extractVisibleOptionNames(field *model.PropertyField) map[string]struct{} {
	names := make(map[string]struct{})
	if field.Attrs == nil {
		return names
	}

	optionsRaw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return names
	}

	optionsSlice, ok := optionsRaw.([]any)
	if !ok {
		return names
	}

	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		name, ok := optMap["name"].(string)
		if ok && name != "" {
			names[name] = struct{}{}
		}
	}

	return names
}

// getCallerTextValues returns the caller's stored text value(s) for the given
// text-type field, as the visible-names set used by filterConditionValues.
// A user has at most one text value per field, so this set has zero or one
// element. Empty values are treated as no value.
func (a *App) getCallerTextValues(rctx request.CTX, callerID string, field *model.PropertyField, cpaGroupID string) map[string]struct{} {
	visible := make(map[string]struct{})

	// Each (user, field) pair has at most one text value.
	values, appErr := a.SearchPropertyValues(rctx, cpaGroupID, model.PropertyValueSearchOpts{
		FieldID:   field.ID,
		TargetIDs: []string{callerID},
		PerPage:   1,
	})
	if appErr != nil {
		rctx.Logger().Warn("Failed to look up caller text value for masking, failing closed",
			mlog.String("field_id", field.ID),
			mlog.String("caller_id", callerID),
			mlog.Err(appErr),
		)
		return visible
	}

	for _, pv := range values {
		var textVal string
		if err := json.Unmarshal(pv.Value, &textVal); err != nil {
			rctx.Logger().Warn("Failed to unmarshal caller text value for masking, treating as no value",
				mlog.String("field_id", field.ID),
				mlog.String("caller_id", callerID),
				mlog.String("value_id", pv.ID),
				mlog.Err(err),
			)
			continue
		}
		if textVal != "" {
			visible[textVal] = struct{}{}
		}
	}

	return visible
}

// filterConditionValues drops any element of condition.Value that is not in the
// visibleNames set, setting HasMaskedValues=true if anything was dropped.
//
// For multi-value conditions ([]any), each string element is checked individually
// (partial masking). For single-value conditions (string), the whole value is
// either kept or replaced with nil (binary masking).
func filterConditionValues(condition *model.Condition, visibleNames map[string]struct{}) {
	switch v := condition.Value.(type) {
	case []any:
		filtered := make([]any, 0, len(v))
		totalStrings := 0
		for _, val := range v {
			strVal, ok := val.(string)
			if !ok {
				continue // non-string elements are not masking candidates
			}
			totalStrings++
			if _, visible := visibleNames[strVal]; visible {
				filtered = append(filtered, val)
			}
		}
		if len(filtered) < totalStrings {
			condition.HasMaskedValues = true
		}
		condition.Value = filtered

	case string:
		if _, visible := visibleNames[v]; !visible {
			condition.Value = nil
			condition.HasMaskedValues = true
		}
	}
}

// maskedTokenValue is a terse local alias for model.MaskingTokenValue, the
// single source of truth for the masked-value sentinel shared with the
// canonical CEL walker. Never a valid attribute value.
const maskedTokenValue = model.MaskingTokenValue

// rejectMaskedTokens rejects any rule expression that still contains the masked
// token after merge — it is a response-only placeholder (server-generated, never
// a real attribute value) that must never reach the store.
//
// The fail-closed sentinel (maskFailClosedSentinel, "false") is deliberately NOT
// rejected here: "false" is also a legitimate, author-written deny-all expression,
// and persisting it is harmless (deny is the safe direction). The dangerous case —
// round-tripping the sentinel back over a stored rule whose values the caller
// could not see — is caught on the update path by the canonical merge, which
// fails closed (ErrMergeNodeDeleted / ErrMergeShapeMismatch → 403) when the
// submitted node can't be paired with the masked stored node.
func rejectMaskedTokens(policy *model.AccessControlPolicy) *model.AppError {
	for _, rule := range policy.Rules {
		if strings.Contains(rule.Expression, maskedTokenValue) {
			return model.NewAppError("CreateOrUpdateAccessControlPolicy",
				"app.pap.save_policy.masked_token_in_expression", nil,
				"expression contains a masked token that could not be resolved to a stored value",
				http.StatusBadRequest)
		}
	}
	return nil
}

// validatePolicyExpressionValues checks that all submitted literal values are held by the caller.
// Returns the same generic error for every rejection to prevent value enumeration.
func (a *App) validatePolicyExpressionValues(rctx request.CTX, policy *model.AccessControlPolicy, resolver model.MaskingFieldResolver) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil
	}

	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}
		if appErr := acs.ValidateExpressionValuesForCaller(rctx, rule.Expression, resolver); appErr != nil {
			return appErr
		}
	}
	return nil
}

func (a *App) GetMaskedExpression(rctx request.CTX, expression string, callerID string) (string, *model.AppError) {
	if expression == "" || expression == "true" {
		return expression, nil
	}

	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return expression, nil
	}

	resolver, appErr := newMaskingResolver(a, rctx, callerID)
	if appErr != nil {
		return "", appErr
	}

	masked, _, appErr := acs.MaskExpressionForCaller(rctx, expression, resolver)
	if appErr != nil {
		return "", appErr
	}
	return masked, nil
}

// MaskSimulationPolicyLiteralsForCaller re-applies attribute-value
// masking to every CEL expression and per-leaf ExpectedValue the
// simulator returned. Without this pass, the response would leak the
// literal values that mergeStoredPolicyExpressions re-injected before
// evaluation — the simulator's verdicts are correct because the
// engine sees the real (unmasked) policy, but the response surfaces
// (Blame.Expression, MergedRules expressions, every leaf in the
// evaluation tree) would otherwise carry those re-injected literals
// back to the caller.
//
// Masking is attribute-based, not role-based: system admins are NOT
// bypassed. A caller who doesn't hold the literal sees the
// "--------" sentinel regardless of role, mirroring the policy GET
// masking contract enforced by MaskPolicyExpressions.
//
// Failure handling is per-surface fail-closed: any masking error on
// a single expression clears that field (Expression -> "",
// ExpectedValue -> sentinel) rather than leaving the unmasked literal
// visible. A top-level CPA group lookup failure wipes every literal
// surface in the response.
//
// No-op when AttributeValueMasking is disabled — same gate as the
// stored-policy merge that precedes evaluation; either both run or
// neither does, so the response always matches the policy state that
// produced it.
func (a *App) MaskSimulationPolicyLiteralsForCaller(rctx request.CTX, resp *model.PolicySimulationResponse, callerID string) {
	if resp == nil || callerID == "" {
		return
	}
	if !a.Config().FeatureFlags.AttributeValueMasking {
		return
	}

	if a.Srv().ch.AccessControl == nil {
		return
	}

	resolver, appErr := newMaskingResolver(a, rctx, callerID)
	if appErr != nil {
		rctx.Logger().Warn(
			"MaskSimulationPolicyLiteralsForCaller: failed to resolve CPA group, clearing every simulation literal as fail-closed default",
			mlog.Err(appErr),
		)
		clearAllSimulationLiterals(resp)
		return
	}

	mc := &simulationMaskContext{
		cpaGroupID:     resolver.cpaGroupID,
		rctxWithCaller: resolver.rctxWithCaller,
		callerID:       callerID,
		resolver:       resolver,
	}

	for i := range resp.Results {
		for action, dec := range resp.Results[i].Decisions {
			a.maskSimulationDecisionLiterals(&dec, mc)
			resp.Results[i].Decisions[action] = dec
		}
		for k := range resp.Results[i].Sessions {
			for action, dec := range resp.Results[i].Sessions[k].Decisions {
				a.maskSimulationDecisionLiterals(&dec, mc)
				resp.Results[i].Sessions[k].Decisions[action] = dec
			}
		}
	}
}

// simulationMaskContext is the per-request mask cache shared across
// every expression in a single simulate response. resolver caches
// MaskingFieldInfo per field name so each unique field is resolved
// at most once across the entire trace.
type simulationMaskContext struct {
	cpaGroupID     string
	rctxWithCaller request.CTX
	callerID       string
	resolver       model.MaskingFieldResolver
}

// maskExpressionWithCache masks literal values in `expression` using the
// canonical CEL AST walker, sharing the resolver cache from mc. Returns ""
// on any parse or lookup failure so the caller can drop the surface
// entirely (fail-closed). Preserves ||/!/grouping structure — no Visual
// AST flattening.
func (a *App) maskExpressionWithCache(expression string, mc *simulationMaskContext) string {
	if expression == "" || expression == "true" {
		return expression
	}
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return ""
	}
	masked, _, appErr := acs.MaskExpressionForCaller(mc.rctxWithCaller, expression, mc.resolver)
	if appErr != nil {
		return ""
	}
	return masked
}

// maskSimulationDecisionLiterals masks every Expression and per-leaf
// ExpectedValue on every blame entry the action decision carries.
// Walks merged-rule sub-surfaces with the same rules so they stay in
// sync with the parent Blame.Expression.
func (a *App) maskSimulationDecisionLiterals(dec *model.PolicySimulationActionDecision, mc *simulationMaskContext) {
	for i := range dec.Blame {
		b := &dec.Blame[i]

		// Mask the evaluation tree first; the root's rebuilt
		// Expression preserves the original OR / NOT structure so
		// when we backfill Blame.Expression from it below the
		// caller-visible CEL keeps the same boolean shape the rule
		// author wrote.
		if b.EvaluationTree != nil {
			a.maskSimulationEvaluationTree(b.EvaluationTree, mc)
		}
		if b.Expression != "" {
			if b.EvaluationTree != nil {
				b.Expression = b.EvaluationTree.Expression
			} else {
				b.Expression = a.maskExpressionWithCache(b.Expression, mc)
			}
		}

		for j := range b.MergedRules {
			m := &b.MergedRules[j]
			if m.EvaluationTree != nil {
				a.maskSimulationEvaluationTree(m.EvaluationTree, mc)
			}
			if m.Expression != "" {
				if m.EvaluationTree != nil {
					m.Expression = m.EvaluationTree.Expression
				} else {
					m.Expression = a.maskExpressionWithCache(m.Expression, mc)
				}
			}
		}
	}
}

// maskSimulationEvaluationTree walks `node` and its children bottom-
// up. Leaf-shaped nodes (compare / function / other) have their
// Expression re-masked through maskExpressionWithCache and their
// ExpectedValue overwritten with the sentinel whenever the masker
// hid at least one literal in the leaf. Compound nodes (and / or /
// not) rebuild their Expression from the already-masked children's
// Expressions, preserving the original boolean shape. Leaf masking
// (canonical CEL walker) handles a single comparison; the compound
// rebuild stitches those masked leaves back together so the caller-
// visible CEL faithfully reflects the rule's || / ! structure.
func (a *App) maskSimulationEvaluationTree(node *model.PolicySimulationEvaluationNode, mc *simulationMaskContext) {
	if node == nil {
		return
	}
	for i := range node.Children {
		a.maskSimulationEvaluationTree(&node.Children[i], mc)
	}
	switch node.Kind {
	case model.PolicySimulationEvaluationKindAnd:
		node.Expression = joinChildExpressions(node.Children, "&&")
	case model.PolicySimulationEvaluationKindOr:
		node.Expression = joinChildExpressions(node.Children, "||")
	case model.PolicySimulationEvaluationKindNot:
		if len(node.Children) == 0 {
			node.Expression = ""
		} else if child := node.Children[0].Expression; child == "" {
			node.Expression = ""
		} else {
			node.Expression = "!(" + child + ")"
		}
	default:
		// compare / function / other — leaf-shaped. Mask the leaf
		// expression in place, then drop ExpectedValue to the
		// sentinel whenever the masker hid at least one literal —
		// the sentinel can never be a legitimate value (write-path
		// validation rejects it on save), so its presence in the
		// masked CEL is unambiguous evidence that masking applied.
		if node.Expression != "" {
			masked := a.maskExpressionWithCache(node.Expression, mc)
			if masked == "" {
				node.Expression = ""
				node.ExpectedValue = maskedTokenValue
			} else {
				if node.ExpectedValue != "" && strings.Contains(masked, maskedTokenValue) {
					node.ExpectedValue = maskedTokenValue
				}
				node.Expression = masked
			}
		}
		// ActualValue is the simulated user's recorded value —
		// independent from the rule literal we just masked above,
		// but just as sensitive under AVM. A caller who couldn't
		// see "il5" as a rule literal would still see "il5"
		// surface in the leaf's "Actual: il5" line without this
		// pass. Apply the same per-value access-mode check the rule
		// literal uses (source_only hides every value, shared_only
		// hides values the caller doesn't hold, public passes
		// through), so the trace stays in lockstep with the
		// policy GET masking contract end-to-end. Skips when the
		// leaf has no attribute path (function-call leaves with
		// non-attribute operands).
		if node.Attribute != "" && node.ActualValue != "" {
			a.maskLeafActualValue(node, mc)
		}
	}
}

// maskLeafActualValue replaces node.ActualValue with the masked token when the
// caller cannot see that value. Uses mc.resolver so field info is cached across
// all leaves in the trace — no per-leaf DB calls. Fails closed on resolver error.
func (a *App) maskLeafActualValue(node *model.PolicySimulationEvaluationNode, mc *simulationMaskContext) {
	fieldName := extractFieldName(node.Attribute)
	if fieldName == "" {
		return
	}
	info, err := mc.resolver.Resolve(fieldName)
	if err != nil {
		node.ActualValue = maskedTokenValue
		return
	}
	if info.IsValueHidden(node.ActualValue) {
		node.ActualValue = maskedTokenValue
	}
}

// joinChildExpressions wraps every non-empty child Expression in
// parens and joins them with " <op> ". Empty children (e.g. a leaf
// whose maskExpressionWithCache failed-closed) are skipped so the
// rebuilt parent doesn't carry a dangling operator. The parens are
// unconditional so the result stays unambiguous when the parent op
// has lower precedence than a child's internal op.
func joinChildExpressions(children []model.PolicySimulationEvaluationNode, op string) string {
	parts := make([]string, 0, len(children))
	for i := range children {
		if children[i].Expression == "" {
			continue
		}
		parts = append(parts, "("+children[i].Expression+")")
	}
	return strings.Join(parts, " "+op+" ")
}

// clearAllSimulationLiterals wipes every literal-carrying surface on
// `resp`: Expression / EvaluationTree on each Blame and each
// MergedRule, plus ExpectedValue on every leaf the tree contained.
// Companion to MaskSimulationPolicyLiteralsForCaller's top-level
// fail-closed branch: when the CPA group can't be resolved we don't
// know which fields are public vs masked, so we drop every literal
// rather than risk shipping a hidden value back to the caller.
func clearAllSimulationLiterals(resp *model.PolicySimulationResponse) {
	if resp == nil {
		return
	}
	for i := range resp.Results {
		for action, dec := range resp.Results[i].Decisions {
			clearDecisionLiterals(&dec)
			resp.Results[i].Decisions[action] = dec
		}
		for k := range resp.Results[i].Sessions {
			for action, dec := range resp.Results[i].Sessions[k].Decisions {
				clearDecisionLiterals(&dec)
				resp.Results[i].Sessions[k].Decisions[action] = dec
			}
		}
	}
}

func clearDecisionLiterals(dec *model.PolicySimulationActionDecision) {
	for i := range dec.Blame {
		b := &dec.Blame[i]
		b.Expression = ""
		if b.EvaluationTree != nil {
			clearEvaluationTreeLiterals(b.EvaluationTree)
		}
		for j := range b.MergedRules {
			b.MergedRules[j].Expression = ""
			if b.MergedRules[j].EvaluationTree != nil {
				clearEvaluationTreeLiterals(b.MergedRules[j].EvaluationTree)
			}
		}
	}
}

func clearEvaluationTreeLiterals(node *model.PolicySimulationEvaluationNode) {
	if node == nil {
		return
	}
	node.Expression = ""
	if node.ExpectedValue != "" {
		node.ExpectedValue = maskedTokenValue
	}
	// ActualValue is the simulated user's value — also a literal
	// the masker normally checks against per-caller AVM semantics.
	// When the CPA group lookup fails we can't tell whether the
	// field is public or protected, so we collapse to the sentinel
	// rather than risk leaving an actual value visible.
	if node.ActualValue != "" {
		node.ActualValue = maskedTokenValue
	}
	for i := range node.Children {
		clearEvaluationTreeLiterals(&node.Children[i])
	}
}

// maskFailClosedSentinel is the CEL expression written into a response rule when masking
// cannot safely produce a redacted version (parse failure or CPA group unavailable).
// "false" is used because it is deny-all if ever evaluated literally, matching the
// fail-closed intent. This value only ever appears in API responses — the stored DB
// expression is never overwritten by this path.
const maskFailClosedSentinel = "false"

// MaskPolicyExpressions masks non-held literal values in all policy rule expressions, in place.
// Fails closed (sets a rule to maskFailClosedSentinel) if its expression cannot be parsed or masked.
func (a *App) MaskPolicyExpressions(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return
	}

	resolver, appErr := newMaskingResolver(a, rctx, callerID)
	if appErr != nil {
		rctx.Logger().Warn("MaskPolicyExpressions: failed to resolve CPA group, masking all rules closed",
			mlog.Err(appErr),
		)
		for i, rule := range policy.Rules {
			if rule.Expression == "" || rule.Expression == "true" {
				continue
			}
			policy.Rules[i].Expression = maskFailClosedSentinel
		}
		return
	}

	for i, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}
		masked, _, appErr := acs.MaskExpressionForCaller(rctx, rule.Expression, resolver)
		if appErr != nil {
			rctx.Logger().Warn("MaskPolicyExpressions: failed to mask rule expression, failing closed",
				mlog.Err(appErr),
			)
			policy.Rules[i].Expression = maskFailClosedSentinel
			continue
		}
		policy.Rules[i].Expression = masked
	}
}
