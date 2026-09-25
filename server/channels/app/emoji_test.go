// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

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

// TestUploadEmojiImage_BoundsDecodedImageCost checks that an emoji source is
// accepted or rejected based on the total amount of image data it produces once
// decoded, rather than on its dimensions and its frame count taken separately.
func TestUploadEmojiImage_BoundsDecodedImageCost(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	rctx := request.TestContext(t)

	// An animated gif that is cut short, so the frames it holds cannot be
	// established from its header.
	incompleteGif := utils.CreateTestAnimatedGif(t, 200, 200, MaxEmojiGIFFrames)
	incompleteGif = incompleteGif[:len(incompleteGif)/2]

	testCases := []struct {
		name     string
		filename string
		image    []byte
		accepted bool
	}{
		{
			name:     "animated gif at the frame limit",
			filename: "image.gif",
			image:    utils.CreateTestAnimatedGif(t, 200, 200, MaxEmojiGIFFrames),
			accepted: true,
		},
		{
			name:     "single frame image at the source dimension limit",
			filename: "image.png",
			image:    utils.CreateTestPng(t, MaxEmojiOriginalWidth, MaxEmojiOriginalHeight),
			accepted: true,
		},
		{
			// A source already within the emoji dimensions is stored as it is,
			// so this one is never decoded at all.
			name:     "animated gif at the emoji dimensions and the frame limit",
			filename: "image.gif",
			image:    utils.CreateTestAnimatedGif(t, MaxEmojiWidth, MaxEmojiHeight, MaxEmojiGIFFrames),
			accepted: true,
		},
		{
			name:     "animated gif at the source dimension limit and the frame limit",
			filename: "image.gif",
			image:    utils.CreateTestAnimatedGif(t, MaxEmojiOriginalWidth, MaxEmojiOriginalHeight, MaxEmojiGIFFrames),
			accepted: false,
		},
		{
			// The filename decides how the image is processed, so the same
			// source is accepted here: a single frame of it is turned into a
			// png, which stays within the cost of one image of that size.
			name:     "animated gif under a filename without a gif extension",
			filename: "image.png",
			image:    utils.CreateTestAnimatedGif(t, MaxEmojiOriginalWidth, MaxEmojiOriginalHeight, MaxEmojiGIFFrames),
			accepted: true,
		},
		{
			name:     "single frame image under a filename with a gif extension",
			filename: "image.gif",
			image:    utils.CreateTestPng(t, 200, 200),
			accepted: false,
		},
		{
			name:     "incomplete animated gif",
			filename: "image.gif",
			image:    incompleteGif,
			accepted: false,
		},
		{
			name:     "no image data",
			filename: "image.gif",
			image:    nil,
			accepted: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Every case is within the upload size accepted by the API layer, so
			// the outcome is decided by the checks in uploadEmojiImage alone.
			require.Less(t, len(tc.image), MaxEmojiFileSize)

			appErr := th.App.uploadEmojiImage(rctx, model.NewId(), tc.filename, bytes.NewReader(tc.image))
			if tc.accepted {
				require.Nil(t, appErr)
				return
			}

			require.NotNil(t, appErr)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		})
	}
}

// TestUploadEmojiImage_RespectsDecoderConcurrencyLimit checks that emoji image
// processing uses the shared image decoder, so the number of emoji uploads
// decoding at the same time stays within FileSettings.MaxImageDecoderConcurrency.
func TestUploadEmojiImage_RespectsDecoderConcurrencyLimit(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		*cfg.FileSettings.MaxImageDecoderConcurrency = 1
	})

	rctx := request.TestContext(t)

	// Hold the only decoding slot for as long as the uploads below are running.
	img, _, release, err := th.App.ch.imgDecoder.DecodeMemBounded(bytes.NewReader(utils.CreateTestPng(t, 10, 10)))
	require.NoError(t, err)
	require.NotNil(t, img)
	defer release()

	const concurrentUploads = 20

	emojiImage := utils.CreateTestAnimatedGif(t, 256, 256, 10)

	var (
		wg        sync.WaitGroup
		completed atomic.Int32
		appErrs   = make(chan *model.AppError, concurrentUploads)
	)

	wg.Add(concurrentUploads)
	for range concurrentUploads {
		go func() {
			defer wg.Done()
			if appErr := th.App.uploadEmojiImage(rctx, model.NewId(), "image.gif", bytes.NewReader(emojiImage)); appErr != nil {
				appErrs <- appErr
			}
			completed.Add(1)
		}()
	}

	// None of the uploads may get through while the slot is held. The window is
	// generous: an upload of this size takes single digit milliseconds once it
	// can decode, so all twenty would be done well inside it. assert rather than
	// require so the slot is still handed back on a failing run.
	assert.Never(t, func() bool {
		return completed.Load() > 0
	}, time.Second, 10*time.Millisecond, "uploads decoded past the configured decoder concurrency")

	release()
	wg.Wait()
	close(appErrs)

	// Once the slot is free every upload still succeeds.
	for appErr := range appErrs {
		require.Nil(t, appErr)
	}
	require.EqualValues(t, concurrentUploads, completed.Load())
}
