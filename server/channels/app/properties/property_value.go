// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// rejectTemplateValues checks that none of the given values target a template
// field. Template fields are definition-only and must never hold values.
// This is enforced at the service layer to cover all entry points (API,
// CPA endpoints, plugin API).
func (ps *PropertyService) rejectTemplateValues(values []*model.PropertyValue) error {
	// Collect unique field IDs
	seen := make(map[string]struct{}, len(values))
	for _, v := range values {
		if v == nil {
			continue
		}
		seen[v.FieldID] = struct{}{}
	}
	if len(seen) == 0 {
		return nil
	}

	fieldIDs := make([]string, 0, len(seen))
	for id := range seen {
		fieldIDs = append(fieldIDs, id)
	}

	// Batch lookup from master to avoid replication lag
	fields, err := ps.fieldStore.GetMany(store.WithMaster(context.Background()), "", fieldIDs)
	if err != nil {
		return fmt.Errorf("failed to look up fields for template check: %w", err)
	}

	for _, field := range fields {
		if field.ObjectType == model.PropertyFieldObjectTypeTemplate {
			return model.NewAppError(
				"PropertyService",
				"app.property_value.template_no_values.app_error",
				nil,
				fmt.Sprintf("template field %q cannot have values", field.ID),
				http.StatusBadRequest,
			)
		}
	}
	return nil
}

// Private implementation methods (database access)

func (ps *PropertyService) createPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues([]*model.PropertyValue{value}); err != nil {
		return nil, err
	}
	return ps.valueStore.Create(value)
}

func (ps *PropertyService) createPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values); err != nil {
		return nil, err
	}
	return ps.valueStore.CreateMany(values)
}

func (ps *PropertyService) getPropertyValue(groupID, id string) (*model.PropertyValue, error) {
	return ps.valueStore.Get(groupID, id)
}

func (ps *PropertyService) getPropertyValues(groupID string, ids []string) ([]*model.PropertyValue, error) {
	return ps.valueStore.GetMany(groupID, ids)
}

func (ps *PropertyService) searchPropertyValues(groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	// groupID is part of the search method signature to
	// incentivize the use of the database indexes in searches
	opts.GroupID = groupID
	return ps.valueStore.SearchPropertyValues(opts)
}

func (ps *PropertyService) updatePropertyValue(groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.updatePropertyValues(groupID, []*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) updatePropertyValues(groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values); err != nil {
		return nil, err
	}
	return ps.valueStore.Update(groupID, values)
}

func (ps *PropertyService) upsertPropertyValue(value *model.PropertyValue) (*model.PropertyValue, error) {
	values, err := ps.upsertPropertyValues([]*model.PropertyValue{value})
	if err != nil {
		return nil, err
	}

	return values[0], nil
}

func (ps *PropertyService) upsertPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if err := ps.rejectTemplateValues(values); err != nil {
		return nil, err
	}
	return ps.valueStore.Upsert(values)
}

func (ps *PropertyService) deletePropertyValue(groupID, id string) error {
	return ps.valueStore.Delete(groupID, id)
}

func (ps *PropertyService) deletePropertyValuesForTarget(groupID string, targetType string, targetID string) error {
	return ps.valueStore.DeleteForTarget(groupID, targetType, targetID)
}

func (ps *PropertyService) deletePropertyValuesForField(groupID, fieldID string) error {
	return ps.valueStore.DeleteForField(groupID, fieldID)
}

// Public methods

func (ps *PropertyService) CreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("CreatePropertyValue: value cannot be nil")
	}

	processed, err := ps.runPreCreatePropertyValue(rctx, value)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValue: %w", err)
	}

	created, err := ps.createPropertyValue(processed)
	if err != nil {
		return nil, err
	}
	ps.runPostCreatePropertyValue(rctx, created)
	return created, nil
}

func (ps *PropertyService) CreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	for i, v := range values {
		if v == nil {
			return nil, fmt.Errorf("CreatePropertyValues: nil element at index %d", i)
		}
		if v.GroupID != values[0].GroupID {
			return nil, fmt.Errorf("CreatePropertyValues: mixed group IDs in batch")
		}
	}

	processed, err := ps.runPreCreatePropertyValues(rctx, values)
	if err != nil {
		return nil, fmt.Errorf("CreatePropertyValues: %w", err)
	}

	created, err := ps.createPropertyValues(processed)
	if err != nil {
		return nil, err
	}
	ps.runPostCreatePropertyValues(rctx, created)
	return created, nil
}

func (ps *PropertyService) GetPropertyValue(rctx request.CTX, groupID, id string) (*model.PropertyValue, error) {
	value, err := ps.getPropertyValue(groupID, id)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValue: %w", err)
	}

	return ps.runPostGetPropertyValue(rctx, value)
}

func (ps *PropertyService) GetPropertyValues(rctx request.CTX, groupID string, ids []string) ([]*model.PropertyValue, error) {
	values, err := ps.getPropertyValues(groupID, ids)
	if err != nil {
		return nil, fmt.Errorf("GetPropertyValues: %w", err)
	}

	return ps.runPostGetPropertyValues(rctx, values)
}

func (ps *PropertyService) SearchPropertyValues(rctx request.CTX, groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	values, err := ps.searchPropertyValues(groupID, opts)
	if err != nil {
		return nil, fmt.Errorf("SearchPropertyValues: %w", err)
	}

	return ps.runPostGetPropertyValues(rctx, values)
}

func (ps *PropertyService) UpdatePropertyValue(rctx request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	processed, err := ps.runPreUpdatePropertyValue(rctx, groupID, value)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValue: %w", err)
	}

	updated, err := ps.updatePropertyValue(groupID, processed)
	if err != nil {
		return nil, err
	}
	ps.runPostUpdatePropertyValue(rctx, updated)
	return updated, nil
}

func (ps *PropertyService) UpdatePropertyValues(rctx request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	// Hooks gate on values[0].GroupID for batch operations, so enforce
	// single-group batches at the public boundary — otherwise a mixed
	// batch could silently bypass per-group hook logic (license,
	// validation, access control).
	for i, v := range values {
		if v == nil {
			return nil, fmt.Errorf("UpdatePropertyValues: nil element at index %d", i)
		}
		if v.GroupID != values[0].GroupID {
			return nil, fmt.Errorf("UpdatePropertyValues: mixed group IDs in batch")
		}
	}

	processed, err := ps.runPreUpdatePropertyValues(rctx, groupID, values)
	if err != nil {
		return nil, fmt.Errorf("UpdatePropertyValues: %w", err)
	}

	updated, err := ps.updatePropertyValues(groupID, processed)
	if err != nil {
		return nil, err
	}
	ps.runPostUpdatePropertyValues(rctx, updated)
	return updated, nil
}

func (ps *PropertyService) UpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return nil, fmt.Errorf("UpsertPropertyValue: value cannot be nil")
	}

	processed, err := ps.runPreUpsertPropertyValue(rctx, value)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValue: %w", err)
	}

	upserted, err := ps.upsertPropertyValue(processed)
	if err != nil {
		return nil, err
	}
	ps.runPostUpsertPropertyValue(rctx, upserted)
	return upserted, nil
}

func (ps *PropertyService) UpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}

	for i, v := range values {
		if v == nil {
			return nil, fmt.Errorf("UpsertPropertyValues: nil element at index %d", i)
		}
		if v.GroupID != values[0].GroupID {
			return nil, fmt.Errorf("UpsertPropertyValues: mixed group IDs in batch")
		}
	}

	processed, err := ps.runPreUpsertPropertyValues(rctx, values)
	if err != nil {
		return nil, fmt.Errorf("UpsertPropertyValues: %w", err)
	}

	upserted, err := ps.upsertPropertyValues(processed)
	if err != nil {
		return nil, err
	}
	ps.runPostUpsertPropertyValues(rctx, upserted)
	return upserted, nil
}

func (ps *PropertyService) DeletePropertyValue(rctx request.CTX, groupID, id string) error {
	// Snapshot before the gates so post-hooks have the target/field metadata
	// the row ID alone does not carry, and so a denied delete is observable.
	// A genuine miss (ErrNotFound) yields a nil snapshot; a real read failure
	// (e.g. replica lag or a transient error) is logged so it does not silently
	// suppress the delete audit with incomplete metadata.
	deleted, snapshotErr := ps.getPropertyValue(groupID, id)
	if snapshotErr != nil && !store.IsErrNotFound(snapshotErr) {
		rctx.Logger().Warn("DeletePropertyValue: failed to snapshot value before delete; audit metadata may be incomplete",
			mlog.String("group_id", groupID),
			mlog.String("value_id", id),
			mlog.Err(snapshotErr),
		)
	}
	if err := ps.runPreDeletePropertyValue(rctx, groupID, id); err != nil {
		return fmt.Errorf("DeletePropertyValue: %w", err)
	}

	if err := ps.deletePropertyValue(groupID, id); err != nil {
		return err
	}
	ps.runPostDeletePropertyValue(rctx, groupID, id, deleted)
	return nil
}

func (ps *PropertyService) DeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if err := ps.runPreDeletePropertyValuesForTarget(rctx, groupID, targetType, targetID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForTarget: %w", err)
	}

	if err := ps.deletePropertyValuesForTarget(groupID, targetType, targetID); err != nil {
		return err
	}
	ps.runPostDeletePropertyValuesForTarget(rctx, groupID, targetType, targetID)
	return nil
}

func (ps *PropertyService) DeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string) error {
	if err := ps.runPreDeletePropertyValuesForField(rctx, groupID, fieldID); err != nil {
		return fmt.Errorf("DeletePropertyValuesForField: %w", err)
	}

	if err := ps.deletePropertyValuesForField(groupID, fieldID); err != nil {
		return err
	}
	ps.runPostDeletePropertyValuesForField(rctx, groupID, fieldID)
	return nil
}
