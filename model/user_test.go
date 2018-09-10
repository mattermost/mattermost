// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	if !ComparePassword(hash, "Test") {
		t.Fatal("Passwords don't match")
	}

	if ComparePassword(hash, "Test2") {
		t.Fatal("Passwords should not have matched")
	}
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

	if user.Id != ruser.Id {
		t.Fatal("Ids do not match")
	}
}

func TestUserPreSave(t *testing.T) {
	user := User{Password: "test"}
	user.PreSave()
	user.Etag(true, true)
	if user.Timezone == nil {
		t.Fatal("Timezone is nil")
	}

	if user.Timezone["useAutomaticTimezone"] != "true" {
		t.Fatal("Timezone is not set to default")
	}
}

func TestUserPreUpdate(t *testing.T) {
	user := User{Password: "test"}
	user.PreUpdate()
}

func TestUserUpdateMentionKeysFromUsername(t *testing.T) {
	user := User{Username: "user"}
	user.SetDefaultNotifications()

	if user.NotifyProps["mention_keys"] != "user,@user" {
		t.Fatalf("default mention keys are invalid: %v", user.NotifyProps["mention_keys"])
	}

	user.Username = "person"
	user.UpdateMentionKeysFromUsername("user")
	if user.NotifyProps["mention_keys"] != "person,@person" {
		t.Fatalf("mention keys are invalid after changing username: %v", user.NotifyProps["mention_keys"])
	}

	user.NotifyProps["mention_keys"] += ",mention"
	user.UpdateMentionKeysFromUsername("person")
	if user.NotifyProps["mention_keys"] != "person,@person,mention" {
		t.Fatalf("mention keys are invalid after adding extra mention keyword: %v", user.NotifyProps["mention_keys"])
	}

	user.Username = "user"
	user.UpdateMentionKeysFromUsername("person")
	if user.NotifyProps["mention_keys"] != "user,@user,mention" {
		t.Fatalf("mention keys are invalid after changing username with extra mention keyword: %v", user.NotifyProps["mention_keys"])
	}
}

func TestUserIsValid(t *testing.T) {
	user := User{}

	if err := user.IsValid(); !HasExpectedUserIsValidError(err, "id", "") {
		t.Fatal(err)
	}

	user.Id = NewId()
	err := user.IsValid()
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
	if err := user.IsValid(); err != nil {
		t.Fatal(err)
	}

	user.FirstName = ""
	user.LastName = ""
	if err := user.IsValid(); err != nil {
		t.Fatal(err)
	}

	user.FirstName = strings.Repeat("a", 65)
	if err := user.IsValid(); !HasExpectedUserIsValidError(err, "first_name", user.Id) {
		t.Fatal(err)
	}

	user.FirstName = strings.Repeat("a", 64)
	user.LastName = strings.Repeat("a", 65)
	if err := user.IsValid(); !HasExpectedUserIsValidError(err, "last_name", user.Id) {
		t.Fatal(err)
	}

	user.LastName = strings.Repeat("a", 64)
	user.Position = strings.Repeat("a", 128)
	if err := user.IsValid(); err != nil {
		t.Fatal(err)
	}

	user.Position = strings.Repeat("a", 129)
	if err := user.IsValid(); !HasExpectedUserIsValidError(err, "position", user.Id) {
		t.Fatal(err)
	}
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

	if fullName := user.GetFullName(); fullName != "" {
		t.Fatal("Full name should be blank")
	}

	user.FirstName = "first"
	if fullName := user.GetFullName(); fullName != "first" {
		t.Fatal("Full name should be first name")
	}

	user.FirstName = ""
	user.LastName = "last"
	if fullName := user.GetFullName(); fullName != "last" {
		t.Fatal("Full name should be last name")
	}

	user.FirstName = "first"
	if fullName := user.GetFullName(); fullName != "first last" {
		t.Fatal("Full name should be first name and last name")
	}
}

func TestUserGetDisplayName(t *testing.T) {
	user := User{Username: "username"}

	if displayName := user.GetDisplayName(SHOW_FULLNAME); displayName != "username" {
		t.Fatal("Display name should be username")
	}

	if displayName := user.GetDisplayName(SHOW_NICKNAME_FULLNAME); displayName != "username" {
		t.Fatal("Display name should be username")
	}

	if displayName := user.GetDisplayName(SHOW_USERNAME); displayName != "username" {
		t.Fatal("Display name should be username")
	}

	user.FirstName = "first"
	user.LastName = "last"

	if displayName := user.GetDisplayName(SHOW_FULLNAME); displayName != "first last" {
		t.Fatal("Display name should be full name")
	}

	if displayName := user.GetDisplayName(SHOW_NICKNAME_FULLNAME); displayName != "first last" {
		t.Fatal("Display name should be full name since there is no nickname")
	}

	if displayName := user.GetDisplayName(SHOW_USERNAME); displayName != "username" {
		t.Fatal("Display name should be username")
	}

	user.Nickname = "nickname"
	if displayName := user.GetDisplayName(SHOW_NICKNAME_FULLNAME); displayName != "nickname" {
		t.Fatal("Display name should be nickname")
	}
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
	if NormalizeUsername("Spin-punch") != "spin-punch" {
		t.Fatal("didn't normalize username properly")
	}
	if NormalizeUsername("PUNCH") != "punch" {
		t.Fatal("didn't normalize username properly")
	}
	if NormalizeUsername("spin") != "spin" {
		t.Fatal("didn't normalize username properly")
	}
}

func TestNormalizeEmail(t *testing.T) {
	if NormalizeEmail("TEST@EXAMPLE.COM") != "test@example.com" {
		t.Fatal("didn't normalize email properly")
	}
	if NormalizeEmail("TEST2@example.com") != "test2@example.com" {
		t.Fatal("didn't normalize email properly")
	}
	if NormalizeEmail("test3@example.com") != "test3@example.com" {
		t.Fatal("didn't normalize email properly")
	}
}

func TestCleanUsername(t *testing.T) {
	if CleanUsername("Spin-punch") != "spin-punch" {
		t.Fatal("didn't clean name properly")
	}
	if CleanUsername("PUNCH") != "punch" {
		t.Fatal("didn't clean name properly")
	}
	if CleanUsername("spin'punch") != "spin-punch" {
		t.Fatal("didn't clean name properly")
	}
	if CleanUsername("spin") != "spin" {
		t.Fatal("didn't clean name properly")
	}
	if len(CleanUsername("all")) != 27 {
		t.Fatal("didn't clean name properly")
	}
}

func TestRoles(t *testing.T) {
	require.True(t, IsValidUserRoles("team_user"))
	require.False(t, IsValidUserRoles("system_admin"))
	require.True(t, IsValidUserRoles("system_user system_admin"))
	require.False(t, IsInRole("system_admin junk", "admin"))
	require.True(t, IsInRole("system_admin junk", "system_admin"))
	require.False(t, IsInRole("admin", "system_admin"))
}
