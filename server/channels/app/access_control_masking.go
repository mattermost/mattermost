// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"maps"
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

	// Pre-fetch the holdings-bearing field for each referenced condition once to
	// avoid N+1 DB queries across conditions.
	fieldsByKey := a.fetchConditionFields(rctxWithCaller, visualAST.Conditions, cpaGroupID)

	for i := range visualAST.Conditions {
		a.maskConditionValues(rctxWithCaller, callerID, &visualAST.Conditions[i], cpaGroupID, fieldsByKey)
	}

	return visualAST, nil
}

// maskingHoldings pairs the field whose per-caller values determine which
// literals are visible (holdings) with the access mode that governs the
// reference. For a channel attribute these come from different fields: the
// access mode is the channel field's own (it defines whether the attribute is
// protected), while holdings are read from the user-side sibling — see
// holdingsFieldFor.
type maskingHoldings struct {
	field      *model.PropertyField
	accessMode string
}

// fetchConditionFields collects the unique CPA references from conditions and
// fetches, for each, the holdings/access-mode pair that determines its
// visibility (see holdingsFieldFor). The map is keyed by
// "<objectType>/<fieldName>" so a user and a channel reference sharing a name
// resolve independently. Lookup failures are logged and omitted; read-path
// callers treat missing entries as fail-closed (mask the value).
func (a *App) fetchConditionFields(rctx request.CTX, conditions []model.Condition, cpaGroupID string) map[string]*maskingHoldings {
	type ref struct{ objectType, fieldName string }
	seen := make(map[ref]struct{})
	for _, c := range conditions {
		if c.ValueType == model.AttrValue {
			continue
		}
		if objectType, fieldName, ok := splitCPAAttribute(c.Attribute); ok {
			seen[ref{objectType, fieldName}] = struct{}{}
		}
	}

	fields := make(map[string]*maskingHoldings, len(seen))
	for r := range seen {
		h, appErr := a.holdingsFieldFor(rctx, cpaGroupID, r.objectType, r.fieldName)
		if appErr != nil {
			rctx.Logger().Warn("Failed to look up field for masking, failing closed",
				mlog.String("object_type", r.objectType),
				mlog.String("field_name", r.fieldName),
				mlog.Err(appErr),
			)
			continue
		}
		fields[r.objectType+"/"+r.fieldName] = h
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

func (r *appMaskingResolver) Resolve(objectType, fieldName string) (*model.MaskingFieldInfo, error) {
	// The cache key includes the object type: a user field and a channel field
	// can share a name yet have different visibility.
	cacheKey := objectType + "/" + fieldName
	if info, ok := r.cache[cacheKey]; ok {
		return info, nil
	}

	h, appErr := r.app.holdingsFieldFor(r.rctxWithCaller, r.cpaGroupID, objectType, fieldName)
	if appErr != nil {
		return nil, appErr
	}
	info := r.fieldToMaskingInfo(h)
	r.cache[cacheKey] = info
	return info, nil
}

// holdingsFieldFor returns the holdings-bearing field plus the access mode that
// governs a reference to (objectType, fieldName). The field is fetched with
// caller context so its options are already filtered to the caller's holdings.
//
// For a user reference both come from the field itself. For a channel reference
// they come from different fields: the access mode is the CHANNEL field's own —
// whether the attribute is protected is a property of the channel field, and a
// linked field does NOT inherit access mode from its template at creation, so
// reading it off the user sibling can silently under-protect. Holdings, by
// contrast, must come from the user-side sibling linked to the same template,
// because users never hold channel-side values directly.
//
// A caller's held option names are only pre-filtered onto the sibling by the
// read path when the sibling is itself shared_only. If the channel field is
// shared_only but the sibling is not, the sibling's option list is unfiltered,
// so its options are dropped (fail closed); text holdings are queried directly
// and are unaffected. When a channel field is unlinked or has no user sibling,
// its own (caller-filtered) field is used — for shared_only that yields no
// visible values (the caller holds nothing channel-side), the fail-closed
// direction.
func (a *App) holdingsFieldFor(rctx request.CTX, groupID, objectType, fieldName string) (*maskingHoldings, *model.AppError) {
	var lookupType string
	switch objectType {
	case model.PropertyFieldObjectTypeChannel:
		lookupType = model.PropertyFieldObjectTypeChannel
	case model.PropertyFieldObjectTypeUser:
		lookupType = model.PropertyFieldObjectTypeUser
	default:
		// Only user./resource. CPA roots reach here (see cpaAttributeRoots); fail
		// loud rather than silently treating an unexpected type as a user lookup.
		return nil, model.NewAppError("holdingsFieldFor", "app.pap.masking.unknown_object_type.app_error", map[string]any{"ObjectType": objectType}, "", http.StatusInternalServerError)
	}

	field, appErr := a.GetPropertyFieldByNameForObjectType(rctx, groupID, "", lookupType, fieldName)
	if appErr != nil {
		return nil, appErr
	}
	if lookupType != model.PropertyFieldObjectTypeChannel {
		return &maskingHoldings{field: field, accessMode: field.GetAccessMode()}, nil
	}

	accessMode := field.GetAccessMode()
	if field.LinkedFieldID != nil && *field.LinkedFieldID != "" {
		sibling, appErr := a.userSiblingField(rctx, groupID, *field.LinkedFieldID)
		if appErr != nil {
			return nil, appErr
		}
		if sibling != nil {
			// The sibling supplies the caller's held values, but its options are
			// only held-filtered by the read path when the sibling is itself
			// shared_only. If the channel field is protected but the sibling is
			// not, the sibling's option list is unfiltered — drop it so no
			// unheld option name leaks (text holdings query the caller directly
			// and are unaffected).
			if accessMode == model.PropertyAccessModeSharedOnly &&
				sibling.GetAccessMode() != model.PropertyAccessModeSharedOnly &&
				sibling.Type.SupportsOptions() {
				sibling = fieldWithEmptyOptions(sibling)
			}
			return &maskingHoldings{field: sibling, accessMode: accessMode}, nil
		}
	}
	return &maskingHoldings{field: field, accessMode: accessMode}, nil
}

// fieldWithEmptyOptions returns a shallow copy of f with an empty options list,
// so extractVisibleOptionNames yields nothing. Used to fail closed without
// mutating the (possibly cached) source field.
func fieldWithEmptyOptions(f *model.PropertyField) *model.PropertyField {
	cp := *f
	cp.Attrs = make(model.StringInterface, len(f.Attrs)+1)
	maps.Copy(cp.Attrs, f.Attrs)
	cp.Attrs[model.PropertyFieldAttributeOptions] = []any{}
	return &cp
}

// userSiblingField returns the user-object-type CPA field linked to the same
// template (linkedFieldID), fetched through rctx so its options are filtered to
// that caller's holdings. Returns nil when no such field exists.
func (a *App) userSiblingField(rctx request.CTX, groupID, linkedFieldID string) (*model.PropertyField, *model.AppError) {
	fields, appErr := a.SearchPropertyFields(rctx, groupID, model.PropertyFieldSearchOpts{
		ObjectTypes:   []string{model.PropertyFieldObjectTypeUser},
		LinkedFieldID: linkedFieldID,
		PerPage:       2,
	})
	if appErr != nil {
		return nil, appErr
	}
	// The masking decision uses this sibling's held values to gate a channel
	// field's option names, so it must resolve to exactly one field. Nothing
	// enforces LinkedFieldID uniqueness at the DB level, so a second match would
	// make the choice depend on store order and could disclose a value via the
	// "wrong" sibling. Error on ambiguity rather than guess — the caller fails
	// this field closed (precompute logs and skips it, masking every value).
	// PerPage:2 is enough to detect the second match.
	var match *model.PropertyField
	for _, f := range fields {
		if f == nil {
			continue
		}
		if match != nil {
			return nil, model.NewAppError("userSiblingField", "app.pap.masking.ambiguous_sibling.app_error", map[string]any{"LinkedFieldID": linkedFieldID}, "multiple user fields link the same template", http.StatusInternalServerError)
		}
		match = f
	}
	return match, nil
}

func (r *appMaskingResolver) fieldToMaskingInfo(h *maskingHoldings) *model.MaskingFieldInfo {
	info := &model.MaskingFieldInfo{}
	// h.accessMode is authoritative (the channel field's own for a channel
	// reference); h.field supplies the caller's held values.
	switch h.accessMode {
	case model.PropertyAccessModePublic:
		info.Access = model.MaskingFieldAccessPublic
	case model.PropertyAccessModeSourceOnly:
		info.Access = model.MaskingFieldAccessSourceOnly
	case model.PropertyAccessModeSharedOnly:
		info.Access = model.MaskingFieldAccessSharedOnly
		if h.field.Type == model.PropertyFieldTypeSelect || h.field.Type == model.PropertyFieldTypeMultiselect {
			info.VisibleValues = extractVisibleOptionNames(h.field)
		} else {
			info.VisibleValues = r.app.getCallerTextValues(r.rctxWithCaller, r.callerID, h.field, r.cpaGroupID)
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
func (a *App) maskConditionValues(rctx request.CTX, callerID string, condition *model.Condition, cpaGroupID string, fieldsByKey map[string]*maskingHoldings) {
	// AttrValue conditions compare two attributes (e.g. user.attr1 == user.attr2) — no literal values to mask.
	if condition.ValueType == model.AttrValue {
		return
	}

	objectType, fieldName, ok := splitCPAAttribute(condition.Attribute)
	if !ok {
		return
	}

	// h pairs the holdings-bearing field (the user sibling for a channel
	// attribute) with the authoritative access mode (the channel field's own),
	// keyed by object type so a shared name does not collide across roots.
	h, ok := fieldsByKey[objectType+"/"+fieldName]
	if !ok {
		// Fail closed: field lookup failed at prefetch time.
		condition.Value = nil
		condition.HasMaskedValues = true
		return
	}

	switch h.accessMode {
	case model.PropertyAccessModePublic:
		// no-op
	case model.PropertyAccessModeSourceOnly:
		condition.Value = nil
		condition.HasMaskedValues = true
	case model.PropertyAccessModeSharedOnly:
		if h.field.Type.SupportsOptions() {
			filterConditionValues(condition, extractVisibleOptionNames(h.field))
		} else {
			filterConditionValues(condition, a.getCallerTextValues(rctx, callerID, h.field, cpaGroupID))
		}
	default:
		// Unknown access mode: fail closed.
		condition.Value = nil
		condition.HasMaskedValues = true
	}
}

// cpaAttributeRoots maps a CEL attribute-path prefix to the PropertyField
// object type whose CPA schema backs it: user.attributes.* is the requesting
// user, resource.attributes.* is the accessed channel.
var cpaAttributeRoots = []struct{ prefix, objectType string }{
	{"user.attributes.", model.PropertyFieldObjectTypeUser},
	{"resource.attributes.", model.PropertyFieldObjectTypeChannel},
}

// splitCPAAttribute splits a CEL attribute path into its CPA object type and
// field name. ok is false for any path that is not a non-empty custom-attribute
// selector (native selectors such as user.email or resource.id carry no
// ".attributes." segment and own no maskable literal).
func splitCPAAttribute(attribute string) (objectType, fieldName string, ok bool) {
	for _, r := range cpaAttributeRoots {
		if name, found := strings.CutPrefix(attribute, r.prefix); found && name != "" {
			return r.objectType, name, true
		}
	}
	return "", "", false
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
	objectType, fieldName, ok := splitCPAAttribute(node.Attribute)
	if !ok {
		return
	}
	info, err := mc.resolver.Resolve(objectType, fieldName)
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
