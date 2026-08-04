// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// A field's options are addressable one at a time, which is what a hierarchy of
// them needs: past a thousand options the field stops serving its option list at
// all, so a change has to name the options it touches.
//
// Every method here takes the field as the caller read it, rather than its ID,
// because that read is needed anyway: to decide whether the caller may change the
// field's options at all, and whether the options it names are the field's own or
// inherited from a template.
//
// A mutation does not trust that copy's UpdateAt. Every option change is written
// under a compare-and-swap, so that a change decided against a set of options
// somebody else has since altered is refused rather than applied -- and the
// property service re-reads the field from the master to anchor it, because this
// one may have come from a replica.

// GetPropertyFieldOptions returns one page of a field's effective option set.
func (a *App) GetPropertyFieldOptions(rctx request.CTX, field *model.PropertyField, cursorCreateAt int64, cursorID string, perPage int) ([]*model.PropertyFieldOption, *model.AppError) {
	options, err := a.Srv().propertyService.GetFieldOptions(field, cursorCreateAt, cursorID, perPage)
	if err != nil {
		if appErr := mapPropertyServiceError("GetPropertyFieldOptions", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("GetPropertyFieldOptions", "app.property_field.options.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return options, nil
}

// CreatePropertyFieldOptions adds options to a field.
func (a *App) CreatePropertyFieldOptions(rctx request.CTX, field *model.PropertyField, options []*model.PropertyFieldOption) ([]*model.PropertyFieldOption, *model.AppError) {
	created, err := a.Srv().propertyService.CreateFieldOptions(field, options)
	if err != nil {
		if appErr := mapPropertyServiceError("CreatePropertyFieldOptions", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("CreatePropertyFieldOptions", "app.property_field.options.create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.invalidatePolicyCachesForOptionChange(rctx, field)
	return created, nil
}

// UpdatePropertyFieldOptions rewrites options a field owns, and reports what
// those options were beforehand so a caller can record what the change replaced.
func (a *App) UpdatePropertyFieldOptions(rctx request.CTX, field *model.PropertyField, options []*model.PropertyFieldOption) (updated, prior []*model.PropertyFieldOption, appErr *model.AppError) {
	updated, prior, err := a.Srv().propertyService.UpdateFieldOptions(field, options)
	if err != nil {
		if mapped := mapPropertyServiceError("UpdatePropertyFieldOptions", err); mapped != nil {
			return nil, nil, mapped
		}
		return nil, nil, model.NewAppError("UpdatePropertyFieldOptions", "app.property_field.options.update.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.invalidatePolicyCachesForOptionChange(rctx, field)
	return updated, prior, nil
}

// DeletePropertyFieldOptions removes options a field owns, and reports them as
// they stood: a parent link is deleted outright, so this is the only chance to
// record that it existed.
func (a *App) DeletePropertyFieldOptions(rctx request.CTX, field *model.PropertyField, optionIDs []string) ([]*model.PropertyFieldOption, *model.AppError) {
	deleted, err := a.Srv().propertyService.DeleteFieldOptions(field, optionIDs)
	if err != nil {
		if appErr := mapPropertyServiceError("DeletePropertyFieldOptions", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("DeletePropertyFieldOptions", "app.property_field.options.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.invalidatePolicyCachesForOptionChange(rctx, field)
	return deleted, nil
}

// invalidatePolicyCachesForOptionChange tells the access control service that a
// field's options have changed, so the per-field metadata it caches and any
// compiled policy resting on it are dropped. Access rules are written against
// option names, so a cache holding options that have been renamed or removed
// would go on deciding from a set of options that no longer exists.
//
// Only the field whose options changed. A field linking to it serves the same
// options and its own compiled policies are cached under its own ID, so those
// are not dropped here -- the websocket republication that tells clients about a
// linked field's derived options is where that belongs, and it is not yet
// written. Until it is, a policy compiled against a linked field keeps a stale
// option set until its own field changes or the node restarts.
func (a *App) invalidatePolicyCachesForOptionChange(rctx request.CTX, field *model.PropertyField) {
	if acs := a.Srv().ch.AccessControl; acs != nil {
		acs.OnPropertyFieldOptionsChanged(rctx, field.ID)
	}
}
