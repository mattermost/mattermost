// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// GetPasskeysForUser returns the user's passkeys, oldest first. It is not gated on the Passkeys
// feature flag or license: the API layer decides who may call it.
func (a *App) GetPasskeysForUser(userID string) ([]*model.Passkey, *model.AppError) {
	passkeys, err := a.Srv().Store().Passkey().GetForUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetPasskeysForUser", "app.passkey.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return passkeys, nil
}

// DeletePasskey removes one of the user's passkeys. A passkey that does not exist and one that
// belongs to someone else give the same 404, so callers learn nothing about other users' passkeys.
func (a *App) DeletePasskey(userID, passkeyID string) *model.AppError {
	if err := a.Srv().Store().Passkey().Delete(userID, passkeyID); err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return model.NewAppError("DeletePasskey", "app.passkey.not_found.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return model.NewAppError("DeletePasskey", "app.passkey.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}
