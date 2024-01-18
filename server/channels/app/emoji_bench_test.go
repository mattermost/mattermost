// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/stretchr/testify/require"
)

func BenchmarkUploadEmojiImage(b *testing.B) {
	th := Setup(b)
	b.Cleanup(func() {
		b.StopTimer()
		th.TearDown()
	})

	rctx := request.TestContext(b)

	b.Run("gif", func(b *testing.B) {
		filename := "image.gif"
		b.Run("small", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestGif(b, 10, 10)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("max size", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestGif(b, MaxEmojiWidth, MaxEmojiHeight)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("too wide", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestGif(b, MaxEmojiOriginalWidth, MaxEmojiHeight)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("too tall", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestGif(b, MaxEmojiWidth, MaxEmojiOriginalWidth)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("too tall and too wide", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestGif(b, MaxEmojiOriginalWidth, MaxEmojiOriginalWidth)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
	})

	b.Run("png", func(b *testing.B) {
		filename := "image.png"

		b.Run("small", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestPng(b, 10, 10)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})

		b.Run("max size", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestPng(b, MaxEmojiWidth, MaxEmojiHeight)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("too wide", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestPng(b, MaxEmojiOriginalWidth, MaxEmojiHeight)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("too tall", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestPng(b, MaxEmojiWidth, MaxEmojiOriginalWidth)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
		b.Run("too tall and too wide", func(b *testing.B) {
			file := strings.NewReader(string(utils.CreateTestPng(b, MaxEmojiOriginalWidth, MaxEmojiOriginalWidth)))
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				id := model.NewId()
				appErr := th.App.uploadEmojiImage(rctx, id, filename, file)
				require.Nil(b, appErr)
				_, err := file.Seek(0, 0)
				require.NoError(b, err)
			}
		})
	})
}
