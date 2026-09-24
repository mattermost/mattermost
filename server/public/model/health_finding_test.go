// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthFindingRender(t *testing.T) {
	text := RuleText{
		TitleID:       "health.rule.title",
		RemediationID: "health.rule.remediation",
	}

	t.Run("nil receiver returns nil", func(t *testing.T) {
		var f *HealthFinding
		require.Nil(t, f.Render(nil, text))
	})

	t.Run("populates rendered fields from a translate func", func(t *testing.T) {
		f := &HealthFinding{
			MessageID: "health.rule.message",
			Details:   map[string]string{"host": "node-1"},
		}
		translate := func(id string, args ...any) string {
			if len(args) > 0 {
				return id + ":" + args[0].(map[string]any)["host"].(string)
			}
			return id + ":noargs"
		}

		rendered := f.Render(translate, text)

		require.NotNil(t, rendered)
		assert.Equal(t, "health.rule.title:node-1", rendered.Title)
		assert.Equal(t, "health.rule.remediation:node-1", rendered.Remediation)
		assert.Equal(t, "health.rule.message:node-1", rendered.Message)
	})

	t.Run("no details passes no args to the translate func", func(t *testing.T) {
		f := &HealthFinding{MessageID: "health.rule.message"}
		translate := func(id string, args ...any) string {
			if len(args) > 0 {
				return id + ":withargs"
			}
			return id + ":noargs"
		}

		rendered := f.Render(translate, text)

		assert.Equal(t, "health.rule.message:noargs", rendered.Message)
	})

	t.Run("nil translate func falls back to the raw ids", func(t *testing.T) {
		f := &HealthFinding{
			MessageID: "health.rule.message",
			Details:   map[string]string{"host": "node-1"},
		}

		rendered := f.Render(nil, text)

		assert.Equal(t, "health.rule.title", rendered.Title)
		assert.Equal(t, "health.rule.remediation", rendered.Remediation)
		assert.Equal(t, "health.rule.message", rendered.Message)
	})

	t.Run("empty ids render as empty strings", func(t *testing.T) {
		f := &HealthFinding{}

		rendered := f.Render(func(id string, args ...any) string {
			return "translated"
		}, RuleText{})

		assert.Empty(t, rendered.Title)
		assert.Empty(t, rendered.Remediation)
		assert.Empty(t, rendered.Message)
	})

	t.Run("does not mutate the receiver", func(t *testing.T) {
		f := &HealthFinding{MessageID: "health.rule.message"}

		f.Render(func(id string, args ...any) string {
			return "translated"
		}, text)

		assert.Empty(t, f.Title)
		assert.Empty(t, f.Remediation)
		assert.Empty(t, f.Message)
	})
}
