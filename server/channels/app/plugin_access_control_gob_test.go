// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// requirePluginRPCGobSafe gob-encodes v the way the plugin RPC layer encodes
// an API reply (public/plugin's client_rpc gob registrations are active via
// the import). An unregistered concrete type inside an interface-typed field
// fails encoding, which shuts down the shared plugin RPC connection.
func requirePluginRPCGobSafe(t *testing.T, v any) {
	t.Helper()
	var buf bytes.Buffer
	require.NoError(t, gob.NewEncoder(&buf).Encode(v),
		"reply payload must gob-encode with client_rpc registrations; an unregistered concrete type inside `any` poisons the plugin RPC connection")
}

// TestPluginAccessControlGobSafety pins that every payload the plugin access
// control API can return over net/rpc survives gob encoding. The autocomplete
// subtest is the regression test for the native-attribute options bug
// (bool-select options were []map[string]string, which gob rejects).
func TestPluginAccessControlGobSafety(t *testing.T) {
	th := Setup(t).InitBasic(t)
	actingUserID := th.BasicUser.Id

	t.Run("fields autocomplete response including native attribute fields", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}

		fields, appErr := th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, actingUserID, "", 100)
		require.Nil(t, appErr)
		require.NotEmpty(t, fields, "native attribute fields expected on the first page")

		// Prove the payload contains a native bool-select field carrying
		// options inside Attrs.
		hasBoolSelect := false
		for _, f := range fields {
			if f.Attrs[model.PropertyFieldAttributeOptions] != nil {
				hasBoolSelect = true
			}
		}
		require.True(t, hasBoolSelect, "expected at least one native field with select options in Attrs")

		requirePluginRPCGobSafe(t, fields)
	})

	t.Run("policy with JSON-decoded Props", func(t *testing.T) {
		// Stored policies hydrate Props via json.Unmarshal, so the concrete
		// types inside are exactly the ones gob accepts; pin that.
		var props map[string]any
		require.NoError(t, json.Unmarshal(
			[]byte(`{"nested":{"k":"v"},"list":[1,"two",true],"s":"x","n":1.5,"b":true,"z":null}`), &props))

		p := validPluginPolicy(model.NewId())
		p.Props = props
		requirePluginRPCGobSafe(t, p)
	})

	t.Run("visual AST with every runtime value shape", func(t *testing.T) {
		// The enterprise AST→visual conversion produces these value shapes.
		visual := &model.VisualExpression{Conditions: []model.Condition{
			{Attribute: "user.attributes.team", Operator: "==", Value: "eng"},
			{Attribute: "user.attributes.admin", Operator: "==", Value: true},
			{Attribute: "user.attributes.age", Operator: ">", Value: int64(30)},
			{Attribute: "user.attributes.count", Operator: "<", Value: uint64(10)},
			{Attribute: "user.attributes.score", Operator: ">=", Value: 1.5},
			{Attribute: "user.attributes.missing", Operator: "==", Value: nil},
			{Attribute: "user.attributes.role", Operator: "in", Value: []any{"a", "b"}},
		}}
		requirePluginRPCGobSafe(t, visual)
	})

	t.Run("expression check errors", func(t *testing.T) {
		requirePluginRPCGobSafe(t, []model.CELExpressionError{{Line: 1, Column: 2, Message: "boom"}})
	})

	t.Run("query users response with a real user", func(t *testing.T) {
		requirePluginRPCGobSafe(t, &model.AccessControlPolicyTestResponse{Users: []*model.User{th.BasicUser}, Total: 1})
	})

	t.Run("query users empty result is non-nil at producer and gob-safe", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return(([]*model.User)(nil), int64(0), nil).Once()

		resp, appErr := th.App.QueryUsersForPluginAccessControlExpression(
			th.Context, testAgentsPluginID, th.BasicUser.Id, testAgentResourceType,
			`user.attributes.dept == "eng"`, "", "", 10)
		require.Nil(t, appErr)
		// Producer normalizes nil → empty slice so JSON/in-process callers never
		// see null users. encoding/gob still decodes empty slices as nil; host
		// and plugin UIs keep `users ?? []` as belt-and-braces for that quirk.
		require.NotNil(t, resp.Users)
		require.Empty(t, resp.Users)
		requirePluginRPCGobSafe(t, resp)

		var decoded model.AccessControlPolicyTestResponse
		var buf bytes.Buffer
		require.NoError(t, gob.NewEncoder(&buf).Encode(resp))
		require.NoError(t, gob.NewDecoder(&buf).Decode(&decoded))
		require.Equal(t, int64(0), decoded.Total)
		require.Empty(t, decoded.Users)
		mockACS.AssertExpectations(t)
	})

	t.Run("evaluation decision carrying a context reason", func(t *testing.T) {
		decision := model.NewNoPolicyAccessDecision()
		requirePluginRPCGobSafe(t, &decision)
	})
}
