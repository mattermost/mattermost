// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelJson(t *testing.T) {
	o := Channel{Id: NewId(), Name: NewId()}
	json := o.ToJson()
	ro := ChannelFromJson(strings.NewReader(json))

	require.Equal(t, o.Id, ro.Id, "Ids do not match")

	p := ChannelPatch{Name: new(string)}
	*p.Name = NewId()
	json = p.ToJson()
	rp := ChannelPatchFromJson(strings.NewReader(json))

	require.Equal(t, *p.Name, *rp.Name, "names do not match")
}

func TestChannelCopy(t *testing.T) {
	o := Channel{Id: NewId(), Name: NewId()}
	ro := o.DeepCopy()

	require.Equal(t, o.Id, ro.Id, "Ids do not match")
}

func TestChannelPatch(t *testing.T) {
	p := &ChannelPatch{Name: new(string), DisplayName: new(string), Header: new(string), Purpose: new(string), GroupConstrained: new(bool)}
	*p.Name = NewId()
	*p.DisplayName = NewId()
	*p.Header = NewId()
	*p.Purpose = NewId()
	*p.GroupConstrained = true

	o := Channel{Id: NewId(), Name: NewId()}
	o.Patch(p)

	require.Equal(t, *p.Name, o.Name, "do not match")

	require.Equal(t, *p.DisplayName, o.DisplayName, "do not match")

	require.Equal(t, *p.Header, o.Header, "do not match")

	require.Equal(t, *p.Purpose, o.Purpose, "do not match")

	require.Equalf(t, *p.GroupConstrained, *o.GroupConstrained, "expected %v got %v", *p.GroupConstrained,
		*o.GroupConstrained)

}

func TestChannelIsValid(t *testing.T) {
	o := Channel{}

	require.Error(t, o.IsValid(), "should be invalid")

	o.Id = NewId()
	require.Error(t, o.IsValid(), "should be invalid")

	o.CreateAt = GetMillis()
	require.Error(t, o.IsValid(), "should be invalid")

	o.UpdateAt = GetMillis()
	require.Error(t, o.IsValid(), "should be invalid")

	o.DisplayName = strings.Repeat("01234567890", 20)
	require.Error(t, o.IsValid(), "should be invalid")

	o.DisplayName = "1234"
	o.Name = "ZZZZZZZ"
	require.Error(t, o.IsValid(), "should be invalid")

	o.Name = "zzzzz"
	require.Error(t, o.IsValid(), "should be invalid")

	o.Type = "U"
	require.Error(t, o.IsValid(), "should be invalid")

	o.Type = "P"
	require.Error(t, o.IsValid(), "should be invalid")

	o.Header = strings.Repeat("01234567890", 100)
	require.Error(t, o.IsValid(), "should be invalid")

	o.Header = "1234"
	require.Equal(t, (*AppError)(nil), o.IsValid())

	o.Purpose = strings.Repeat("01234567890", 30)
	require.Error(t, o.IsValid(), "should be invalid")

	o.Purpose = "1234"
	require.Equal(t, (*AppError)(nil), o.IsValid())

	o.Purpose = strings.Repeat("0123456789", 25)
	require.Equal(t, (*AppError)(nil), o.IsValid())
}

func TestChannelPreSave(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreSave()
	o.Etag()
}

func TestChannelPreUpdate(t *testing.T) {
	o := Channel{Name: "test"}
	o.PreUpdate()
}

func TestGetGroupDisplayNameFromUsers(t *testing.T) {
	users := make([]*User, 4)
	users[0] = &User{Username: NewId()}
	users[1] = &User{Username: NewId()}
	users[2] = &User{Username: NewId()}
	users[3] = &User{Username: NewId()}

	name := GetGroupDisplayNameFromUsers(users, true)
	require.LessOrEqual(t, len(name), CHANNEL_NAME_MAX_LENGTH, "name too long")
}

func TestGetGroupNameFromUserIds(t *testing.T) {
	name := GetGroupNameFromUserIds([]string{NewId(), NewId(), NewId(), NewId(), NewId()})

	require.LessOrEqual(t, len(name), CHANNEL_NAME_MAX_LENGTH, "name too long")
}
