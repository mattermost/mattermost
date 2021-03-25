// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPasswordHash(t *testing.T) {
	hash := HashPassword("Test")

	assert.True(t, ComparePassword(hash, "Test"), "Passwords don't match")
	assert.False(t, ComparePassword(hash, "Test2"), "Passwords should not have matched")
}

func TestUserDeepCopy(t *testing.T) {
	id := NewId()
	authData := "authdata"
	mapKey := "key"
	mapValue := "key"

	user := &User{Id: id, AuthData: NewString(authData), Props: map[string]string{}, NotifyProps: map[string]string{}, Timezone: map[string]string{}}
	user.Props[mapKey] = mapValue
	user.NotifyProps[mapKey] = mapValue
	user.Timezone[mapKey] = mapValue

	copyUser := user.DeepCopy()
	copyUser.Id = "someid"
	*copyUser.AuthData = "changed"
	copyUser.Props[mapKey] = "changed"
	copyUser.NotifyProps[mapKey] = "changed"
	copyUser.Timezone[mapKey] = "changed"

	assert.Equal(t, id, user.Id)
	assert.Equal(t, authData, *user.AuthData)
	assert.Equal(t, mapValue, user.Props[mapKey])
	assert.Equal(t, mapValue, user.NotifyProps[mapKey])
	assert.Equal(t, mapValue, user.Timezone[mapKey])

	user = &User{Id: id}
	copyUser = user.DeepCopy()

	assert.Equal(t, id, copyUser.Id)
}

func TestUserJson(t *testing.T) {
	user := User{Id: NewId(), Username: NewId()}
	json := user.ToJson()
	ruser := UserFromJson(strings.NewReader(json))

	assert.Equal(t, user.Id, ruser.Id, "Ids do not match")
}

func TestUserPreSave(t *testing.T) {
	user := User{Password: "test"}
	user.PreSave()
	user.Etag(true, true)
	assert.NotNil(t, user.Timezone, "Timezone is nil")
	assert.Equal(t, user.Timezone["useAutomaticTimezone"], "true", "Timezone is not set to default")
}

func TestUserPreUpdate(t *testing.T) {
	user := User{Password: "test"}
	user.PreUpdate()
}

func TestUserUpdateMentionKeysFromUsername(t *testing.T) {
	user := User{Username: "user"}
	user.SetDefaultNotifications()
	assert.Equalf(t, user.NotifyProps["mention_keys"], "", "default mention keys are invalid: %v", user.NotifyProps["mention_keys"])

	user.Username = "person"
	user.UpdateMentionKeysFromUsername("user")
	assert.Equalf(t, user.NotifyProps["mention_keys"], "", "mention keys are invalid after changing username: %v", user.NotifyProps["mention_keys"])

	user.NotifyProps["mention_keys"] += ",mention"
	user.UpdateMentionKeysFromUsername("person")
	assert.Equalf(t, user.NotifyProps["mention_keys"], ",mention", "mention keys are invalid after adding extra mention keyword: %v", user.NotifyProps["mention_keys"])

	user.Username = "user"
	user.UpdateMentionKeysFromUsername("person")
	assert.Equalf(t, user.NotifyProps["mention_keys"], ",mention", "mention keys are invalid after changing username with extra mention keyword: %v", user.NotifyProps["mention_keys"])
}

func TestUserIsValid(t *testing.T) {
	user := User{}
	err := user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "id", ""), "expected user is valid error: %s", err.Error())

	user.Id = NewId()
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "create_at", user.Id), "expected user is valid error: %s", err.Error())

	user.CreateAt = GetMillis()
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "update_at", user.Id), "expected user is valid error: %s", err.Error())

	user.UpdateAt = GetMillis()
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "username", user.Id), "expected user is valid error: %s", err.Error())

	user.Username = NewId() + "^hello#"
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "username", user.Id), "expected user is valid error: %s", err.Error())

	user.Username = NewId()
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "email", user.Id), "expected user is valid error: %s", err.Error())

	user.Email = strings.Repeat("01234567890", 20)
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "email", user.Id), "expected user is valid error: %s", err.Error())

	user.Email = "user@example.com"

	user.Nickname = strings.Repeat("a", 65)
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "nickname", user.Id), "expected user is valid error: %s", err.Error())

	user.Nickname = strings.Repeat("a", 64)
	require.Nil(t, user.IsValid())

	user.FirstName = ""
	user.LastName = ""
	require.Nil(t, user.IsValid())

	user.FirstName = strings.Repeat("a", 65)
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "first_name", user.Id), "expected user is valid error: %s", err.Error())

	user.FirstName = strings.Repeat("a", 64)
	user.LastName = strings.Repeat("a", 65)
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "last_name", user.Id), "expected user is valid error: %s", err.Error())

	user.LastName = strings.Repeat("a", 64)
	user.Position = strings.Repeat("a", 128)
	require.Nil(t, user.IsValid())

	user.Position = strings.Repeat("a", 129)
	err = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(err, "position", user.Id), "expected user is valid error: %s", err.Error())
}

func HasExpectedUserIsValidError(err *AppError, fieldName string, userId string) bool {
	if err == nil {
		return false
	}

	return err.Where == "User.IsValid" &&
		err.Id == fmt.Sprintf("model.user.is_valid.%s.app_error", fieldName) &&
		err.StatusCode == http.StatusBadRequest &&
		(userId == "" || err.DetailedError == "user_id="+userId)
}

func TestUserGetFullName(t *testing.T) {
	user := User{}
	assert.Equal(t, user.GetFullName(), "", "Full name should be blank")

	user.FirstName = "first"
	assert.Equal(t, user.GetFullName(), "first", "Full name should be first name")

	user.FirstName = ""
	user.LastName = "last"
	assert.Equal(t, user.GetFullName(), "last", "Full name should be last name")

	user.FirstName = "first"
	assert.Equal(t, user.GetFullName(), "first last", "Full name should be first name and last name")
}

func TestUserGetDisplayName(t *testing.T) {
	user := User{Username: "username"}

	assert.Equal(t, user.GetDisplayName(SHOW_FULLNAME), "username", "Display name should be username")
	assert.Equal(t, user.GetDisplayName(SHOW_NICKNAME_FULLNAME), "username", "Display name should be username")
	assert.Equal(t, user.GetDisplayName(SHOW_USERNAME), "username", "Display name should be username")

	user.FirstName = "first"
	user.LastName = "last"

	assert.Equal(t, user.GetDisplayName(SHOW_FULLNAME), "first last", "Display name should be full name")
	assert.Equal(t, user.GetDisplayName(SHOW_NICKNAME_FULLNAME), "first last", "Display name should be full name since there is no nickname")
	assert.Equal(t, user.GetDisplayName(SHOW_USERNAME), "username", "Display name should be username")

	user.Nickname = "nickname"
	assert.Equal(t, user.GetDisplayName(SHOW_NICKNAME_FULLNAME), "nickname", "Display name should be nickname")
}

func TestUserGetDisplayNameWithPrefix(t *testing.T) {
	user := User{Username: "username"}

	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_FULLNAME, "@"), "@username", "Display name should be username")
	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_NICKNAME_FULLNAME, "@"), "@username", "Display name should be username")
	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_USERNAME, "@"), "@username", "Display name should be username")

	user.FirstName = "first"
	user.LastName = "last"

	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_FULLNAME, "@"), "first last", "Display name should be full name")
	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_NICKNAME_FULLNAME, "@"), "first last", "Display name should be full name since there is no nickname")
	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_USERNAME, "@"), "@username", "Display name should be username")

	user.Nickname = "nickname"
	assert.Equal(t, user.GetDisplayNameWithPrefix(SHOW_NICKNAME_FULLNAME, "@"), "nickname", "Display name should be nickname")
}

var usernames = []struct {
	value    string
	expected bool
}{
	{"spin-punch", true},
	{"sp", true},
	{"s", true},
	{"1spin-punch", true},
	{"-spin-punch", true},
	{".spin-punch", true},
	{"Spin-punch", false},
	{"spin punch-", false},
	{"spin_punch", true},
	{"spin", true},
	{"PUNCH", false},
	{"spin.punch", true},
	{"spin'punch", false},
	{"spin*punch", false},
	{"all", false},
	{"system", false},
}

func TestValidUsername(t *testing.T) {
	for _, v := range usernames {
		if IsValidUsername(v.value) != v.expected {
			t.Errorf("expect %v as %v", v.value, v.expected)
		}
	}
}

func TestNormalizeUsername(t *testing.T) {
	assert.Equal(t, NormalizeUsername("Spin-punch"), "spin-punch", "didn't normalize username properly")
	assert.Equal(t, NormalizeUsername("PUNCH"), "punch", "didn't normalize username properly")
	assert.Equal(t, NormalizeUsername("spin"), "spin", "didn't normalize username properly")
}

func TestNormalizeEmail(t *testing.T) {
	assert.Equal(t, NormalizeEmail("TEST@EXAMPLE.COM"), "test@example.com", "didn't normalize email properly")
	assert.Equal(t, NormalizeEmail("TEST2@example.com"), "test2@example.com", "didn't normalize email properly")
	assert.Equal(t, NormalizeEmail("test3@example.com"), "test3@example.com", "didn't normalize email properly")
}

func TestCleanUsername(t *testing.T) {
	assert.Equal(t, CleanUsername("Spin-punch"), "spin-punch", "didn't clean name properly")
	assert.Equal(t, CleanUsername("PUNCH"), "punch", "didn't clean name properly")
	assert.Equal(t, CleanUsername("spin'punch"), "spin-punch", "didn't clean name properly")
	assert.Equal(t, CleanUsername("spin"), "spin", "didn't clean name properly")
	assert.Equal(t, len(CleanUsername("all")), 27, "didn't clean name properly")
}

func TestRoles(t *testing.T) {
	require.True(t, IsValidUserRoles("team_user"))
	require.False(t, IsValidUserRoles("system_admin"))
	require.True(t, IsValidUserRoles("system_user system_admin"))
	require.False(t, IsInRole("system_admin junk", "admin"))
	require.True(t, IsInRole("system_admin junk", "system_admin"))
	require.False(t, IsInRole("admin", "system_admin"))
}

func TestIsValidLocale(t *testing.T) {
	for _, test := range []struct {
		Name     string
		Locale   string
		Expected bool
	}{
		{
			Name:     "empty locale",
			Locale:   "",
			Expected: true,
		},
		{
			Name:     "locale with only language",
			Locale:   "fr",
			Expected: true,
		},
		{
			Name:     "locale with region",
			Locale:   "en-DE", // English, as used in Germany
			Expected: true,
		},
		{
			Name:     "invalid locale",
			Locale:   "'",
			Expected: false,
		},

		// Note that the following cases are all valid language tags, but they're considered invalid here because of
		// the max length of the User.Locale field.
		{
			Name:     "locale with extended language subtag",
			Locale:   "zh-yue-HK", // Chinese, Cantonese, as used in Hong Kong
			Expected: false,
		},
		{
			Name:     "locale with script",
			Locale:   "hy-Latn-IT-arevela", // Eastern Armenian written in Latin script, as used in Italy
			Expected: false,
		},
		{
			Name:     "locale with variant",
			Locale:   "sl-rozaj-biske", // San Giorgio dialect of Resian dialect of Slovenian
			Expected: false,
		},
		{
			Name:     "locale with extension",
			Locale:   "de-DE-u-co-phonebk", // German, as used in Germany, using German phonebook sort order
			Expected: false,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, test.Expected, IsValidLocale(test.Locale))
		})
	}
}

func TestUserSlice(t *testing.T) {
	t.Run("FilterByActive", func(t *testing.T) {
		user0 := &User{Id: "user0", DeleteAt: 0, IsBot: true}
		user1 := &User{Id: "user1", DeleteAt: 0, IsBot: true}
		user2 := &User{Id: "user2", DeleteAt: 1, IsBot: false}

		slice := UserSlice([]*User{user0, user1, user2})

		activeUsers := slice.FilterByActive(true)
		assert.Equal(t, 2, len(activeUsers))
		for _, user := range activeUsers {
			assert.True(t, user.DeleteAt == 0)
		}

		inactiveUsers := slice.FilterByActive(false)
		assert.Equal(t, 1, len(inactiveUsers))
		for _, user := range inactiveUsers {
			assert.True(t, user.DeleteAt != 0)
		}

		nonBotUsers := slice.FilterWithoutBots()
		assert.Equal(t, 1, len(nonBotUsers))
	})
}
