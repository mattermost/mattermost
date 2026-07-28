// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestBuildRewriteSystemPrompt(t *testing.T) {
	basePrompt := model.RewriteSystemPrompt

	t.Run("uses_user_locale", func(t *testing.T) {
		prompt := buildRewriteSystemPrompt("en_CA")
		require.True(t, strings.HasPrefix(prompt, basePrompt))
		require.Contains(t, prompt, "User locale: en_CA.")
	})

	t.Run("returns_base_prompt_when_no_locale", func(t *testing.T) {
		prompt := buildRewriteSystemPrompt("")
		require.Equal(t, basePrompt, prompt)
	})
}

func TestRewriteMessage(t *testing.T) {
	t.Run("sets_structured_output_schema_on_bridge_request", func(t *testing.T) {
		bridge := &testAgentsBridge{
			completeFn: func(sessionUserID, agentID string, req BridgeCompletionRequest) (string, error) {
				return `{"rewritten_text":"Rewritten message"}`, nil
			},
		}

		th := Setup(t, WithAgentsBridge(bridge)).InitBasic(t)
		ctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id})

		response, appErr := th.App.RewriteMessage(ctx, model.NewId(), "original message", model.RewriteActionImproveWriting, "", "")
		require.Nil(t, appErr)
		require.NotNil(t, response)
		assert.Equal(t, "Rewritten message", response.RewrittenText)
		require.Len(t, bridge.completeCalls, 1)
		assert.Equal(t, BridgeOperationRewrite, bridge.completeCalls[0].request.Operation)
		assert.Equal(t, string(model.RewriteActionImproveWriting), bridge.completeCalls[0].request.OperationSubType)
		assert.Equal(t, rewriteResponseJSONSchema, bridge.completeCalls[0].request.JSONOutputFormat)
	})
}
