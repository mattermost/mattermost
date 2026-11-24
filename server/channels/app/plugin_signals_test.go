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
	signalPublisherID  = "com.mattermost.test-signal-publisher"
	signalSubscriberID = "com.mattermost.test-signal-subscriber"
	signalOutsiderID   = "com.mattermost.test-signal-outsider"

	disabledPublisherID  = "com.mattermost.test-signal-disabled-publisher"
	disabledSubscriberID = "com.mattermost.test-signal-disabled-subscriber"
)

// signalTestPluginRecorder is shared by the test plugins: they record what they receive and any
// errors in their KV store, so the test can read it back.
const signalTestPluginRecorder = `
func record(api plugin.API, key string, value any) {
	data, _ := json.Marshal(value)
	api.KVSet(key, data)
}

func recordError(api plugin.API, err error) {
	record(api, "activate_error", err.Error())
	record(api, "activate_error_disabled", errors.Is(err, model.ErrSignalBusDisabled))
}
`

var signalPublisherCode = `
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
` + signalTestPluginRecorder + `
func (p *MyPlugin) OnActivate() error {
	if err := p.register(); err != nil {
		recordError(p.API, err)
	}
	return nil
}

func (p *MyPlugin) register() error {
	if err := p.API.RegisterSignalGroup(model.SignalGroup{Name: "items", Label: "Items"}); err != nil {
		return err
	}
	if err := p.API.RegisterSignal(model.SignalDescriptor{
		Name:    "item_created",
		Group:   "items",
		Label:   "Item created",
		Version: 1,
		Fields:  []model.SignalField{{Key: "item_id"}},
	}); err != nil {
		return err
	}
	return p.API.RegisterAction(model.ActionDescriptor{
		Type:           "create_item",
		Group:          "items",
		Label:          "Create item",
		Fields:         []model.SignalField{{Key: "title"}},
		Results:        []model.SignalField{{Key: "item_id"}},
		Emits:          []string{"item_created"},
		AllowedCallers: []string{"SUBSCRIBER_ID"},
	})
}

func (p *MyPlugin) OnActionCall(c *plugin.Context, call *model.ActionCall) (*model.ActionResult, *model.AppError) {
	record(p.API, "action_call", call)
	if call.Fields["title"].Text == "fail" {
		return nil, model.NewAppError("OnActionCall", "test.publisher.create_item.failed", nil, "", http.StatusConflict)
	}
	if err := p.API.EmitSignal("item_created", map[string]model.SignalValue{
		"item_id": model.SignalTextValue("created-by-action"),
	}, call.Cause, nil); err != nil {
		record(p.API, "emit_error", err.Error())
	}
	return &model.ActionResult{Fields: map[string]model.SignalValue{
		"item_id":    model.SignalTextValue("created-by-action"),
		"undeclared": model.SignalTextValue("dropped"),
	}}, nil
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
`

var signalSubscriberCode = `
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
` + signalTestPluginRecorder + `
func (p *MyPlugin) OnActivate() error {
	botID, err := p.API.EnsureBotUser(&model.Bot{Username: "signal-subscriber", DisplayName: "Signal subscriber"})
	if err != nil {
		return err
	}
	record(p.API, "bot_id", botID)

	if err := p.API.SetSubscriptions([]model.SignalSubscription{
		{ID: "created", Signal: "PUBLISHER_ID/item_created"},
		{ID: "group", Signal: "PUBLISHER_ID/items/*"},
	}, model.SubscriptionOptions{}); err != nil {
		recordError(p.API, err)
	}
	return nil
}

func (p *MyPlugin) OnSignal(c *plugin.Context, d *model.SignalDelivery) {
	itemID := d.Payload["item_id"].Text
	record(p.API, "delivery_"+itemID, d)
	if itemID != "root" {
		return
	}

	resp, err := p.API.ExecuteAction(&model.ActionRequest{
		PluginID:     "PUBLISHER_ID",
		Action:       "create_item",
		Fields:       map[string]model.SignalValue{"title": model.SignalTextValue("from subscriber")},
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

// setupSignalBusPlugins activates the publisher and subscriber test plugins in an environment
// wired to the signal bus the way initPlugins wires it.
// Plugin KV data lives in the shared test database, so parallel tests need distinct plugin IDs.
func setupSignalBusPlugins(t *testing.T, th *TestHelper, publisherID, subscriberID string) *plugin.Environment {
	t.Helper()
	pluginDir := t.TempDir()

	env, err := plugin.NewEnvironment(th.NewPluginAPI, NewDriverImpl(th.Server), pluginDir, t.TempDir(), th.App.Log(), nil,
		plugin.WithOnActivate(th.App.ch.signalBus.DropPlugin),
		plugin.WithOnDeactivate(th.App.ch.signalBus.DropPlugin),
	)
	require.NoError(t, err)
	th.App.ch.SetPluginsEnvironment(env)

	replacer := strings.NewReplacer("PUBLISHER_ID", publisherID, "SUBSCRIBER_ID", subscriberID)
	for _, p := range []struct{ id, code string }{
		{publisherID, signalPublisherCode},
		{subscriberID, signalSubscriberCode},
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

func setupSignalBus(t *testing.T, enabled bool) *TestHelper {
	return SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PluginSignalBus = enabled
	}).InitBasic(t)
}

func TestPluginSignalBus(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSignalBus(t, true)
	env := setupSignalBusPlugins(t, th, signalPublisherID, signalSubscriberID)

	publisherAPI := th.NewPluginAPI(&model.Manifest{Id: signalPublisherID})
	subscriberAPI := th.NewPluginAPI(&model.Manifest{Id: signalSubscriberID})
	outsiderAPI := th.NewPluginAPI(&model.Manifest{Id: signalOutsiderID})

	for _, pluginID := range []string{signalPublisherID, signalSubscriberID} {
		activateErr, failed := readPluginRecord[string](t, th, pluginID, "activate_error")
		require.False(t, failed, "plugin %s failed to set up the signal bus: %s", pluginID, activateErr)
	}

	t.Run("catalog lists the publisher's contributions", func(t *testing.T) {
		catalog, err := subscriberAPI.ListSignalContributions()
		require.NoError(t, err)
		require.Len(t, catalog.Groups, 1)
		assert.Equal(t, model.SignalGroup{PublisherID: signalPublisherID, Name: "items", Label: "Items"}, catalog.Groups[0])
		require.Len(t, catalog.Signals, 1)
		assert.Equal(t, signalPublisherID, catalog.Signals[0].PublisherID)
		assert.Equal(t, "item_created", catalog.Signals[0].Name)
		assert.Equal(t, model.SignalVisibilityAny, catalog.Signals[0].Visibility)
		require.Len(t, catalog.Actions, 1)
		assert.Equal(t, "create_item", catalog.Actions[0].Type)
		assert.Equal(t, []string{signalSubscriberID}, catalog.Actions[0].AllowedCallers)
		assert.Len(t, catalog.Hash, 64)
	})

	t.Run("root emit, delivery, action call and chained emit", func(t *testing.T) {
		cause := model.SignalCause("opaque-root-cause")
		require.NoError(t, publisherAPI.EmitSignal("item_created",
			map[string]model.SignalValue{"item_id": model.SignalTextValue("root")},
			cause, &model.EmitOptions{OriginUserID: th.BasicUser.Id}))

		root := waitForPluginRecord[model.SignalDelivery](t, th, signalSubscriberID, "delivery_root")
		assert.Equal(t, root.EnvelopeID+":"+signalSubscriberID, root.ID)
		assert.Equal(t, signalPublisherID+"/item_created", root.Signal)
		assert.Equal(t, signalPublisherID, root.PublisherID)
		assert.Equal(t, 1, root.Version)
		assert.Equal(t, []string{"created", "group"}, root.SubscriptionIDs, "overlapping subscriptions produce one delivery")
		assert.Equal(t, th.BasicUser.Id, root.OriginUserID)
		assert.Equal(t, cause, root.Cause)
		assert.NotEmpty(t, root.TraceID)

		botID := waitForPluginRecord[string](t, th, signalSubscriberID, "bot_id")
		call := waitForPluginRecord[model.ActionCall](t, th, signalPublisherID, "action_call")
		assert.Equal(t, "create_item", call.Action)
		assert.Equal(t, signalSubscriberID, call.CallerPluginID)
		assert.Equal(t, botID, call.ActingUserID, "the acting user is the caller's bot, not the requested user")
		assert.Equal(t, cause, call.Cause)
		assert.Equal(t, map[string]model.SignalValue{"title": model.SignalTextValue("from subscriber")}, call.Fields)

		resp := waitForPluginRecord[model.ActionResponse](t, th, signalSubscriberID, "action_response")
		assert.Equal(t, map[string]model.SignalValue{"item_id": model.SignalTextValue("created-by-action")}, resp.Fields,
			"undeclared results are dropped")

		chained := waitForPluginRecord[model.SignalDelivery](t, th, signalSubscriberID, "delivery_created-by-action")
		assert.NotEqual(t, root.EnvelopeID, chained.EnvelopeID)
		assert.Equal(t, cause, chained.Cause)
		assert.Equal(t, []string{"created", "group"}, chained.SubscriptionIDs)

		_, emitFailed := readPluginRecord[string](t, th, signalPublisherID, "emit_error")
		assert.False(t, emitFailed)
	})

	t.Run("plugins can only emit their own registered signals", func(t *testing.T) {
		err := subscriberAPI.EmitSignal("item_created", nil, "", nil)
		require.ErrorIs(t, err, model.ErrSignalNotRegistered)

		err = publisherAPI.EmitSignal("item_created", map[string]model.SignalValue{"undeclared": model.SignalTextValue("x")}, "", nil)
		require.ErrorIs(t, err, model.ErrSignalPayloadInvalid)
	})

	t.Run("ExecuteAction enforces AllowedCallers", func(t *testing.T) {
		_, err := outsiderAPI.ExecuteAction(&model.ActionRequest{
			PluginID: signalPublisherID,
			Action:   "create_item",
			Fields:   map[string]model.SignalValue{"title": model.SignalTextValue("x")},
		}, "")
		require.ErrorIs(t, err, model.ErrActionCallerNotAllowed)
	})

	t.Run("ExecuteAction validates inputs", func(t *testing.T) {
		_, err := subscriberAPI.ExecuteAction(&model.ActionRequest{
			PluginID: signalPublisherID,
			Action:   "create_item",
			Fields:   map[string]model.SignalValue{"title": model.SignalIntValue(1)},
		}, "")
		require.ErrorIs(t, err, model.ErrActionFieldsInvalid)
	})

	t.Run("an AppError from the target reaches the caller", func(t *testing.T) {
		_, err := subscriberAPI.ExecuteAction(&model.ActionRequest{
			PluginID: signalPublisherID,
			Action:   "create_item",
			Fields:   map[string]model.SignalValue{"title": model.SignalTextValue("fail")},
		}, "")
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "test.publisher.create_item.failed", appErr.Id)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})

	t.Run("SetSubscriptions requires OnSignal", func(t *testing.T) {
		err := publisherAPI.SetSubscriptions([]model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{})
		require.ErrorIs(t, err, model.ErrSubscriberHookMissing)
	})

	t.Run("RegisterAction requires OnActionCall", func(t *testing.T) {
		err := subscriberAPI.RegisterAction(model.ActionDescriptor{Type: "noop", Label: "Noop"})
		require.ErrorIs(t, err, model.ErrActionHookMissing)
	})

	t.Run("deactivating the publisher removes its contributions", func(t *testing.T) {
		before, err := publisherAPI.ListSignalContributions()
		require.NoError(t, err)

		require.True(t, env.Deactivate(signalPublisherID))
		catalog, err := publisherAPI.ListSignalContributions()
		require.NoError(t, err)
		assert.Empty(t, catalog.Groups)
		assert.Empty(t, catalog.Signals)
		assert.Empty(t, catalog.Actions)
		require.ErrorIs(t, publisherAPI.EmitSignal("item_created", nil, "", nil), model.ErrSignalNotRegistered)

		_, _, err = env.Activate(signalPublisherID)
		require.NoError(t, err)
		after, err := publisherAPI.ListSignalContributions()
		require.NoError(t, err)
		assert.Equal(t, before.Hash, after.Hash)
	})

	t.Run("restarting the publisher re-registers the same contributions", func(t *testing.T) {
		before, err := publisherAPI.ListSignalContributions()
		require.NoError(t, err)

		require.NoError(t, env.RestartPlugin(signalPublisherID))
		after, err := publisherAPI.ListSignalContributions()
		require.NoError(t, err)
		assert.Equal(t, before.Hash, after.Hash)
		assert.Len(t, after.Signals, 1)
	})

	t.Run("deactivating the subscriber removes its subscriptions", func(t *testing.T) {
		require.True(t, env.Deactivate(signalSubscriberID))
		require.NoError(t, publisherAPI.EmitSignal("item_created",
			map[string]model.SignalValue{"item_id": model.SignalTextValue("while-inactive")}, "", nil))

		_, _, err := env.Activate(signalSubscriberID)
		require.NoError(t, err)
		require.NoError(t, publisherAPI.EmitSignal("item_created",
			map[string]model.SignalValue{"item_id": model.SignalTextValue("after-reactivation")}, "", nil))

		waitForPluginRecord[model.SignalDelivery](t, th, signalSubscriberID, "delivery_after-reactivation")
		_, delivered := readPluginRecord[model.SignalDelivery](t, th, signalSubscriberID, "delivery_while-inactive")
		assert.False(t, delivered, "a signal emitted while the subscriber was inactive is never delivered")
	})
}

func TestPluginSignalBusDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupSignalBus(t, false)
	setupSignalBusPlugins(t, th, disabledPublisherID, disabledSubscriberID)

	for _, pluginID := range []string{disabledPublisherID, disabledSubscriberID} {
		isDisabled := waitForPluginRecord[bool](t, th, pluginID, "activate_error_disabled")
		assert.True(t, isDisabled, "plugin %s sees ErrSignalBusDisabled across RPC", pluginID)
	}

	api := th.NewPluginAPI(&model.Manifest{Id: disabledPublisherID})
	require.ErrorIs(t, api.RegisterSignalGroup(model.SignalGroup{Name: "items", Label: "Items"}), model.ErrSignalBusDisabled)
	require.ErrorIs(t, api.RegisterSignal(model.SignalDescriptor{Name: "item_created", Label: "Item created", Version: 1}), model.ErrSignalBusDisabled)
	require.ErrorIs(t, api.RegisterAction(model.ActionDescriptor{Type: "create_item", Label: "Create item"}), model.ErrSignalBusDisabled)
	require.ErrorIs(t, api.SetSubscriptions(nil, model.SubscriptionOptions{}), model.ErrSignalBusDisabled)
	require.ErrorIs(t, api.EmitSignal("item_created", nil, "", nil), model.ErrSignalBusDisabled)
	_, err := api.ExecuteAction(&model.ActionRequest{PluginID: disabledPublisherID, Action: "create_item"}, "")
	require.ErrorIs(t, err, model.ErrSignalBusDisabled)
	_, err = api.ListSignalContributions()
	require.ErrorIs(t, err, model.ErrSignalBusDisabled)

	_, called := readPluginRecord[model.ActionCall](t, th, disabledPublisherID, "action_call")
	assert.False(t, called)
}
