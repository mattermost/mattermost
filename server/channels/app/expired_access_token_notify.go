// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// NotifyExpiredAccessTokensDeleted DMs the owner of each expired personal
// access token that the cleanup_expired_access_tokens job is about to delete.
//
// This is the at-expiry safety net that complements the pre-expiry warning
// cascade (pat_expiry_notify): it fires from the cleanup job at the moment a
// token is removed, so an owner whose fire-and-forget integration silently
// swallowed the rejection error still learns their token stopped working.
//
// It is best-effort. It is invoked before the tokens are deleted so the
// token→owner mapping is still available, and every failure is logged and
// swallowed so it never blocks the cleanup. Bot-owned tokens and tokens owned
// by deactivated users are skipped, matching pat_expiry_notify — GetExpiredBefore
// returns those too because the cleanup job must still delete them.
func (a *App) NotifyExpiredAccessTokensDeleted(rctx request.CTX, tokens []*model.UserAccessToken) {
	if len(tokens) == 0 {
		return
	}

	systemBot, appErr := a.GetSystemBot(rctx)
	if appErr != nil {
		rctx.Logger().Error("Failed to get system bot to notify expired personal access token owners", mlog.Err(appErr))
		return
	}

	for _, token := range tokens {
		user, appErr := a.GetUser(token.UserId)
		if appErr != nil {
			rctx.Logger().Warn("Failed to get user for expired personal access token notification",
				mlog.String("user_id", token.UserId),
				mlog.Err(appErr),
			)
			continue
		}

		// Skip bot accounts and deactivated users, matching pat_expiry_notify.
		if user.IsBot || user.DeleteAt != 0 {
			continue
		}

		channel, appErr := a.GetOrCreateDirectChannel(rctx, token.UserId, systemBot.UserId)
		if appErr != nil {
			rctx.Logger().Warn("Failed to get direct channel for expired personal access token notification",
				mlog.String("user_id", token.UserId),
				mlog.Err(appErr),
			)
			continue
		}

		T := i18n.GetUserTranslations(user.Locale)
		post := &model.Post{
			ChannelId: channel.Id,
			Message: T("app.user_access_token.expired_deleted_notification", model.StringInterface{
				"Description": token.Description,
			}),
			Type:   model.PostTypeDefault,
			UserId: systemBot.UserId,
		}

		if _, _, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true}); appErr != nil {
			rctx.Logger().Warn("Failed to send expired personal access token notification",
				mlog.String("user_id", token.UserId),
				mlog.Err(appErr),
			)
		}
	}
}
