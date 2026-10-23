// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// checkBotEventModeAvailable is the single gate for push mode, which is not delivered yet.
func checkBotEventModeAvailable(mode model.BotEventSubscriptionMode) *model.AppError {
	if mode == model.BotEventSubscriptionModePush {
		return model.NewAppError("checkBotEventModeAvailable", "app.bot_event_subscription.push_unavailable.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// botEventSubscriptionError maps a store error to an AppError, falling back to the given
// internal error. The fallback is built by the caller so that its id is extracted for i18n.
func botEventSubscriptionError(where, botUserID string, err error, fallback *model.AppError) *model.AppError {
	var appErr *model.AppError
	var nfErr *store.ErrNotFound
	switch {
	case errors.As(err, &appErr):
		return appErr
	case errors.As(err, &nfErr):
		return model.NewAppError(where, "app.bot_event_subscription.not_found.app_error", map[string]any{"BotUserId": botUserID}, "", http.StatusNotFound).Wrap(err)
	default:
		return fallback.Wrap(err)
	}
}

// CreateOrUpdateBotEventSubscription returns the subscription with its secret only when it was created.
func (a *App) CreateOrUpdateBotEventSubscription(rctx request.CTX, botUserID string, patch *model.BotEventSubscriptionPatch) (*model.BotEventSubscription, bool, *model.AppError) {
	bot, appErr := a.GetBot(rctx, botUserID, true)
	if appErr != nil {
		return nil, false, appErr
	}
	if bot.IsSystemOwned() {
		return nil, false, model.NewAppError("CreateOrUpdateBotEventSubscription", "app.bot_event_subscription.system_owned.app_error", nil, "", http.StatusBadRequest)
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	subs := a.Srv().Store().BotEventSubscription()

	existing, err := subs.Get(masterCtx, botUserID)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return nil, false, botEventSubscriptionError("CreateOrUpdateBotEventSubscription", botUserID, err, model.NewAppError("CreateOrUpdateBotEventSubscription", "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
		}

		created, appErr := a.createBotEventSubscription(masterCtx, botUserID, patch)
		if appErr == nil {
			return created, true, nil
		}

		var conflictErr *store.ErrConflict
		if !errors.As(appErr.Unwrap(), &conflictErr) {
			return nil, false, appErr
		}

		// A concurrent request created it first; treat this one as an update.
		existing, err = subs.Get(masterCtx, botUserID)
		if err != nil {
			return nil, false, botEventSubscriptionError("CreateOrUpdateBotEventSubscription", botUserID, err, model.NewAppError("CreateOrUpdateBotEventSubscription", "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
		}
	}

	existing.Patch(patch)
	if appErr := existing.IsValid(); appErr != nil {
		return nil, false, appErr
	}
	if appErr := checkBotEventModeAvailable(existing.Mode); appErr != nil {
		return nil, false, appErr
	}

	updated, err := subs.Update(masterCtx, existing)
	if err != nil {
		return nil, false, botEventSubscriptionError("CreateOrUpdateBotEventSubscription", botUserID, err, model.NewAppError("CreateOrUpdateBotEventSubscription", "app.bot_event_subscription.update.app_error", nil, "", http.StatusInternalServerError))
	}
	updated.Sanitize()
	return updated, false, nil
}

func (a *App) createBotEventSubscription(rctx request.CTX, botUserID string, patch *model.BotEventSubscriptionPatch) (*model.BotEventSubscription, *model.AppError) {
	if appErr := patch.IsValidForCreate(); appErr != nil {
		return nil, appErr
	}

	sub := &model.BotEventSubscription{
		BotUserId:        botUserID,
		Mode:             *patch.Mode,
		IgnoreBotAuthors: true,
		Enabled:          true,
		Secret:           model.NewRandomString(model.BotEventSecretLength),
	}
	if patch.CallbackURL != nil {
		sub.CallbackURL = *patch.CallbackURL
	}
	if patch.IgnoreBotAuthors != nil {
		sub.IgnoreBotAuthors = *patch.IgnoreBotAuthors
	}

	sub.PreSave()
	if appErr := sub.IsValid(); appErr != nil {
		return nil, appErr
	}
	if appErr := checkBotEventModeAvailable(sub.Mode); appErr != nil {
		return nil, appErr
	}

	saved, err := a.Srv().Store().BotEventSubscription().Save(rctx, sub)
	if err != nil {
		return nil, botEventSubscriptionError("createBotEventSubscription", botUserID, err, model.NewAppError("createBotEventSubscription", "app.bot_event_subscription.save.app_error", nil, "", http.StatusInternalServerError))
	}
	return saved, nil
}

func (a *App) GetBotEventSubscription(rctx request.CTX, botUserID string) (*model.BotEventSubscription, *model.AppError) {
	if _, appErr := a.GetBot(rctx, botUserID, true); appErr != nil {
		return nil, appErr
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	sub, err := a.Srv().Store().BotEventSubscription().Get(masterCtx, botUserID)
	if err != nil {
		return nil, botEventSubscriptionError("GetBotEventSubscription", botUserID, err, model.NewAppError("GetBotEventSubscription", "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}

	backlog, err := a.Srv().Store().BotEvent().CountAfterCursor(rctx, botUserID, sub.AckCursor())
	if err != nil {
		return nil, model.NewAppError("GetBotEventSubscription", "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	sub.Sanitize()
	sub.BacklogSize = &backlog
	return sub, nil
}

func (a *App) DeleteBotEventSubscription(rctx request.CTX, botUserID string) *model.AppError {
	if _, appErr := a.GetBot(rctx, botUserID, true); appErr != nil {
		return appErr
	}

	if err := a.Srv().Store().BotEventSubscription().Delete(rctx, botUserID); err != nil {
		return botEventSubscriptionError("DeleteBotEventSubscription", botUserID, err, model.NewAppError("DeleteBotEventSubscription", "app.bot_event_subscription.delete.app_error", nil, "", http.StatusInternalServerError))
	}
	return nil
}

func (a *App) RegenerateBotEventSubscriptionSecret(rctx request.CTX, botUserID string) (*model.BotEventSubscription, *model.AppError) {
	if _, appErr := a.GetBot(rctx, botUserID, true); appErr != nil {
		return nil, appErr
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	subs := a.Srv().Store().BotEventSubscription()

	sub, err := subs.Get(masterCtx, botUserID)
	if err != nil {
		return nil, botEventSubscriptionError("RegenerateBotEventSubscriptionSecret", botUserID, err, model.NewAppError("RegenerateBotEventSubscriptionSecret", "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}

	sub.Secret = model.NewRandomString(model.BotEventSecretLength)
	sub.UpdateAt = model.GetMillis()
	if err := subs.UpdateSecret(masterCtx, botUserID, sub.Secret, sub.UpdateAt); err != nil {
		return nil, botEventSubscriptionError("RegenerateBotEventSubscriptionSecret", botUserID, err, model.NewAppError("RegenerateBotEventSubscriptionSecret", "app.bot_event_subscription.update.app_error", nil, "", http.StatusInternalServerError))
	}
	return sub, nil
}

func (a *App) EnableBotEventSubscription(rctx request.CTX, botUserID string) (*model.BotEventSubscription, *model.AppError) {
	if _, appErr := a.GetBot(rctx, botUserID, true); appErr != nil {
		return nil, appErr
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	subs := a.Srv().Store().BotEventSubscription()

	if err := subs.SetEnabled(masterCtx, botUserID, true, "", model.GetMillis()); err != nil {
		return nil, botEventSubscriptionError("EnableBotEventSubscription", botUserID, err, model.NewAppError("EnableBotEventSubscription", "app.bot_event_subscription.update.app_error", nil, "", http.StatusInternalServerError))
	}

	sub, err := subs.Get(masterCtx, botUserID)
	if err != nil {
		return nil, botEventSubscriptionError("EnableBotEventSubscription", botUserID, err, model.NewAppError("EnableBotEventSubscription", "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}
	sub.Sanitize()
	return sub, nil
}

// CreateBotWithEventSubscription creates the bot and its subscription, removing the
// bot again if the subscription cannot be created.
func (a *App) CreateBotWithEventSubscription(rctx request.CTX, bot *model.Bot, patch *model.BotEventSubscriptionPatch) (*model.Bot, *model.BotEventSubscription, *model.AppError) {
	if appErr := patch.IsValidForCreate(); appErr != nil {
		return nil, nil, appErr
	}
	if appErr := checkBotEventModeAvailable(*patch.Mode); appErr != nil {
		return nil, nil, appErr
	}

	createdBot, appErr := a.CreateBot(rctx, bot)
	if appErr != nil {
		return nil, nil, appErr
	}

	sub, _, appErr := a.CreateOrUpdateBotEventSubscription(rctx, createdBot.UserId, patch)
	if appErr != nil {
		if deleteErr := a.PermanentDeleteBot(rctx, createdBot.UserId); deleteErr != nil {
			rctx.Logger().Error("Failed to remove bot after its event subscription could not be created", mlog.String("bot_user_id", createdBot.UserId), mlog.Err(deleteErr))
		}
		return nil, nil, appErr
	}

	return createdBot, sub, nil
}
