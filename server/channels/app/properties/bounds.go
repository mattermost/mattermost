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

// PostChannelResolver returns the ID of the channel a post is in, so a parent
// rule on a post field can find the channel whose value it compares against.
// This avoids a circular dependency between the properties and app packages,
// the same way DirectChannelChecker does.
type PostChannelResolver func(rctx request.CTX, postID string) (string, error)

// BoundsHook holds the bounds checks. It is registered for every group and
// decides per call from the group's version, as AccessControlHook does for
// permissions: it acts only on v3 groups, so a group moved to v3 later is
// covered without being listed anywhere.
type BoundsHook struct {
	BasePropertyHook
	propertyService *PropertyService
	enabled         PropertyFieldBoundsProvider
	// A nil resolver refuses every write to a post field that carries a parent
	// rule.
	postChannelResolver PostChannelResolver
	// valueAudit receives a record for each value write a bounds rule or
	// mutability refuses, or would refuse without Enterprise Advanced. Without
	// it nothing is audited.
	valueAudit *PropertyValueAuditHook
}

var _ PropertyHook = (*BoundsHook)(nil)

func NewBoundsHook(ps *PropertyService, enabled PropertyFieldBoundsProvider, postChannelResolver PostChannelResolver, valueAudit *PropertyValueAuditHook) *BoundsHook {
	return &BoundsHook{propertyService: ps, enabled: enabled, postChannelResolver: postChannelResolver, valueAudit: valueAudit}
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

// check runs the field-level checks. existing is nil for a new field.
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
// becomes write_once, judged against changePolicyBaseline. Unless the
// PropertyFieldBounds and PropertyFieldPermissionsV3 flags are both on it is
// refused whatever the license; with them on it is refused unless the server is
// licensed for Enterprise Advanced. Rules and locks already
// on the field ride along, and removing them is always allowed. Unstated bounds
// (nil) and mutability ("") add nothing; the update path fills them in from the
// stored field.
func (h *BoundsHook) validateBoundsChange(field, existing *model.PropertyField) error {
	prevMutability, prevBounds := changePolicyBaseline(existing)

	var adding string
	for _, rule := range field.Bounds {
		if !slices.Contains(prevBounds, rule) {
			adding = fmt.Sprintf("add the bounds rule %s %s", rule.Operator, rule.Reference)
			break
		}
	}
	if adding == "" && field.Mutability == model.PropertyFieldMutabilityWriteOnce && prevMutability != field.Mutability {
		adding = fmt.Sprintf("make the field %s", field.Mutability)
	}
	if adding == "" {
		return nil
	}

	if !h.propertyFieldBoundsEnabled() {
		details := fmt.Sprintf("field %s: cannot %s unless the PropertyFieldBounds and PropertyFieldPermissionsV3 feature flags are both on", field.ID, adding)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_disabled.app_error", nil, details, http.StatusBadRequest)
	}
	if !h.propertyService.boundsEnforced() {
		details := fmt.Sprintf("field %s: cannot %s without an Enterprise Advanced license", field.ID, adding)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_license.app_error", nil, details, http.StatusNotImplemented)
	}
	return nil
}
