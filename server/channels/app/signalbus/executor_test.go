// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const callerBotID = "callerbotuserid"

func newActionBus(t *testing.T) *testBus {
	t.Helper()
	tb := newTestBus(t, 0)
	action := createItemAction()
	action.Fields = append(action.Fields, model.SignalField{Key: "body", Type: model.SignalTypeTextarea})
	action.Results = append(action.Results, model.SignalField{Key: "count", Type: model.SignalTypeInt})
	require.NoError(t, tb.RegisterAction(publisherID, action))
	tb.hooks.bots[subscriberID] = callerBotID
	return tb
}

func createItemRequest() *model.ActionRequest {
	return &model.ActionRequest{
		PluginID: publisherID,
		Action:   "create_item",
		Fields:   map[string]model.SignalValue{"title": {Text: "Hello"}},
	}
}

func TestExecuteAction(t *testing.T) {
	t.Run("calls the target and returns only declared results", func(t *testing.T) {
		tb := newActionBus(t)
		tb.hooks.onActionCall = func(string, *model.ActionCall) (*model.ActionResult, error) {
			return &model.ActionResult{Fields: map[string]model.SignalValue{
				"item_id":    {Text: "i1"},
				"count":      model.SignalIntValue(7),
				"undeclared": model.SignalTextValue("secret"),
			}}, nil
		}

		req := createItemRequest()
		req.ActingUserID = "ignored_for_now"
		req.Attributes = map[string]string{"run_as": "author"}
		resp, err := tb.ExecuteAction(subscriberID, req, "cause-token")
		require.NoError(t, err)
		assert.Equal(t, map[string]model.SignalValue{
			"item_id": model.SignalTextValue("i1"),
			"count":   model.SignalIntValue(7),
		}, resp.Fields)

		calls := tb.hooks.actionCalls(publisherID)
		require.Len(t, calls, 1)
		assert.Equal(t, &model.ActionCall{
			Action:         "create_item",
			Fields:         map[string]model.SignalValue{"title": model.SignalTextValue("Hello")},
			CallerPluginID: subscriberID,
			ActingUserID:   callerBotID,
			Cause:          "cause-token",
			Attributes:     map[string]string{"run_as": "author"},
		}, calls[0])

		req.Attributes["run_as"] = "changed"
		assert.Equal(t, "author", calls[0].Attributes["run_as"], "attributes are copied")
	})

	t.Run("a nil result returns no fields", func(t *testing.T) {
		tb := newActionBus(t)
		tb.hooks.onActionCall = func(string, *model.ActionCall) (*model.ActionResult, error) {
			return nil, nil
		}
		resp, err := tb.ExecuteAction(subscriberID, createItemRequest(), "")
		require.NoError(t, err)
		assert.Empty(t, resp.Fields)
	})

	tests := []struct {
		name    string
		setup   func(tb *testBus)
		req     func() *model.ActionRequest
		wantErr error
		// reachesTarget marks failures that happen after the target's hook was called.
		reachesTarget bool
	}{
		{
			name:    "nil request",
			req:     func() *model.ActionRequest { return nil },
			wantErr: model.ErrActionNotFound,
		},
		{
			name: "unknown action",
			req: func() *model.ActionRequest {
				r := createItemRequest()
				r.Action = "missing"
				return r
			},
			wantErr: model.ErrActionNotFound,
		},
		{
			name: "unknown target",
			req: func() *model.ActionRequest {
				r := createItemRequest()
				r.PluginID = otherID
				return r
			},
			wantErr: model.ErrActionNotFound,
		},
		{
			name:    "inactive target",
			setup:   func(tb *testBus) { tb.hooks.setInactive(publisherID, true) },
			wantErr: model.ErrActionNotFound,
		},
		{
			name:    "target still in OnActivate",
			setup:   func(tb *testBus) { tb.hooks.setStarting(publisherID, true) },
			wantErr: model.ErrActionNotFound,
		},
		{
			name:    "target lost OnActionCall",
			setup:   func(tb *testBus) { tb.hooks.setMissingHook(publisherID, plugin.OnActionCallID) },
			wantErr: model.ErrActionNotFound,
		},
		{
			name: "caller not allowed",
			setup: func(tb *testBus) {
				action := createItemAction()
				action.AllowedCallers = []string{otherID}
				require.NoError(t, tb.RegisterAction(publisherID, action))
			},
			wantErr: model.ErrActionCallerNotAllowed,
		},
		{
			name: "undeclared input",
			req: func() *model.ActionRequest {
				r := createItemRequest()
				r.Fields["undeclared"] = model.SignalTextValue("x")
				return r
			},
			wantErr: model.ErrActionFieldsInvalid,
		},
		{
			name: "input with the wrong type",
			req: func() *model.ActionRequest {
				r := createItemRequest()
				r.Fields["title"] = model.SignalIntValue(1)
				return r
			},
			wantErr: model.ErrActionFieldsInvalid,
		},
		{
			name: "input text over the cap",
			req: func() *model.ActionRequest {
				r := createItemRequest()
				r.Fields["title"] = model.SignalTextValue(strings.Repeat("x", model.ActionTextMaxRunes+1))
				return r
			},
			wantErr: model.ErrActionFieldsInvalid,
		},
		{
			name: "encoded request over 1 MiB",
			req: func() *model.ActionRequest {
				r := createItemRequest()
				r.Attributes = map[string]string{"big": strings.Repeat("x", model.ActionMaxBytes)}
				return r
			},
			wantErr: model.ErrActionFieldsInvalid,
		},
		{
			name:    "caller without a bot",
			setup:   func(tb *testBus) { delete(tb.hooks.bots, subscriberID) },
			wantErr: model.ErrActingUserRequired,
		},
		{
			name:    "bot lookup fails",
			setup:   func(tb *testBus) { tb.hooks.botErr = errors.New("store down") },
			wantErr: model.ErrActingUserRequired,
		},
		{
			name:    "inactive bot",
			setup:   func(tb *testBus) { tb.hooks.inactiveUsers[callerBotID] = true },
			wantErr: model.ErrActingUserInvalid,
		},
		{
			name: "transport error",
			setup: func(tb *testBus) {
				tb.hooks.onActionCall = func(string, *model.ActionCall) (*model.ActionResult, error) {
					return nil, errors.New("connection closed")
				}
			},
			wantErr:       model.ErrActionCallFailed,
			reachesTarget: true,
		},
		{
			name: "invalid result",
			setup: func(tb *testBus) {
				tb.hooks.onActionCall = func(string, *model.ActionCall) (*model.ActionResult, error) {
					return &model.ActionResult{Fields: map[string]model.SignalValue{"count": model.SignalTextValue("seven")}}, nil
				}
			},
			wantErr:       model.ErrActionResultInvalid,
			reachesTarget: true,
		},
		{
			name: "encoded response over 1 MiB",
			setup: func(tb *testBus) {
				action := createItemAction()
				action.Results = []model.SignalField{{Key: "body", Type: model.SignalTypeTextarea}}
				require.NoError(t, tb.RegisterAction(publisherID, action))

				// The results alone fit exactly; the response wrapper pushes it over.
				overhead, err := json.Marshal(map[string]model.SignalValue{"body": model.SignalTextareaValue("")})
				require.NoError(t, err)
				body := model.SignalTextareaValue(strings.Repeat("x", model.ActionMaxBytes-len(overhead)))
				tb.hooks.onActionCall = func(string, *model.ActionCall) (*model.ActionResult, error) {
					return &model.ActionResult{Fields: map[string]model.SignalValue{"body": body}}, nil
				}
			},
			wantErr:       model.ErrActionResultInvalid,
			reachesTarget: true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tb := newActionBus(t)
			if tc.setup != nil {
				tc.setup(tb)
			}
			req := createItemRequest()
			if tc.req != nil {
				req = tc.req()
			}
			resp, err := tb.ExecuteAction(subscriberID, req, "")
			require.ErrorIs(t, err, tc.wantErr)
			assert.Nil(t, resp)
			if tc.reachesTarget {
				assert.Len(t, tb.hooks.actionCalls(publisherID), 1)
			} else {
				assert.Empty(t, tb.hooks.actionCalls(publisherID), "rejected before reaching the target")
			}
		})
	}

	t.Run("a disallowed caller without a bot is told it is not allowed", func(t *testing.T) {
		tb := newActionBus(t)
		action := createItemAction()
		action.AllowedCallers = []string{otherID}
		require.NoError(t, tb.RegisterAction(publisherID, action))
		delete(tb.hooks.bots, subscriberID)

		_, err := tb.ExecuteAction(subscriberID, createItemRequest(), "")
		require.ErrorIs(t, err, model.ErrActionCallerNotAllowed)
	})

	t.Run("target changes during the bot lookup are enforced", func(t *testing.T) {
		tests := []struct {
			name    string
			change  func(tb *testBus)
			wantErr error
		}{
			{
				name: "caller removed from the allowlist",
				change: func(tb *testBus) {
					action := createItemAction()
					action.AllowedCallers = []string{otherID}
					require.NoError(t, tb.RegisterAction(publisherID, action))
				},
				wantErr: model.ErrActionCallerNotAllowed,
			},
			{
				name:    "target restarting",
				change:  func(tb *testBus) { tb.hooks.setStarting(publisherID, true) },
				wantErr: model.ErrActionNotFound,
			},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				tb := newActionBus(t)
				tb.hooks.onBotLookup = func() { tc.change(tb) }

				_, err := tb.ExecuteAction(subscriberID, createItemRequest(), "")
				require.ErrorIs(t, err, tc.wantErr)
				assert.Empty(t, tb.hooks.actionCalls(publisherID))
			})
		}
	})

	t.Run("an AppError from the target is returned unchanged", func(t *testing.T) {
		tb := newActionBus(t)
		appErr := model.NewAppError("createItem", "plugin.items.create.duplicate", nil, "already exists", http.StatusConflict)
		tb.hooks.onActionCall = func(string, *model.ActionCall) (*model.ActionResult, error) {
			return nil, appErr
		}
		_, err := tb.ExecuteAction(subscriberID, createItemRequest(), "")
		var got *model.AppError
		require.ErrorAs(t, err, &got)
		assert.Equal(t, "plugin.items.create.duplicate", got.Id)
		assert.Equal(t, http.StatusConflict, got.StatusCode)
	})
}
