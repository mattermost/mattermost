// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMultipleEmojiByName(t *testing.T) {
	// The fact that we use mock store ensures that
	// the call to the DB does not happen. If it did, we would have needed
	// to provide the mock explicitly.
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomEmoji = true
	})

	// Ensure it returns empty for system emojis
	emojis, appErr := th.App.GetMultipleEmojiByName(th.Context, []string{"+1"})
	require.Nil(t, appErr)
	assert.Empty(t, emojis)
}
