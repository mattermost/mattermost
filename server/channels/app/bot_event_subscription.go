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

// CreateOrUpdateBotEventSubscription returns the subscription with its secret only when it was created
// or when an update switched it to push mode, which generates a new secret.
func (a *App) CreateOrUpdateBotEventSubscription(rctx request.CTX, botUserID string, patch *model.BotEventSubscriptionPatch) (*model.BotEventSubscription, bool, *model.AppError) {
	const where = "CreateOrUpdateBotEventSubscription"

	bot, appErr := a.GetBot(rctx, botUserID, true)
	if appErr != nil {
		return nil, false, appErr
	}
	if bot.IsSystemOwned() {
		return nil, false, model.NewAppError(where, "app.bot_event_subscription.system_owned.app_error", nil, "", http.StatusBadRequest)
	}

	masterCtx := store.RequestContextWithMaster(rctx)
	subs := a.Srv().Store().BotEventSubscription()

	existing, err := subs.Get(masterCtx, botUserID)
	if store.IsErrNotFound(err) {
		if appErr := patch.IsValidForCreate(); appErr != nil {
			return nil, false, appErr
		}
		sub := newBotEventSubscription(botUserID, patch)
		if appErr := a.verifyBotEventSubscription(rctx, sub, botUserID); appErr != nil {
			return nil, false, appErr
		}

		saved, saveErr := subs.Save(masterCtx, sub)
		if saveErr == nil {
			return saved, true, nil
		}
		var conflictErr *store.ErrConflict
		if !errors.As(saveErr, &conflictErr) {
			return nil, false, botEventSubscriptionError(where, botUserID, saveErr, model.NewAppError(where, "app.bot_event_subscription.save.app_error", nil, "", http.StatusInternalServerError))
		}

		// A concurrent request created it first; treat this one as an update.
		existing, err = subs.Get(masterCtx, botUserID)
	}
	if err != nil {
		return nil, false, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}

	prevMode, prevURL := existing.Mode, existing.CallbackURL
	existing.Patch(patch)

	// A subscription that wasn't push has never shown its secret, so switching to push issues a new one.
	issuedSecret := existing.Mode == model.BotEventSubscriptionModePush && prevMode != model.BotEventSubscriptionModePush
	if issuedSecret {
		existing.Secret = model.NewRandomString(model.BotEventSecretLength)
	}
	if existing.Mode != prevMode || existing.CallbackURL != prevURL {
		if appErr := a.verifyBotEventSubscription(rctx, existing, botUserID); appErr != nil {
			return nil, false, appErr
		}
	}

	updateErr := model.NewAppError(where, "app.bot_event_subscription.update.app_error", nil, "", http.StatusInternalServerError)
	if issuedSecret {
		// Stored first: a failed update then only changes the secret of a subscription that didn't use one.
		if err = subs.UpdateSecret(masterCtx, botUserID, existing.Secret, model.GetMillis()); err != nil {
			return nil, false, botEventSubscriptionError(where, botUserID, err, updateErr)
		}
	}
	if _, err = subs.Update(masterCtx, existing); err != nil {
		return nil, false, botEventSubscriptionError(where, botUserID, err, updateErr)
	}

	// Read back so the response shows the counters the update reset.
	updated, err := subs.Get(masterCtx, botUserID)
	if err != nil {
		return nil, false, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}
	if !issuedSecret {
		updated.Sanitize()
	}
	return updated, false, nil
}

// verifyBotEventSubscription validates the subscription and, for push mode, proves that
// the callback URL answers a challenge before anything is stored. The challenge names
// challengeBotID, which is empty while the bot doesn't exist yet.
func (a *App) verifyBotEventSubscription(rctx request.CTX, sub *model.BotEventSubscription, challengeBotID string) *model.AppError {
	sub.PreSave()
	if appErr := sub.IsValid(); appErr != nil {
		return appErr
	}
	if sub.Mode != model.BotEventSubscriptionModePush {
		return nil
	}
	return a.verifyBotEventCallbackURL(rctx, challengeBotID, sub.CallbackURL, sub.Secret)
}

// newBotEventSubscription builds the subscription to store; the store stamps and validates it.
func newBotEventSubscription(botUserID string, patch *model.BotEventSubscriptionPatch) *model.BotEventSubscription {
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
	return sub
}

func (a *App) GetBotEventSubscription(rctx request.CTX, botUserID string) (*model.BotEventSubscription, *model.AppError) {
	const where = "GetBotEventSubscription"

	sub, err := a.Srv().Store().BotEventSubscription().Get(store.RequestContextWithMaster(rctx), botUserID)
	if err != nil {
		return nil, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}

	backlog, err := a.Srv().Store().BotEvent().CountAfterCursor(rctx, botUserID, sub.AckCursor())
	if err != nil {
		return nil, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	sub.Sanitize()
	sub.BacklogSize = &backlog
	return sub, nil
}

func (a *App) DeleteBotEventSubscription(rctx request.CTX, botUserID string) *model.AppError {
	const where = "DeleteBotEventSubscription"

	// The store delete is idempotent, so check existence to report a missing subscription.
	subs := a.Srv().Store().BotEventSubscription()
	if _, err := subs.Get(store.RequestContextWithMaster(rctx), botUserID); err != nil {
		return botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}
	if err := subs.Delete(rctx, botUserID); err != nil {
		return model.NewAppError(where, "app.bot_event_subscription.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) RegenerateBotEventSubscriptionSecret(rctx request.CTX, botUserID string) (*model.BotEventSubscription, *model.AppError) {
	const where = "RegenerateBotEventSubscriptionSecret"

	masterCtx := store.RequestContextWithMaster(rctx)
	subs := a.Srv().Store().BotEventSubscription()

	sub, err := subs.Get(masterCtx, botUserID)
	if err != nil {
		return nil, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}

	sub.Secret = model.NewRandomString(model.BotEventSecretLength)
	sub.UpdateAt = model.GetMillis()
	if err := subs.UpdateSecret(masterCtx, botUserID, sub.Secret, sub.UpdateAt); err != nil {
		return nil, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.update.app_error", nil, "", http.StatusInternalServerError))
	}
	return sub, nil
}

func (a *App) EnableBotEventSubscription(rctx request.CTX, botUserID string) (*model.BotEventSubscription, *model.AppError) {
	const where = "EnableBotEventSubscription"

	masterCtx := store.RequestContextWithMaster(rctx)
	subs := a.Srv().Store().BotEventSubscription()

	if err := subs.SetEnabled(masterCtx, botUserID, true, "", model.GetMillis()); err != nil {
		return nil, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.update.app_error", nil, "", http.StatusInternalServerError))
	}

	sub, err := subs.Get(masterCtx, botUserID)
	if err != nil {
		return nil, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event_subscription.get.app_error", nil, "", http.StatusInternalServerError))
	}
	if sub.Mode == model.BotEventSubscriptionModePush {
		a.notifyBotEventsAvailable([]string{botUserID})
	}
	sub.Sanitize()
	return sub, nil
}

// CreateBotWithEventSubscription validates the subscription and verifies a push callback URL
// before creating the bot, so a rejected request leaves nothing behind. The bot is removed
// again if the subscription cannot be saved afterwards.
func (a *App) CreateBotWithEventSubscription(rctx request.CTX, bot *model.Bot, patch *model.BotEventSubscriptionPatch) (*model.Bot, *model.BotEventSubscription, *model.AppError) {
	const where = "CreateBotWithEventSubscription"

	if appErr := patch.IsValidForCreate(); appErr != nil {
		return nil, nil, appErr
	}

	// The bot's id doesn't exist yet; a placeholder lets the subscription validate.
	sub := newBotEventSubscription(model.NewId(), patch)
	if appErr := a.verifyBotEventSubscription(rctx, sub, ""); appErr != nil {
		return nil, nil, appErr
	}

	createdBot, appErr := a.CreateBot(rctx, bot)
	if appErr != nil {
		return nil, nil, appErr
	}

	sub.BotUserId = createdBot.UserId
	sub, err := a.Srv().Store().BotEventSubscription().Save(rctx, sub)
	if err != nil {
		if deleteErr := a.PermanentDeleteBot(rctx, createdBot.UserId); deleteErr != nil {
			rctx.Logger().Error("Failed to remove bot after its event subscription could not be created", mlog.String("bot_user_id", createdBot.UserId), mlog.Err(deleteErr))
		}
		return nil, nil, botEventSubscriptionError(where, createdBot.UserId, err, model.NewAppError(where, "app.bot_event_subscription.save.app_error", nil, "", http.StatusInternalServerError))
	}

	return createdBot, sub, nil
}
