// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ValueTypeValidationHook refuses a value whose JSON does not fit its field's
// type, for the types whose shape core enforces in every group: number (see
// model.ValidatePropertyValueForFieldType). Unlike the access
// control validation hook it is not scoped to managed groups, because these
// types are new and nothing has ever been stored under them that a check could
// now refuse: a plugin, the REST API, and an import all get the same answer.
//
// It reads the fields the values name, once per group per write. A value naming
// a field its group does not hold is not checked here: that was allowed before
// these types existed, and refusing it would change writes that never involve
// them.
type ValueTypeValidationHook struct {
	BasePropertyHook
	propertyService *PropertyService
}

var _ PropertyHook = (*ValueTypeValidationHook)(nil)

func NewValueTypeValidationHook(ps *PropertyService) *ValueTypeValidationHook {
	return &ValueTypeValidationHook{propertyService: ps}
}

func (h *ValueTypeValidationHook) PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validate(rctx, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *ValueTypeValidationHook) PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validate(rctx, values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *ValueTypeValidationHook) PreUpdatePropertyValue(rctx request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validate(rctx, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *ValueTypeValidationHook) PreUpdatePropertyValues(rctx request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validate(rctx, values); err != nil {
		return nil, err
	}
	return values, nil
}

func (h *ValueTypeValidationHook) PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := h.validate(rctx, []*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *ValueTypeValidationHook) PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := h.validate(rctx, values); err != nil {
		return nil, err
	}
	return values, nil
}

// validate checks every value against its field's type. The values of a batch
// may name fields of several groups, so the fields are read per group.
func (h *ValueTypeValidationHook) validate(rctx request.CTX, values []*model.PropertyValue) error {
	fieldIDsByGroup := make(map[string][]string)
	seen := make(map[string]struct{})
	for _, v := range values {
		if v == nil || !model.IsValidId(v.FieldID) {
			continue
		}
		key := v.GroupID + "\x00" + v.FieldID
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		fieldIDsByGroup[v.GroupID] = append(fieldIDsByGroup[v.GroupID], v.FieldID)
	}
	if len(fieldIDsByGroup) == 0 {
		return nil
	}

	fieldTypes := make(map[string]model.PropertyFieldType, len(seen))
	for groupID, fieldIDs := range fieldIDsByGroup {
		fields, err := h.fieldsOfGroup(rctx, groupID, fieldIDs)
		if err != nil {
			return fmt.Errorf("failed to fetch fields for value validation: %w", err)
		}
		for _, f := range fields {
			fieldTypes[groupID+"\x00"+f.ID] = f.Type
		}
	}

	for _, v := range values {
		if v == nil {
			continue
		}
		fieldType, ok := fieldTypes[v.GroupID+"\x00"+v.FieldID]
		if !ok {
			continue
		}
		if err := model.ValidatePropertyValueForFieldType(fieldType, v.Value); err != nil {
			return fmt.Errorf("field %s: %s: %w", v.FieldID, err.Error(), ErrInvalidValue)
		}
	}
	return nil
}

// fieldsOfGroup returns those of the fields the group holds. When some are not
// in it, the rest are read one at a time, so their values are still checked.
func (h *ValueTypeValidationHook) fieldsOfGroup(rctx request.CTX, groupID string, fieldIDs []string) ([]*model.PropertyField, error) {
	fields, err := h.propertyService.getPropertyFields(rctx, groupID, fieldIDs)
	if err == nil {
		return fields, nil
	}
	if !errors.Is(err, ErrFieldNotFound) {
		return nil, err
	}

	fields = fields[:0]
	for _, id := range fieldIDs {
		found, err := h.propertyService.getPropertyFields(rctx, groupID, []string{id})
		if errors.Is(err, ErrFieldNotFound) {
			continue
		}
		if err != nil {
			return nil, err
		}
		fields = append(fields, found...)
	}
	return fields, nil
}
