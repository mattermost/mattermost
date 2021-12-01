// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEmojiIsValid(t *testing.T) {
	emoji := Emoji{
		Id:        NewId(),
		CreateAt:  1234,
		UpdateAt:  1234,
		DeleteAt:  0,
		CreatorId: NewId(),
		Name:      "name",
	}

	require.Nil(t, emoji.IsValid())

	emoji.Id = "1234"
	require.NotNil(t, emoji.IsValid())

	emoji.Id = NewId()
	emoji.CreateAt = 0
	require.NotNil(t, emoji.IsValid())

	emoji.CreateAt = 1234
	emoji.UpdateAt = 0
	require.NotNil(t, emoji.IsValid())

	emoji.UpdateAt = 1234
	emoji.CreatorId = strings.Repeat("1", 27)
	require.NotNil(t, emoji.IsValid())

	emoji.CreatorId = NewId()
	emoji.Name = strings.Repeat("1", 65)
	require.NotNil(t, emoji.IsValid())

	emoji.Name = ""
	require.NotNil(t, emoji.IsValid())

	emoji.Name = strings.Repeat("1", 64)
	require.Nil(t, emoji.IsValid())

	emoji.Name = "name-"
	require.Nil(t, emoji.IsValid())

	emoji.Name = "name+"
	require.Nil(t, emoji.IsValid())

	emoji.Name = "name_"
	require.Nil(t, emoji.IsValid())

	emoji.Name = "name:"
	require.NotNil(t, emoji.IsValid())

	emoji.Name = "croissant"
	require.NotNil(t, emoji.IsValid())
}
