// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	_ "image/gif"
	_ "image/png"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFileInfoIsValid(t *testing.T) {
	info := &FileInfo{
		Id:        NewId(),
		CreatorId: NewId(),
		CreateAt:  1234,
		UpdateAt:  1234,
		PostId:    "",
		Path:      "fake/path.png",
	}

	t.Run("Valid File Info", func(t *testing.T) {
		assert.Nil(t, info.IsValid())
	})

	t.Run("Empty ID is not valid", func(t *testing.T) {
		info.Id = ""
		assert.NotNil(t, info.IsValid(), "empty Id isn't valid")
		info.Id = NewId()
	})

	t.Run("CreateAt 0 is not valid", func(t *testing.T) {
		info.CreateAt = 0
		assert.NotNil(t, info.IsValid(), "empty CreateAt isn't valid")
		info.CreateAt = 1234
	})

	t.Run("UpdateAt 0 is not valid", func(t *testing.T) {
		info.UpdateAt = 0
		assert.NotNil(t, info.IsValid(), "empty UpdateAt isn't valid")
		info.UpdateAt = 1234
	})

	t.Run("New Post ID is valid", func(t *testing.T) {
		info.PostId = NewId()
		assert.Nil(t, info.IsValid())
	})

	t.Run("Empty path is not valid", func(t *testing.T) {
		info.Path = ""
		assert.NotNil(t, info.IsValid(), "empty Path isn't valid")
		info.Path = "fake/path.png"
	})
}

func TestFileInfoIsImage(t *testing.T) {
	info := &FileInfo{}
	t.Run("MimeType set to image/png is considered an image", func(t *testing.T) {
		info.MimeType = "image/png"
		assert.True(t, info.IsImage(), "PNG file should be considered as an image")
	})

	t.Run("MimeType set to text/plain is not considered an image", func(t *testing.T) {
		info.MimeType = "text/plain"
		assert.False(t, info.IsImage(), "Text file should not be considered as an image")
	})
}
