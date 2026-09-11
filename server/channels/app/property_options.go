// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// A field's options are addressable one at a time, which is what a hierarchy of
// them needs: past a thousand options the field stops serving its option list at
// all, so a change has to name the options it touches.
//
// Every option change is written under a compare-and-swap, anchored on a field
// the property service reads from the master, so a change decided against
// options somebody else has since altered is refused rather than applied.

// GetPropertyFieldOptions returns one page of a field's effective option set.
func (a *App) GetPropertyFieldOptions(rctx request.CTX, groupID, fieldID string, cursorCreateAt int64, cursorID string, perPage int) ([]*model.PropertyFieldOption, *model.AppError) {
	options, err := a.Srv().propertyService.GetFieldOptions(rctx, groupID, fieldID, cursorCreateAt, cursorID, perPage)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyFieldOptions", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyFieldOptions", "app.property_field.options.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return options, nil
}

// CreatePropertyFieldOptions adds options to a field.
func (a *App) CreatePropertyFieldOptions(rctx request.CTX, groupID, fieldID string, options []*model.PropertyFieldOption, connectionID string) ([]*model.PropertyFieldOption, *model.AppError) {
	created, err := a.Srv().propertyService.CreateFieldOptions(rctx, groupID, fieldID, options)
	if err != nil {
		if appErr := mapPropertyServiceError("CreatePropertyFieldOptions", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyFieldOptions", "app.property_field.options.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.propertyFieldOptionsChanged(rctx, groupID, fieldID, connectionID)
	return created, nil
}

// UpdatePropertyFieldOptions rewrites options a field owns, and reports what
// those options were beforehand so a caller can record what the change replaced.
func (a *App) UpdatePropertyFieldOptions(rctx request.CTX, groupID, fieldID string, options []*model.PropertyFieldOption, connectionID string) (updated, prior []*model.PropertyFieldOption, appErr *model.AppError) {
	updated, prior, err := a.Srv().propertyService.UpdateFieldOptions(rctx, groupID, fieldID, options)
	if err != nil {
		if mapped := mapPropertyServiceError("UpdatePropertyFieldOptions", err); mapped != nil {
			return nil, nil, mapped
		}
		return nil, nil, model.NewAppError("UpdatePropertyFieldOptions", "app.property_field.options.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.propertyFieldOptionsChanged(rctx, groupID, fieldID, connectionID)
	return updated, prior, nil
}

// DeletePropertyFieldOptions removes options a field owns, and reports them as
// they stood: a parent link is deleted outright, so this is the only chance to
// record that it existed.
func (a *App) DeletePropertyFieldOptions(rctx request.CTX, groupID, fieldID string, optionIDs []string, connectionID string) ([]*model.PropertyFieldOption, *model.AppError) {
	deleted, err := a.Srv().propertyService.DeleteFieldOptions(rctx, groupID, fieldID, optionIDs)
	if err != nil {
		if appErr := mapPropertyServiceError("DeletePropertyFieldOptions", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("DeletePropertyFieldOptions", "app.property_field.options.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.propertyFieldOptionsChanged(rctx, groupID, fieldID, connectionID)
	return deleted, nil
}

// propertyFieldOptionsChanged announces a change to a field's options: it drops
// the access control caches resting on them and tells connected clients to read
// the field again.
//
// Both go to the field named by the change *and* to every field linking to it. A
// linked field serves the template's options as its own without holding a copy of
// them, so a change to the template changes what the dependent serves while
// leaving the dependent's own row untouched -- nothing about the dependent would
// otherwise say that its option list had moved. Access rules are written against
// option names and compiled per field, so a policy compiled against a dependent
// would go on deciding from options that have been renamed or deleted, and a
// client holding the dependent would go on offering them.
//
// Each field is published separately rather than as a list, because each event is
// a different one: the option list is inlined from that field's own perspective,
// and the broadcast is scoped to that field's own target.
//
// connectionID is the connection that asked for the change, which is excluded from
// the event for the field it named -- it already knows. It is not excluded from the
// dependents' events, which are about fields it did not write.
//
// The invalidation runs before the broadcast, so that a client acting on the event
// cannot read back a cache entry the event was announcing the end of. This is the
// ordering the field write path uses, for the same reason.
func (a *App) propertyFieldOptionsChanged(rctx request.CTX, groupID, fieldID, connectionID string) {
	current, dependents, err := a.Srv().propertyService.FieldWithDependents(rctx, groupID, fieldID)
	if err != nil {
		// Which fields' policies went stale is unknown -- that is exactly what
		// this read failed to produce -- so every compiled policy is dropped
		// rather than just the named field's. A policy names the dependent
		// field it reads the attribute off, not the template, so per-field
		// invalidation for the template would match no policy and leave every
		// stale dependent policy in place. Nothing is published, because the
		// only field state to publish is the one from before the change.
		rctx.Logger().Error(
			"Failed to read the property fields serving changed options; involved fields are unknown and clients were not notified",
			mlog.String("field_id", fieldID),
			mlog.Err(err),
		)
		if acs := a.Srv().ch.AccessControl; acs != nil {
			acs.InvalidateAllPolicyCaches(rctx)
		}
		// Unconditional, unlike the success path below, which can see whether any
		// field involved is one the AttributeView materializes. Here nothing can:
		// a template carries object type "template" and its user-scoped dependents
		// are exactly what could not be read, so testing the field ID the change
		// named would skip the invalidation in the case most likely to need it.
		// The cost of invalidating when nothing was affected is one matview
		// refresh.
		a.invalidateAllUserAttributeCaches()
		return
	}

	a.invalidatePolicyCachesForOptionChange(rctx, current.ID)
	for _, dependent := range dependents {
		a.invalidatePolicyCachesForOptionChange(rctx, dependent.ID)
	}

	// The matview resolves an object's stored option IDs to names through
	// PropertyOptions, so an option write changes what every subject resolves to
	// without touching a single PropertyValues row -- which is what the per-user
	// epoch is computed from, so it cannot see this on its own.
	if current.ObjectType == model.PropertyFieldObjectTypeUser || anyUserObjectType(dependents) {
		a.invalidateAllUserAttributeCaches()
	}

	a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, current, connectionID)
	for _, dependent := range dependents {
		a.publishPropertyFieldEvent(rctx, model.WebsocketEventPropertyFieldUpdated, dependent, "")
	}
}

// invalidatePolicyCachesForOptionChange tells the access control service that a
// field's options have changed, so the per-field metadata it caches and any
// compiled policy resting on it are dropped. Access rules are written against
// option names, so a cache holding options that have been renamed or removed
// would go on deciding from a set of options that no longer exists.
func (a *App) invalidatePolicyCachesForOptionChange(rctx request.CTX, fieldID string) {
	if acs := a.Srv().ch.AccessControl; acs != nil {
		acs.OnPropertyFieldOptionsChanged(rctx, fieldID)
	}
}
