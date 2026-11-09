// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// storedValueExamples caps how many target IDs a refusal names.
const storedValueExamples = 5

// storedValueBreaches is how many stored values a change would put out of bounds, and a few of
// the targets holding them.
type storedValueBreaches struct {
	Count    int64
	Examples []string
}

func (b *storedValueBreaches) add(count int64, examples []string) {
	b.Count += count
	b.Examples = append(b.Examples, examples...)
	if len(b.Examples) > storedValueExamples {
		b.Examples = b.Examples[:storedValueExamples]
	}
}

// allowedByRule returns the option IDs in ranks that pass op against refRank.
func allowedByRule(ranks map[string]int, op model.PropertyBoundsOperator, refRank int) ([]string, error) {
	var keep func(rank int) bool
	switch op {
	case model.PropertyBoundsOperatorAtOrBelow:
		keep = func(rank int) bool { return rank <= refRank }
	case model.PropertyBoundsOperatorAtOrAbove:
		keep = func(rank int) bool { return rank >= refRank }
	default:
		// Save refuses unknown operators, so this is bad data; passing would quietly stop the rule applying.
		return nil, fmt.Errorf("unknown operator %q: %w", op, errBoundsCheckFailed)
	}
	allowed := []string{}
	for id, rank := range ranks {
		if keep(rank) {
			allowed = append(allowed, id)
		}
	}
	return allowed, nil
}

// allowedBySystemValue returns the options in ranks that pass rule against the system's value of
// parent, and false when the system holds no value, which sets no limit. A value that can't be
// ranked wraps errBoundsCheckFailed. Messages name IDs, never a value.
func (ps *PropertyService) allowedBySystemValue(rctx request.CTX, parent *model.PropertyField, rule model.PropertyBoundsRule, ranks map[string]int) ([]string, bool, error) {
	values, err := ps.searchPropertyValues(store.RequestContextWithMaster(rctx), parent.GroupID, model.PropertyValueSearchOpts{
		FieldID:    parent.ID,
		TargetType: model.PropertyValueTargetTypeSystem,
		TargetIDs:  []string{model.PropertyValueSystemTargetID},
		PerPage:    1,
	})
	if err != nil {
		return nil, false, fmt.Errorf("failed to read the parent's value: %w", err)
	}
	// A user's clear leaves a null-valued row behind, so a row isn't proof of a value.
	if len(values) == 0 || model.IsEmptyPropertyValue(values[0].Value) {
		return nil, false, nil
	}

	refRank, ok := singleOptionRank(parent.Type, values[0].Value, ranks)
	if !ok {
		return nil, false, fmt.Errorf("the parent's value can't be ranked: %w", errBoundsCheckFailed)
	}
	allowed, err := allowedByRule(ranks, rule.Operator, refRank)
	return allowed, err == nil, err
}

// onlyParentField returns the one field on child's parent object type that links to child's
// template; any other count wraps errBoundsCheckFailed. enforceParentField has already refused a
// rule whose parent side isn't unique, so this is a guard.
func (ps *PropertyService) onlyParentField(rctx request.CTX, child *model.PropertyField) (*model.PropertyField, error) {
	matches, err := ps.parentMatchingFields(rctx, child)
	if err != nil {
		return nil, fmt.Errorf("field %s: failed to look up the parent's field: %w", child.ID, err)
	}
	if len(matches) != 1 {
		return nil, fmt.Errorf("field %s: needs exactly one parent field, found %d: %w", child.ID, len(matches), errBoundsCheckFailed)
	}
	return matches[0], nil
}

// parentRuleBreaches counts the stored values that break a parent rule child gains, judged against
// the parent's value as it is now: child's own, plus, for a channel field, the posts whose post
// field already carries the same rule and that would start falling back through it, unless
// withFallback is false. A rule that can't be evaluated wraps errBoundsCheckFailed; a store error is
// returned wrapped. Messages name IDs, never a value. incoming holds every field of the update call,
// whose copies replace the stored ones.
func (ps *PropertyService) parentRuleBreaches(rctx request.CTX, child *model.PropertyField, rule model.PropertyBoundsRule, ranks map[string]int, incoming map[string]*model.PropertyField, withFallback bool) (storedValueBreaches, error) {
	var breaches storedValueBreaches
	switch child.ObjectType {
	case model.PropertyFieldObjectTypePost:
		return ps.postRuleBreaches(rctx, child, rule, ranks, incoming)
	case model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeUser:
	default:
		return breaches, nil
	}

	parent, err := ps.onlyParentField(rctx, child)
	if err != nil {
		return breaches, err
	}
	allowed, limited, err := ps.allowedBySystemValue(rctx, parent, rule, ranks)
	if err != nil {
		return breaches, fmt.Errorf("field %s: %w", child.ID, err)
	}
	if !limited {
		return breaches, nil
	}

	count, examples, err := ps.valueStore.CountValuesOutsideOptions(child.GroupID, child.ID, allowed, nil, storedValueExamples)
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to count the stored values: %w", child.ID, err)
	}
	breaches.add(count, examples)
	if child.ObjectType != model.PropertyFieldObjectTypeChannel || !withFallback {
		return breaches, nil
	}
	found, _, err := ps.fallbackPostBreaches(rctx, child, child.Bounds, &rule, func(model.PropertyBoundsRule) ([]string, error) { return allowed, nil }, incoming)
	if err != nil {
		return breaches, err
	}
	breaches.add(found.Count, found.Examples)
	return breaches, nil
}

// fallbackPostBreaches counts the stored values of the post fields whose parent is channelField
// that fall outside what allowedFor says a rule permits. Posts in a channel with no value of
// channelField fall back to the system's value, but only when their post field carries the same
// rule as channelBounds, so only those rules are counted; only, when set, narrows that to one rule.
// incoming's copies replace the stored post fields, and may be nil. It also returns the ID of the
// first post field with a breach.
func (ps *PropertyService) fallbackPostBreaches(rctx request.CTX, channelField *model.PropertyField, channelBounds model.PropertyBounds, only *model.PropertyBoundsRule, allowedFor func(model.PropertyBoundsRule) ([]string, error), incoming map[string]*model.PropertyField) (breaches storedValueBreaches, firstFieldID string, err error) {
	postFields, err := ps.childFieldsWithParentRule(rctx, channelField)
	if err != nil {
		return breaches, "", fmt.Errorf("field %s: failed to look up the post fields: %w", channelField.ID, err)
	}
	for _, postField := range postFields {
		if inc, ok := incoming[postField.ID]; ok {
			postField = inc
		}
		for _, rule := range postField.Bounds {
			if rule.Reference != model.PropertyBoundsReferenceParent || !slices.Contains(channelBounds, rule) || (only != nil && rule != *only) {
				continue
			}
			allowed, err := allowedFor(rule)
			if err != nil {
				return breaches, "", fmt.Errorf("field %s: %w", postField.ID, err)
			}
			count, examples, err := ps.valueStore.CountValuesOutsideOptions(postField.GroupID, postField.ID, allowed, &store.PostValueScope{ChannelFieldID: channelField.ID}, storedValueExamples)
			if err != nil {
				return breaches, "", fmt.Errorf("field %s: failed to count the stored values of post field %s: %w", channelField.ID, postField.ID, err)
			}
			if count > 0 && firstFieldID == "" {
				firstFieldID = postField.ID
			}
			breaches.add(count, examples)
		}
	}
	return breaches, firstFieldID, nil
}

// postRuleBreaches counts the stored values of a post field that break a parent rule it gains. A
// post's reference is its channel's value of the channel field; a channel with no value falls back
// to the system's, but only when the channel field carries the same rule, as it will once this
// update is stored.
func (ps *PropertyService) postRuleBreaches(rctx request.CTX, post *model.PropertyField, rule model.PropertyBoundsRule, ranks map[string]int, incoming map[string]*model.PropertyField) (storedValueBreaches, error) {
	var breaches storedValueBreaches
	channelField, err := ps.onlyParentField(rctx, post)
	if err != nil {
		return breaches, err
	}

	// One query per distinct channel value, so no walk through posts.
	held, err := ps.valueStore.GetReferencedOptionIDs(post.GroupID, []string{channelField.ID})
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to read the channel field's values: %w", post.ID, err)
	}
	for _, optionID := range held {
		// An option that isn't in ranks can't be compared, so every value under it counts.
		allowed := []string{}
		if rank, ok := ranks[optionID]; ok {
			if allowed, err = allowedByRule(ranks, rule.Operator, rank); err != nil {
				return breaches, fmt.Errorf("field %s: %w", post.ID, err)
			}
		}
		var count int64
		var examples []string
		count, examples, err = ps.valueStore.CountValuesOutsideOptions(post.GroupID, post.ID, allowed, &store.PostValueScope{ChannelFieldID: channelField.ID, ChannelValue: optionID}, storedValueExamples)
		if err != nil {
			return breaches, fmt.Errorf("field %s: failed to count the stored values: %w", post.ID, err)
		}
		breaches.add(count, examples)
	}

	bounds := channelField.Bounds
	if inc, ok := incoming[channelField.ID]; ok {
		bounds = inc.Bounds
	}
	if !slices.Contains(bounds, rule) {
		return breaches, nil
	}
	system, err := ps.onlyParentField(rctx, channelField)
	if err != nil {
		return breaches, err
	}
	allowed, limited, err := ps.allowedBySystemValue(rctx, system, rule, ranks)
	if err != nil {
		return breaches, fmt.Errorf("field %s: %w", post.ID, err)
	}
	if !limited {
		return breaches, nil
	}
	count, examples, err := ps.valueStore.CountValuesOutsideOptions(post.GroupID, post.ID, allowed, &store.PostValueScope{ChannelFieldID: channelField.ID}, storedValueExamples)
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to count the stored values: %w", post.ID, err)
	}
	breaches.add(count, examples)
	return breaches, nil
}

// locksField reports whether saving next over existing applies a lock: the new mutability is not
// mutable and differs from the stored one.
func locksField(existing, next model.PropertyFieldMutability) bool {
	next = next.OrMutable()
	return next != model.PropertyFieldMutabilityMutable && next != existing.OrMutable()
}

// deletedOptionBreaches counts the live values of an option field that name an option the field no
// longer holds. A store error is returned wrapped. Messages name IDs, never an option.
func (ps *PropertyService) deletedOptionBreaches(existing *model.PropertyField) (storedValueBreaches, error) {
	var breaches storedValueBreaches
	if !existing.Type.SupportsOptions() {
		return breaches, nil
	}
	referenced, err := ps.valueStore.GetReferencedOptionIDs(existing.GroupID, []string{existing.ID})
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to read the options its values name: %w", existing.ID, err)
	}
	if len(referenced) == 0 {
		return breaches, nil
	}
	// Asked of the option rows, not the hydrated list: a linked field serves its template's options,
	// and a field with very many options is read back without its list.
	live, err := ps.fieldStore.GetExistingOptionIDs(existing, referenced)
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to look up its options: %w", existing.ID, err)
	}
	if !slices.ContainsFunc(referenced, func(id string) bool { return !slices.Contains(live, id) }) {
		return breaches, nil
	}
	var scope *store.PostValueScope
	if existing.ObjectType == model.PropertyFieldObjectTypePost {
		// Values on deleted posts are not live, whichever option they name.
		scope = &store.PostValueScope{}
	}
	count, examples, err := ps.valueStore.CountValuesOutsideOptions(existing.GroupID, existing.ID, live, scope, storedValueExamples)
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to count the stored values: %w", existing.ID, err)
	}
	breaches.add(count, examples)
	return breaches, nil
}

// optionRanksChange reports whether saving field over existing changes the rank of an option both
// hold. Only a rank field that supplies its options can; adding an option or leaving the ranks
// alone changes no comparison.
func optionRanksChange(existing, field *model.PropertyField) bool {
	if existing.Type != model.PropertyFieldTypeRank || field.Type != model.PropertyFieldTypeRank || !model.PropertyFieldSuppliesOptions(field.Attrs) {
		return false
	}
	old := buildOptionRankMap(existing)
	for id, rank := range buildOptionRankMap(field) {
		if was, ok := old[id]; ok && was != rank {
			return true
		}
	}
	return false
}

// rankChangeBreaches counts the stored values that break a parent rule of a field linked to
// template once template takes ranks, and names the first linked field with a breach. Every rule
// is checked, not only new ones, and a linked field in the call is judged by its copy there. The
// IDs of the linked fields it judged are added to checked.
func (ps *PropertyService) rankChangeBreaches(rctx request.CTX, template *model.PropertyField, ranks map[string]int, incoming map[string]*model.PropertyField, checked map[string]bool) (breaches storedValueBreaches, linkedID string, err error) {
	linked, err := ps.fieldStore.GetLinkedFields([]string{template.ID}, nil)
	if err != nil {
		return breaches, "", fmt.Errorf("field %s: failed to look up the fields linked to it: %w", template.ID, err)
	}
	for _, child := range linked {
		if inc, ok := incoming[child.ID]; ok {
			child = inc
		}
		if child.IsPSAv1() {
			continue
		}
		checked[child.ID] = true
		for _, rule := range child.Bounds {
			if rule.Reference != model.PropertyBoundsReferenceParent {
				continue
			}
			// Fallback posts are left out: a post field carrying the rule is linked to this template
			// too, so it is one of linked and counts its own posts.
			found, err := ps.parentRuleBreaches(rctx, child, rule, ranks, incoming, false)
			if err != nil {
				return breaches, "", err
			}
			if found.Count > 0 && linkedID == "" {
				linkedID = child.ID
			}
			breaches.add(found.Count, found.Examples)
		}
	}
	return breaches, linkedID, nil
}

// refuseRulesBrokenByStoredValues refuses a field save that adds a parent rule some stored value
// of the field already breaks, or whose check can't be completed, and one that locks a field whose
// values name a deleted option: they would be stuck, since the lock refuses the replacement value.
// It also refuses a change to the rank of an option that would put a stored value outside the
// parent rules of the fields linked to it. Removing or keeping a rule is never checked, a self rule
// can't be broken by a value that is already stored, and no other mutability change depends on
// stored values. fields hold the rules and mutability about to be stored; a field missing from
// existingByID, or a PSAv1 field, is skipped.
//
// A value written between this check and the field's write can still land out of bounds; the
// field's own write stays conditional on its UpdateAt, and there are no locks across objects.
func (ps *PropertyService) refuseRulesBrokenByStoredValues(rctx request.CTX, fields []*model.PropertyField, existingByID, incoming map[string]*model.PropertyField) error {
	// Linked fields whose rules a rank change in this call already judged with the new ranks, which
	// includes any rule new in the call.
	checked := map[string]bool{}
	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok || field.IsPSAv1() || existing.IsPSAv1() || !optionRanksChange(existing, field) {
			continue
		}
		breaches, linkedID, err := ps.rankChangeBreaches(rctx, field, buildOptionRankMap(field), incoming, checked)
		if errors.Is(err, errBoundsCheckFailed) {
			return model.NewAppError("UpdatePropertyFields", "app.property_field.bounds_check_failed.app_error", nil, err.Error(), http.StatusConflict).Wrap(err)
		}
		if err != nil {
			return err
		}
		if breaches.Count > 0 {
			examples := strings.Join(breaches.Examples, ", ")
			return model.NewAppError("UpdatePropertyFields", "app.property_field.option_ranks_stored_values.app_error",
				map[string]any{"Count": breaches.Count, "Examples": examples},
				fmt.Sprintf("field %s: new option ranks put %d stored values of field %s out of bounds, e.g. %s", field.ID, breaches.Count, linkedID, examples),
				http.StatusConflict)
		}
	}

	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok || field.IsPSAv1() || existing.IsPSAv1() {
			continue
		}
		ranks := buildOptionRankMap(existing)
		for _, rule := range field.Bounds {
			if rule.Reference != model.PropertyBoundsReferenceParent || slices.Contains(existing.Bounds, rule) || checked[field.ID] {
				continue
			}
			breaches, err := ps.parentRuleBreaches(rctx, field, rule, ranks, incoming, true)
			if errors.Is(err, errBoundsCheckFailed) {
				return model.NewAppError("UpdatePropertyFields", "app.property_field.bounds_check_failed.app_error", nil, err.Error(), http.StatusConflict).Wrap(err)
			}
			if err != nil {
				return err
			}
			if breaches.Count > 0 {
				examples := strings.Join(breaches.Examples, ", ")
				return model.NewAppError("UpdatePropertyFields", "app.property_field.bounds_stored_values.app_error",
					map[string]any{"Count": breaches.Count, "Examples": examples},
					fmt.Sprintf("field %s: bounds rule %s %s: %d stored values out of bounds, e.g. %s", field.ID, rule.Operator, rule.Reference, breaches.Count, examples),
					http.StatusConflict)
			}
		}
		if !locksField(existing.Mutability, field.Mutability) {
			continue
		}
		breaches, err := ps.deletedOptionBreaches(existing)
		if err != nil {
			return err
		}
		if breaches.Count > 0 {
			examples := strings.Join(breaches.Examples, ", ")
			return model.NewAppError("UpdatePropertyFields", "app.property_field.mutability_deleted_options.app_error",
				map[string]any{"Count": breaches.Count, "Examples": examples},
				fmt.Sprintf("field %s: mutability %s: %d values name a deleted option, e.g. %s", field.ID, field.Mutability, breaches.Count, examples),
				http.StatusConflict)
		}
	}
	return nil
}
