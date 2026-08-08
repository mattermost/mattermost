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
// swallowed so it never blocks the cleanup. User-owned bot tokens notify the
// bot owner; plugin-owned bot tokens and tokens without an active human
// recipient are skipped.
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
		recipient, bot, appErr := a.resolveAccessTokenNotificationRecipient(rctx, token)
		if appErr != nil {
			rctx.Logger().Warn("Failed to resolve recipient for expired personal access token notification",
				mlog.String("user_id", token.UserId),
				mlog.Err(appErr),
			)
			continue
		}
		if recipient == nil {
			continue
		}

		channel, appErr := a.GetOrCreateDirectChannel(rctx, recipient.Id, systemBot.UserId)
		if appErr != nil {
			rctx.Logger().Warn("Failed to get direct channel for expired personal access token notification",
				mlog.String("user_id", recipient.Id),
				mlog.Err(appErr),
			)
			continue
		}

		T := i18n.GetUserTranslations(recipient.Locale)
		message := T("app.user_access_token.expired_deleted_notification", model.StringInterface{
			"Description": token.Description,
		})
		if bot != nil {
			message = T("app.user_access_token.bot_expired_deleted_notification", model.StringInterface{
				"BotUsername": bot.Username,
				"Description": token.Description,
			})
		}
		post := &model.Post{
			ChannelId: channel.Id,
			Message:   message,
			Type:      model.PostTypeDefault,
			UserId:    systemBot.UserId,
		}

		if _, _, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: true}); appErr != nil {
			rctx.Logger().Warn("Failed to send expired personal access token notification",
				mlog.String("user_id", recipient.Id),
				mlog.Err(appErr),
			)
		}
	}
}
