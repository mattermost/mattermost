// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

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
