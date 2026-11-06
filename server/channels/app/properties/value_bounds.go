// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// errBoundsCheckFailed marks a bounds rule that can't be checked because the
// data it depends on is broken, such as a missing parent object. It refuses the
// write, unlike a rule that simply has nothing to compare against.
var errBoundsCheckFailed = errors.New("bounds check failed")

// errBoundsViolated marks a value that breaks a bounds rule.
var errBoundsViolated = errors.New("bounds violated")

// compareByRank checks next against ref by option rank under op. Which value
// ref is (the parent's or the object's own) is the caller's to resolve, and
// empty values are the caller's to handle: an empty one fails the check.
// Messages never carry option IDs or ranks, since the writer may not be allowed
// to see ref.
func compareByRank(field *model.PropertyField, op model.PropertyBoundsOperator, next, ref json.RawMessage) error {
	ranks := buildOptionRankMap(field)
	nextRank, nextOK := singleOptionRank(field.Type, next, ranks)
	refRank, refOK := singleOptionRank(field.Type, ref, ranks)
	if !nextOK || !refOK {
		return fmt.Errorf("field %s: operator %q: a value can't be ranked: %w", field.ID, op, errBoundsCheckFailed)
	}

	var ok bool
	switch op {
	case model.PropertyBoundsOperatorAtOrBelow:
		ok = nextRank <= refRank
	case model.PropertyBoundsOperatorAtOrAbove:
		ok = nextRank >= refRank
	default:
		// Save refuses unknown operators, so this is bad data; passing would quietly stop the rule applying.
		return fmt.Errorf("field %s: unknown operator %q: %w", field.ID, op, errBoundsCheckFailed)
	}
	if !ok {
		return fmt.Errorf("field %s: operator %q: %w", field.ID, op, errBoundsViolated)
	}
	return nil
}

// boundsParent returns the field and the object that hold the value a parent
// rule on field compares against, for a value written to targetID. Every
// failure to find them refuses the write: a store error is returned wrapped, and
// anything missing or ambiguous wraps errBoundsCheckFailed. Messages name IDs,
// never a value.
func (h *AccessControlAttributeValidationHook) boundsParent(rctx request.CTX, field *model.PropertyField, targetID string) (parentField *model.PropertyField, parentTargetType, parentTargetID string, err error) {
	switch field.ObjectType {
	case model.PropertyFieldObjectTypeChannel, model.PropertyFieldObjectTypeUser:
		parentTargetType, parentTargetID = model.PropertyValueTargetTypeSystem, model.PropertyValueSystemTargetID
	case model.PropertyFieldObjectTypePost:
		if h.postChannelResolver == nil {
			return nil, "", "", fmt.Errorf("field %s: no way to find the channel of post %s: %w", field.ID, targetID, errBoundsCheckFailed)
		}
		channelID, resolveErr := h.postChannelResolver(rctx, targetID)
		if resolveErr != nil {
			return nil, "", "", fmt.Errorf("field %s: could not find the channel of post %s: %v: %w", field.ID, targetID, resolveErr, errBoundsCheckFailed)
		}
		if channelID == "" {
			return nil, "", "", fmt.Errorf("field %s: post %s has no channel: %w", field.ID, targetID, errBoundsCheckFailed)
		}
		parentTargetType, parentTargetID = model.PropertyValueTargetTypeChannel, channelID
	default:
		return nil, "", "", fmt.Errorf("field %s: object type %q has no parent: %w", field.ID, field.ObjectType, errBoundsCheckFailed)
	}

	matches, err := h.propertyService.parentMatchingFields(rctx, field)
	if err != nil {
		return nil, "", "", fmt.Errorf("field %s: failed to look up the parent's field for target %s: %w", field.ID, targetID, err)
	}
	if len(matches) != 1 {
		found := "none"
		if len(matches) > 1 {
			found = "more than one"
		}
		return nil, "", "", fmt.Errorf("field %s: target %s needs exactly one parent field, found %s: %w", field.ID, targetID, found, errBoundsCheckFailed)
	}
	return matches[0], parentTargetType, parentTargetID, nil
}

// checkParentRule decides whether value, about to be written to field, satisfies
// a parent rule. An empty parent value isn't a limit: the walk moves up only
// through parent fields carrying the same rule, so an object isn't held to a
// level that its own level isn't. Nothing up the chain having a value means no
// limit. The parent's value is read from the store directly, so masking doesn't
// loosen the rule.
func (h *AccessControlAttributeValidationHook) checkParentRule(rctx request.CTX, field *model.PropertyField, rule model.PropertyBoundsRule, value *model.PropertyValue) error {
	if model.IsEmptyPropertyValue(value.Value) {
		return nil
	}

	// The walk ends at the system, which has no parent and so never carries a parent rule.
	current, targetID := field, value.TargetID
	for {
		parentField, parentTargetType, parentTargetID, err := h.boundsParent(rctx, current, targetID)
		if err != nil {
			return err
		}

		values, err := h.propertyService.searchPropertyValues(rctx, field.GroupID, model.PropertyValueSearchOpts{
			FieldID:    parentField.ID,
			TargetType: parentTargetType,
			TargetIDs:  []string{parentTargetID},
			PerPage:    1,
		})
		if err != nil {
			return fmt.Errorf("field %s: failed to read the parent's value for target %s: %w", field.ID, targetID, err)
		}

		// A user's clear leaves a null-valued row behind, so a row isn't proof of a value.
		if len(values) > 0 && !model.IsEmptyPropertyValue(values[0].Value) {
			return compareByRank(field, rule.Operator, value.Value, values[0].Value)
		}
		if !slices.Contains(parentField.Bounds, rule) {
			return nil
		}
		current, targetID = parentField, parentTargetID
	}
}
