// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) resolveAccessTokenNotificationRecipient(rctx request.CTX, token *model.UserAccessToken) (*model.User, *model.Bot, *model.AppError) {
	tokenUser, appErr := a.GetUser(token.UserId)
	if appErr != nil {
		return nil, nil, appErr
	}
	if !tokenUser.IsBot {
		if tokenUser.DeleteAt != 0 {
			return nil, nil, nil
		}
		return tokenUser, nil, nil
	}

	bot, appErr := a.GetBot(rctx, token.UserId, true)
	if appErr != nil {
		return nil, nil, appErr
	}
	if bot.Username == model.BotSystemBotUsername {
		return nil, nil, nil
	}

	owner, err := a.Srv().Store().User().Get(rctx.Context(), bot.OwnerId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return nil, nil, nil
		}
		return nil, nil, model.NewAppError("resolveAccessTokenNotificationRecipient", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if owner.DeleteAt != 0 {
		return nil, nil, nil
	}

	return owner, bot, nil
}
