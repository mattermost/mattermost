// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestAutomationTraceAdvancesAndStops(t *testing.T) {
	registry := newAutomationRegistry()
	require.NoError(t, registry.registerSignal("playbooks", model.AutomationSignalDescriptor{
		Name:   "run_created",
		Fields: []model.AutomationField{{Key: "run_id", Type: model.AutomationValueText}},
	}))

	first, err := registry.acceptTrace("playbooks", "run_created", map[string]model.AutomationValue{"run_id": model.AutomationText("r1")}, "")
	require.NoError(t, err)
	require.Equal(t, 0, first.Hop)
	require.NotEmpty(t, first.TraceToken)

	registry.holdTrace(first.TraceToken, "com.mattermost.weave")
	registry.bindTrace(first.TraceToken, "com.mattermost.weave", "playbooks")

	second, err := registry.acceptTrace("playbooks", "run_created", map[string]model.AutomationValue{"run_id": model.AutomationText("r2")}, first.TraceToken)
	require.NoError(t, err)
	require.Equal(t, 1, second.Hop)

	_, err = registry.acceptTrace("playbooks", "run_created", map[string]model.AutomationValue{"run_id": model.AutomationText("r3")}, "not-a-token")
	require.Error(t, err)
}

func TestAutomationPayloadRejectsMessageText(t *testing.T) {
	err := validateSignalFields([]model.AutomationField{{Key: "summary", Type: model.AutomationValueText}})
	require.Error(t, err)

	declared := []model.AutomationField{{Key: "run_id", Type: model.AutomationValueText}, {Key: "action", Type: model.AutomationValueText}}
	err = validateAutomationPayload(declared, map[string]model.AutomationValue{
		"run_id": model.AutomationText("r1"),
		"action": model.AutomationText("check"),
	})
	require.NoError(t, err)
}
