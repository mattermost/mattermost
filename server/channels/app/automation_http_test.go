// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestRenderAutomationRequestFillsPathAndBody(t *testing.T) {
	action := model.AutomationActionDescriptor{
		Method: http.MethodPut,
		Path:   "/api/v0/runs/{{.run_id}}/checklists/{{.checklist}}/item/{{.item}}/state",
	}
	method, route, body, err := renderAutomationRequest(action, map[string]model.AutomationValue{
		"run_id":    model.AutomationText("run1"),
		"checklist": model.AutomationInt(0),
		"item":      model.AutomationInt(2),
		"new_state": model.AutomationText("closed"),
	})
	require.NoError(t, err)
	require.Equal(t, http.MethodPut, method)
	require.Equal(t, "/api/v0/runs/run1/checklists/0/item/2/state", route)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(body, &payload))
	require.Equal(t, map[string]any{"new_state": "closed"}, payload)
}

func TestRenderAutomationRequestRejectsUnsafePathValues(t *testing.T) {
	action := model.AutomationActionDescriptor{Method: http.MethodGet, Path: "/api/v0/runs/{{.run_id}}"}
	_, _, _, err := renderAutomationRequest(action, map[string]model.AutomationValue{
		"run_id": model.AutomationText("../secret"),
	})
	require.Error(t, err)

	_, _, _, err = renderAutomationRequest(action, map[string]model.AutomationValue{
		"run_id": model.AutomationText("a/b"),
	})
	require.Error(t, err)

	_, _, _, err = renderAutomationRequest(action, map[string]model.AutomationValue{})
	require.Error(t, err)
}

func TestRenderAutomationRequestRejectsGetFieldsLeftOutOfThePath(t *testing.T) {
	action := model.AutomationActionDescriptor{Method: http.MethodGet, Path: "/api/v0/runs/{{.run_id}}"}
	_, _, _, err := renderAutomationRequest(action, map[string]model.AutomationValue{
		"run_id":  model.AutomationText("run1"),
		"message": model.AutomationText("hello"),
	})
	require.Error(t, err)
}

func TestProjectAutomationResultsReadsDeclaredJSON(t *testing.T) {
	results := []model.AutomationField{
		{Key: "id", Type: model.AutomationValueText},
		{Key: "found", Type: model.AutomationValueBool},
		{Key: "num_stages", Type: model.AutomationValueInt},
		{Key: "summary", Type: model.AutomationValueTextarea},
	}
	body := []byte(`{"id":"run1","found":true,"num_stages":3,"summary":"done","extra":"hidden"}`)
	got, err := projectAutomationResults(results, http.StatusOK, body)
	require.NoError(t, err)
	require.Equal(t, model.AutomationText("run1"), got["id"])
	require.Equal(t, model.AutomationBool(true), got["found"])
	require.Equal(t, model.AutomationInt(3), got["num_stages"])
	require.Equal(t, model.AutomationValue{Type: model.AutomationValueTextarea, Text: "done"}, got["summary"])
	_, ok := got["extra"]
	require.False(t, ok)
}

func TestProjectAutomationResultsUsesThePluginError(t *testing.T) {
	_, err := projectAutomationResults(nil, http.StatusForbidden, []byte(`{"error":"Not authorized"}`))
	require.Error(t, err)
	require.Contains(t, err.Error(), "403")
	require.Contains(t, err.Error(), "Not authorized")
}

func TestProjectAutomationResultsIgnoresAStatusBodyWhenNothingIsDeclared(t *testing.T) {
	got, err := projectAutomationResults(nil, http.StatusOK, []byte(`{"status":"OK"}`))
	require.NoError(t, err)
	require.Empty(t, got)
}
