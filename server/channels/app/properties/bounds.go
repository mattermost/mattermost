// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"
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
func (h *BoundsHook) check(rctx request.CTX, field, existing *model.PropertyField) error {
	if err := refuseSetOnCreate(field); err != nil {
		return err
	}
	return h.validateBoundsChange(rctx, field, existing)
}

func (h *BoundsHook) PreCreatePropertyField(rctx request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	v3, err := h.isGroupV3(field.GroupID)
	if err != nil {
		return nil, err
	}
	if !v3 {
		return field, nil
	}
	if err := h.check(rctx, field, nil); err != nil {
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
	if err := h.check(rctx, field, existing); err != nil {
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
		if err := h.check(rctx, field, existingByID[field.ID]); err != nil {
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

// changePolicyWrites is what the change_policy translation in a field write's
// pre-hooks tells the bounds hook: which fields the request saves in the old
// format. Such a write carries the existing change_policy feature over, so the
// flag does not gate the self rules and write_once its translation adds. It is
// plain data on the request context: the translation writes it, the bounds hook
// reads it.
type changePolicyWrites struct {
	oldFormatByField map[string]bool
}

type changePolicyWritesKey struct{}

// withChangePolicyWrites attaches a fresh, empty record to rctx. Every public
// field-write method calls it, even when rctx already carries one, so one save's
// record never leaks into another's.
func withChangePolicyWrites(rctx request.CTX) request.CTX {
	c := &changePolicyWrites{oldFormatByField: make(map[string]bool)}
	return rctx.WithContext(context.WithValue(rctx.Context(), changePolicyWritesKey{}, c))
}

// changePolicyWritesFrom returns the record on rctx, or nil when no write method
// created one; its methods then report every field as not old-format.
func changePolicyWritesFrom(rctx request.CTX) *changePolicyWrites {
	c, _ := rctx.Context().Value(changePolicyWritesKey{}).(*changePolicyWrites)
	return c
}

// record notes whether the save of fieldID is an old-format write. A batch can
// name a field twice; it counts as old-format only if every entry for it is, so
// a rule stated directly in one entry can't ride another entry's exemption.
func (c *changePolicyWrites) record(fieldID string, oldFormat bool) {
	if c == nil {
		return
	}
	if prev, seen := c.oldFormatByField[fieldID]; seen {
		oldFormat = prev && oldFormat
	}
	c.oldFormatByField[fieldID] = oldFormat
}

func (c *changePolicyWrites) oldFormat(fieldID string) bool {
	return c != nil && c.oldFormatByField[fieldID]
}

// validateBoundsChange refuses a new bounds rule, or a mutability that newly
// becomes write_once, judged against changePolicyBaseline. Unless the
// PropertyFieldBounds and PropertyFieldPermissionsV3 flags are both on it is
// refused whatever the license, except what an old-format write's translation
// adds (a self rule or write_once): that carries the existing change_policy
// feature over and needs only the license. A parent rule saved beside
// change_policy is still refused. With the flags on it is refused unless the
// server is licensed for Enterprise Advanced. Rules and locks already on the
// field ride along, and removing them is always allowed. Unstated bounds (nil)
// and mutability ("") add nothing; the update path fills them in from the stored
// field.
func (h *BoundsHook) validateBoundsChange(rctx request.CTX, field, existing *model.PropertyField) error {
	prevMutability, prevBounds := changePolicyBaseline(existing)
	oldFormat := changePolicyWritesFrom(rctx).oldFormat(field.ID)

	// adding is the first thing the write adds, which the license check names;
	// flagGated is the first of those the flag also refuses, so it skips the self
	// rules and write_once that an old-format write's translation adds.
	var adding, flagGated string
	for _, rule := range field.Bounds {
		if slices.Contains(prevBounds, rule) {
			continue
		}
		desc := fmt.Sprintf("add the bounds rule %s %s", rule.Operator, rule.Reference)
		if adding == "" {
			adding = desc
		}
		if flagGated == "" && (!oldFormat || rule.Reference != model.PropertyBoundsReferenceSelf) {
			flagGated = desc
		}
	}
	if field.Mutability == model.PropertyFieldMutabilityWriteOnce && prevMutability != field.Mutability {
		desc := fmt.Sprintf("make the field %s", field.Mutability)
		if adding == "" {
			adding = desc
		}
		if flagGated == "" && !oldFormat {
			flagGated = desc
		}
	}
	if adding == "" {
		return nil
	}

	if flagGated != "" && !h.propertyFieldBoundsEnabled() {
		details := fmt.Sprintf("field %s: cannot %s unless the PropertyFieldBounds and PropertyFieldPermissionsV3 feature flags are both on", field.ID, flagGated)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_disabled.app_error", nil, details, http.StatusBadRequest)
	}
	if !h.propertyService.boundsEnforced() {
		details := fmt.Sprintf("field %s: cannot %s without an Enterprise Advanced license", field.ID, adding)
		return model.NewAppError("UpsertPropertyField", "app.property_field.bounds_license.app_error", nil, details, http.StatusNotImplemented)
	}
	return nil
}
