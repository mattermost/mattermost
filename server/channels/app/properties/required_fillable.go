// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CheckRequiredChannelFieldFillable refuses a save that leaves a system-scoped
// channel field required while channel creators can't set its value: new
// channels would be created without it and Required would do nothing. Required
// is enforced on system-scoped fields only, so no other field is judged.
// existing is the stored field on update, nil on create. A field that was
// already required and unfillable before this save is grandfathered, so it
// stays editable; making a required, fillable field unfillable is refused like
// any other transition.
//
// On update the field is judged on the permissions it will be stored with,
// after this save's legacy-column translation, so an update that only changes
// permission_values is judged by its result. On create it is judged as given,
// so the service runs it once the field's permissions are final. Callers gate
// it on required-attribute enforcement.
func (ps *PropertyService) CheckRequiredChannelFieldFillable(rctx request.CTX, field, existing *model.PropertyField) error {
	// The store never updates ObjectType, so an existing field keeps its own
	// whatever the update claims.
	objectType := field.ObjectType
	if existing != nil {
		objectType = existing.ObjectType
	}
	if objectType != model.PropertyFieldObjectTypeChannel || !isRequiredEnforcedOn(field) {
		return nil
	}
	if existing != nil && isRequiredEnforcedOn(existing) && !model.IsChannelFieldFillableByCreators(existing) {
		return nil
	}

	judged := *field
	judged.ObjectType = objectType
	judged.Permissions = ps.permissionsAfterSave(rctx, field, existing)
	if model.IsChannelFieldFillableByCreators(&judged) {
		return nil
	}

	details := fmt.Sprintf("field %s: cannot be required while channel creators can't set its value", field.ID)
	return model.NewAppError("UpsertPropertyField", "app.property_field.required_unfillable.app_error", nil, details, http.StatusBadRequest)
}

// isRequiredEnforcedOn reports whether field is required where Required is
// enforced: channel creation checks system-scoped fields only.
func isRequiredEnforcedOn(field *model.PropertyField) bool {
	return field.TargetType == string(model.PropertyFieldTargetLevelSystem) && model.IsPropertyFieldRequired(field)
}

// permissionsAfterSave returns the Permissions an update of existing to field
// stores, or field's own on create, where a nil object is converted from the
// legacy columns later and IsChannelFieldFillableByCreators converts it the
// same way.
func (ps *PropertyService) permissionsAfterSave(rctx request.CTX, field, existing *model.PropertyField) *model.Permissions {
	if existing == nil {
		return field.Permissions
	}

	translated := *field
	if err := ps.translateLegacyPermissionKeys(rctx, &translated, existing, map[string]*model.PropertyField{}); err != nil {
		// The update is refused with this same error once it reaches the
		// translation itself; until then, judge what it would otherwise keep.
		translated.Permissions = field.Permissions
	}
	if translated.Permissions != nil {
		return translated.Permissions
	}
	return existing.Permissions
}
