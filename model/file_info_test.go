// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/base64"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "image/gif"
	_ "image/png"
	"io/ioutil"
	"strings"
	"testing"
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

	require.Nil(t, info.IsValid())

	info.Id = ""
	require.NotNil(t, info.IsValid(), "empty Id isn't valid")

	info.Id = NewId()
	info.CreateAt = 0
	require.NotNil(t, info.IsValid(), "empty CreateAt isn't valid")

	info.CreateAt = 1234
	info.UpdateAt = 0
	require.NotNil(t, info.IsValid(), "empty UpdateAt isn't valid")

	info.UpdateAt = 1234
	info.PostId = NewId()
	require.Nil(t, info.IsValid())

	info.Path = ""
	require.NotNil(t, info.IsValid(), "empty Path isn't valid")

	info.Path = "fake/path.png"
	require.Nil(t, info.IsValid())
}

func TestFileInfoIsImage(t *testing.T) {
	info := &FileInfo{MimeType: "image/png"}
	assert.True(t, info.IsImage(), "file is an image")

	info.MimeType = "text/plain"
	assert.False(t, info.IsImage(), "file is not an image")
}

func TestGetInfoForFile(t *testing.T) {
	fakeFile := make([]byte, 1000)

	info, errApp := GetInfoForBytes("file.txt", fakeFile)
	require.Nil(t, errApp)
	assert.Equalf(t, info.Name, "file.txt", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "txt", "Got incorrect extension: %v", info.Extension)
	assert.EqualValuesf(t, info.Size, 1000, "Got incorrect size: %v", info.Size)
	assert.Truef(t, strings.HasPrefix(info.MimeType, "text/plain"), "Got incorrect mime type: %v", info.MimeType)
	assert.Equalf(t, info.Width, 0, "Got incorrect width: %v", info.Width)
	assert.Equalf(t, info.Height, 0, "Got incorrect height: %v", info.Height)
	assert.Falsef(t, info.HasPreviewImage, "Got incorrect has preview image: %v", info.HasPreviewImage)

	pngFile, err := ioutil.ReadFile("../tests/test.png")
	require.Nilf(t, err, "Failed to load test.png")

	info, err = GetInfoForBytes("test.png", pngFile)
	require.Nil(t, err)
	assert.Equalf(t, info.Name, "test.png", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "png", "Got incorrect extension: %v", info.Extension)
	assert.EqualValues(t, info.Size, 279591, "Got incorrect size: %v", info.Size)
	assert.Equalf(t, info.MimeType, "image/png", "Got incorrect mime type: %v", info.MimeType)
	assert.Equalf(t, info.Width, 408, "Got incorrect width: %v", info.Width)
	assert.Equalf(t, info.Height, 336, "Got incorrect height: %v", info.Height)
	assert.Truef(t, info.HasPreviewImage, "Got incorrect has preview image: %v", info.HasPreviewImage)

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	gifFile, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")
	info, err = GetInfoForBytes("handtinywhite.gif", gifFile)
	require.Nil(t, err)
	assert.Equalf(t, info.Name, "handtinywhite.gif", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "gif", "Got incorrect extension: %v", info.Extension)
	assert.EqualValuesf(t, info.Size, 35, "Got incorrect size: %v", info.Size)
	assert.Equalf(t, info.MimeType, "image/gif", "Got incorrect mime type: %v", info.MimeType)
	assert.Equalf(t, info.Width, 1, "Got incorrect width: %v", info.Width)
	assert.Equalf(t, info.Height, 1, "Got incorrect height: %v", info.Height)
	assert.Truef(t, info.HasPreviewImage, "Got incorrect has preview image: %v", info.HasPreviewImage)

	animatedGifFile, err := ioutil.ReadFile("../tests/testgif.gif")
	require.Nilf(t, err, "Failed to load testgif.gif")

	info, err = GetInfoForBytes("testgif.gif", animatedGifFile)
	require.Nil(t, err)
	assert.Equalf(t, info.Name, "testgif.gif", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "gif", "Got incorrect extension: %v", info.Extension)
	assert.EqualValuesf(t, info.Size, 38689, "Got incorrect size: %v", info.Size)
	assert.Equalf(t, info.MimeType, "image/gif", "Got incorrect mime type: %v", info.MimeType)
	assert.Equalf(t, info.Width, 118, "Got incorrect width: %v", info.Width)
	assert.Equalf(t, info.Height, 118, "Got incorrect height: %v", info.Height)
	assert.Falsef(t, info.HasPreviewImage, "Got incorrect has preview image: %v", info.HasPreviewImage)

	info, err = GetInfoForBytes("filewithoutextension", fakeFile)
	require.Nil(t, err)
	assert.Equalf(t, info.Name, "filewithoutextension", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "", "Got incorrect extension: %v", info.Extension)
	assert.EqualValuesf(t, info.Size, 1000, "Got incorrect size: %v", info.Size)
	assert.Equalf(t, info.MimeType, "", "Got incorrect mime type: %v", info.MimeType)
	assert.Equalf(t, info.Width, 0, "Got incorrect width: %v", info.Width)
	assert.Equalf(t, info.Height, 0, "Got incorrect height: %v", info.Height)
	assert.Falsef(t, info.HasPreviewImage, "Got incorrect has preview image: %v", info.HasPreviewImage)

	// Always make the extension lower case to make it easier to use in other places
	info, err = GetInfoForBytes("file.TXT", fakeFile)
	require.Nil(t, err)
	assert.Equalf(t, info.Name, "file.TXT", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "txt", "Got incorrect extension: %v", info.Extension)

	// Don't error out for image formats we don't support
	info, err = GetInfoForBytes("file.tif", fakeFile)
	require.Nil(t, err)
	assert.Equalf(t, info.Name, "file.tif", "Got incorrect filename: %v", info.Name)
	assert.Equalf(t, info.Extension, "tif", "Got incorrect extension: %v", info.Extension)
	assert.True(t, info.MimeType == "image/x-tiff" || info.MimeType == "image/tiff", "Got incorrect mime type: %v", info.MimeType)
}
