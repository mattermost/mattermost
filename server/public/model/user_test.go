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
	"golang.org/x/crypto/bcrypt"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/timezones"
)

func TestUserAuditable(t *testing.T) {
	t.Run("zero value", func(t *testing.T) {
		var u User
		m := u.Auditable()
		require.NotNil(t, m)
		assert.Equal(t, "", m["remote_id"])
	})

	t.Run("values set", func(t *testing.T) {
		id := NewId()
		now := GetMillis()
		u := User{
			Id:             id,
			CreateAt:       now,
			UpdateAt:       now,
			DeleteAt:       now,
			Username:       "some user_name",
			Password:       "some password",
			AuthData:       NewPointer("some_auth_data"),
			AuthService:    UserAuthServiceLdap,
			Email:          "test@example.org",
			EmailVerified:  true,
			Position:       "some position",
			Roles:          strings.Join([]string{ChannelAdminRoleId, SystemManagerRoleId}, ","),
			AllowMarketing: true,
			Props: StringMap{
				"foo": "bar",
			},
			NotifyProps: StringMap{
				"bar": "foo",
			},
			Locale:    DefaultLocale,
			Timezone:  timezones.DefaultUserTimezone(),
			MfaActive: true,
			RemoteId:  NewPointer("some_remote"),
		}
		m := u.Auditable()

		expected := map[string]any{
			"id":              id,
			"create_at":       now,
			"update_at":       now,
			"delete_at":       now,
			"username":        "some user_name",
			"auth_service":    "ldap",
			"email":           "test@example.org",
			"email_verified":  true,
			"position":        "some position",
			"roles":           "channel_admin,system_manager",
			"allow_marketing": true,
			"props": StringMap{
				"foo": "bar",
			},
			"notify_props": StringMap{
				"bar": "foo",
			},
			"last_password_update":       int64(0),
			"last_picture_update":        int64(0),
			"failed_attempts":            0,
			"locale":                     "en",
			"timezone":                   StringMap(timezones.DefaultUserTimezone()),
			"mfa_active":                 true,
			"remote_id":                  "some_remote",
			"last_activity_at":           int64(0),
			"is_bot":                     false,
			"bot_description":            "",
			"bot_last_icon_update":       int64(0),
			"terms_of_service_id":        "",
			"terms_of_service_create_at": int64(0),
			"disable_welcome_email":      false,
		}

		assert.Equal(t, expected, m)
	})
}

func TestUserLogClone(t *testing.T) {
	t.Run("zero value", func(t *testing.T) {
		var u User
		l := u.LogClone()
		require.NotNil(t, l)

		m, ok := l.(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "", m["remote_id"])
	})

	t.Run("values set", func(t *testing.T) {
		id := NewId()
		now := GetMillis()

		u := User{
			Id:             id,
			CreateAt:       now,
			UpdateAt:       now,
			DeleteAt:       now,
			Username:       "some user_name",
			Password:       "some password",
			AuthData:       NewPointer("some_auth_data"),
			AuthService:    UserAuthServiceLdap,
			Email:          "test@example.org",
			EmailVerified:  true,
			Position:       "some position",
			Roles:          strings.Join([]string{ChannelAdminRoleId, SystemManagerRoleId}, ","),
			AllowMarketing: true,
			Props: StringMap{
				"foo": "bar",
			},
			NotifyProps: StringMap{
				"bar": "foo",
			},
			Locale:    DefaultLocale,
			Timezone:  timezones.DefaultUserTimezone(),
			MfaActive: true,
			RemoteId:  NewPointer("some_remote"),
		}

		l := u.LogClone()
		m, ok := l.(map[string]interface{})
		require.True(t, ok)

		expected := map[string]any{
			"id":              id,
			"create_at":       now,
			"update_at":       now,
			"delete_at":       now,
			"username":        "some user_name",
			"auth_data":       "some_auth_data",
			"auth_service":    "ldap",
			"email":           "test@example.org",
			"email_verified":  true,
			"position":        "some position",
			"roles":           "channel_admin,system_manager",
			"allow_marketing": true,
			"props": StringMap{
				"foo": "bar",
			},
			"notify_props": StringMap{
				"bar": "foo",
			},
			"locale":     "en",
			"timezone":   StringMap(timezones.DefaultUserTimezone()),
			"mfa_active": true,
			"remote_id":  "some_remote",
		}

		assert.Equal(t, expected, m)
	})
}

func TestUserDeepCopy(t *testing.T) {
	id := NewId()
	authData := "authdata"
	mapKey := "key"
	mapValue := "key"

	user := &User{Id: id, AuthData: NewPointer(authData), Props: map[string]string{}, NotifyProps: map[string]string{}, Timezone: map[string]string{}}
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

func TestUserPreSave(t *testing.T) {
	user := User{Password: "test"}
	err := user.PreSave()
	require.Nil(t, err)
	user.Etag(true, true)
	assert.NotNil(t, user.Timezone, "Timezone is nil")
	assert.Equal(t, user.Timezone["useAutomaticTimezone"], "true", "Timezone is not set to default")

	// Set default user with notify props
	userWithDefaultNotifyProps := User{}
	userWithDefaultNotifyProps.SetDefaultNotifications()

	for notifyPropKey, expectedNotifyPropValue := range userWithDefaultNotifyProps.NotifyProps {
		actualNotifyPropValue, ok := user.NotifyProps[notifyPropKey]

		assert.True(t, ok, "Notify prop %s is not set", notifyPropKey)
		assert.Equal(t, expectedNotifyPropValue, actualNotifyPropValue, "Notify prop %s is not set to default", notifyPropKey)
	}
}

func TestUserPreSavePwdTooLong(t *testing.T) {
	user := User{Password: strings.Repeat("1234567890", 8)}
	err := user.PreSave()
	assert.ErrorIs(t, err, bcrypt.ErrPasswordTooLong)
}

func TestUserPreUpdate(t *testing.T) {
	user := User{Password: "test"}
	user.PreUpdate()

	// Set default user with notify props
	userWithDefaultNotifyProps := User{}
	userWithDefaultNotifyProps.SetDefaultNotifications()

	for notifyPropKey, expectedNotifyPropValue := range userWithDefaultNotifyProps.NotifyProps {
		actualNotifyPropValue, ok := user.NotifyProps[notifyPropKey]

		assert.True(t, ok, "Notify prop %s is not set", notifyPropKey)
		assert.Equal(t, expectedNotifyPropValue, actualNotifyPropValue, "Notify prop %s is not set to default", notifyPropKey)
	}
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
	appErr := user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "id", "", user.Id), "expected user is valid error: %s", appErr.Error())

	user.Id = NewId()
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "create_at", user.Id, user.CreateAt), "expected user is valid error: %s", appErr.Error())

	user.CreateAt = GetMillis()
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "update_at", user.Id, user.UpdateAt), "expected user is valid error: %s", appErr.Error())

	user.UpdateAt = GetMillis()
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "username", user.Id, user.Username), "expected user is valid error: %s", appErr.Error())

	user.Username = NewUsername() + "^hello#"
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "username", user.Id, user.Username), "expected user is valid error: %s", appErr.Error())

	user.Username = NewUsername()
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "email", user.Id, user.Email), "expected user is valid error: %s", appErr.Error())

	user.Email = strings.Repeat("01234567890", 20)
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "email", user.Id, user.Email), "expected user is valid error: %s", appErr.Error())

	user.Email = "user@example.com"

	user.Nickname = strings.Repeat("a", 65)
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "nickname", user.Id, user.Nickname), "expected user is valid error: %s", appErr.Error())

	user.Nickname = strings.Repeat("a", 64)
	require.Nil(t, user.IsValid())

	user.FirstName = ""
	user.LastName = ""
	require.Nil(t, user.IsValid())

	user.Email = NewId()
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "email", user.Id, user.Email), "expected user is valid error: %s", appErr.Error())

	user.RemoteId = NewPointer(NewId())
	require.Nil(t, user.IsValid())

	user.FirstName = strings.Repeat("a", 65)
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "first_name", user.Id, user.FirstName), "expected user is valid error: %s", appErr.Error())

	user.FirstName = strings.Repeat("a", 64)
	user.LastName = strings.Repeat("a", 65)
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "last_name", user.Id, user.LastName), "expected user is valid error: %s", appErr.Error())

	user.LastName = strings.Repeat("a", 64)
	user.Position = strings.Repeat("a", 128)
	require.Nil(t, user.IsValid())

	user.Position = strings.Repeat("a", 129)
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "position", user.Id, user.Position), "expected user is valid error: %s", appErr.Error())
	user.Position = ""

	user.Roles = strings.Repeat("a", UserRolesMaxLength)
	appErr = user.IsValid()
	require.Nil(t, appErr)

	user.Roles = strings.Repeat("a", UserRolesMaxLength+1)
	appErr = user.IsValid()
	require.True(t, HasExpectedUserIsValidError(appErr, "roles_limit", user.Id, user.Roles), "expected user is valid error: %s", appErr.Error())
}

func TestUserSanitizeInput(t *testing.T) {
	user := User{}
	user.CreateAt = GetMillis()
	user.UpdateAt = GetMillis()
	user.DeleteAt = GetMillis()
	user.LastPasswordUpdate = GetMillis()
	user.LastPictureUpdate = GetMillis()

	user.Username = "username"
	user.Email = "  user@example.com "
	user.Nickname = "nickname"
	user.FirstName = "firstname"
	user.LastName = "lastname"
	user.RemoteId = NewPointer(NewId())
	user.Position = "position"
	user.Roles = "system_admin"
	user.AuthData = NewPointer("authdata")
	user.AuthService = "saml"
	user.EmailVerified = true
	user.FailedAttempts = 10
	user.LastActivityAt = GetMillis()
	user.MfaUsedTimestamps = StringArray{"1234", "4566"}

	user.SanitizeInput(false)

	// these fields should be reset
	require.Equal(t, NewPointer(""), user.AuthData)
	require.Equal(t, "", user.AuthService)
	require.False(t, user.EmailVerified)
	require.Equal(t, NewPointer(""), user.RemoteId)
	require.Equal(t, int64(0), user.CreateAt)
	require.Equal(t, int64(0), user.UpdateAt)
	require.Equal(t, int64(0), user.DeleteAt)
	require.Equal(t, int64(0), user.LastPasswordUpdate)
	require.Equal(t, int64(0), user.LastPictureUpdate)
	require.Equal(t, int64(0), user.LastActivityAt)
	require.Equal(t, 0, user.FailedAttempts)
	require.Equal(t, StringArray{}, user.MfaUsedTimestamps)

	// these fields should remain intact
	require.Equal(t, "user@example.com", user.Email)
	require.Equal(t, "username", user.Username)
	require.Equal(t, "nickname", user.Nickname)
	require.Equal(t, "firstname", user.FirstName)
	require.Equal(t, "lastname", user.LastName)
	require.Equal(t, "position", user.Position)
}

func HasExpectedUserIsValidError(err *AppError, fieldName, userId string, fieldValue any) bool {
	if err == nil {
		return false
	}

	return err.Where == "User.IsValid" &&
		err.Id == fmt.Sprintf("model.user.is_valid.%s.app_error", fieldName) &&
		err.StatusCode == http.StatusBadRequest &&
		(userId == "" || err.DetailedError == fmt.Sprintf("user_id=%s %s=%v", userId, fieldName, fieldValue))
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

	assert.Equal(t, user.GetDisplayName(ShowFullName), "username", "Display name should be username")
	assert.Equal(t, user.GetDisplayName(ShowNicknameFullName), "username", "Display name should be username")
	assert.Equal(t, user.GetDisplayName(ShowUsername), "username", "Display name should be username")

	user.FirstName = "first"
	user.LastName = "last"

	assert.Equal(t, user.GetDisplayName(ShowFullName), "first last", "Display name should be full name")
	assert.Equal(t, user.GetDisplayName(ShowNicknameFullName), "first last", "Display name should be full name since there is no nickname")
	assert.Equal(t, user.GetDisplayName(ShowUsername), "username", "Display name should be username")

	user.Nickname = "nickname"
	assert.Equal(t, user.GetDisplayName(ShowNicknameFullName), "nickname", "Display name should be nickname")
}

func TestUserGetDisplayNameWithPrefix(t *testing.T) {
	user := User{Username: "username"}

	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowFullName, "@"), "@username", "Display name should be username")
	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowNicknameFullName, "@"), "@username", "Display name should be username")
	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowUsername, "@"), "@username", "Display name should be username")

	user.FirstName = "first"
	user.LastName = "last"

	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowFullName, "@"), "first last", "Display name should be full name")
	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowNicknameFullName, "@"), "first last", "Display name should be full name since there is no nickname")
	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowUsername, "@"), "@username", "Display name should be username")

	user.Nickname = "nickname"
	assert.Equal(t, user.GetDisplayNameWithPrefix(ShowNicknameFullName, "@"), "nickname", "Display name should be nickname")
}

type usernamesTest struct {
	value              string
	expected           bool
	expectedWhenRemote bool
}

var usernames = []usernamesTest{
	{"spin-punch", true, true},
	{"sp", true, true},
	{"s", true, true},
	{"1spin-punch", true, true},
	{"-spin-punch", true, true},
	{".spin-punch", true, true},
	{"Spin-punch", false, false},
	{"spin punch-", false, false},
	{"spin_punch", true, true},
	{"spin", true, true},
	{"PUNCH", false, false},
	{"spin.punch", true, true},
	{"spin'punch", false, false},
	{"spin*punch", false, false},
	{"all", false, false},
	{"system", false, false},
	{"spin:punch", false, true},
}

func TestValidUsername(t *testing.T) {
	for _, v := range usernames {
		if IsValidUsername(v.value) != v.expected {
			t.Errorf("expect %v as %v", v.value, v.expected)
		}
	}
	for _, v := range usernames {
		if IsValidUsernameAllowRemote(v.value) != v.expectedWhenRemote {
			t.Errorf("expect %v as %v", v.value, v.expectedWhenRemote)
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
	logger := mlog.CreateConsoleTestLogger(t)
	assert.Equal(t, CleanUsername(logger, "Spin-punch"), "spin-punch", "didn't clean name properly")
	assert.Equal(t, CleanUsername(logger, "PUNCH"), "punch", "didn't clean name properly")
	assert.Equal(t, CleanUsername(logger, "spin'punch"), "spin-punch", "didn't clean name properly")
	assert.Equal(t, CleanUsername(logger, "spin"), "spin", "didn't clean name properly")
	assert.Len(t, CleanUsername(logger, "all"), 27, "didn't clean name properly")
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
		assert.Len(t, activeUsers, 2)
		for _, user := range activeUsers {
			assert.True(t, user.DeleteAt == 0)
		}

		inactiveUsers := slice.FilterByActive(false)
		assert.Len(t, inactiveUsers, 1)
		for _, user := range inactiveUsers {
			assert.True(t, user.DeleteAt != 0)
		}

		nonBotUsers := slice.FilterWithoutBots()
		assert.Len(t, nonBotUsers, 1)
	})
}

func TestValidateCustomStatus(t *testing.T) {
	t.Run("ValidateCustomStatus", func(t *testing.T) {
		user0 := &User{Id: "user0", DeleteAt: 0, IsBot: true}

		user0.Props = map[string]string{UserPropsKeyCustomStatus: ""}
		assert.True(t, user0.ValidateCustomStatus())

		user0.Props[UserPropsKeyCustomStatus] = "hello"
		assert.False(t, user0.ValidateCustomStatus())

		user0.Props[UserPropsKeyCustomStatus] = "{\"emoji\":{\"foo\":\"bar\"}}"
		assert.True(t, user0.ValidateCustomStatus())

		user0.Props[UserPropsKeyCustomStatus] = "{\"text\": \"hello\"}"
		assert.True(t, user0.ValidateCustomStatus())

		user0.Props[UserPropsKeyCustomStatus] = "{\"wrong\": \"hello\"}"
		assert.True(t, user0.ValidateCustomStatus())
	})
}

func TestSanitizeProfile(t *testing.T) {
	t.Run("should correctly sanitize email and remote email", func(t *testing.T) {
		user := &User{
			Email: "john@doe.com",
			Props: StringMap{UserPropsKeyRemoteEmail: "remote@doe.com"},
		}

		user.SanitizeProfile(nil, false)

		require.Equal(t, "john@doe.com", user.Email)
		require.Equal(t, "remote@doe.com", user.Props[UserPropsKeyRemoteEmail])

		user.SanitizeProfile(map[string]bool{"email": false}, false)

		require.Empty(t, user.Email)
		require.Empty(t, user.Props[UserPropsKeyRemoteEmail])
	})
}
