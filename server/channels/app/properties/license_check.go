// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

var ErrLicenseRequired = errors.New("license_error: an Enterprise license is required")

// LicenseProvider is a function that returns the current license.
type LicenseProvider func() *model.License

// LicenseCheckHook enforces license requirements for property operations on
// specific groups. Operations on groups without a license requirement pass
// through without checks.
type LicenseCheckHook struct {
	BasePropertyHook
	propertyService *PropertyService
	licenseProvider LicenseProvider
	managedGroupIDs map[string]struct{}
}

var _ PropertyHook = (*LicenseCheckHook)(nil)

// NewLicenseCheckHook creates a hook that requires an Enterprise license for
// all field and value operations on the given property groups.
func NewLicenseCheckHook(ps *PropertyService, licenseProvider LicenseProvider, managedGroupIDs ...string) *LicenseCheckHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &LicenseCheckHook{
		propertyService: ps,
		licenseProvider: licenseProvider,
		managedGroupIDs: ids,
	}
}

func (h *LicenseCheckHook) licensed() bool {
	return model.MinimumEnterpriseLicense(h.licenseProvider())
}

// requireLicense returns ErrLicenseRequired when any of groupIDs is in the
// managed set and no Enterprise license is active. Unmanaged groups and
// licensed calls return nil.
func (h *LicenseCheckHook) requireLicense(groupIDs ...string) error {
	for _, groupID := range groupIDs {
		if _, managed := h.managedGroupIDs[groupID]; managed && !h.licensed() {
			return ErrLicenseRequired
		}
	}
	return nil
}

// requireLicenseForValues judges every value by its own group, so a batch can't
// hide a licensed value behind an unlicensed first one.
func (h *LicenseCheckHook) requireLicenseForValues(values []*model.PropertyValue) error {
	for _, v := range values {
		if err := h.requireLicense(v.GroupID); err != nil {
			return err
		}
	}
	return nil
}

// requireLicenseForField resolves the group of a field named without one.
// A field that can't be found passes: the call fails downstream.
func (h *LicenseCheckHook) requireLicenseForField(rctx request.CTX, fieldID string) error {
	if h.licensed() {
		return nil
	}
	// Master: a replica lag must not let an unlicensed call through.
	fields, err := h.propertyService.getPropertyFields(store.RequestContextWithMaster(rctx), "", []string{fieldID})
	if errors.Is(err, ErrFieldNotFound) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to read field %s to check the license: %w", fieldID, err)
	}
	return h.requireLicense(fields[0].GroupID)
}

// Field pre-hooks

func (h *LicenseCheckHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	return field, h.requireLicense(field.GroupID)
}

func (h *LicenseCheckHook) PreUpdatePropertyField(_ request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	return field, h.requireLicense(groupID)
}

func (h *LicenseCheckHook) PreUpdatePropertyFields(_ request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	return fields, h.requireLicense(groupID)
}

func (h *LicenseCheckHook) PreDeletePropertyField(rctx request.CTX, groupID string, id string) error {
	if groupID == "" {
		return h.requireLicenseForField(rctx, id)
	}
	return h.requireLicense(groupID)
}

func (h *LicenseCheckHook) PreCountPropertyFields(_ request.CTX, groupID string) error {
	return h.requireLicense(groupID)
}

// Field option hooks

func (h *LicenseCheckHook) PreChangePropertyFieldOptions(_ request.CTX, field *model.PropertyField) error {
	return h.requireLicense(field.GroupID)
}

func (h *LicenseCheckHook) PostGetPropertyFieldOptions(_ request.CTX, field *model.PropertyField, _ *model.PropertyFieldOptionPageFilter, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, error) {
	return options, h.requireLicense(field.GroupID)
}

func (h *LicenseCheckHook) PreGetPropertyFieldOptions(_ request.CTX, field *model.PropertyField, filter *model.PropertyFieldOptionPageFilter) (*model.PropertyFieldOptionPageFilter, error) {
	return filter, h.requireLicense(field.GroupID)
}

// Field post-hooks

func (h *LicenseCheckHook) PostGetPropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	return field, h.requireLicense(field.GroupID)
}

func (h *LicenseCheckHook) PostGetPropertyFields(_ request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return fields, nil
	}
	return fields, h.requireLicense(fields[0].GroupID)
}

// Value pre-hooks

func (h *LicenseCheckHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, h.requireLicense(value.GroupID)
}

func (h *LicenseCheckHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, h.requireLicenseForValues(values)
}

// A value update naming no group is judged by the group each value states; one
// stating a group other than its row's is refused later by the validation hook.
func (h *LicenseCheckHook) PreUpdatePropertyValue(_ request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if groupID == "" {
		return value, h.requireLicense(value.GroupID)
	}
	return value, h.requireLicense(groupID)
}

func (h *LicenseCheckHook) PreUpdatePropertyValues(_ request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if groupID == "" {
		return values, h.requireLicenseForValues(values)
	}
	return values, h.requireLicense(groupID)
}

func (h *LicenseCheckHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	return value, h.requireLicense(value.GroupID)
}

func (h *LicenseCheckHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return values, h.requireLicenseForValues(values)
}

func (h *LicenseCheckHook) PreDeletePropertyValue(rctx request.CTX, groupID string, id string) error {
	if groupID != "" || h.licensed() {
		return h.requireLicense(groupID)
	}
	rows, err := h.propertyService.searchPropertyValues(store.RequestContextWithMaster(rctx), "", model.PropertyValueSearchOpts{IDs: []string{id}, PerPage: 1})
	if err != nil {
		return fmt.Errorf("failed to read value %s to check the license: %w", id, err)
	}
	// No row: the delete fails downstream.
	if len(rows) == 0 {
		return nil
	}
	return h.requireLicense(rows[0].GroupID)
}

// A target-wide delete naming no group reaches every group, so it needs the
// license only when the target holds a value in a managed one.
func (h *LicenseCheckHook) PreDeletePropertyValuesForTarget(rctx request.CTX, groupID string, targetType string, targetID string) error {
	if groupID != "" || h.licensed() {
		return h.requireLicense(groupID)
	}
	master := store.RequestContextWithMaster(rctx)
	for g := range h.managedGroupIDs {
		rows, err := h.propertyService.searchPropertyValues(master, g, model.PropertyValueSearchOpts{TargetType: targetType, TargetIDs: []string{targetID}, PerPage: 1})
		if err != nil {
			return fmt.Errorf("failed to read values of %s %s to check the license: %w", targetType, targetID, err)
		}
		if len(rows) > 0 {
			return ErrLicenseRequired
		}
	}
	return nil
}

func (h *LicenseCheckHook) PreDeletePropertyValuesForField(rctx request.CTX, groupID string, fieldID string) error {
	if groupID == "" {
		return h.requireLicenseForField(rctx, fieldID)
	}
	return h.requireLicense(groupID)
}

// Value post-hooks

func (h *LicenseCheckHook) PostGetPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil {
		return value, nil
	}
	return value, h.requireLicense(value.GroupID)
}

func (h *LicenseCheckHook) PostGetPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 {
		return values, nil
	}
	return values, h.requireLicense(values[0].GroupID)
}
