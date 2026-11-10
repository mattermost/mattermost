// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"encoding/xml"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSharedChannelIsValid(t *testing.T) {
	id := NewId()
	now := GetMillis()
	data := []struct {
		name  string
		sc    *SharedChannel
		valid bool
	}{
		{name: "Zero value", sc: &SharedChannel{}, valid: false},
		{name: "Missing team_id", sc: &SharedChannel{ChannelId: id}, valid: false},
		{name: "Missing create_at", sc: &SharedChannel{ChannelId: id, TeamId: id}, valid: false},
		{name: "Missing update_at", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now}, valid: false},
		{name: "Missing share_name", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now}, valid: false},
		{name: "Invalid share_name", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "@test@"}, valid: false},
		{name: "Too long share_name", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: strings.Repeat("01234567890", 100)}, valid: false},
		{name: "Missing creator_id", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "test"}, valid: false},
		{name: "Missing remote_id", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "test", CreatorId: id}, valid: false},
		{name: "Valid shared channel", sc: &SharedChannel{ChannelId: id, TeamId: id, CreateAt: now, UpdateAt: now,
			ShareName: "test", CreatorId: id, RemoteId: id}, valid: true},
	}

	for _, item := range data {
		appErr := item.sc.IsValid()
		if item.valid {
			assert.Nil(t, appErr, item.name)
		} else {
			assert.NotNil(t, appErr, item.name)
		}
	}
}

func TestSharedChannelPreSave(t *testing.T) {
	now := GetMillis()

	o := SharedChannel{ChannelId: NewId(), ShareName: "test"}
	o.PreSave()

	require.GreaterOrEqual(t, o.CreateAt, now)
	require.GreaterOrEqual(t, o.UpdateAt, now)
}

func TestSharedChannelPreUpdate(t *testing.T) {
	now := GetMillis()

	o := SharedChannel{ChannelId: NewId(), ShareName: "test"}
	o.PreUpdate()

	require.GreaterOrEqual(t, o.UpdateAt, now)
}

func TestSyncMsgXMLRoundTrip(t *testing.T) {
	remoteID := NewId()
	msg := &SyncMsg{
		Id:        NewId(),
		ChannelId: NewId(),
		Users: map[string]*User{
			"user1": {
				Id:       NewId(),
				Username: "testuser1",
				Email:    "test1@example.com",
				Props:    StringMap{"key1": "val1"},
				Timezone: StringMap{"useAutomaticTimezone": "true"},
			},
			"user2": {
				Id:       NewId(),
				Username: "testuser2",
				Email:    "test2@example.com",
			},
		},
		Posts: []*Post{
			{
				Id:        NewId(),
				ChannelId: NewId(),
				UserId:    NewId(),
				Message:   "hello world",
				Props:     StringInterface{"from_webhook": "true", "count": float64(42)},
				RemoteId:  &remoteID,
			},
		},
		Reactions: []*Reaction{
			{
				UserId:    NewId(),
				PostId:    NewId(),
				EmojiName: "thumbsup",
				CreateAt:  1000,
			},
		},
		Statuses: []*Status{
			{
				UserId: NewId(),
				Status: StatusOnline,
			},
		},
		MembershipChanges: []*MembershipChangeMsg{
			{
				ChannelId:  NewId(),
				UserId:     NewId(),
				IsAdd:      true,
				RemoteId:   NewId(),
				ChangeTime: 2000,
			},
		},
		Acknowledgements: []*PostAcknowledgement{
			{
				UserId:         NewId(),
				PostId:         NewId(),
				AcknowledgedAt: 3000,
				ChannelId:      NewId(),
			},
		},
		MentionTransforms: map[string]string{
			"@olduser": "@newuser",
			"@admin":   "@remote_admin",
		},
	}

	data, err := xml.MarshalIndent(msg, "", "  ")
	require.NoError(t, err)

	var decoded SyncMsg
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, msg.Id, decoded.Id)
	assert.Equal(t, msg.ChannelId, decoded.ChannelId)
	assert.Len(t, decoded.Users, 2)
	assert.Equal(t, msg.Users["user1"].Username, decoded.Users["user1"].Username)
	assert.Equal(t, msg.Users["user2"].Username, decoded.Users["user2"].Username)
	assert.Len(t, decoded.Posts, 1)
	assert.Equal(t, msg.Posts[0].Message, decoded.Posts[0].Message)
	assert.Len(t, decoded.Reactions, 1)
	assert.Equal(t, msg.Reactions[0].EmojiName, decoded.Reactions[0].EmojiName)
	assert.Len(t, decoded.Statuses, 1)
	assert.Equal(t, msg.Statuses[0].Status, decoded.Statuses[0].Status)
	assert.Len(t, decoded.MembershipChanges, 1)
	assert.Equal(t, msg.MembershipChanges[0].IsAdd, decoded.MembershipChanges[0].IsAdd)
	assert.Len(t, decoded.Acknowledgements, 1)
	assert.Equal(t, msg.Acknowledgements[0].AcknowledgedAt, decoded.Acknowledgements[0].AcknowledgedAt)
	assert.Equal(t, msg.MentionTransforms, decoded.MentionTransforms)
}

func TestSyncMsgXMLUsersMap(t *testing.T) {
	msg := &SyncMsg{
		Id: NewId(),
		Users: map[string]*User{
			"alpha": {Id: "id-alpha", Username: "alpha"},
			"beta":  {Id: "id-beta", Username: "beta"},
			"gamma": {Id: "id-gamma", Username: "gamma"},
		},
	}

	data, err := xml.Marshal(msg)
	require.NoError(t, err)

	var decoded SyncMsg
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	require.Len(t, decoded.Users, 3)
	assert.Equal(t, "alpha", decoded.Users["alpha"].Username)
	assert.Equal(t, "beta", decoded.Users["beta"].Username)
	assert.Equal(t, "gamma", decoded.Users["gamma"].Username)
}

func TestSyncMsgXMLMentionTransforms(t *testing.T) {
	msg := &SyncMsg{
		Id: NewId(),
		MentionTransforms: map[string]string{
			"@user1": "@remote_user1",
			"@user2": "@remote_user2",
		},
	}

	data, err := xml.Marshal(msg)
	require.NoError(t, err)

	var decoded SyncMsg
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, msg.MentionTransforms, decoded.MentionTransforms)
}

func TestSyncMsgXMLEmptyMaps(t *testing.T) {
	msg := &SyncMsg{
		Id:        NewId(),
		ChannelId: NewId(),
	}

	data, err := xml.Marshal(msg)
	require.NoError(t, err)

	var decoded SyncMsg
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, msg.Id, decoded.Id)
	assert.Equal(t, msg.ChannelId, decoded.ChannelId)
	assert.Nil(t, decoded.Users)
	assert.Nil(t, decoded.MentionTransforms)
}

func TestPostXMLRoundTrip(t *testing.T) {
	remoteID := NewId()
	post := &Post{
		Id:        NewId(),
		CreateAt:  1000,
		UpdateAt:  2000,
		UserId:    NewId(),
		ChannelId: NewId(),
		Message:   "test message with <xml> special & chars",
		Props: StringInterface{
			"from_webhook": "true",
			"count":        float64(42),
			"nested":       map[string]any{"a": float64(1), "b": "two"},
		},
		FileIds:  StringArray{"file1", "file2"},
		RemoteId: &remoteID,
		Metadata: &PostMetadata{}, // should be excluded from XML
	}

	data, err := xml.MarshalIndent(post, "", "  ")
	require.NoError(t, err)

	var decoded Post
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, post.Id, decoded.Id)
	assert.Equal(t, post.Message, decoded.Message)
	assert.Equal(t, post.CreateAt, decoded.CreateAt)
	assert.Equal(t, "true", decoded.Props["from_webhook"])
	assert.Equal(t, float64(42), decoded.Props["count"])
	assert.Equal(t, post.FileIds, decoded.FileIds)
	assert.Equal(t, *post.RemoteId, *decoded.RemoteId)
	assert.Nil(t, decoded.Metadata, "Metadata should be excluded from XML")
}

func TestUserXMLRoundTrip(t *testing.T) {
	remoteID := NewId()
	user := &User{
		Id:          NewId(),
		Username:    "testuser",
		Email:       "test@example.com",
		FirstName:   "Test",
		LastName:    "User",
		Props:       StringMap{"customkey": "customval"},
		NotifyProps: StringMap{"push": "all", "desktop": "mention"},
		Timezone:    StringMap{"useAutomaticTimezone": "true", "manualTimezone": "America/New_York"},
		RemoteId:    &remoteID,
	}

	data, err := xml.MarshalIndent(user, "", "  ")
	require.NoError(t, err)

	var decoded User
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, user.Id, decoded.Id)
	assert.Equal(t, user.Username, decoded.Username)
	assert.Equal(t, user.Email, decoded.Email)
	assert.Equal(t, user.Props, decoded.Props)
	assert.Equal(t, user.NotifyProps, decoded.NotifyProps)
	assert.Equal(t, user.Timezone, decoded.Timezone)
	assert.Equal(t, *user.RemoteId, *decoded.RemoteId)
}

func TestReactionXMLRoundTrip(t *testing.T) {
	remoteID := NewId()
	reaction := &Reaction{
		UserId:    NewId(),
		PostId:    NewId(),
		EmojiName: "thumbsup",
		CreateAt:  1000,
		UpdateAt:  2000,
		RemoteId:  &remoteID,
		ChannelId: NewId(),
	}

	data, err := xml.Marshal(reaction)
	require.NoError(t, err)

	var decoded Reaction
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, reaction.UserId, decoded.UserId)
	assert.Equal(t, reaction.PostId, decoded.PostId)
	assert.Equal(t, reaction.EmojiName, decoded.EmojiName)
	assert.Equal(t, reaction.CreateAt, decoded.CreateAt)
	assert.Equal(t, *reaction.RemoteId, *decoded.RemoteId)
}

func TestStatusXMLRoundTrip(t *testing.T) {
	status := &Status{
		UserId:         NewId(),
		Status:         StatusOnline,
		Manual:         true,
		LastActivityAt: 5000,
		DNDEndTime:     6000,
		PrevStatus:     StatusAway, // should be excluded
	}

	data, err := xml.Marshal(status)
	require.NoError(t, err)

	var decoded Status
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, status.UserId, decoded.UserId)
	assert.Equal(t, status.Status, decoded.Status)
	assert.Equal(t, status.Manual, decoded.Manual)
	assert.Equal(t, status.DNDEndTime, decoded.DNDEndTime)
	assert.Empty(t, decoded.PrevStatus, "PrevStatus should be excluded from XML")
}

func TestPostAcknowledgementXMLRoundTrip(t *testing.T) {
	remoteID := NewId()
	ack := &PostAcknowledgement{
		UserId:         NewId(),
		PostId:         NewId(),
		AcknowledgedAt: 3000,
		ChannelId:      NewId(),
		RemoteId:       &remoteID,
	}

	data, err := xml.Marshal(ack)
	require.NoError(t, err)

	var decoded PostAcknowledgement
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, ack.UserId, decoded.UserId)
	assert.Equal(t, ack.PostId, decoded.PostId)
	assert.Equal(t, ack.AcknowledgedAt, decoded.AcknowledgedAt)
	assert.Equal(t, ack.ChannelId, decoded.ChannelId)
	assert.Equal(t, *ack.RemoteId, *decoded.RemoteId)
}

func TestFileInfoXMLRoundTrip(t *testing.T) {
	remoteID := NewId()
	fi := &FileInfo{
		Id:            NewId(),
		CreatorId:     NewId(),
		PostId:        NewId(),
		ChannelId:     NewId(),
		CreateAt:      1000,
		UpdateAt:      2000,
		Name:          "test.txt",
		Extension:     "txt",
		Size:          1024,
		MimeType:      "text/plain",
		RemoteId:      &remoteID,
		Path:          "/data/test.txt",
		ThumbnailPath: "/data/test_thumb.txt",
		PreviewPath:   "/data/test_preview.txt",
		Content:       "file content for search",
	}

	data, err := xml.Marshal(fi)
	require.NoError(t, err)

	var decoded FileInfo
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, fi.Id, decoded.Id)
	assert.Equal(t, fi.CreatorId, decoded.CreatorId)
	assert.Equal(t, fi.Name, decoded.Name)
	assert.Equal(t, fi.Size, decoded.Size)
	assert.Equal(t, *fi.RemoteId, *decoded.RemoteId)
	assert.Empty(t, decoded.Path, "Path should be excluded from XML")
	assert.Empty(t, decoded.ThumbnailPath, "ThumbnailPath should be excluded from XML")
	assert.Empty(t, decoded.PreviewPath, "PreviewPath should be excluded from XML")
	assert.Empty(t, decoded.Content, "Content should be excluded from XML")
}

func TestStringMapXMLRoundTrip(t *testing.T) {
	m := StringMap{
		"key1":  "value1",
		"key2":  "value2",
		"empty": "",
	}

	data, err := xml.Marshal(m)
	require.NoError(t, err)

	var decoded StringMap
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, m, decoded)
}

func TestStringInterfaceXMLRoundTrip(t *testing.T) {
	m := StringInterface{
		"string_val": "hello",
		"number_val": float64(42),
		"bool_val":   true,
		"null_val":   nil,
		"nested":     map[string]any{"a": float64(1), "b": "two"},
	}

	data, err := xml.Marshal(m)
	require.NoError(t, err)

	var decoded StringInterface
	err = xml.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "hello", decoded["string_val"])
	assert.Equal(t, float64(42), decoded["number_val"])
	assert.Equal(t, true, decoded["bool_val"])
	assert.Nil(t, decoded["null_val"])
	nested, ok := decoded["nested"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, float64(1), nested["a"])
	assert.Equal(t, "two", nested["b"])
}

func TestXMLDoesNotAffectJSON(t *testing.T) {
	remoteID := NewId()

	t.Run("SyncMsg", func(t *testing.T) {
		msg := &SyncMsg{
			Id:        NewId(),
			ChannelId: NewId(),
			Users: map[string]*User{
				"u1": {Id: NewId(), Username: "u1"},
			},
			Posts:             []*Post{{Id: NewId(), Message: "test"}},
			MentionTransforms: map[string]string{"@a": "@b"},
		}
		data, err := json.Marshal(msg)
		require.NoError(t, err)

		var decoded SyncMsg
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)
		assert.Equal(t, msg.Id, decoded.Id)
		assert.Equal(t, msg.Users["u1"].Username, decoded.Users["u1"].Username)
		assert.Equal(t, msg.MentionTransforms, decoded.MentionTransforms)
	})

	t.Run("Post", func(t *testing.T) {
		post := &Post{
			Id:       NewId(),
			Message:  "test",
			Props:    StringInterface{"key": "val"},
			RemoteId: &remoteID,
			Metadata: &PostMetadata{},
		}
		data, err := json.Marshal(post)
		require.NoError(t, err)

		var decoded Post
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)
		assert.Equal(t, post.Id, decoded.Id)
		assert.Equal(t, post.Props["key"], decoded.Props["key"])
		assert.NotNil(t, decoded.Metadata, "Metadata should be present in JSON")
	})

	t.Run("User", func(t *testing.T) {
		user := &User{
			Id:       NewId(),
			Username: "test",
			Props:    StringMap{"k": "v"},
			Timezone: StringMap{"tz": "utc"},
		}
		data, err := json.Marshal(user)
		require.NoError(t, err)

		var decoded User
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)
		assert.Equal(t, user.Id, decoded.Id)
		assert.Equal(t, user.Props, decoded.Props)
		assert.Equal(t, user.Timezone, decoded.Timezone)
	})

	t.Run("SyncResponse", func(t *testing.T) {
		sr := &SyncResponse{
			UsersLastUpdateAt: 1000,
			UserErrors:        []string{"err1"},
			PostsLastUpdateAt: 2000,
		}
		data, err := json.Marshal(sr)
		require.NoError(t, err)

		var decoded SyncResponse
		err = json.Unmarshal(data, &decoded)
		require.NoError(t, err)
		assert.Equal(t, sr.UsersLastUpdateAt, decoded.UsersLastUpdateAt)
		assert.Equal(t, sr.UserErrors, decoded.UserErrors)
	})
}
