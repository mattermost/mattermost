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

// parentRuleBreaches counts the stored values of child that break a parent rule, judged against
// the parent's value as it is now. A rule that can't be evaluated wraps errBoundsCheckFailed; a
// store error is returned wrapped. Messages name IDs, never a value.
func (ps *PropertyService) parentRuleBreaches(rctx request.CTX, child *model.PropertyField, rule model.PropertyBoundsRule, ranks map[string]int) (storedValueBreaches, error) {
	var breaches storedValueBreaches
	switch child.ObjectType {
	case model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeUser:
	default:
		return breaches, nil
	}

	matches, err := ps.parentMatchingFields(rctx, child)
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to look up the parent's field: %w", child.ID, err)
	}
	// enforceParentField has already refused a rule whose parent side isn't unique.
	if len(matches) != 1 {
		return breaches, fmt.Errorf("field %s: needs exactly one parent field, found %d: %w", child.ID, len(matches), errBoundsCheckFailed)
	}
	parent := matches[0]

	master := store.RequestContextWithMaster(rctx)
	values, err := ps.searchPropertyValues(master, child.GroupID, model.PropertyValueSearchOpts{
		FieldID:    parent.ID,
		TargetType: model.PropertyValueTargetTypeSystem,
		TargetIDs:  []string{model.PropertyValueSystemTargetID},
		PerPage:    1,
	})
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to read the parent's value: %w", child.ID, err)
	}
	// A user's clear leaves a null-valued row behind, so a row isn't proof of a value.
	if len(values) == 0 || model.IsEmptyPropertyValue(values[0].Value) {
		return breaches, nil
	}

	refRank, ok := singleOptionRank(parent.Type, values[0].Value, ranks)
	if !ok {
		return breaches, fmt.Errorf("field %s: the parent's value can't be ranked: %w", child.ID, errBoundsCheckFailed)
	}
	allowed, err := allowedByRule(ranks, rule.Operator, refRank)
	if err != nil {
		return breaches, fmt.Errorf("field %s: %w", child.ID, err)
	}

	count, examples, err := ps.valueStore.CountValuesOutsideOptions(child.GroupID, child.ID, allowed, nil, storedValueExamples)
	if err != nil {
		return breaches, fmt.Errorf("field %s: failed to count the stored values: %w", child.ID, err)
	}
	breaches.add(count, examples)
	return breaches, nil
}

// refuseRulesBrokenByStoredValues refuses a field save that adds a parent rule some stored value
// of the field already breaks, or whose check can't be completed. Removing or keeping a rule is
// never checked, and a self rule can't be broken by a value that is already stored. fields hold
// the rules about to be stored; a field missing from existingByID, or a PSAv1 field, is skipped.
//
// A value written between this check and the field's write can still land out of bounds; the
// field's own write stays conditional on its UpdateAt, and there are no locks across objects.
func (ps *PropertyService) refuseRulesBrokenByStoredValues(rctx request.CTX, fields []*model.PropertyField, existingByID map[string]*model.PropertyField) error {
	for _, field := range fields {
		existing, ok := existingByID[field.ID]
		if !ok || field.IsPSAv1() || existing.IsPSAv1() {
			continue
		}
		ranks := buildOptionRankMap(existing)
		for _, rule := range field.Bounds {
			if rule.Reference != model.PropertyBoundsReferenceParent || slices.Contains(existing.Bounds, rule) {
				continue
			}
			breaches, err := ps.parentRuleBreaches(rctx, field, rule, ranks)
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
	}
	return nil
}
