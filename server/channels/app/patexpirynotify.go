// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	// patExpiryNotifyHorizonDays is the look-ahead window for the pre-expiry
	// warning. It matches the largest warning bucket, so a token is fetched as
	// soon as it enters the cascade.
	patExpiryNotifyHorizonDays = 7

	// patExpiryNotifyBatchLimit bounds the number of tokens processed per run.
	patExpiryNotifyBatchLimit = 1000
)

// patExpiryThresholds is the pre-expiry warning cascade, in days, ordered from
// most to least urgent. A token owner is warned once as the token crosses into
// each bucket.
var patExpiryThresholds = []int{1, 3, 7}

// NotifyPersonalAccessTokensExpiring warns the owners of personal access tokens
// that are approaching expiry, on a fixed 7 / 3 / 1 day cascade. It is invoked
// hourly by the pat_expiry_notify job.
//
// Bot tokens and tokens owned by deactivated users are excluded by the store
// query. For each remaining token this computes the current warning bucket,
// sends a single system-bot DM, and advances the per-token LastNotifiedThreshold
// marker so the same (or a less urgent) warning is never re-sent. Because only
// the most urgent applicable bucket is ever sent, a token that first becomes
// visible already inside the window (e.g. created with a short lifetime, or owned
// by a just-reactivated user) gets a single warning rather than a catch-up burst
// of every threshold it has already passed.
func (a *App) NotifyPersonalAccessTokensExpiring() error {
	if !*a.Config().ServiceSettings.EnableUserAccessTokens {
		return nil
	}

	rctx := request.EmptyContext(a.Log().With(mlog.String("component", "pat_expiry_notify")))

	now := model.GetMillis()
	horizon := int64(patExpiryNotifyHorizonDays) * model.DayInMilliseconds

	tokens, err := a.Srv().Store().UserAccessToken().GetExpiringTokens(now, horizon, patExpiryNotifyBatchLimit)
	if err != nil {
		return model.NewAppError("NotifyPersonalAccessTokensExpiring", "app.user_access_token.get_expiring.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(tokens) == 0 {
		return nil
	}

	systemBot, appErr := a.GetSystemBot(rctx)
	if appErr != nil {
		return appErr
	}

	for _, token := range tokens {
		bucket := patExpiryBucket(token.ExpiresAt, now)
		if bucket == 0 {
			// Already expired or outside the cascade; the store window should
			// prevent this, but guard against clock skew between runs.
			continue
		}

		// Skip if the owner has already been warned at this bucket or a more
		// urgent (smaller) one. nil means no warning has been sent yet.
		if token.LastNotifiedThreshold != nil && *token.LastNotifiedThreshold <= bucket {
			continue
		}

		if appErr := a.sendPATExpiryNotification(rctx, systemBot, token, bucket); appErr != nil {
			rctx.Logger().Error("Failed to send personal access token expiry notification",
				mlog.String("token_id", token.Id),
				mlog.String("user_id", token.UserId),
				mlog.Err(appErr),
			)
			continue
		}

		if err := a.Srv().Store().UserAccessToken().UpdateLastNotifiedThreshold(token.Id, bucket); err != nil {
			rctx.Logger().Error("Failed to update LastNotifiedThreshold for personal access token",
				mlog.String("token_id", token.Id),
				mlog.Err(err),
			)
		}
	}

	return nil
}

// patExpiryBucket returns the most urgent warning threshold (in days) that the
// token currently qualifies for, or 0 if it is already expired or further out
// than the largest threshold. A token with N days remaining maps to the smallest
// threshold T such that N <= T (e.g. 2 days remaining -> the 3-day bucket).
func patExpiryBucket(expiresAt int64, now int64) int {
	remaining := expiresAt - now
	if remaining <= 0 {
		return 0
	}
	for _, threshold := range patExpiryThresholds {
		if remaining <= int64(threshold)*model.DayInMilliseconds {
			return threshold
		}
	}
	return 0
}

func (a *App) sendPATExpiryNotification(rctx request.CTX, systemBot *model.Bot, token *model.UserAccessToken, bucket int) *model.AppError {
	channel, appErr := a.GetOrCreateDirectChannel(rctx, token.UserId, systemBot.UserId)
	if appErr != nil {
		return appErr
	}

	user, appErr := a.GetUser(token.UserId)
	if appErr != nil {
		return appErr
	}

	T := i18n.GetUserTranslations(user.Locale)

	description := token.Description
	if description == "" {
		description = T("app.pat_expiry_notify.unnamed_token")
	}

	message := T("app.pat_expiry_notify.dm", map[string]any{
		"Description": description,
		"Days":        bucket,
	})

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		Type:      model.PostTypeDefault,
		UserId:    systemBot.UserId,
	}

	if _, _, err := a.CreatePost(rctx, post, channel, model.CreatePostFlags{SetOnline: false}); err != nil {
		return err
	}

	return nil
}
