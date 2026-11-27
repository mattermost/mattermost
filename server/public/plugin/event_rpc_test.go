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

// eventAPI records the event bus calls it receives and returns canned results. The embedded
// API is nil, so any other method panics.
type eventAPI struct {
	API

	group        model.EventGroup
	event        model.EventDescriptor
	action       model.ActionDescriptor
	subs         []model.EventSubscription
	subOpts      model.SubscriptionOptions
	emitName     string
	emitPayload  map[string]model.EventValue
	emitCause    model.EventCause
	emitOpts     *model.EmitOptions
	executeReq   *model.ActionRequest
	executeCause model.EventCause
	executeResp  *model.ActionResponse
	catalog      *model.EventCatalog
	err          error
	executeErr   error
}

func (a *eventAPI) RegisterEventGroup(group model.EventGroup) error {
	a.group = group
	return a.err
}

func (a *eventAPI) RegisterEvent(event model.EventDescriptor) error {
	a.event = event
	return a.err
}

func (a *eventAPI) RegisterAction(action model.ActionDescriptor) error {
	a.action = action
	return a.err
}

func (a *eventAPI) SetSubscriptions(subs []model.EventSubscription, opts model.SubscriptionOptions) error {
	a.subs = subs
	a.subOpts = opts
	return a.err
}

func (a *eventAPI) EmitEvent(name string, payload map[string]model.EventValue, cause model.EventCause, opts *model.EmitOptions) error {
	a.emitName = name
	a.emitPayload = payload
	a.emitCause = cause
	a.emitOpts = opts
	return a.err
}

func (a *eventAPI) ExecuteAction(req *model.ActionRequest, cause model.EventCause) (*model.ActionResponse, error) {
	a.executeReq = req
	a.executeCause = cause
	return a.executeResp, a.executeErr
}

func (a *eventAPI) ListEventContributions() (*model.EventCatalog, error) {
	return a.catalog, a.err
}

func newEventAPIClient(t *testing.T, impl *eventAPI) *apiRPCClient {
	t.Helper()
	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &apiRPCServer{impl: impl}))
	go server.ServeConn(serverConnection)
	client := rpc.NewClient(clientConnection)
	t.Cleanup(func() { client.Close() })
	return &apiRPCClient{client: client}
}

func allEventValues() map[string]model.EventValue {
	return map[string]model.EventValue{
		"text":     model.EventTextValue("hello"),
		"textarea": model.EventTextareaValue("long\ntext"),
		"yes":      model.EventBoolValue(true),
		"no":       model.EventBoolValue(false),
		"int":      model.EventIntValue(-42),
		"zero":     model.EventIntValue(0),
		"float":    model.EventFloatValue(3.25),
	}
}

func TestEventBusAPIRPCRoundTrip(t *testing.T) {
	t.Run("registration", func(t *testing.T) {
		impl := &eventAPI{}
		client := newEventAPIClient(t, impl)

		group := model.EventGroup{Name: "items", Label: "Items", Icon: "icon-items"}
		require.NoError(t, client.RegisterEventGroup(group))
		assert.Equal(t, group, impl.group)

		event := model.EventDescriptor{
			Name:               "item_created",
			Group:              "items",
			Label:              "Item created",
			Description:        "An item was created",
			Version:            2,
			Fields:             []model.EventField{{Key: "item_id", Label: "Item", Type: model.EventTypeText, Description: "The item"}},
			Visibility:         model.EventVisibilityAllowlist,
			AllowedSubscribers: []string{"com.example.subscriber"},
		}
		require.NoError(t, client.RegisterEvent(event))
		assert.Equal(t, event, impl.event)

		action := model.ActionDescriptor{
			Type:           "create_item",
			Group:          "items",
			Label:          "Create item",
			Fields:         []model.EventField{{Key: "body", Type: model.EventTypeTextarea}},
			Results:        []model.EventField{{Key: "item_id"}},
			Emits:          []string{"item_created"},
			AllowedCallers: []string{"com.mattermost.weave"},
			TimeoutSeconds: 60,
		}
		require.NoError(t, client.RegisterAction(action))
		assert.Equal(t, action, impl.action)

		subs := []model.EventSubscription{
			{ID: "a", Event: "pub/item_created", Filters: allEventValues(), IncludeOwn: true},
			{ID: "b", Event: "*"},
		}
		opts := model.SubscriptionOptions{QueueSize: 10, Workers: 2}
		require.NoError(t, client.SetSubscriptions(subs, opts))
		assert.Equal(t, subs, impl.subs)
		assert.Equal(t, opts, impl.subOpts)
	})

	t.Run("emit", func(t *testing.T) {
		impl := &eventAPI{}
		client := newEventAPIClient(t, impl)

		require.NoError(t, client.EmitEvent("item_created", allEventValues(), "cause", &model.EmitOptions{OriginUserID: "user1"}))
		assert.Equal(t, "item_created", impl.emitName)
		assert.Equal(t, allEventValues(), impl.emitPayload)
		assert.Equal(t, model.EventCause("cause"), impl.emitCause)
		assert.Equal(t, &model.EmitOptions{OriginUserID: "user1"}, impl.emitOpts)

		require.NoError(t, client.EmitEvent("item_created", nil, "", nil))
		assert.Nil(t, impl.emitOpts)
	})

	t.Run("execute action", func(t *testing.T) {
		impl := &eventAPI{executeResp: &model.ActionResponse{Fields: allEventValues()}}
		client := newEventAPIClient(t, impl)

		req := &model.ActionRequest{
			PluginID:     "pub",
			Action:       "create_item",
			Fields:       allEventValues(),
			ActingUserID: "user1",
			Attributes:   map[string]string{"run_as": "author"},
		}
		resp, err := client.ExecuteAction(req, "delivery-token")
		require.NoError(t, err)
		assert.Equal(t, req, impl.executeReq)
		assert.Equal(t, model.EventCause("delivery-token"), impl.executeCause)
		assert.Equal(t, impl.executeResp, resp)
	})

	t.Run("catalog", func(t *testing.T) {
		impl := &eventAPI{catalog: &model.EventCatalog{
			Hash:    "abc",
			Groups:  []model.EventGroup{{PublisherID: "pub", Name: "items", Label: "Items"}},
			Events:  []model.EventDescriptor{{PublisherID: "pub", Name: "item_created", Label: "Item created", Version: 1, Fields: []model.EventField{{Key: "item_id"}}, Visibility: model.EventVisibilityAny}},
			Actions: []model.ActionDescriptor{{PublisherID: "pub", Type: "create_item", Label: "Create item", Fields: []model.EventField{}, Results: []model.EventField{}}},
		}}
		client := newEventAPIClient(t, impl)

		catalog, err := client.ListEventContributions()
		require.NoError(t, err)
		assert.Equal(t, impl.catalog.Hash, catalog.Hash)
		assert.Equal(t, impl.catalog.Groups, catalog.Groups)
		assert.Equal(t, impl.catalog.Events, catalog.Events)
		require.Len(t, catalog.Actions, 1)
		assert.Equal(t, "create_item", catalog.Actions[0].Type)
	})

	t.Run("event bus errors keep their identity", func(t *testing.T) {
		impl := &eventAPI{err: model.ErrEventPayloadInvalid.Wrapf("field %q", "x")}
		client := newEventAPIClient(t, impl)

		err := client.EmitEvent("item_created", nil, "", nil)
		require.ErrorIs(t, err, model.ErrEventPayloadInvalid)
		assert.Equal(t, `event payload is invalid: field "x"`, err.Error())

		require.ErrorIs(t, client.RegisterEvent(model.EventDescriptor{}), model.ErrEventPayloadInvalid)

		impl.err = model.ErrEventBusDisabled
		_, err = client.ListEventContributions()
		require.ErrorIs(t, err, model.ErrEventBusDisabled)
	})

	t.Run("an AppError from an action call keeps its ID and status", func(t *testing.T) {
		impl := &eventAPI{executeErr: model.NewAppError("createItem", "plugin.items.duplicate", nil, "", http.StatusConflict)}
		client := newEventAPIClient(t, impl)

		_, err := client.ExecuteAction(&model.ActionRequest{PluginID: "pub", Action: "create_item"}, "")
		var appErr *model.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, "plugin.items.duplicate", appErr.Id)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
	})
}

type eventHooks struct {
	delivery *model.EventDelivery
	call     *model.ActionCall
	result   *model.ActionResult
	appErr   *model.AppError
}

func (h *eventHooks) OnEvent(c *Context, delivery *model.EventDelivery) {
	h.delivery = delivery
}

func (h *eventHooks) OnActionCall(c *Context, call *model.ActionCall) (*model.ActionResult, *model.AppError) {
	h.call = call
	return h.result, h.appErr
}

func newEventHooksClient(t *testing.T, impl *eventHooks) *hooksRPCClient {
	t.Helper()
	serverConnection, clientConnection := net.Pipe()
	server := rpc.NewServer()
	require.NoError(t, server.RegisterName("Plugin", &hooksRPCServer{impl: impl}))
	go server.ServeConn(serverConnection)
	client := rpc.NewClient(clientConnection)
	t.Cleanup(func() { client.Close() })
	hooks := &hooksRPCClient{client: client, log: mlog.CreateConsoleTestLogger(t)}
	hooks.implemented[OnEventID] = true
	hooks.implemented[OnActionCallID] = true
	return hooks
}

func TestEventBusHooksRPCRoundTrip(t *testing.T) {
	t.Run("OnEvent", func(t *testing.T) {
		impl := &eventHooks{}
		hooks := newEventHooksClient(t, impl)

		delivery := &model.EventDelivery{
			ID:              "env1:sub",
			EnvelopeID:      "env1",
			Event:           "pub/item_created",
			PublisherID:     "pub",
			Version:         1,
			Payload:         allEventValues(),
			SubscriptionIDs: []string{"a", "b"},
			TraceID:         "trace1",
			Hop:             3,
			OriginUserID:    "user1",
			Cause:           "token",
			EmittedAt:       1234,
		}
		require.NoError(t, hooks.OnEventWithRPCErr(&Context{}, delivery))
		assert.Equal(t, delivery, impl.delivery)
	})

	t.Run("OnActionCall", func(t *testing.T) {
		impl := &eventHooks{result: &model.ActionResult{Fields: allEventValues()}}
		hooks := newEventHooksClient(t, impl)

		call := &model.ActionCall{
			Action:         "create_item",
			Fields:         allEventValues(),
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
		impl := &eventHooks{appErr: model.NewAppError("createItem", "plugin.items.invalid", nil, "details", http.StatusBadRequest)}
		hooks := newEventHooksClient(t, impl)

		result, appErr, err := hooks.OnActionCallWithRPCErr(&Context{}, &model.ActionCall{Action: "create_item"})
		require.NoError(t, err)
		assert.Nil(t, result)
		require.NotNil(t, appErr)
		assert.Equal(t, "plugin.items.invalid", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}
