// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

type botEventOutcomeKind int

const (
	botEventDelivered botEventOutcomeKind = iota
	botEventRetry
	botEventGone
	botEventAborted
)

type botEventOutcome struct {
	kind       botEventOutcomeKind
	reason     string
	statusCode int
	err        error
}

func newSignedBotEventRequest(ctx context.Context, callbackURL, secret, botUserID, eventID string, body []byte, now time.Time) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, callbackURL, bytes.NewReader(body))
	if err != nil {
		return nil, stripURLError(err)
	}

	ts := now.Unix()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(model.BotEventHeaderEventId, eventID)
	req.Header.Set(model.BotEventHeaderBotId, botUserID)
	req.Header.Set(model.BotEventHeaderTimestamp, strconv.FormatInt(ts, 10))
	req.Header.Set(model.BotEventHeaderSignature, model.SignBotEventPayload(secret, ts, body))
	return req, nil
}

func classifyBotEventStatus(code int) botEventOutcome {
	switch {
	case code >= 200 && code < 300:
		return botEventOutcome{kind: botEventDelivered, statusCode: code}
	case code == http.StatusGone:
		return botEventOutcome{kind: botEventGone, reason: "status", statusCode: code}
	default:
		return botEventOutcome{kind: botEventRetry, reason: "status", statusCode: code}
	}
}

func classifyBotEventError(err error, aborted bool) botEventOutcome {
	var netErr net.Error
	switch {
	case aborted:
		return botEventOutcome{kind: botEventAborted}
	case errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout()):
		return botEventOutcome{kind: botEventRetry, reason: "timeout", err: stripURLError(err)}
	case errors.Is(err, httpservice.ErrAddressForbidden):
		return botEventOutcome{kind: botEventRetry, reason: "address_forbidden", err: stripURLError(err)}
	default:
		return botEventOutcome{kind: botEventRetry, reason: "request_failed", err: stripURLError(err)}
	}
}

// stripURLError drops the URL that net/http embeds in its errors; callback URLs often carry tokens.
func stripURLError(err error) error {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return urlErr.Err
	}
	return err
}

func botEventCallbackHost(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return u.Host
}

func botEventBackoff(schedule []time.Duration, n int) time.Duration {
	return schedule[min(max(n, 1), len(schedule))-1]
}

// deliver sends one signed event. Redirects are never followed, so a 3xx is a failure.
func (d *botEventDispatcher) deliver(sub *model.BotEventSubscription, env *model.BotEventEnvelope) botEventOutcome {
	body, err := json.Marshal(env)
	if err != nil {
		return botEventOutcome{kind: botEventRetry, reason: "request_failed", err: err}
	}

	ctx, cancel := context.WithTimeout(d.ctx, d.requestTimeout())
	defer cancel()

	req, err := newSignedBotEventRequest(ctx, sub.CallbackURL, sub.Secret, sub.BotUserId, env.EventId, body, d.now())
	if err != nil {
		return botEventOutcome{kind: botEventRetry, reason: "request_failed", err: err}
	}

	resp, err := d.client.Do(req)
	if err != nil {
		return classifyBotEventError(err, d.ctx.Err() != nil)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, botEventMaxResponseBytes))

	return classifyBotEventStatus(resp.StatusCode)
}

// recordFailure schedules the retry, or disables the subscription once the receiver has
// failed for BotEventMaxFailureDuration or reported the callback gone.
func (d *botEventDispatcher) recordFailure(rctx request.CTX, sub *model.BotEventSubscription, eventID string, o botEventOutcome) {
	now := d.now()
	n := sub.ConsecutiveFailures + 1
	first := sub.FirstFailureAt
	if first == 0 {
		first = now.UnixMilli()
	}

	reason := ""
	switch {
	case o.kind == botEventGone:
		reason = model.BotEventDisabledReasonCallbackGone
	case now.UnixMilli()-first >= model.BotEventMaxFailureDuration.Milliseconds():
		reason = model.BotEventDisabledReasonDeliveryFailures
	}

	applied, err := d.srv.Store().BotEventSubscription().RecordDeliveryFailure(rctx, sub.BotUserId, d.nodeID, model.BotEventDeliveryFailure{
		ConsecutiveFailures: n,
		FirstFailureAt:      first,
		NextAttemptAt:       now.Add(botEventBackoff(d.backoff, n)).UnixMilli(),
		DisabledReason:      reason,
		UpdateAt:            now.UnixMilli(),
		ExpectedUpdateAt:    sub.UpdateAt,
	})
	if err != nil {
		rctx.Logger().Warn("Failed to record bot event delivery failure", mlog.Err(err))
		return
	}
	if !applied {
		rctx.Logger().Debug("Bot event delivery failure not recorded: the lease is no longer held or the subscription changed")
		return
	}

	fields := []mlog.Field{
		mlog.String("event_id", eventID),
		mlog.String("reason", o.reason),
		mlog.Int("status_code", o.statusCode),
		mlog.Int("consecutive_failures", n),
		mlog.String("callback_host", botEventCallbackHost(sub.CallbackURL)),
	}
	if o.err != nil {
		fields = append(fields, mlog.Err(o.err))
	}
	if reason == "" {
		rctx.Logger().Info("Bot event delivery failed", fields...)
		return
	}
	rctx.Logger().Warn("Bot event delivery disabled", append(fields, mlog.String("disabled_reason", reason))...)
	d.app().notifyBotEventSubscriptionDisabled(rctx, sub, reason)
}

// notifyBotEventSubscriptionDisabled DMs the bot's owner from the system bot. It is
// best-effort and runs once per disable, because only the node whose write applied calls it.
func (a *App) notifyBotEventSubscriptionDisabled(rctx request.CTX, sub *model.BotEventSubscription, reason string) {
	owner, bot, appErr := a.resolveBotOwner(rctx, sub.BotUserId)
	if appErr != nil {
		rctx.Logger().Warn("Failed to resolve the owner of a bot whose event delivery was disabled", mlog.Err(appErr))
		return
	}
	if owner == nil || owner.DeleteAt != 0 || owner.IsBot {
		rctx.Logger().Info("No active user to notify that bot event delivery was disabled")
		return
	}

	systemBot, appErr := a.GetSystemBot(rctx)
	if appErr != nil {
		rctx.Logger().Warn("Failed to get the system bot to notify a bot owner", mlog.Err(appErr))
		return
	}
	channel, appErr := a.GetOrCreateDirectChannel(rctx, owner.Id, systemBot.UserId)
	if appErr != nil {
		rctx.Logger().Warn("Failed to get the direct channel to notify a bot owner", mlog.Err(appErr))
		return
	}

	T := i18n.GetUserTranslations(owner.Locale)
	params := map[string]any{"BotUsername": bot.Username, "CallbackHost": botEventCallbackHost(sub.CallbackURL)}
	message := T("app.bot_event_subscription.disabled_delivery_failures.dm", params)
	if reason == model.BotEventDisabledReasonCallbackGone {
		message = T("app.bot_event_subscription.disabled_callback_gone.dm", params)
	}
	post := &model.Post{ChannelId: channel.Id, UserId: systemBot.UserId, Type: model.PostTypeDefault, Message: message}
	if _, _, appErr := a.CreatePost(rctx, post, channel, model.CreatePostFlags{}); appErr != nil {
		rctx.Logger().Warn("Failed to notify a bot owner that event delivery was disabled", mlog.Err(appErr))
	}
}

// verifyBotEventCallbackURL proves that the receiver controls the URL by echoing a challenge.
// The body is signed, but on create the receiver has not seen the secret yet.
func (a *App) verifyBotEventCallbackURL(rctx request.CTX, botUserID, callbackURL, secret string) *model.AppError {
	const where = "verifyBotEventCallbackURL"

	fail := func(appErr *model.AppError, reason string, err error) *model.AppError {
		fields := []mlog.Field{
			mlog.String("bot_user_id", botUserID),
			mlog.String("callback_host", botEventCallbackHost(callbackURL)),
			mlog.String("reason", reason),
		}
		if err != nil {
			fields = append(fields, mlog.Err(err))
		}
		rctx.Logger().Info("Bot event callback URL verification failed", fields...)
		return appErr.Wrap(err)
	}

	challenge := model.NewRandomString(32)
	body, _ := json.Marshal(model.BotEventURLVerification{Type: model.BotEventTypeURLVerification, Challenge: challenge, BotUserId: botUserID})

	ctx, cancel := context.WithTimeout(a.Srv().Platform().GoContext(), a.Srv().botEventDispatcher.requestTimeout())
	defer cancel()

	requestFailed := model.NewAppError(where, "app.bot_event_subscription.url_verification.request_failed.app_error", nil, "", http.StatusBadRequest)
	req, err := newSignedBotEventRequest(ctx, callbackURL, secret, botUserID, model.NewId(), body, time.Now())
	if err != nil {
		return fail(requestFailed, "request_failed", err)
	}
	resp, err := a.Srv().botEventClient.Do(req)
	if err != nil {
		o := classifyBotEventError(err, false)
		if o.reason == "address_forbidden" {
			return fail(model.NewAppError(where, "app.bot_event_subscription.url_verification.address_forbidden.app_error", nil, "", http.StatusBadRequest), o.reason, o.err)
		}
		return fail(requestFailed, o.reason, o.err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fail(model.NewAppError(where, "app.bot_event_subscription.url_verification.bad_status.app_error", map[string]any{"StatusCode": resp.StatusCode}, "", http.StatusBadRequest), "bad_status", nil)
	}

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, botEventMaxResponseBytes+1))
	var echoed model.BotEventURLVerificationResponse
	if err != nil || len(respBody) > botEventMaxResponseBytes || json.Unmarshal(respBody, &echoed) != nil || echoed.Challenge != challenge {
		return fail(model.NewAppError(where, "app.bot_event_subscription.url_verification.bad_challenge.app_error", nil, "", http.StatusBadRequest), "bad_challenge", stripURLError(err))
	}
	return nil
}
