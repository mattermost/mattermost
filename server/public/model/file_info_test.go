// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	_ "image/gif"
	_ "image/png"
	"strings"
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

	t.Run("Creator ID for bookmarks is valid", func(t *testing.T) {
		creatorId := info.CreatorId
		info.CreatorId = BookmarkFileOwner
		assert.Nil(t, info.IsValid(), "creatorId isn't valid")
		info.CreatorId = creatorId
	})

	t.Run("Empty Name is valid", func(t *testing.T) {
		info.Name = ""
		assert.Nil(t, info.IsValid())
	})

	t.Run("Non-empty Name must be a plain filename", func(t *testing.T) {
		originalName := info.Name
		defer func() { info.Name = originalName }()

		badNames := []string{
			".",
			"..",
			"../a.png",
			`..\..\a.png`,
			"foo/bar.png",
			`foo\bar.png`,
			"foo\x00.png",
		}
		for _, bad := range badNames {
			info.Name = bad
			assert.NotNilf(t, info.IsValid(), "expected %q to be rejected", bad)
		}
	})
}

func TestIsValidFilename(t *testing.T) {
	cases := []struct {
		name  string
		valid bool
	}{
		{"hello.png", true},
		{"hello world (1).png", true},
		{"日本語.txt", true},
		{"", false},
		{".", false},
		{"..", false},
		{"../a.png", false},
		{`..\..\a`, false},
		{"a/b", false},
		{`foo\bar.png`, false},
		{"a\x00b", false},
		{"foo\tbar.png", false},
		{"foo\rbar.png", false},
		// MaxFilenameLength matches the VARCHAR(256) column; longer inputs
		// that bypass SanitizeFilename's truncation must still fail here.
		{strings.Repeat("a", MaxFilenameLength+1), false},
		{strings.Repeat("a", MaxFilenameLength), true},
	}
	for _, tc := range cases {
		assert.Equalf(t, tc.valid, IsValidFilename(tc.name), "input %q", tc.name)
	}
}

func TestSanitizeFilename(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain name unchanged", "hello.png", "hello.png"},
		{"preserves spaces and parens", "hello world (1).png", "hello world (1).png"},
		{"reduces leading dotdot path to basename", "../../a.png", "a.png"},
		{"handles backslash separators", `..\..\a.exe`, "a.exe"},
		{"reduces nested path to basename", "a/b/c.png", "c.png"},
		{"strips null bytes", "foo\x00bar.png", "foobar.png"},
		{"strips control chars", "foo\tbar\x1f.png", "foobar.png"},
		{"rejects bare dotdot", "..", ""},
		{"rejects bare dot", ".", ""},
		{"rejects empty", "", ""},
		{"rejects root", "/", ""},
		{"rejects path ending in separator", "../", ""},
		{"truncates to max length by runes", strings.Repeat("a", MaxFilenameLength+50), strings.Repeat("a", MaxFilenameLength)},
		{"NFC-normalizes NFD input", "ガ.txt", "ガ.txt"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := SanitizeFilename(tc.in)
			assert.Equal(t, tc.want, got)
			if got != "" {
				// SanitizeFilename output must always satisfy IsValidFilename.
				assert.True(t, IsValidFilename(got), "sanitized output %q must be valid", got)
			}
		})
	}
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
