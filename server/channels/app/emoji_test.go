// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMultipleEmojiByName(t *testing.T) {
	mainHelper.Parallel(t)
	// The fact that we use mock store ensures that
	// the call to the DB does not happen. If it did, we would have needed
	// to provide the mock explicitly.
	th := SetupWithStoreMock(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomEmoji = true
	})

	// Ensure it returns empty for system emojis
	emojis, appErr := th.App.GetMultipleEmojiByName(th.Context, []string{"+1"})
	require.Nil(t, appErr)
	assert.Empty(t, emojis)
}

// TestUploadEmojiImageResourceLimits covers the combined resource budget on the
// emoji upload path: an animated GIF within every individual limit (file size,
// dimensions, frame count) can still decode to far more pixels than the server
// is willing to process at once.
func TestUploadEmojiImageResourceLimits(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	rctx := request.TestContext(t)

	maxRes := *th.App.Config().FileSettings.MaxImageResolution
	// Enough frames at the maximum allowed emoji dimensions to blow past the
	// total decoded resolution, while staying under the frame limit.
	frames := int(maxRes/(MaxEmojiOriginalWidth*MaxEmojiOriginalHeight)) + 1
	require.LessOrEqual(t, frames, MaxEmojiGIFFrames)

	t.Run("animated gif exceeding the total decoded resolution is rejected", func(t *testing.T) {
		data := utils.CreateTestAnimatedGif(t, MaxEmojiOriginalWidth, MaxEmojiOriginalHeight, frames)
		require.Less(t, len(data), MaxEmojiFileSize, "payload must stay within the upload size limit")

		appErr := th.App.uploadEmojiImage(rctx, model.NewId(), "image.gif", bytes.NewReader(data))
		require.NotNil(t, appErr)
		require.Equal(t, "api.emoji.upload.too_much_image_data.app_error", appErr.Id)
	})

	t.Run("animated gif within the total decoded resolution is accepted", func(t *testing.T) {
		data := utils.CreateTestAnimatedGif(t, 200, 200, MaxEmojiGIFFrames)

		appErr := th.App.uploadEmojiImage(rctx, model.NewId(), "image.gif", bytes.NewReader(data))
		require.Nil(t, appErr)
	})
}
