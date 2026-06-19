// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFileInfoPageOwner(t *testing.T) {
	base := func() *FileInfo {
		return &FileInfo{
			Id:        NewId(),
			CreatorId: NewId(),
			CreateAt:  GetMillis(),
			UpdateAt:  GetMillis(),
			Path:      "/path/to/file",
		}
	}

	t.Run("page-owned file is valid", func(t *testing.T) {
		fi := base()
		fi.PageId = NewId()
		require.Nil(t, fi.IsValid())
	})

	t.Run("post-owned file is valid", func(t *testing.T) {
		fi := base()
		fi.PostId = NewId()
		require.Nil(t, fi.IsValid())
	})

	t.Run("unowned (both empty) file is valid — transient upload window", func(t *testing.T) {
		fi := base()
		require.Nil(t, fi.IsValid())
	})

	t.Run("both owners set is invalid", func(t *testing.T) {
		fi := base()
		fi.PostId = NewId()
		fi.PageId = NewId()
		require.NotNil(t, fi.IsValid(), "a file cannot belong to both a post and a page")
	})

	t.Run("malformed page id is invalid", func(t *testing.T) {
		fi := base()
		fi.PageId = "not-an-id"
		require.NotNil(t, fi.IsValid())
	})
}
