// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// LicenseProvider is a function that returns the current license.
type LicenseProvider func() *model.License

// LicenseCheckHook enforces license requirements for property operations on
// specific groups. Operations on groups without a license requirement pass
// through without checks.
type LicenseCheckHook struct {
	BasePropertyHook
	licenseProvider LicenseProvider
	managedGroupIDs map[string]struct{}
}

var _ PropertyHook = (*LicenseCheckHook)(nil)

// NewLicenseCheckHook creates a hook that requires an Enterprise license for
// all field and value operations on the given property groups.
func NewLicenseCheckHook(licenseProvider LicenseProvider, managedGroupIDs ...string) *LicenseCheckHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &LicenseCheckHook{
		licenseProvider: licenseProvider,
		managedGroupIDs: ids,
	}
}

func (h *LicenseCheckHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

func (h *LicenseCheckHook) checkLicense() error {
	if !model.MinimumEnterpriseLicense(h.licenseProvider()) {
		return model.NewAppError(
			"LicenseCheckHook",
			"app.property.license_error",
			nil,
			"an Enterprise license is required",
			http.StatusForbidden,
		)
	}
	return nil
}

// Field pre-hooks

func (h *LicenseCheckHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreCreatePropertyField: %w", err)
	}
	return field, nil
}

func (h *LicenseCheckHook) PreUpdatePropertyField(_ request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyField: %w", err)
	}
	return field, nil
}

func (h *LicenseCheckHook) PreUpdatePropertyFields(_ request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return fields, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyFields: %w", err)
	}
	return fields, nil
}

func (h *LicenseCheckHook) PreDeletePropertyField(_ request.CTX, groupID string, _ string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}
	return h.checkLicense()
}

func (h *LicenseCheckHook) PreCountPropertyFields(_ request.CTX, groupID string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}
	return h.checkLicense()
}

// Field post-hooks

func (h *LicenseCheckHook) PostGetPropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if field == nil || !h.isGroupManaged(field.GroupID) {
		return field, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PostGetPropertyField: %w", err)
	}
	return field, nil
}

func (h *LicenseCheckHook) PostGetPropertyFields(_ request.CTX, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 || !h.isGroupManaged(fields[0].GroupID) {
		return fields, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PostGetPropertyFields: %w", err)
	}
	return fields, nil
}

// Value pre-hooks

func (h *LicenseCheckHook) PreCreatePropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if !h.isGroupManaged(value.GroupID) {
		return value, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreCreatePropertyValue: %w", err)
	}
	return value, nil
}

func (h *LicenseCheckHook) PreCreatePropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(values[0].GroupID) {
		return values, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreCreatePropertyValues: %w", err)
	}
	return values, nil
}

func (h *LicenseCheckHook) PreUpdatePropertyValue(_ request.CTX, groupID string, value *model.PropertyValue) (*model.PropertyValue, error) {
	if !h.isGroupManaged(groupID) {
		return value, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyValue: %w", err)
	}
	return value, nil
}

func (h *LicenseCheckHook) PreUpdatePropertyValues(_ request.CTX, groupID string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if !h.isGroupManaged(groupID) {
		return values, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreUpdatePropertyValues: %w", err)
	}
	return values, nil
}

func (h *LicenseCheckHook) PreUpsertPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if !h.isGroupManaged(value.GroupID) {
		return value, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreUpsertPropertyValue: %w", err)
	}
	return value, nil
}

func (h *LicenseCheckHook) PreUpsertPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(values[0].GroupID) {
		return values, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PreUpsertPropertyValues: %w", err)
	}
	return values, nil
}

func (h *LicenseCheckHook) PreDeletePropertyValue(_ request.CTX, groupID string, _ string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}
	return h.checkLicense()
}

func (h *LicenseCheckHook) PreDeletePropertyValuesForTarget(_ request.CTX, groupID string, _ string, _ string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}
	return h.checkLicense()
}

func (h *LicenseCheckHook) PreDeletePropertyValuesForField(_ request.CTX, groupID string, _ string) error {
	if !h.isGroupManaged(groupID) {
		return nil
	}
	return h.checkLicense()
}

// Value post-hooks

func (h *LicenseCheckHook) PostGetPropertyValue(_ request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	if value == nil || !h.isGroupManaged(value.GroupID) {
		return value, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PostGetPropertyValue: %w", err)
	}
	return value, nil
}

func (h *LicenseCheckHook) PostGetPropertyValues(_ request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	if len(values) == 0 || !h.isGroupManaged(values[0].GroupID) {
		return values, nil
	}
	if err := h.checkLicense(); err != nil {
		return nil, fmt.Errorf("PostGetPropertyValues: %w", err)
	}
	return values, nil
}
