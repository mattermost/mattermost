// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"net"
	"net/http"
	"net/rpc"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// signalAPI records the signal bus calls it receives and returns canned results. The embedded
// API is nil, so any other method panics.
type signalAPI struct {
	API

	group        model.SignalGroup
	signal       model.SignalDescriptor
	action       model.ActionDescriptor
	subs         []model.SignalSubscription
	subOpts      model.SubscriptionOptions
	emitName     string
	emitPayload  map[string]model.SignalValue
	emitCause    model.SignalCause
	emitOpts     *model.EmitOptions
	executeReq   *model.ActionRequest
	executeCause model.SignalCause
	executeResp  *model.ActionResponse
	catalog      *model.SignalCatalog
	err          error
	executeErr   error
}

func (a *signalAPI) RegisterSignalGroup(group model.SignalGroup) error {
	a.group = group
	return a.err
}

func (a *signalAPI) RegisterSignal(signal model.SignalDescriptor) error {
	a.signal = signal
	return a.err
}

func (a *signalAPI) RegisterAction(action model.ActionDescriptor) error {
	a.action = action
	return a.err
}

func (a *signalAPI) SetSubscriptions(subs []model.SignalSubscription, opts model.SubscriptionOptions) error {
	a.subs = subs
	a.subOpts = opts
	return a.err
}

func (a *signalAPI) EmitSignal(name string, payload map[string]model.SignalValue, cause model.SignalCause, opts *model.EmitOptions) error {
	a.emitName = name
	a.emitPayload = payload
	a.emitCause = cause
	a.emitOpts = opts
	return a.err
}

func (a *signalAPI) ExecuteAction(req *model.ActionRequest, cause model.SignalCause) (*model.ActionResponse, error) {
	a.executeReq = req
	a.executeCause = cause
	return a.executeResp, a.executeErr
}

func (a *signalAPI) ListSignalContributions() (*model.SignalCatalog, error) {
	return a.catalog, a.err
}

func newSignalAPIClient(t *testing.T, impl *signalAPI) *apiRPCClient {
	t.Helper()
	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &apiRPCServer{impl: impl}))
	go server.ServeConn(serverConnection)
	client := rpc.NewClient(clientConnection)
	t.Cleanup(func() { client.Close() })
	return &apiRPCClient{client: client}
}

func allSignalValues() map[string]model.SignalValue {
	return map[string]model.SignalValue{
		"text":     model.SignalTextValue("hello"),
		"textarea": model.SignalTextareaValue("long\ntext"),
		"yes":      model.SignalBoolValue(true),
		"no":       model.SignalBoolValue(false),
		"int":      model.SignalIntValue(-42),
		"zero":     model.SignalIntValue(0),
		"float":    model.SignalFloatValue(3.25),
	}
}

func TestSignalBusAPIRPCRoundTrip(t *testing.T) {
	t.Run("registration", func(t *testing.T) {
		impl := &signalAPI{}
		client := newSignalAPIClient(t, impl)

		group := model.SignalGroup{Name: "items", Label: "Items", Icon: "icon-items"}
		require.NoError(t, client.RegisterSignalGroup(group))
		assert.Equal(t, group, impl.group)

		signal := model.SignalDescriptor{
			Name:               "item_created",
			Group:              "items",
			Label:              "Item created",
			Description:        "An item was created",
			Version:            2,
			Fields:             []model.SignalField{{Key: "item_id", Label: "Item", Type: model.SignalTypeText, Description: "The item"}},
			Visibility:         model.SignalVisibilityAllowlist,
			AllowedSubscribers: []string{"com.example.subscriber"},
		}
		require.NoError(t, client.RegisterSignal(signal))
		assert.Equal(t, signal, impl.signal)

		action := model.ActionDescriptor{
			Type:           "create_item",
			Group:          "items",
			Label:          "Create item",
			Fields:         []model.SignalField{{Key: "body", Type: model.SignalTypeTextarea}},
			Results:        []model.SignalField{{Key: "item_id"}},
			Emits:          []string{"item_created"},
			AllowedCallers: []string{"com.mattermost.weave"},
			TimeoutSeconds: 60,
		}
		require.NoError(t, client.RegisterAction(action))
		assert.Equal(t, action, impl.action)

		subs := []model.SignalSubscription{
			{ID: "a", Signal: "pub/item_created", Filters: allSignalValues(), IncludeOwn: true},
			{ID: "b", Signal: "*"},
		}
		opts := model.SubscriptionOptions{QueueSize: 10, Workers: 2}
		require.NoError(t, client.SetSubscriptions(subs, opts))
		assert.Equal(t, subs, impl.subs)
		assert.Equal(t, opts, impl.subOpts)
	})

	t.Run("emit", func(t *testing.T) {
		impl := &signalAPI{}
		client := newSignalAPIClient(t, impl)

		require.NoError(t, client.EmitSignal("item_created", allSignalValues(), "cause", &model.EmitOptions{OriginUserID: "user1"}))
		assert.Equal(t, "item_created", impl.emitName)
		assert.Equal(t, allSignalValues(), impl.emitPayload)
		assert.Equal(t, model.SignalCause("cause"), impl.emitCause)
		assert.Equal(t, &model.EmitOptions{OriginUserID: "user1"}, impl.emitOpts)

		require.NoError(t, client.EmitSignal("item_created", nil, "", nil))
		assert.Nil(t, impl.emitOpts)
	})

	t.Run("execute action", func(t *testing.T) {
		impl := &signalAPI{executeResp: &model.ActionResponse{Fields: allSignalValues()}}
		client := newSignalAPIClient(t, impl)

		req := &model.ActionRequest{
			PluginID:     "pub",
			Action:       "create_item",
			Fields:       allSignalValues(),
			ActingUserID: "user1",
			Attributes:   map[string]string{"run_as": "author"},
		}
		resp, err := client.ExecuteAction(req, "delivery-token")
		require.NoError(t, err)
		assert.Equal(t, req, impl.executeReq)
		assert.Equal(t, model.SignalCause("delivery-token"), impl.executeCause)
		assert.Equal(t, impl.executeResp, resp)
	})

	t.Run("catalog", func(t *testing.T) {
		impl := &signalAPI{catalog: &model.SignalCatalog{
			Hash:    "abc",
			Groups:  []model.SignalGroup{{PublisherID: "pub", Name: "items", Label: "Items"}},
			Signals: []model.SignalDescriptor{{PublisherID: "pub", Name: "item_created", Label: "Item created", Version: 1, Fields: []model.SignalField{{Key: "item_id"}}, Visibility: model.SignalVisibilityAny}},
			Actions: []model.ActionDescriptor{{PublisherID: "pub", Type: "create_item", Label: "Create item", Fields: []model.SignalField{}, Results: []model.SignalField{}}},
		}}
		client := newSignalAPIClient(t, impl)

		catalog, err := client.ListSignalContributions()
		require.NoError(t, err)
		assert.Equal(t, impl.catalog.Hash, catalog.Hash)
		assert.Equal(t, impl.catalog.Groups, catalog.Groups)
		assert.Equal(t, impl.catalog.Signals, catalog.Signals)
		require.Len(t, catalog.Actions, 1)
		assert.Equal(t, "create_item", catalog.Actions[0].Type)
	})

	t.Run("signal bus errors keep their identity", func(t *testing.T) {
		impl := &signalAPI{err: model.ErrSignalPayloadInvalid.Wrapf("field %q", "x")}
		client := newSignalAPIClient(t, impl)

		err := client.EmitSignal("item_created", nil, "", nil)
		require.ErrorIs(t, err, model.ErrSignalPayloadInvalid)
		assert.Equal(t, `signal payload is invalid: field "x"`, err.Error())

		require.ErrorIs(t, client.RegisterSignal(model.SignalDescriptor{}), model.ErrSignalPayloadInvalid)

		impl.err = model.ErrSignalBusDisabled
		_, err = client.ListSignalContributions()
		require.ErrorIs(t, err, model.ErrSignalBusDisabled)
	})

	t.Run("an AppError from an action call keeps its ID and status", func(t *testing.T) {
		impl := &signalAPI{executeErr: model.NewAppError("createItem", "plugin.items.duplicate", nil, "", http.StatusConflict)}
		client := newSignalAPIClient(t, impl)

		_, err := client.ExecuteAction(&model.ActionRequest{PluginID: "pub", Action: "create_item"}, "")
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "plugin.items.duplicate", appErr.Id)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})
}

type signalHooks struct {
	delivery *model.SignalDelivery
	call     *model.ActionCall
	result   *model.ActionResult
	appErr   *model.AppError
}

func (h *signalHooks) OnSignal(c *Context, delivery *model.SignalDelivery) {
	h.delivery = delivery
}

func (h *signalHooks) OnActionCall(c *Context, call *model.ActionCall) (*model.ActionResult, *model.AppError) {
	h.call = call
	return h.result, h.appErr
}

func newSignalHooksClient(t *testing.T, impl *signalHooks) *hooksRPCClient {
	t.Helper()
	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &hooksRPCServer{impl: impl}))
	go server.ServeConn(serverConnection)
	client := rpc.NewClient(clientConnection)
	t.Cleanup(func() { client.Close() })
	hooks := &hooksRPCClient{client: client, log: mlog.CreateConsoleTestLogger(t)}
	hooks.implemented[OnSignalID] = true
	hooks.implemented[OnActionCallID] = true
	return hooks
}

func TestSignalBusHooksRPCRoundTrip(t *testing.T) {
	t.Run("OnSignal", func(t *testing.T) {
		impl := &signalHooks{}
		hooks := newSignalHooksClient(t, impl)

		delivery := &model.SignalDelivery{
			ID:              "env1:sub",
			EnvelopeID:      "env1",
			Signal:          "pub/item_created",
			PublisherID:     "pub",
			Version:         1,
			Payload:         allSignalValues(),
			SubscriptionIDs: []string{"a", "b"},
			TraceID:         "trace1",
			Hop:             3,
			OriginUserID:    "user1",
			Cause:           "token",
			EmittedAt:       1234,
		}
		require.NoError(t, hooks.OnSignalWithRPCErr(&Context{}, delivery))
		assert.Equal(t, delivery, impl.delivery)
	})

	t.Run("OnActionCall", func(t *testing.T) {
		impl := &signalHooks{result: &model.ActionResult{Fields: allSignalValues()}}
		hooks := newSignalHooksClient(t, impl)

		call := &model.ActionCall{
			Action:         "create_item",
			Fields:         allSignalValues(),
			CallerPluginID: "caller",
			ActingUserID:   "bot1",
			Cause:          "call-token",
			Attributes:     map[string]string{"k": "v"},
		}
		result, appErr, err := hooks.OnActionCallWithRPCErr(&Context{}, call)
		require.NoError(t, err)
		require.Nil(t, appErr)
		assert.Equal(t, call, impl.call)
		assert.Equal(t, impl.result, result)
	})

	t.Run("OnActionCall AppError", func(t *testing.T) {
		impl := &signalHooks{appErr: model.NewAppError("createItem", "plugin.items.invalid", nil, "details", http.StatusBadRequest)}
		hooks := newSignalHooksClient(t, impl)

		result, appErr, err := hooks.OnActionCallWithRPCErr(&Context{}, &model.ActionCall{Action: "create_item"})
		require.NoError(t, err)
		assert.Nil(t, result)
		require.NotNil(t, appErr)
		assert.Equal(t, "plugin.items.invalid", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}
