// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// PropertyFieldBoundsProvider reports whether both the PropertyFieldBounds and
// PropertyFieldPermissionsV3 flags are on, which lets a field gain a bounds rule
// or a write_once lock. With permissions v3 off the REST API serves the group as
// v2 and hides bounds, so a rule added then could not be seen or removed by an
// admin. Backed by a closure over live config, like
// RequiredAttributeEnforcementProvider.
type PropertyFieldBoundsProvider func() bool

// BoundsHook holds the bounds checks. It is registered for every group and
// decides per call from the group's version, as AccessControlHook does for
// permissions: it acts only on v3 groups, so a group moved to v3 later is
// covered without being listed anywhere.
type BoundsHook struct {
	BasePropertyHook
	propertyService *PropertyService
	enabled         PropertyFieldBoundsProvider
}

var _ PropertyHook = (*BoundsHook)(nil)

func NewBoundsHook(ps *PropertyService, enabled PropertyFieldBoundsProvider) *BoundsHook {
	return &BoundsHook{propertyService: ps, enabled: enabled}
}

// isGroupV3 reports whether groupID names a v3 group. A group ID that fails to
// resolve is an error, not "not v3": it must not fail open.
func (h *BoundsHook) isGroupV3(groupID string) (bool, error) {
	group, err := h.propertyService.GroupByID(groupID)
	if err != nil {
		return false, err
	}
	return group.IsPSAv3(), nil
}

// check runs the field-level checks. existing is nil for a new field (or an
// update naming a field the group doesn't hold).
func (h *BoundsHook) check(field, existing *model.PropertyField) error {
	if err := refuseSetOnCreate(field); err != nil {
		return err
	}
	return h.validateBoundsChange(field, existing)
}

func (h *BoundsHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	v3, err := h.isGroupV3(field.GroupID)
	if err != nil {
		return nil, err
	}
	if !v3 {
		return field, nil
	}
	if err := h.check(field, nil); err != nil {
		return nil, err
	}
	return field, nil
}

func (h *BoundsHook) PreUpdatePropertyField(rctx request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	v3, err := h.isGroupV3(groupID)
	if err != nil {
		return nil, err
	}
	if !v3 {
		return field, nil
	}
	existing, err := h.propertyService.getPropertyField(rctx, groupID, field.ID)
	if err != nil {
		return nil, err
	}
	if err := h.check(field, existing); err != nil {
		return nil, err
	}
	return field, nil
}

func (h *BoundsHook) PreUpdatePropertyFields(rctx request.CTX, groupID string, fields []*model.PropertyField) ([]*model.PropertyField, error) {
	if len(fields) == 0 {
		return fields, nil
	}
	v3, err := h.isGroupV3(groupID)
	if err != nil {
		return nil, err
	}
	if !v3 {
		return fields, nil
	}

	fieldIDs := make([]string, len(fields))
	for i, f := range fields {
		fieldIDs[i] = f.ID
	}
	existingFields, err := h.propertyService.getPropertyFields(rctx, groupID, fieldIDs)
	if err != nil {
		return nil, err
	}
	existingByID := make(map[string]*model.PropertyField, len(existingFields))
	for _, ex := range existingFields {
		existingByID[ex.ID] = ex
	}

	for _, field := range fields {
		if err := h.check(field, existingByID[field.ID]); err != nil {
			return nil, fmt.Errorf("field %s: %w", field.ID, err)
		}
	}
	return fields, nil
}

// propertyFieldBoundsEnabled reports whether adding rules and locks is allowed.
// A nil provider means off, unlike openIDAttributeSyncEnabled: this flag defaults
// off and gates new protections, so a hook built without a provider must not
// quietly let rules in.
func (h *BoundsHook) propertyFieldBoundsEnabled() bool {
	return h.enabled != nil && h.enabled()
}

// refuseSetOnCreate refuses a field whose mutability is set_on_create, flag on or
// off: that lock allows a write only from the request that creates the object, and
// no write path checks that, so a field must not carry a lock that isn't enforced.
// TODO: remove once writes enforce set_on_create.
func refuseSetOnCreate(field *model.PropertyField) error {
	if field.Mutability != model.PropertyFieldMutabilitySetOnCreate {
		return nil
	}
	details := fmt.Sprintf("field %s: set_on_create mutability is not supported yet", field.ID)
	return model.NewAppError("UpsertPropertyField", "app.property_field.set_on_create_unsupported.app_error", nil, details, http.StatusBadRequest)
}

// validateBoundsChange refuses a new bounds rule, or a mutability that newly
// becomes write_once, unless the PropertyFieldBounds and PropertyFieldPermissionsV3
// flags are both on. Rules and locks already on the field ride along, and
// removing them is always allowed. Unstated bounds (nil) and mutability ("") add
// nothing; the update path fills them in from the stored field.
func (h *BoundsHook) validateBoundsChange(field, existing *model.PropertyField) error {
	if h.propertyFieldBoundsEnabled() {
		return nil
	}

	var prevBounds model.PropertyBounds
	prevMutability := model.PropertyFieldMutabilityMutable
	if existing != nil {
		prevBounds = existing.Bounds
		prevMutability = existing.Mutability.OrMutable()
	}

	for _, rule := range field.Bounds {
		if !slices.Contains(prevBounds, rule) {
			details := fmt.Sprintf("field %s: cannot add the bounds rule %s %s unless the PropertyFieldBounds and PropertyFieldPermissionsV3 feature flags are both on", field.ID, rule.Operator, rule.Reference)
			return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_disabled.app_error", nil, details, http.StatusBadRequest)
		}
	}
	if field.Mutability == model.PropertyFieldMutabilityWriteOnce && prevMutability != field.Mutability {
		details := fmt.Sprintf("field %s: cannot make the field %s unless the PropertyFieldBounds and PropertyFieldPermissionsV3 feature flags are both on", field.ID, field.Mutability)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_disabled.app_error", nil, details, http.StatusBadRequest)
	}
	return nil
}
