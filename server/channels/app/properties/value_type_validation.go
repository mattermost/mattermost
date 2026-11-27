// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// ValueTypeValidationHook refuses a value whose JSON does not fit its field's
// type, for the types whose shape core enforces in every group: number and
// checkbox (see model.ValidatePropertyValueForFieldType). Unlike the access
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

func (h *ValueTypeValidationHook) PreUpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	checked, err := h.asStored(rctx, groupID, []*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}
	if err := h.validate(rctx, checked); err != nil {
		return nil, err
	}
	return value, nil
}

func (h *ValueTypeValidationHook) PreUpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	checked, err := h.asStored(rctx, groupID, values)
	if err != nil {
		return nil, err
	}
	if err := h.validate(rctx, checked); err != nil {
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

// asStored returns copies of an update's values carrying the field and group of
// the rows they update. An update writes Value to the row its ID names, in
// groupID when that is set, and leaves the row's FieldID and GroupID as they
// are, so the field the payload names must not decide the check. The rows are
// read from the master, so a replica that hasn't caught up can't hide one. A
// value with no row writes nothing, and keeps the payload's field, in groupID.
func (h *ValueTypeValidationHook) asStored(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	var ids []string
	for _, v := range values {
		if v != nil && model.IsValidId(v.ID) {
			ids = append(ids, v.ID)
		}
	}
	stored, err := h.propertyService.getStoredPropertyValues(rctx, groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch values for value validation: %w", err)
	}

	checked := make([]*model.PropertyValue, len(values))
	for i, v := range values {
		if v == nil {
			continue
		}
		c := *v
		if row, ok := stored[v.ID]; ok {
			c.FieldID = row.FieldID
			c.GroupID = row.GroupID
		} else if groupID != "" {
			c.GroupID = groupID
		}
		checked[i] = &c
	}
	return checked, nil
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
		fields, err := h.propertyService.getExistingPropertyFields(rctx, groupID, fieldIDs)
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
