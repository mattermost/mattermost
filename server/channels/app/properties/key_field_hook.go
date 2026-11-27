// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// KeyFieldHook owns the lifecycle of key fields, whose values are issue-style
// numbers (the 42 of MM-42) that the server hands out.
//
// On fields it normalizes and validates the prefix attr and refuses to turn a
// key field into any other type, or another field into a key field: the
// numbers already handed out would lose their meaning, or never have had one.
//
// On values it keeps one rule: a number is assigned once, from the field's
// atomic counter, and never supplied or changed by a caller. Creating a value
// (or upserting onto a target with none) assigns the next number; an upsert
// onto a live row keeps the stored one; an update may only repeat it. Exactly
// one entity can therefore hold each number, and a number that is handed out
// but not stored is a gap, never reused.
//
// Fields and values are read from the master. A value naming a field its group
// does not hold is left alone, as ValueTypeValidationHook does. Register it
// before ValueTypeValidationHook so the numbers exist when shapes are checked.
type KeyFieldHook struct {
	BasePropertyHook
	propertyService *PropertyService
}

var _ PropertyHook = (*KeyFieldHook)(nil)

func NewKeyFieldHook(ps *PropertyService) *KeyFieldHook {
	return &KeyFieldHook{propertyService: ps}
}

// keyFieldRef names a field within its group.
type keyFieldRef struct {
	groupID string
	fieldID string
}

// keyValueSlot names the row a value is written to.
type keyValueSlot struct {
	keyFieldRef
	targetID string
}

func (h *KeyFieldHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if err := sanitizeKeyFieldPrefix(field); err != nil {
		return nil, err
	}
	return field, nil
}

func (h *KeyFieldHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if field == nil {
		return field, nil
	}
	if err := sanitizeKeyFieldPrefix(field); err != nil {
		return nil, err
	}

	existing, err := h.propertyService.getPropertyFieldFromMaster(rctx, groupID, field.ID)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return field, nil
		}
		return nil, fmt.Errorf("failed to fetch field for key validation: %w", err)
	}
	if err := refuseKeyTypeChange(existing, field); err != nil {
		return nil, err
	}
	return field, nil
}

func (h *KeyFieldHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	var ids []string
	for _, f := range fields {
		if f == nil {
			continue
		}
		if err := sanitizeKeyFieldPrefix(f); err != nil {
			return nil, fmt.Errorf("field %s: %w", f.ID, err)
		}
		if model.IsValidId(f.ID) {
			ids = append(ids, f.ID)
		}
	}
	if len(ids) == 0 {
		return fields, nil
	}

	existing, err := h.propertyService.getExistingPropertyFields(rctx, groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch fields for key validation: %w", err)
	}
	existingByID := make(map[string]*model.PropertyField, len(existing))
	for _, f := range existing {
		existingByID[f.ID] = f
	}

	for _, f := range fields {
		if f == nil {
			continue
		}
		if ex, ok := existingByID[f.ID]; ok {
			if err := refuseKeyTypeChange(ex, f); err != nil {
				return nil, fmt.Errorf("field %s: %w", f.ID, err)
			}
		}
	}
	return fields, nil
}

func (h *KeyFieldHook) PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	out, err := h.assignNumbers(rctx, []*model.PropertyValue{value}, false)
	if err != nil {
		return nil, err
	}
	return out[0], nil
}

func (h *KeyFieldHook) PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return h.assignNumbers(rctx, values, false)
}

func (h *KeyFieldHook) PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	out, err := h.assignNumbers(rctx, []*model.PropertyValue{value}, true)
	if err != nil {
		return nil, err
	}
	return out[0], nil
}

func (h *KeyFieldHook) PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return h.assignNumbers(rctx, values, true)
}

func (h *KeyFieldHook) PreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.refuseNumberChanges(rctx, groupID, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *KeyFieldHook) PreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.refuseNumberChanges(rctx, groupID, values); err != nil {
		return nil, err
	}
	return values, nil
}

func sanitizeKeyFieldPrefix(field *model.PropertyField) error {
	if field == nil {
		return nil
	}
	if err := model.SanitizeAndValidatePropertyFieldPrefix(field); err != nil {
		return fmt.Errorf("%s: %w", err.Error(), ErrInvalidFieldAttrs)
	}
	return nil
}

func refuseKeyTypeChange(existing, field *model.PropertyField) error {
	wasKey := existing.Type == model.PropertyFieldTypeKey
	isKey := field.Type == model.PropertyFieldTypeKey
	switch {
	case wasKey && !isKey:
		return fmt.Errorf("a key field cannot be changed to another type, its numbers would lose their meaning: %w", ErrInvalidFieldAttrs)
	case !wasKey && isKey:
		return fmt.Errorf("a field cannot be changed to a key field, create a new one instead: %w", ErrInvalidFieldAttrs)
	}
	return nil
}

// assignNumbers gives every empty value of a key field its number, in input
// order, with one allocation per field. With upsert, a target that already has
// a live row keeps that row's number instead, and a caller may echo it back.
// It returns a slice parallel to values, copying only the values it changes.
func (h *KeyFieldHook) assignNumbers(rctx request.CTX, values []*model.PropertyValue, upsert bool) ([]*model.PropertyValue, error) {
	keyFields, err := h.keyFieldsOf(rctx, values)
	if err != nil {
		return nil, err
	}
	if len(keyFields) == 0 {
		return values, nil
	}

	var existing map[keyValueSlot]json.RawMessage
	if upsert {
		existing, err = h.liveNumbers(rctx, values, keyFields)
		if err != nil {
			return nil, err
		}
	}

	out := make([]*model.PropertyValue, len(values))
	copy(out, values)

	var fieldOrder []keyFieldRef
	toAllocate := make(map[keyFieldRef][]int)
	// A target repeated in one upsert batch is one row, so its repeats share the
	// number of its first occurrence rather than each burning one.
	firstOfSlot := make(map[keyValueSlot]int)
	sharesNumberWith := make(map[int]int)

	for i, v := range values {
		if v == nil {
			continue
		}
		ref := keyFieldRef{v.GroupID, v.FieldID}
		if _, ok := keyFields[ref]; !ok {
			continue
		}

		slot := keyValueSlot{ref, v.TargetID}
		stored, hasStored := existing[slot]

		if !isNullValue(v.Value) {
			if !hasStored || !sameKeyNumber(stored, v.Value) {
				return nil, fmt.Errorf("field %s: a key field's value is assigned by the server: %w", v.FieldID, ErrInvalidValue)
			}
			continue
		}

		if hasStored {
			c := *v
			c.Value = stored
			out[i] = &c
			continue
		}

		if upsert {
			if first, ok := firstOfSlot[slot]; ok {
				sharesNumberWith[i] = first
				continue
			}
			firstOfSlot[slot] = i
		}

		if _, ok := toAllocate[ref]; !ok {
			fieldOrder = append(fieldOrder, ref)
		}
		toAllocate[ref] = append(toAllocate[ref], i)
	}

	for _, ref := range fieldOrder {
		indices := toAllocate[ref]
		last, err := h.propertyService.allocateKeyNumbers(ref.fieldID, len(indices))
		if err != nil {
			return nil, fmt.Errorf("failed to allocate key numbers for field %s: %w", ref.fieldID, err)
		}
		first := last - int64(len(indices)) + 1
		for n, i := range indices {
			c := *values[i]
			c.Value = json.RawMessage(strconv.FormatInt(first+int64(n), 10))
			out[i] = &c
		}
	}

	for i, first := range sharesNumberWith {
		c := *values[i]
		c.Value = out[first].Value
		out[i] = &c
	}

	return out, nil
}

// refuseNumberChanges refuses an update that would write a different number
// than the row holds. The row decides which field is written, not the payload,
// as in ValueTypeValidationHook.asStored.
func (h *KeyFieldHook) refuseNumberChanges(rctx request.CTX, groupID string, values []*model.PropertyValue) error {
	var ids []string
	for _, v := range values {
		if v != nil && model.IsValidId(v.ID) {
			ids = append(ids, v.ID)
		}
	}
	rows, err := h.propertyService.getStoredPropertyValues(rctx, groupID, ids)
	if err != nil {
		return fmt.Errorf("failed to fetch values for key validation: %w", err)
	}
	if len(rows) == 0 {
		return nil
	}

	stored := make([]*model.PropertyValue, 0, len(rows))
	for _, row := range rows {
		stored = append(stored, row)
	}
	keyFields, err := h.keyFieldsOf(rctx, stored)
	if err != nil {
		return err
	}

	for _, v := range values {
		if v == nil {
			continue
		}
		row, ok := rows[v.ID]
		if !ok {
			continue
		}
		if _, ok := keyFields[keyFieldRef{row.GroupID, row.FieldID}]; !ok {
			continue
		}
		if !sameKeyNumber(row.Value, v.Value) {
			return fmt.Errorf("field %s: a key field's value cannot be changed: %w", row.FieldID, ErrInvalidValue)
		}
	}
	return nil
}

// keyFieldsOf returns the fields, among those the values name, that are of type
// key. The values of a batch may name fields of several groups, so the fields
// are read per group.
func (h *KeyFieldHook) keyFieldsOf(rctx request.CTX, values []*model.PropertyValue) (map[keyFieldRef]struct{}, error) {
	idsByGroup := make(map[string][]string)
	seen := make(map[keyFieldRef]struct{})
	for _, v := range values {
		if v == nil || !model.IsValidId(v.FieldID) {
			continue
		}
		ref := keyFieldRef{v.GroupID, v.FieldID}
		if _, ok := seen[ref]; ok {
			continue
		}
		seen[ref] = struct{}{}
		idsByGroup[v.GroupID] = append(idsByGroup[v.GroupID], v.FieldID)
	}

	keyFields := make(map[keyFieldRef]struct{})
	for groupID, ids := range idsByGroup {
		fields, err := h.propertyService.getExistingPropertyFields(rctx, groupID, ids)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch fields for key validation: %w", err)
		}
		for _, f := range fields {
			if f.Type == model.PropertyFieldTypeKey {
				keyFields[keyFieldRef{groupID, f.ID}] = struct{}{}
			}
		}
	}
	return keyFields, nil
}

// liveNumbers returns the stored value of each live row a key field's value in
// the batch would write to.
func (h *KeyFieldHook) liveNumbers(rctx request.CTX, values []*model.PropertyValue, keyFields map[keyFieldRef]struct{}) (map[keyValueSlot]json.RawMessage, error) {
	targetsByField := make(map[keyFieldRef][]string)
	seen := make(map[keyValueSlot]struct{})
	for _, v := range values {
		if v == nil {
			continue
		}
		ref := keyFieldRef{v.GroupID, v.FieldID}
		if _, ok := keyFields[ref]; !ok {
			continue
		}
		slot := keyValueSlot{ref, v.TargetID}
		if _, ok := seen[slot]; ok {
			continue
		}
		seen[slot] = struct{}{}
		targetsByField[ref] = append(targetsByField[ref], v.TargetID)
	}

	existing := make(map[keyValueSlot]json.RawMessage)
	for ref, targetIDs := range targetsByField {
		rows, err := h.propertyService.searchPropertyValues(store.RequestContextWithMaster(rctx), ref.groupID, model.PropertyValueSearchOpts{
			FieldID:   ref.fieldID,
			TargetIDs: targetIDs,
			PerPage:   len(targetIDs),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch values for key validation: %w", err)
		}
		for _, row := range rows {
			existing[keyValueSlot{ref, row.TargetID}] = row.Value
		}
	}
	return existing, nil
}

func isNullValue(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) == 0 || string(trimmed) == "null"
}

// sameKeyNumber reports whether two raw values hold the same number, or are
// both empty.
func sameKeyNumber(a, b json.RawMessage) bool {
	na, oka := model.ParsePropertyKeyValue(a)
	nb, okb := model.ParsePropertyKeyValue(b)
	return oka == okb && na == nb
}
