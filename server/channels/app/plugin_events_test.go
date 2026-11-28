// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
)

const (
	eventPublisherID  = "com.mattermost.test-event-publisher"
	eventSubscriberID = "com.mattermost.test-event-subscriber"
	eventOutsiderID   = "com.mattermost.test-event-outsider"

	disabledPublisherID  = "com.mattermost.test-event-disabled-publisher"
	disabledSubscriberID = "com.mattermost.test-event-disabled-subscriber"
)

// eventTestPluginRecorder is shared by the test plugins: they record what they receive and any
// errors in their KV store, so the test can read it back.
const eventTestPluginRecorder = `
func record(api plugin.API, key string, value any) {
	data, _ := json.Marshal(value)
	api.KVSet(key, data)
}

func recordError(api plugin.API, err error) {
	record(api, "activate_error", err.Error())
	record(api, "activate_error_disabled", errors.Is(err, model.ErrEventBusDisabled))
}
`

var eventPublisherCode = `
package main

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}
` + eventTestPluginRecorder + `
func (p *MyPlugin) OnActivate() error {
	if err := p.register(); err != nil {
		recordError(p.API, err)
	}
	return nil
}

func (p *MyPlugin) register() error {
	if err := p.API.RegisterEventGroup(model.EventGroup{Name: "items", Label: "Items"}); err != nil {
		return err
	}
	if err := p.API.RegisterEvent(model.EventDescriptor{
		Name:    "item_created",
		Group:   "items",
		Label:   "Item created",
		Version: 1,
		Fields:  []model.EventField{{Key: "item_id"}},
	}); err != nil {
		return err
	}
	return p.API.RegisterAction(model.ActionDescriptor{
		Type:           "create_item",
		Group:          "items",
		Label:          "Create item",
		Fields:         []model.EventField{{Key: "title"}},
		Results:        []model.EventField{{Key: "item_id"}},
		Emits:          []string{"item_created"},
		AllowedCallers: []string{"SUBSCRIBER_ID"},
	})
}

func (p *MyPlugin) OnActionCall(c *plugin.Context, call *model.ActionCall) (*model.ActionResult, *model.AppError) {
	record(p.API, "action_call", call)
	if call.Fields["title"].Text == "fail" {
		return nil, model.NewAppError("OnActionCall", "test.publisher.create_item.failed", nil, "", http.StatusConflict)
	}
	if err := p.API.EmitEvent("item_created", map[string]model.EventValue{
		"item_id": model.EventTextValue("created-by-action"),
	}, call.Cause, nil); err != nil {
		record(p.API, "emit_error", err.Error())
	}
	return &model.ActionResult{Fields: map[string]model.EventValue{
		"item_id":    model.EventTextValue("created-by-action"),
		"undeclared": model.EventTextValue("dropped"),
	}}, nil
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
`

var eventSubscriberCode = `
package main

import (
	"encoding/json"
	"errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}
` + eventTestPluginRecorder + `
func (p *MyPlugin) OnActivate() error {
	botID, err := p.API.EnsureBotUser(&model.Bot{Username: "event-subscriber", DisplayName: "Event subscriber"})
	if err != nil {
		return err
	}
	record(p.API, "bot_id", botID)

	if err := p.API.SetSubscriptions([]model.EventSubscription{
		{ID: "created", Event: "PUBLISHER_ID/item_created"},
		{ID: "group", Event: "PUBLISHER_ID/items/*"},
	}, model.SubscriptionOptions{}); err != nil {
		recordError(p.API, err)
	}
	return nil
}

func (p *MyPlugin) OnEvent(c *plugin.Context, d *model.EventDelivery) {
	itemID := d.Payload["item_id"].Text
	record(p.API, "delivery_"+itemID, d)
	if itemID != "root" {
		return
	}

	resp, err := p.API.ExecuteAction(&model.ActionRequest{
		PluginID:     "PUBLISHER_ID",
		Action:       "create_item",
		Fields:       map[string]model.EventValue{"title": model.EventTextValue("from subscriber")},
		ActingUserID: "ignored",
	}, d.Cause)
	if err != nil {
		record(p.API, "action_error", err.Error())
		return
	}
	record(p.API, "action_response", resp)
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
`

// setupEventBusPlugins activates the publisher and subscriber test plugins in an environment
// wired to the event bus the way initPlugins wires it.
// Plugin KV data lives in the shared test database, so parallel tests need distinct plugin IDs.
func setupEventBusPlugins(t *testing.T, th *TestHelper, publisherID, subscriberID string) *plugin.Environment {
	t.Helper()
	pluginDir := t.TempDir()

	env, err := plugin.NewEnvironment(th.NewPluginAPI, NewDriverImpl(th.Server), pluginDir, t.TempDir(), th.App.Log(), nil,
		plugin.WithOnActivate(th.App.ch.eventBus.DropPlugin),
		plugin.WithOnDeactivate(th.App.ch.eventBus.DropPlugin),
	)
	require.NoError(t, err)
	th.App.ch.SetPluginsEnvironment(env)

	replacer := strings.NewReplacer("PUBLISHER_ID", publisherID, "SUBSCRIBER_ID", subscriberID)
	for _, p := range []struct{ id, code string }{
		{publisherID, eventPublisherCode},
		{subscriberID, eventSubscriberCode},
	} {
		utils.CompileGo(t, replacer.Replace(p.code), filepath.Join(pluginDir, p.id, "backend.exe"))
		require.NoError(t, os.WriteFile(filepath.Join(pluginDir, p.id, "plugin.json"),
			[]byte(`{"id": "`+p.id+`", "server": {"executable": "backend.exe"}}`), 0600))
		_, _, err := env.Activate(p.id)
		require.NoError(t, err)
	}

	return env
}

func readPluginRecord[T any](t *testing.T, th *TestHelper, pluginID, key string) (T, bool) {
	t.Helper()
	var value T
	data, appErr := th.App.GetPluginKey(pluginID, key)
	require.Nil(t, appErr)
	if data == nil {
		return value, false
	}
	require.NoError(t, json.Unmarshal(data, &value))
	return value, true
}

func waitForPluginRecord[T any](t *testing.T, th *TestHelper, pluginID, key string) T {
	t.Helper()
	var value T
	require.Eventually(t, func() bool {
		var ok bool
		value, ok = readPluginRecord[T](t, th, pluginID, key)
		return ok
	}, 10*time.Second, 20*time.Millisecond, "plugin %s never recorded %s", pluginID, key)
	return value
}

func setupEventBus(t *testing.T, enabled bool) *TestHelper {
	return SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PluginEventBus = enabled
	}).InitBasic(t)
}

func TestPluginEventBus(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupEventBus(t, true)
	env := setupEventBusPlugins(t, th, eventPublisherID, eventSubscriberID)

	publisherAPI := th.NewPluginAPI(&model.Manifest{Id: eventPublisherID})
	subscriberAPI := th.NewPluginAPI(&model.Manifest{Id: eventSubscriberID})
	outsiderAPI := th.NewPluginAPI(&model.Manifest{Id: eventOutsiderID})

	for _, pluginID := range []string{eventPublisherID, eventSubscriberID} {
		activateErr, failed := readPluginRecord[string](t, th, pluginID, "activate_error")
		require.False(t, failed, "plugin %s failed to set up the event bus: %s", pluginID, activateErr)
	}

	t.Run("catalog lists the publisher's contributions", func(t *testing.T) {
		catalog, err := subscriberAPI.ListEventContributions()
		require.NoError(t, err)
		require.Len(t, catalog.Groups, 1)
		assert.Equal(t, model.EventGroup{PublisherID: eventPublisherID, Name: "items", Label: "Items"}, catalog.Groups[0])
		require.Len(t, catalog.Events, 1)
		assert.Equal(t, eventPublisherID, catalog.Events[0].PublisherID)
		assert.Equal(t, "item_created", catalog.Events[0].Name)
		assert.Equal(t, model.EventVisibilityAny, catalog.Events[0].Visibility)
		require.Len(t, catalog.Actions, 1)
		assert.Equal(t, "create_item", catalog.Actions[0].Type)
		assert.Equal(t, []string{eventSubscriberID}, catalog.Actions[0].AllowedCallers)
		assert.Len(t, catalog.Hash, 64)
	})

	t.Run("root emit, delivery, action call and chained emit", func(t *testing.T) {
		cause := model.EventCause("opaque-root-cause")
		require.NoError(t, publisherAPI.EmitEvent("item_created",
			map[string]model.EventValue{"item_id": model.EventTextValue("root")},
			cause, &model.EmitOptions{OriginUserID: th.BasicUser.Id}))

		root := waitForPluginRecord[model.EventDelivery](t, th, eventSubscriberID, "delivery_root")
		assert.Equal(t, root.EnvelopeID+":"+eventSubscriberID, root.ID)
		assert.Equal(t, eventPublisherID+"/item_created", root.Event)
		assert.Equal(t, eventPublisherID, root.PublisherID)
		assert.Equal(t, 1, root.Version)
		assert.Equal(t, []string{"created", "group"}, root.SubscriptionIDs, "overlapping subscriptions produce one delivery")
		assert.Equal(t, th.BasicUser.Id, root.OriginUserID)
		assert.Equal(t, cause, root.Cause)
		assert.NotEmpty(t, root.TraceID)

		botID := waitForPluginRecord[string](t, th, eventSubscriberID, "bot_id")
		call := waitForPluginRecord[model.ActionCall](t, th, eventPublisherID, "action_call")
		assert.Equal(t, "create_item", call.Action)
		assert.Equal(t, eventSubscriberID, call.CallerPluginID)
		assert.Equal(t, botID, call.ActingUserID, "the acting user is the caller's bot, not the requested user")
		assert.Equal(t, cause, call.Cause)
		assert.Equal(t, map[string]model.EventValue{"title": model.EventTextValue("from subscriber")}, call.Fields)

		resp := waitForPluginRecord[model.ActionResponse](t, th, eventSubscriberID, "action_response")
		assert.Equal(t, map[string]model.EventValue{"item_id": model.EventTextValue("created-by-action")}, resp.Fields,
			"undeclared results are dropped")

		chained := waitForPluginRecord[model.EventDelivery](t, th, eventSubscriberID, "delivery_created-by-action")
		assert.NotEqual(t, root.EnvelopeID, chained.EnvelopeID)
		assert.Equal(t, cause, chained.Cause)
		assert.Equal(t, []string{"created", "group"}, chained.SubscriptionIDs)

		_, emitFailed := readPluginRecord[string](t, th, eventPublisherID, "emit_error")
		assert.False(t, emitFailed)
	})

	t.Run("plugins can only emit their own registered events", func(t *testing.T) {
		err := subscriberAPI.EmitEvent("item_created", nil, "", nil)
		require.ErrorIs(t, err, model.ErrEventNotRegistered)

		err = publisherAPI.EmitEvent("item_created", map[string]model.EventValue{"undeclared": model.EventTextValue("x")}, "", nil)
		require.ErrorIs(t, err, model.ErrEventPayloadInvalid)
	})

	t.Run("ExecuteAction enforces AllowedCallers", func(t *testing.T) {
		_, err := outsiderAPI.ExecuteAction(&model.ActionRequest{
			PluginID: eventPublisherID,
			Action:   "create_item",
			Fields:   map[string]model.EventValue{"title": model.EventTextValue("x")},
		}, "")
		require.ErrorIs(t, err, model.ErrActionCallerNotAllowed)
	})

	t.Run("ExecuteAction validates inputs", func(t *testing.T) {
		_, err := subscriberAPI.ExecuteAction(&model.ActionRequest{
			PluginID: eventPublisherID,
			Action:   "create_item",
			Fields:   map[string]model.EventValue{"title": model.EventIntValue(1)},
		}, "")
		require.ErrorIs(t, err, model.ErrActionFieldsInvalid)
	})

	t.Run("an AppError from the target reaches the caller", func(t *testing.T) {
		_, err := subscriberAPI.ExecuteAction(&model.ActionRequest{
			PluginID: eventPublisherID,
			Action:   "create_item",
			Fields:   map[string]model.EventValue{"title": model.EventTextValue("fail")},
		}, "")
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "test.publisher.create_item.failed", appErr.Id)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("SetSubscriptions requires OnEvent", func(t *testing.T) {
		err := publisherAPI.SetSubscriptions([]model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{})
		require.ErrorIs(t, err, model.ErrSubscriberHookMissing)
	})

	t.Run("RegisterAction requires OnActionCall", func(t *testing.T) {
		err := subscriberAPI.RegisterAction(model.ActionDescriptor{Type: "noop", Label: "Noop"})
		require.ErrorIs(t, err, model.ErrActionHookMissing)
	})

	t.Run("deactivating the publisher removes its contributions", func(t *testing.T) {
		before, err := publisherAPI.ListEventContributions()
		require.NoError(t, err)

		require.True(t, env.Deactivate(eventPublisherID))
		catalog, err := publisherAPI.ListEventContributions()
		require.NoError(t, err)
		assert.Empty(t, catalog.Groups)
		assert.Empty(t, catalog.Events)
		assert.Empty(t, catalog.Actions)
		require.ErrorIs(t, publisherAPI.EmitEvent("item_created", nil, "", nil), model.ErrEventNotRegistered)

		_, _, err = env.Activate(eventPublisherID)
		require.NoError(t, err)
		after, err := publisherAPI.ListEventContributions()
		require.NoError(t, err)
		assert.Equal(t, before.Hash, after.Hash)
	})

	t.Run("restarting the publisher re-registers the same contributions", func(t *testing.T) {
		before, err := publisherAPI.ListEventContributions()
		require.NoError(t, err)

		require.NoError(t, env.RestartPlugin(eventPublisherID))
		after, err := publisherAPI.ListEventContributions()
		require.NoError(t, err)
		assert.Equal(t, before.Hash, after.Hash)
		assert.Len(t, after.Events, 1)
	})

	t.Run("deactivating the subscriber removes its subscriptions", func(t *testing.T) {
		require.True(t, env.Deactivate(eventSubscriberID))
		require.NoError(t, publisherAPI.EmitEvent("item_created",
			map[string]model.EventValue{"item_id": model.EventTextValue("while-inactive")}, "", nil))

		_, _, err := env.Activate(eventSubscriberID)
		require.NoError(t, err)
		require.NoError(t, publisherAPI.EmitEvent("item_created",
			map[string]model.EventValue{"item_id": model.EventTextValue("after-reactivation")}, "", nil))

		waitForPluginRecord[model.EventDelivery](t, th, eventSubscriberID, "delivery_after-reactivation")
		_, delivered := readPluginRecord[model.EventDelivery](t, th, eventSubscriberID, "delivery_while-inactive")
		assert.False(t, delivered, "an event emitted while the subscriber was inactive is never delivered")
	})
}

func TestPluginEventBusDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupEventBus(t, false)
	setupEventBusPlugins(t, th, disabledPublisherID, disabledSubscriberID)

	for _, pluginID := range []string{disabledPublisherID, disabledSubscriberID} {
		isDisabled := waitForPluginRecord[bool](t, th, pluginID, "activate_error_disabled")
		assert.True(t, isDisabled, "plugin %s sees ErrEventBusDisabled across RPC", pluginID)
	}

	api := th.NewPluginAPI(&model.Manifest{Id: disabledPublisherID})
	require.ErrorIs(t, api.RegisterEventGroup(model.EventGroup{Name: "items", Label: "Items"}), model.ErrEventBusDisabled)
	require.ErrorIs(t, api.RegisterEvent(model.EventDescriptor{Name: "item_created", Label: "Item created", Version: 1}), model.ErrEventBusDisabled)
	require.ErrorIs(t, api.RegisterAction(model.ActionDescriptor{Type: "create_item", Label: "Create item"}), model.ErrEventBusDisabled)
	require.ErrorIs(t, api.SetSubscriptions(nil, model.SubscriptionOptions{}), model.ErrEventBusDisabled)
	require.ErrorIs(t, api.EmitEvent("item_created", nil, "", nil), model.ErrEventBusDisabled)
	_, err := api.ExecuteAction(&model.ActionRequest{PluginID: disabledPublisherID, Action: "create_item"}, "")
	require.ErrorIs(t, err, model.ErrEventBusDisabled)
	_, err = api.ListEventContributions()
	require.ErrorIs(t, err, model.ErrEventBusDisabled)

	_, called := readPluginRecord[model.ActionCall](t, th, disabledPublisherID, "action_call")
	assert.False(t, called)
}
