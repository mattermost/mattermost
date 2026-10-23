// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// botEventsWriteTimeoutMargin keeps a long-poll's response inside ServiceSettings.WriteTimeout.
const botEventsWriteTimeoutMargin = 5 * time.Second

// GetBotEvents returns the bot's events after its acknowledged cursor. Passing a
// cursor acknowledges everything up to it. rctx must carry the HTTP request's
// context so that a long-poll ends when the client disconnects.
func (a *App) GetBotEvents(rctx request.CTX, botUserID string, opts model.BotEventsOptions) (*model.BotEventList, *model.AppError) {
	const where = "GetBotEvents"

	masterCtx := store.RequestContextWithMaster(rctx)
	sub, err := a.Srv().Store().BotEventSubscription().Get(masterCtx, botUserID)
	if err != nil {
		return nil, botEventSubscriptionError(where, botUserID, err, model.NewAppError(where, "app.bot_event.pull.get.app_error", nil, "", http.StatusInternalServerError))
	}
	if sub.Mode != model.BotEventSubscriptionModePull {
		return nil, model.NewAppError(where, "app.bot_event.pull.wrong_mode.app_error", nil, "", http.StatusConflict)
	}
	if !sub.Enabled {
		return nil, model.NewAppError(where, "app.bot_event.pull.disabled.app_error", nil, "", http.StatusConflict)
	}

	ack := sub.AckCursor()
	if opts.Cursor != nil && ack.Less(*opts.Cursor) {
		if _, err := a.Srv().Store().BotEventSubscription().AdvanceAckCursor(rctx, botUserID, *opts.Cursor, model.GetMillis()); err != nil {
			return nil, model.NewAppError(where, "app.bot_event.pull.ack.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		ack = *opts.Cursor
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = model.BotEventsDefaultLimit
	}
	limit = min(limit, model.BotEventsMaxLimit)

	svc := a.Srv().botEvents
	wait := a.effectiveBotEventsWait(opts.Wait)

	var waiter *botEventWaiter
	if wait > 0 {
		// Register before the first read so a wake-up between read and wait is not lost.
		waiter = svc.register(botUserID)
		defer svc.unregister(waiter)
	}

	events, appErr := a.waitForBotEvents(rctx, botUserID, ack, limit, wait, waiter)
	if appErr != nil {
		return nil, appErr
	}

	list := &model.BotEventList{Events: []*model.BotEventEnvelope{}, NextCursor: ack.Encode()}
	if len(events) == 0 {
		return list, nil
	}

	for _, e := range events {
		envelope, err := e.ToEnvelope()
		if err != nil {
			return nil, model.NewAppError(where, "app.bot_event.pull.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		list.Events = append(list.Events, envelope)
	}
	list.NextCursor = events[len(events)-1].Cursor().Encode()

	return list, nil
}

// waitForBotEvents reads events, and when there are none and a waiter is given, polls until
// some settle, the wait elapses, the request ends, or the server shuts down.
func (a *App) waitForBotEvents(rctx request.CTX, botUserID string, after model.BotEventCursor, limit int, wait time.Duration, waiter *botEventWaiter) ([]*model.BotEvent, *model.AppError) {
	svc := a.Srv().botEvents
	settleMillis := svc.settleWindow.Milliseconds()

	deadline := time.NewTimer(wait)
	defer deadline.Stop()
	recheck := time.NewTimer(svc.recheckInterval)
	defer recheck.Stop()
	settlePending := false

	for {
		events, err := a.Srv().Store().BotEvent().GetAfterCursor(rctx, botUserID, after, settleMillis, limit)
		if err != nil {
			return nil, model.NewAppError("GetBotEvents", "app.bot_event.pull.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(events) > 0 || waiter == nil {
			return events, nil
		}

		select {
		case <-waiter.wake:
			// A new event is not readable until it has settled, so look again then.
			if !settlePending {
				settlePending = true
				recheck.Reset(svc.settleWindow)
			}
		case <-recheck.C:
			settlePending = false
			recheck.Reset(svc.recheckInterval)
		case <-deadline.C:
			return nil, nil
		case <-rctx.Context().Done():
			return nil, nil
		case <-svc.closed:
			return nil, nil
		}
	}
}

// effectiveBotEventsWait caps the requested wait by the global maximum and by the
// server write timeout, which would otherwise swallow the response silently.
func (a *App) effectiveBotEventsWait(requested time.Duration) time.Duration {
	writeTimeout := time.Duration(*a.Config().ServiceSettings.WriteTimeout) * time.Second
	return max(min(requested, model.BotEventsMaxWait, writeTimeout-botEventsWriteTimeoutMargin), 0)
}
