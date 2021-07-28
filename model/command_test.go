// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCommandIsValid(t *testing.T) {
	o := Command{
		Id:          NewId(),
		Token:       NewId(),
		CreateAt:    GetMillis(),
		UpdateAt:    GetMillis(),
		CreatorId:   NewId(),
		TeamId:      NewId(),
		Trigger:     "trigger",
		URL:         "http://example.com",
		Method:      CommandMethodGet,
		DisplayName: "",
		Description: "",
	}

	require.Nil(t, o.IsValid())

	o.Id = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Id = NewId()
	require.Nil(t, o.IsValid())

	o.Token = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Token = NewId()
	require.Nil(t, o.IsValid())

	o.CreateAt = 0
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.CreateAt = GetMillis()
	require.Nil(t, o.IsValid())

	o.UpdateAt = 0
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.UpdateAt = GetMillis()
	require.Nil(t, o.IsValid())

	o.CreatorId = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.CreatorId = NewId()
	require.Nil(t, o.IsValid())

	o.TeamId = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.TeamId = NewId()
	require.Nil(t, o.IsValid())

	o.Trigger = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Trigger = strings.Repeat("1", 129)
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Trigger = strings.Repeat("1", 128)
	require.Nil(t, o.IsValid())

	o.URL = ""
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.URL = "1234"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.URL = "https:////example.com"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.URL = "https://example.com"
	require.Nil(t, o.IsValid())

	o.Method = "https://example.com"
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Method = CommandMethodGet
	require.Nil(t, o.IsValid())

	o.Method = CommandMethodPost
	require.Nil(t, o.IsValid())

	o.DisplayName = strings.Repeat("1", 65)
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.DisplayName = strings.Repeat("1", 64)
	require.Nil(t, o.IsValid())

	o.Description = strings.Repeat("1", 129)
	require.NotNil(t, o.IsValid(), "should be invalid")

	o.Description = strings.Repeat("1", 128)
	require.Nil(t, o.IsValid())
}

func TestCommandPreSave(t *testing.T) {
	o := Command{}
	o.PreSave()
}

func TestCommandPreUpdate(t *testing.T) {
	o := Command{}
	o.PreUpdate()
}
