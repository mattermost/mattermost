// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"encoding/json"
	"errors"
	"maps"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// ExecuteAction validates the request against the target's action descriptor, calls the target's
// OnActionCall hook, and returns only the declared results. An AppError from the target is
// returned unchanged.
func (b *Bus) ExecuteAction(callerID string, req *model.ActionRequest, cause model.SignalCause) (*model.ActionResponse, error) {
	if !b.isEnabled() {
		return nil, model.ErrSignalBusDisabled
	}
	if req == nil || req.PluginID == "" || req.Action == "" {
		return nil, model.ErrActionNotFound.Wrapf("a plugin ID and an action are required")
	}

	action, ok := b.registry.action(req.PluginID, req.Action)
	// A target still in OnActivate is listed but can't be called yet, so it counts as not active.
	if !ok || !b.hooks.IsActive(req.PluginID) || b.hooks.IsStarting(req.PluginID) || !b.hooks.Implements(req.PluginID, plugin.OnActionCallID) {
		return nil, model.ErrActionNotFound.Wrapf("%s/%s", req.PluginID, req.Action)
	}
	if !action.IsCallerAllowed(callerID) {
		return nil, model.ErrActionCallerNotAllowed.Wrapf("%s may not call %s/%s", callerID, req.PluginID, req.Action)
	}

	fields, err := model.ValidateActionInputs(action.Fields, req.Fields)
	if err != nil {
		return nil, model.ErrActionFieldsInvalid.Wrapf("%s/%s: %v", req.PluginID, req.Action, err)
	}

	actingUserID, err := b.resolveActingUser(callerID)
	if err != nil {
		return nil, err
	}

	call := &model.ActionCall{
		Action:         action.Type,
		Fields:         fields,
		CallerPluginID: callerID,
		ActingUserID:   actingUserID,
		Cause:          cause,
		Attributes:     maps.Clone(req.Attributes),
	}
	encoded, err := json.Marshal(call)
	if err != nil {
		return nil, model.ErrActionFieldsInvalid.Wrapf("%v", err)
	}
	if len(encoded) > model.ActionMaxBytes {
		return nil, model.ErrActionFieldsInvalid.Wrapf("encoded request exceeds %d bytes", model.ActionMaxBytes)
	}

	result, err := b.hooks.OnActionCall(req.PluginID, call)
	if err != nil {
		if appErr, ok := errors.AsType[*model.AppError](err); ok {
			return nil, appErr
		}
		return nil, model.ErrActionCallFailed.Wrapf("%s/%s: %v", req.PluginID, req.Action, err)
	}

	var returned map[string]model.SignalValue
	if result != nil {
		returned = result.Fields
	}
	filtered, err := model.FilterActionResults(action.Results, returned)
	if err != nil {
		return nil, model.ErrActionResultInvalid.Wrapf("%s/%s: %v", req.PluginID, req.Action, err)
	}

	return &model.ActionResponse{Fields: filtered}, nil
}

// resolveActingUser returns the caller's bot user, which must exist and be active.
func (b *Bus) resolveActingUser(callerID string) (string, error) {
	botUserID, err := b.hooks.BotUserID(callerID)
	if err != nil {
		return "", model.ErrActingUserRequired.Wrapf("%s: %v", callerID, err)
	}
	if botUserID == "" {
		return "", model.ErrActingUserRequired.Wrapf("%s has no bot", callerID)
	}
	if !b.hooks.UserIsActive(botUserID) {
		return "", model.ErrActingUserInvalid.Wrapf("%s", botUserID)
	}
	return botUserID, nil
}
