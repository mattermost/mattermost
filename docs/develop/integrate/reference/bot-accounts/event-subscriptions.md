---
title: "Bot event subscriptions"
description: "Receive the direct messages, mentions, thread replies, and reactions a bot account is a recipient of, by push to a callback URL or by pull through the REST API."
sidebar_position: 10
---

An event subscription lets an external system receive the messages and reactions a bot account is a recipient of, without a WebSocket connection. A bot has at most one subscription, in one of two modes:

- **Push:** Mattermost sends each event to a callback URL as a signed HTTP `POST`.
- **Pull:** your system fetches events with the bot's access token.

Event subscriptions require Mattermost server v12.2 or later. The bot must be a member of the channel, like any user. Events caused by the bot itself, burn-on-read posts, and system messages are never delivered. Posts and reactions from other bots are skipped unless `ignore_bot_authors` is `false`; the default avoids two bots answering each other forever.

## Set up

In the UI, go to **Integrations > Bot Accounts**, create or edit a bot, and choose a mode under **Event delivery**. With the API, send `PUT /api/v4/bots/{bot_user_id}/event_subscription`, or include `event_subscription` in `POST /api/v4/bots`. See the [API reference](https://api.mattermost.com/#tag/bots). Creating a bot together with a subscription requires the `manage_bots` permission.

The signing `secret` is returned only when the subscription is created and when it is regenerated with `POST /api/v4/bots/{bot_user_id}/event_subscription/regenerate_secret`. Store it when you receive it.

## Event types and payload

| Type | Delivered when |
|---|---|
| `post_dm` | A post is created in a direct message with the bot. |
| `post_mention` | A post mentions the bot, a group containing it, or `@channel`, `@all`, or `@here`. |
| `post_gm` | A post is created in a group message that includes the bot. |
| `post_thread_reply` | A reply is created in a thread the bot follows. |
| `reaction_added`, `reaction_removed` | A reaction changes on a post by the bot, or in a direct or group message the bot is in. |

A post that qualifies for several types produces one event, with the first type in the order `post_dm`, `post_mention`, `post_gm`, `post_thread_reply`.

```json
{
  "event_id": "9m3o4pe5ytbh3g6d6xs8mfwb9a",
  "type": "post_mention",
  "created_at": 1790000000000,
  "bot_user_id": "k8w3r2uh5fnm3p4sz3q6x7tw1o",
  "team": {"id": "t1", "name": "engineering"},
  "channel": {"id": "c1", "type": "O", "name": "town-square", "display_name": "Town Square"},
  "sender": {"id": "u1", "username": "alice", "is_bot": false},
  "post": {"id": "p1", "root_id": "", "user_id": "u1", "channel_id": "c1", "message": "@helper-bot hello", "create_at": 1790000000000}
}
```

```json
{
  "event_id": "b5f1xq8d7igpjm1a4ckn3wj9ry",
  "type": "reaction_added",
  "created_at": 1790000005000,
  "bot_user_id": "k8w3r2uh5fnm3p4sz3q6x7tw1o",
  "team": null,
  "channel": {"id": "c2", "type": "D", "name": "k8w3r2uh5fnm3p4sz3q6x7tw1o__u1", "display_name": ""},
  "sender": {"id": "u1", "username": "alice", "is_bot": false},
  "post": {"id": "p9", "root_id": "", "user_id": "k8w3r2uh5fnm3p4sz3q6x7tw1o"},
  "reaction": {"emoji_name": "thumbsup", "user_id": "u1", "post_id": "p9", "create_at": 1790000005000}
}
```

`team` is `null` for direct and group messages. Reaction events carry only the ids of the post. Events don't include thread context; use `GET /api/v4/posts/{root_id}/thread` when you need it.

## Guarantees

- Delivery is at least once. Deduplicate by `event_id`.
- Events are ordered per bot.
- An event is delivered no sooner than about one second after it is created.
- Events that aren't delivered or acknowledged are kept for up to 7 days.

## Push

Every request has these headers:

| Header | Value |
|---|---|
| `X-Mattermost-Event-Id` | The event id, the same on every attempt. |
| `X-Mattermost-Bot-Id` | The bot user id. |
| `X-Mattermost-Timestamp` | The send time in unix seconds. |
| `X-Mattermost-Signature` | `v1=` followed by `hex(HMAC-SHA256(secret, "v1:" + timestamp + ":" + body))`. |

Compute the signature over the raw request body, compare in constant time, and reject timestamps more than 5 minutes from your clock. `model.VerifyBotEventSignature` does all three.

When you create a push subscription, or change its mode or URL, Mattermost first posts `{"type": "url_verification", "challenge": "...", "bot_user_id": "..."}` and expects a 2xx response with `{"challenge": "..."}`. On creation your receiver doesn't have the secret yet, so it can't check the signature of this request. Nothing is saved if verification fails.

Respond with a 2xx status within 10 seconds. Redirects aren't followed. Failed requests are retried with a growing delay, from 5 seconds up to once an hour. Delivery is disabled after 24 hours of failures, or immediately after `410 Gone`, and the bot owner gets a direct message. Choose **Enable delivery** in the bot list, or call `POST /api/v4/bots/{bot_user_id}/event_subscription/enable`, to resume from the first event that wasn't acknowledged. Changing the callback URL of a disabled subscription doesn't re-enable it.

## Pull

Call `GET /api/v4/bots/{bot_user_id}/events?cursor=&limit=&wait=` with one of the bot's access tokens. Pass the `next_cursor` of the previous response as `cursor` to acknowledge the events up to it, so advance it only after you've processed them. With `wait` (in seconds, at most 60), the request is held until events arrive. The endpoint returns `409` in push mode, and when delivery is disabled.

## Reference receiver

This push receiver and pull loop are adapted from the examples compiled and tested in [`example_bot_event_test.go`](https://github.com/mattermost/mattermost/blob/master/server/public/model/example_bot_event_test.go).

```go
func newBotEventReceiver(secret string, events chan<- *model.BotEventEnvelope) http.HandlerFunc {
	var mut sync.Mutex
	seen := map[string]bool{}

	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		var verification model.BotEventURLVerification
		if json.Unmarshal(body, &verification) == nil && verification.Type == model.BotEventTypeURLVerification {
			// The secret is not known yet when a subscription is created, so don't check the signature here.
			_ = json.NewEncoder(w).Encode(model.BotEventURLVerificationResponse{Challenge: verification.Challenge})
			return
		}

		err = model.VerifyBotEventSignature(secret, r.Header.Get(model.BotEventHeaderTimestamp), body, r.Header.Get(model.BotEventHeaderSignature), time.Now())
		if err != nil {
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}

		var event model.BotEventEnvelope
		if err := json.Unmarshal(body, &event); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		// Delivery is at least once, so the same event_id can arrive again.
		mut.Lock()
		duplicate := seen[event.EventId]
		seen[event.EventId] = true
		mut.Unlock()

		// A production receiver should hand the event to durable storage and expire old event ids.
		if !duplicate {
			events <- &event
		}
		w.WriteHeader(http.StatusOK)
	}
}
```

```go
func pollBotEvents() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_BOT_TOKEN"))

	botUserID := "bot_user_id"
	cursor := ""
	for {
		list, _, err := client.GetBotEvents(context.Background(), botUserID, cursor, 100, 30)
		if err != nil {
			log.Print(err)
			time.Sleep(5 * time.Second)
			continue
		}

		for _, event := range list.Events {
			// Delivery is at least once, so processing must be idempotent.
			fmt.Printf("Event %s of type %s\n", event.EventId, event.Type)
		}

		// Passing the cursor on the next request acknowledges the events, so advance it only after processing.
		cursor = list.NextCursor
	}
}
```

## Troubleshooting

- The bot list shows the mode, whether delivery is active, why it was disabled, and when an event was last delivered.
- The `mattermost_bot_events_enqueued_total`, `mattermost_bot_events_delivered_total`, and `mattermost_bot_events_delivery_failures_total` metrics are described in [performance monitoring metrics](https://docs.mattermost.com/administration-guide/scale/performance-monitoring-metrics.html#bot-event-metrics).
- Server logs for delivery carry the `bot_user_id` field.
