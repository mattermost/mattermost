// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"runtime/debug"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func ptrStr(s string) *string {
	return &s
}

func ptrInt64(i int64) *int64 {
	return &i
}

func ptrInt(i int) *int {
	return &i
}

func ptrBool(b bool) *bool {
	return &b
}

func checkPreference(t *testing.T, a *App, userId string, category string, name string, value string) {
	if res := <-a.Srv.Store.Preference().GetCategory(userId, category); res.Err != nil {
		debug.PrintStack()
		t.Fatalf("Failed to get preferences for user %v with category %v", userId, category)
	} else {
		preferences := res.Data.(model.Preferences)
		found := false
		for _, preference := range preferences {
			if preference.Name == name {
				found = true
				if preference.Value != value {
					debug.PrintStack()
					t.Fatalf("Preference for user %v in category %v with name %v has value %v, expected %v", userId, category, name, preference.Value, value)
				}
				break
			}
		}
		if !found {
			debug.PrintStack()
			t.Fatalf("Did not find preference for user %v in category %v with name %v", userId, category, name)
		}
	}
}

func checkNotifyProp(t *testing.T, user *model.User, key string, value string) {
	if actual, ok := user.NotifyProps[key]; !ok {
		debug.PrintStack()
		t.Fatalf("Notify prop %v not found. User: %v", key, user.Id)
	} else if actual != value {
		debug.PrintStack()
		t.Fatalf("Notify Prop %v was %v but expected %v. User: %v", key, actual, value, user.Id)
	}
}

func checkError(t *testing.T, err *model.AppError) {
	if err == nil {
		debug.PrintStack()
		t.Fatal("Should have returned an error.")
	}
}

func checkNoError(t *testing.T, err *model.AppError) {
	if err != nil {
		debug.PrintStack()
		t.Fatalf("Unexpected Error: %v", err.Error())
	}
}

func TestImportValidateTeamImportData(t *testing.T) {

	// Test with minimum required valid properties.
	data := TeamImportData{
		Name:        ptrStr("teamname"),
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}
	if err := validateTeamImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with various invalid names.
	data = TeamImportData{
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing name.")
	}

	data.Name = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long name.")
	}

	data.Name = ptrStr("login")
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to reserved word in name.")
	}

	data.Name = ptrStr("Test::''ASD")
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to non alphanum characters in name.")
	}

	data.Name = ptrStr("A")
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to short name.")
	}

	// Test team various invalid display names.
	data = TeamImportData{
		Name: ptrStr("teamname"),
		Type: ptrStr("O"),
	}
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing display_name.")
	}

	data.DisplayName = ptrStr("")
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to empty display_name.")
	}

	data.DisplayName = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long display_name.")
	}

	// Test with various valid and invalid types.
	data = TeamImportData{
		Name:        ptrStr("teamname"),
		DisplayName: ptrStr("Display Name"),
	}
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing type.")
	}

	data.Type = ptrStr("A")
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to invalid type.")
	}

	data.Type = ptrStr("I")
	if err := validateTeamImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid type.")
	}

	// Test with all the combinations of optional parameters.
	data = TeamImportData{
		Name:            ptrStr("teamname"),
		DisplayName:     ptrStr("Display Name"),
		Type:            ptrStr("O"),
		Description:     ptrStr("The team description."),
		AllowOpenInvite: ptrBool(true),
	}
	if err := validateTeamImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid optional properties.")
	}

	data.AllowOpenInvite = ptrBool(false)
	if err := validateTeamImportData(&data); err != nil {
		t.Fatal("Should have succeeded with allow open invites false.")
	}

	data.Description = ptrStr(strings.Repeat("abcdefghij ", 26))
	if err := validateTeamImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long description.")
	}
}

func TestImportValidateChannelImportData(t *testing.T) {

	// Test with minimum required valid properties.
	data := ChannelImportData{
		Team:        ptrStr("teamname"),
		Name:        ptrStr("channelname"),
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}
	if err := validateChannelImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with missing team.
	data = ChannelImportData{
		Name:        ptrStr("channelname"),
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing team.")
	}

	// Test with various invalid names.
	data = ChannelImportData{
		Team:        ptrStr("teamname"),
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing name.")
	}

	data.Name = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long name.")
	}

	data.Name = ptrStr("Test::''ASD")
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to non alphanum characters in name.")
	}

	data.Name = ptrStr("A")
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to short name.")
	}

	// Test team various invalid display names.
	data = ChannelImportData{
		Team: ptrStr("teamname"),
		Name: ptrStr("channelname"),
		Type: ptrStr("O"),
	}
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing display_name.")
	}

	data.DisplayName = ptrStr("")
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to empty display_name.")
	}

	data.DisplayName = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long display_name.")
	}

	// Test with various valid and invalid types.
	data = ChannelImportData{
		Team:        ptrStr("teamname"),
		Name:        ptrStr("channelname"),
		DisplayName: ptrStr("Display Name"),
	}
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing type.")
	}

	data.Type = ptrStr("A")
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to invalid type.")
	}

	data.Type = ptrStr("P")
	if err := validateChannelImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid type.")
	}

	// Test with all the combinations of optional parameters.
	data = ChannelImportData{
		Team:        ptrStr("teamname"),
		Name:        ptrStr("channelname"),
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
		Header:      ptrStr("Channel Header Here"),
		Purpose:     ptrStr("Channel Purpose Here"),
	}
	if err := validateChannelImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid optional properties.")
	}

	data.Header = ptrStr(strings.Repeat("abcdefghij ", 103))
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long header.")
	}

	data.Header = ptrStr("Channel Header Here")
	data.Purpose = ptrStr(strings.Repeat("abcdefghij ", 26))
	if err := validateChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long purpose.")
	}
}

func TestImportValidateUserImportData(t *testing.T) {

	// Test with minimum required valid properties.
	data := UserImportData{
		Username: ptrStr("bob"),
		Email:    ptrStr("bob@example.com"),
	}
	if err := validateUserImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Invalid Usernames.
	data.Username = nil
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to nil Username.")
	}

	data.Username = ptrStr("")
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to 0 length Username.")
	}

	data.Username = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long Username.")
	}

	data.Username = ptrStr("i am a username with spaces and !!!")
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to invalid characters in Username.")
	}

	data.Username = ptrStr("bob")

	// Invalid Emails
	data.Email = nil
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to nil Email.")
	}

	data.Email = ptrStr("")
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to 0 length Email.")
	}

	data.Email = ptrStr(strings.Repeat("abcdefghij", 13))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long Email.")
	}

	data.Email = ptrStr("bob@example.com")

	data.AuthService = ptrStr("")
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to 0-length auth service.")
	}

	data.AuthService = ptrStr("saml")
	data.AuthData = ptrStr(strings.Repeat("abcdefghij", 15))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long auth data.")
	}

	data.AuthData = ptrStr("bobbytables")
	if err := validateUserImportData(&data); err != nil {
		t.Fatal("Validation should have succeeded with valid auth service and auth data.")
	}

	// Test a valid User with all fields populated.
	data = UserImportData{
		Username:    ptrStr("bob"),
		Email:       ptrStr("bob@example.com"),
		AuthService: ptrStr("ldap"),
		AuthData:    ptrStr("bob"),
		Nickname:    ptrStr("BobNick"),
		FirstName:   ptrStr("Bob"),
		LastName:    ptrStr("Blob"),
		Position:    ptrStr("The Boss"),
		Roles:       ptrStr("system_user"),
		Locale:      ptrStr("en"),
	}
	if err := validateUserImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test various invalid optional field values.
	data.Nickname = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long Nickname.")
	}
	data.Nickname = ptrStr("BobNick")

	data.FirstName = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long First Name.")
	}
	data.FirstName = ptrStr("Bob")

	data.LastName = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long Last name.")
	}
	data.LastName = ptrStr("Blob")

	data.Position = ptrStr(strings.Repeat("abcdefghij", 7))
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too long Position.")
	}
	data.Position = ptrStr("The Boss")

	data.Roles = ptrStr("system_user wat")
	if err := validateUserImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to too unrecognised role.")
	}
	data.Roles = nil
	if err := validateUserImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	data.Roles = ptrStr("")
	if err := validateUserImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}
	data.Roles = ptrStr("system_user")

	// Try various valid/invalid notify props.
	data.NotifyProps = &UserNotifyPropsImportData{}

	data.NotifyProps.Desktop = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.Desktop = ptrStr(model.USER_NOTIFY_ALL)
	data.NotifyProps.DesktopDuration = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.DesktopDuration = ptrStr("5")
	data.NotifyProps.DesktopSound = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.DesktopSound = ptrStr("true")
	data.NotifyProps.Email = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.Email = ptrStr("true")
	data.NotifyProps.Mobile = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.Mobile = ptrStr(model.USER_NOTIFY_ALL)
	data.NotifyProps.MobilePushStatus = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.MobilePushStatus = ptrStr(model.STATUS_ONLINE)
	data.NotifyProps.ChannelTrigger = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.ChannelTrigger = ptrStr("true")
	data.NotifyProps.CommentsTrigger = ptrStr("invalid")
	checkError(t, validateUserImportData(&data))

	data.NotifyProps.CommentsTrigger = ptrStr(model.COMMENTS_NOTIFY_ROOT)
	data.NotifyProps.MentionKeys = ptrStr("valid")
	checkNoError(t, validateUserImportData(&data))
}

func TestImportValidateUserTeamsImportData(t *testing.T) {

	// Invalid Name.
	data := []UserTeamImportData{
		{
			Roles: ptrStr("team_admin team_user"),
		},
	}
	if err := validateUserTeamsImportData(&data); err == nil {
		t.Fatal("Should have failed due to invalid name.")
	}
	data[0].Name = ptrStr("teamname")

	// Invalid Roles
	data[0].Roles = ptrStr("wtf")
	if err := validateUserTeamsImportData(&data); err == nil {
		t.Fatal("Should have failed due to invalid roles.")
	}

	// Valid (nil roles)
	data[0].Roles = nil
	if err := validateUserTeamsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with empty roles.")
	}

	// Valid (empty roles)
	data[0].Roles = ptrStr("")
	if err := validateUserTeamsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with empty roles.")
	}

	// Valid (with roles)
	data[0].Roles = ptrStr("team_admin team_user")
	if err := validateUserTeamsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid roles.")
	}
}

func TestImportValidateUserChannelsImportData(t *testing.T) {

	// Invalid Name.
	data := []UserChannelImportData{
		{
			Roles: ptrStr("channel_admin channel_user"),
		},
	}
	if err := validateUserChannelsImportData(&data); err == nil {
		t.Fatal("Should have failed due to invalid name.")
	}
	data[0].Name = ptrStr("channelname")

	// Invalid Roles
	data[0].Roles = ptrStr("wtf")
	if err := validateUserChannelsImportData(&data); err == nil {
		t.Fatal("Should have failed due to invalid roles.")
	}

	// Valid (nil roles)
	data[0].Roles = nil
	if err := validateUserChannelsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with empty roles.")
	}

	// Valid (empty roles)
	data[0].Roles = ptrStr("")
	if err := validateUserChannelsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with empty roles.")
	}

	// Valid (with roles)
	data[0].Roles = ptrStr("channel_admin channel_user")
	if err := validateUserChannelsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid roles.")
	}

	// Empty notify props.
	data[0].NotifyProps = &UserChannelNotifyPropsImportData{}
	if err := validateUserChannelsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with empty notify props.")
	}

	// Invalid desktop notify props.
	data[0].NotifyProps.Desktop = ptrStr("invalid")
	if err := validateUserChannelsImportData(&data); err == nil {
		t.Fatal("Should have failed with invalid desktop notify props.")
	}

	// Invalid mobile notify props.
	data[0].NotifyProps.Desktop = ptrStr("mention")
	data[0].NotifyProps.Mobile = ptrStr("invalid")
	if err := validateUserChannelsImportData(&data); err == nil {
		t.Fatal("Should have failed with invalid mobile notify props.")
	}

	// Invalid mark_unread notify props.
	data[0].NotifyProps.Mobile = ptrStr("mention")
	data[0].NotifyProps.MarkUnread = ptrStr("invalid")
	if err := validateUserChannelsImportData(&data); err == nil {
		t.Fatal("Should have failed with invalid mark_unread notify props.")
	}

	// Valid notify props.
	data[0].NotifyProps.MarkUnread = ptrStr("mention")
	if err := validateUserChannelsImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid notify props.")
	}
}

func TestImportValidatePostImportData(t *testing.T) {

	// Test with minimum required valid properties.
	data := PostImportData{
		Team:     ptrStr("teamname"),
		Channel:  ptrStr("channelname"),
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with missing required properties.
	data = PostImportData{
		Channel:  ptrStr("channelname"),
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = PostImportData{
		Team:     ptrStr("teamname"),
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = PostImportData{
		Team:     ptrStr("teamname"),
		Channel:  ptrStr("channelname"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = PostImportData{
		Team:     ptrStr("teamname"),
		Channel:  ptrStr("channelname"),
		User:     ptrStr("username"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = PostImportData{
		Team:    ptrStr("teamname"),
		Channel: ptrStr("channelname"),
		User:    ptrStr("username"),
		Message: ptrStr("message"),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	// Test with invalid message.
	data = PostImportData{
		Team:     ptrStr("teamname"),
		Channel:  ptrStr("channelname"),
		User:     ptrStr("username"),
		Message:  ptrStr(strings.Repeat("1234567890", 500)),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long message.")
	}

	// Test with invalid CreateAt
	data = PostImportData{
		Team:     ptrStr("teamname"),
		Channel:  ptrStr("channelname"),
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(0),
	}
	if err := validatePostImportData(&data); err == nil {
		t.Fatal("Should have failed due to 0 create-at value.")
	}

	// Test with valid all optional parameters.
	data = PostImportData{
		Team:     ptrStr("teamname"),
		Channel:  ptrStr("channelname"),
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validatePostImportData(&data); err != nil {
		t.Fatal("Should have succeeded.")
	}
}

func TestImportValidateDirectChannelImportData(t *testing.T) {

	// Test with valid number of members for direct message.
	data := DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
			model.NewId(),
		},
	}
	if err := validateDirectChannelImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with valid number of members for group message.
	data = DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
		},
	}
	if err := validateDirectChannelImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with all the combinations of optional parameters.
	data = DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
			model.NewId(),
		},
		Header: ptrStr("Channel Header Here"),
	}
	if err := validateDirectChannelImportData(&data); err != nil {
		t.Fatal("Should have succeeded with valid optional properties.")
	}

	// Test with invalid Header.
	data.Header = ptrStr(strings.Repeat("abcdefghij ", 103))
	if err := validateDirectChannelImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long header.")
	}

	// Test with different combinations of invalid member counts.
	data = DirectChannelImportData{
		Members: &[]string{},
	}
	if err := validateDirectChannelImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to invalid number of members.")
	}

	data = DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
		},
	}
	if err := validateDirectChannelImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to invalid number of members.")
	}

	data = DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
		},
	}
	if err := validateDirectChannelImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to invalid number of members.")
	}

	// Test with invalid FavoritedBy
	member1 := model.NewId()
	member2 := model.NewId()
	data = DirectChannelImportData{
		Members: &[]string{
			member1,
			member2,
		},
		FavoritedBy: &[]string{
			member1,
			model.NewId(),
		},
	}
	if err := validateDirectChannelImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to non-member favorited.")
	}

	// Test with valid FavoritedBy
	data = DirectChannelImportData{
		Members: &[]string{
			member1,
			member2,
		},
		FavoritedBy: &[]string{
			member1,
			member2,
		},
	}
	if err := validateDirectChannelImportData(&data); err != nil {
		t.Fatal(err)
	}
}

func TestImportValidateDirectPostImportData(t *testing.T) {

	// Test with minimum required valid properties.
	data := DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with missing required properties.
	data = DirectPostImportData{
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     ptrStr("username"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:    ptrStr("username"),
		Message: ptrStr("message"),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to missing required property.")
	}

	// Test with invalid numbers of channel members.
	data = DirectPostImportData{
		ChannelMembers: &[]string{},
		User:           ptrStr("username"),
		Message:        ptrStr("message"),
		CreateAt:       ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to unsuitable number of members.")
	}

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to unsuitable number of members.")
	}

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to unsuitable number of members.")
	}

	// Test with group message number of members.
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err != nil {
		t.Fatal("Validation failed but should have been valid.")
	}

	// Test with invalid message.
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr(strings.Repeat("1234567890", 500)),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to too long message.")
	}

	// Test with invalid CreateAt
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(0),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Should have failed due to 0 create-at value.")
	}

	// Test with invalid FlaggedBy
	member1 := model.NewId()
	member2 := model.NewId()
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			member1,
			member2,
		},
		FlaggedBy: &[]string{
			member1,
			model.NewId(),
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err == nil {
		t.Fatal("Validation should have failed due to non-member flagged.")
	}

	// Test with valid FlaggedBy
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			member1,
			member2,
		},
		FlaggedBy: &[]string{
			member1,
			member2,
		},
		User:     ptrStr("username"),
		Message:  ptrStr("message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := validateDirectPostImportData(&data); err != nil {
		t.Fatal(err)
	}
}

func TestImportImportTeam(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Check how many teams are in the database.
	var teamsCount int64
	if r := <-th.App.Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		teamsCount = r.Data.(int64)
	} else {
		t.Fatalf("Failed to get team count.")
	}

	data := TeamImportData{
		Name:            ptrStr(model.NewId()),
		DisplayName:     ptrStr("Display Name"),
		Type:            ptrStr("XYZ"),
		Description:     ptrStr("The team description."),
		AllowOpenInvite: ptrBool(true),
	}

	// Try importing an invalid team in dryRun mode.
	if err := th.App.ImportTeam(&data, true); err == nil {
		t.Fatalf("Should have received an error importing an invalid team.")
	}

	// Do a valid team in dry-run mode.
	data.Type = ptrStr("O")
	if err := th.App.ImportTeam(&data, true); err != nil {
		t.Fatalf("Received an error validating valid team.")
	}

	// Check that no more teams are in the DB.
	if r := <-th.App.Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64) != teamsCount {
			t.Fatalf("Teams got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Do an invalid team in apply mode, check db changes.
	data.Type = ptrStr("XYZ")
	if err := th.App.ImportTeam(&data, false); err == nil {
		t.Fatalf("Import should have failed on invalid team.")
	}

	// Check that no more teams are in the DB.
	if r := <-th.App.Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64) != teamsCount {
			t.Fatalf("Invalid team got persisted.")
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Do a valid team in apply mode, check db changes.
	data.Type = ptrStr("O")
	if err := th.App.ImportTeam(&data, false); err != nil {
		t.Fatalf("Received an error importing valid team.")
	}

	// Check that one more team is in the DB.
	if r := <-th.App.Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64)-1 != teamsCount {
			t.Fatalf("Team did not get saved in apply run mode. analytics=%v teamcount=%v", r.Data.(int64), teamsCount)
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Get the team and check that all the fields are correct.
	if team, err := th.App.GetTeamByName(*data.Name); err != nil {
		t.Fatalf("Failed to get team from database.")
	} else {
		if team.DisplayName != *data.DisplayName || team.Type != *data.Type || team.Description != *data.Description || team.AllowOpenInvite != *data.AllowOpenInvite {
			t.Fatalf("Imported team properties do not match import data.")
		}
	}

	// Alter all the fields of that team (apart from unique identifier) and import again.
	data.DisplayName = ptrStr("Display Name 2")
	data.Type = ptrStr("P")
	data.Description = ptrStr("The new description")
	data.AllowOpenInvite = ptrBool(false)

	// Check that the original number of teams are again in the DB (because this query doesn't include deleted).
	data.Type = ptrStr("O")
	if err := th.App.ImportTeam(&data, false); err != nil {
		t.Fatalf("Received an error importing updated valid team.")
	}

	if r := <-th.App.Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64)-1 != teamsCount {
			t.Fatalf("Team alterations did not get saved in apply run mode. analytics=%v teamcount=%v", r.Data.(int64), teamsCount)
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Get the team and check that all fields are correct.
	if team, err := th.App.GetTeamByName(*data.Name); err != nil {
		t.Fatalf("Failed to get team from database.")
	} else {
		if team.DisplayName != *data.DisplayName || team.Type != *data.Type || team.Description != *data.Description || team.AllowOpenInvite != *data.AllowOpenInvite {
			t.Fatalf("Updated team properties do not match import data.")
		}
	}
}

func TestImportImportChannel(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Import a Team.
	teamName := model.NewId()
	th.App.ImportTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	if err != nil {
		t.Fatalf("Failed to get team from database.")
	}

	// Check how many channels are in the database.
	var channelCount int64
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		channelCount = r.Data.(int64)
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Do an invalid channel in dry-run mode.
	data := ChannelImportData{
		Team:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
		Header:      ptrStr("Channe Header"),
		Purpose:     ptrStr("Channel Purpose"),
	}
	if err := th.App.ImportChannel(&data, true); err == nil {
		t.Fatalf("Expected error due to invalid name.")
	}

	// Check that no more channels are in the DB.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Channels got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel with a nonexistent team in dry-run mode.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	if err := th.App.ImportChannel(&data, true); err != nil {
		t.Fatalf("Expected success as cannot validate channel name in dry run mode.")
	}

	// Check that no more channels are in the DB.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Channels got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel in dry-run mode.
	data.Team = &teamName
	if err := th.App.ImportChannel(&data, true); err != nil {
		t.Fatalf("Expected success as valid team.")
	}

	// Check that no more channels are in the DB.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Channels got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do an invalid channel in apply mode.
	data.Name = nil
	if err := th.App.ImportChannel(&data, false); err == nil {
		t.Fatalf("Expected error due to invalid name (apply mode).")
	}

	// Check that no more channels are in the DB.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Invalid channel got persisted in apply mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel in apply mode with a nonexistant team.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	if err := th.App.ImportChannel(&data, false); err == nil {
		t.Fatalf("Expected error due to non-existant team (apply mode).")
	}

	// Check that no more channels are in the DB.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Invalid team channel got persisted in apply mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel in apply mode.
	data.Team = &teamName
	if err := th.App.ImportChannel(&data, false); err != nil {
		t.Fatalf("Expected success in apply mode: %v", err.Error())
	}

	// Check that no more channels are in the DB.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount+1 {
			t.Fatalf("Channels did not get persisted in apply mode: found %v expected %v + 1", r.Data.(int64), channelCount)
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Get the Channel and check all the fields are correct.
	if channel, err := th.App.GetChannelByName(*data.Name, team.Id); err != nil {
		t.Fatalf("Failed to get channel from database.")
	} else {
		if channel.Name != *data.Name || channel.DisplayName != *data.DisplayName || channel.Type != *data.Type || channel.Header != *data.Header || channel.Purpose != *data.Purpose {
			t.Fatalf("Imported team properties do not match Import Data.")
		}
	}

	// Alter all the fields of that channel.
	data.DisplayName = ptrStr("Chaned Disp Name")
	data.Type = ptrStr(model.CHANNEL_PRIVATE)
	data.Header = ptrStr("New Header")
	data.Purpose = ptrStr("New Purpose")
	if err := th.App.ImportChannel(&data, false); err != nil {
		t.Fatalf("Expected success in apply mode: %v", err.Error())
	}

	// Check channel count the same.
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Updated channel did not get correctly persisted in apply mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Get the Channel and check all the fields are correct.
	if channel, err := th.App.GetChannelByName(*data.Name, team.Id); err != nil {
		t.Fatalf("Failed to get channel from database.")
	} else {
		if channel.Name != *data.Name || channel.DisplayName != *data.DisplayName || channel.Type != *data.Type || channel.Header != *data.Header || channel.Purpose != *data.Purpose {
			t.Fatalf("Updated team properties do not match Import Data.")
		}
	}

}

func TestImportImportUser(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Check how many users are in the database.
	var userCount int64
	if r := <-th.App.Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		userCount = r.Data.(int64)
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do an invalid user in dry-run mode.
	data := UserImportData{
		Username: ptrStr(model.NewId()),
	}
	if err := th.App.ImportUser(&data, true); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	// Check that no more users are in the DB.
	if r := <-th.App.Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do a valid user in dry-run mode.
	data = UserImportData{
		Username: ptrStr(model.NewId()),
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	if err := th.App.ImportUser(&data, true); err != nil {
		t.Fatalf("Should have succeeded to import valid user.")
	}

	// Check that no more users are in the DB.
	if r := <-th.App.Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do an invalid user in apply mode.
	data = UserImportData{
		Username: ptrStr(model.NewId()),
	}
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	// Check that no more users are in the DB.
	if r := <-th.App.Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do a valid user in apply mode.
	username := model.NewId()
	data = UserImportData{
		Username:  &username,
		Email:     ptrStr(model.NewId() + "@example.com"),
		Nickname:  ptrStr(model.NewId()),
		FirstName: ptrStr(model.NewId()),
		LastName:  ptrStr(model.NewId()),
		Position:  ptrStr(model.NewId()),
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded to import valid user.")
	}

	// Check that one more user is in the DB.
	if r := <-th.App.Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount+1 {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Get the user and check all the fields are correct.
	if user, err := th.App.GetUserByUsername(username); err != nil {
		t.Fatalf("Failed to get user from database.")
	} else {
		if user.Email != *data.Email || user.Nickname != *data.Nickname || user.FirstName != *data.FirstName || user.LastName != *data.LastName || user.Position != *data.Position {
			t.Fatalf("User properties do not match Import Data.")
		}
		// Check calculated properties.
		if user.AuthService != "" {
			t.Fatalf("Expected Auth Service to be empty.")
		}

		if !(user.AuthData == nil || *user.AuthData == "") {
			t.Fatalf("Expected AuthData to be empty.")
		}

		if len(user.Password) == 0 {
			t.Fatalf("Expected password to be set.")
		}

		if !user.EmailVerified {
			t.Fatalf("Expected EmailVerified to be true.")
		}

		if user.Locale != *th.App.Config().LocalizationSettings.DefaultClientLocale {
			t.Fatalf("Expected Locale to be the default.")
		}

		if user.Roles != "system_user" {
			t.Fatalf("Expected roles to be system_user")
		}
	}

	// Alter all the fields of that user.
	data.Email = ptrStr(model.NewId() + "@example.com")
	data.AuthService = ptrStr("ldap")
	data.AuthData = &username
	data.Nickname = ptrStr(model.NewId())
	data.FirstName = ptrStr(model.NewId())
	data.LastName = ptrStr(model.NewId())
	data.Position = ptrStr(model.NewId())
	data.Roles = ptrStr("system_admin system_user")
	data.Locale = ptrStr("zh_CN")
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded to update valid user %v", err)
	}

	// Check user count the same.
	if r := <-th.App.Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount+1 {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Get the user and check all the fields are correct.
	if user, err := th.App.GetUserByUsername(username); err != nil {
		t.Fatalf("Failed to get user from database.")
	} else {
		if user.Email != *data.Email || user.Nickname != *data.Nickname || user.FirstName != *data.FirstName || user.LastName != *data.LastName || user.Position != *data.Position {
			t.Fatalf("Updated User properties do not match Import Data.")
		}
		// Check calculated properties.
		if user.AuthService != "ldap" {
			t.Fatalf("Expected Auth Service to be ldap \"%v\"", user.AuthService)
		}

		if !(user.AuthData == data.AuthData || *user.AuthData == *data.AuthData) {
			t.Fatalf("Expected AuthData to be set.")
		}

		if len(user.Password) != 0 {
			t.Fatalf("Expected password to be empty.")
		}

		if !user.EmailVerified {
			t.Fatalf("Expected EmailVerified to be true.")
		}

		if user.Locale != *data.Locale {
			t.Fatalf("Expected Locale to be the set.")
		}

		if user.Roles != *data.Roles {
			t.Fatalf("Expected roles to be set: %v", user.Roles)
		}
	}

	// Check Password and AuthData together.
	data.Password = ptrStr("PasswordTest")
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	data.AuthData = nil
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded to update valid user %v", err)
	}

	data.Password = ptrStr("")
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	data.Password = ptrStr(strings.Repeat("0123456789", 10))
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	data.Password = ptrStr("TestPassword")

	// Test team and channel memberships
	teamName := model.NewId()
	th.App.ImportTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	if err != nil {
		t.Fatalf("Failed to get team from database.")
	}

	channelName := model.NewId()
	th.App.ImportChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	channel, err := th.App.GetChannelByName(channelName, team.Id)
	if err != nil {
		t.Fatalf("Failed to get channel from database.")
	}

	username = model.NewId()
	data = UserImportData{
		Username:  &username,
		Email:     ptrStr(model.NewId() + "@example.com"),
		Nickname:  ptrStr(model.NewId()),
		FirstName: ptrStr(model.NewId()),
		LastName:  ptrStr(model.NewId()),
		Position:  ptrStr(model.NewId()),
	}

	teamMembers, err := th.App.GetTeamMembers(team.Id, 0, 1000)
	if err != nil {
		t.Fatalf("Failed to get team member count")
	}
	teamMemberCount := len(teamMembers)

	channelMemberCount, err := th.App.GetChannelMemberCount(channel.Id)
	if err != nil {
		t.Fatalf("Failed to get channel member count")
	}

	// Test with an invalid team & channel membership in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Roles: ptrStr("invalid"),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, true); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Test with an unknown team name & invalid channel membership in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: ptrStr(model.NewId()),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, true); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Test with a valid team & invalid channel membership in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, true); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Test with a valid team & unknown channel name in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: ptrStr(model.NewId()),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, true); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Test with a valid team & valid channel name in dry-run mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: &channelName,
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, true); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check no new member objects were created because dry run mode.
	if tmc, err := th.App.GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := th.App.GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount {
		t.Fatalf("Number of channel members not as expected")
	}

	// Test with an invalid team & channel membership in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Roles: ptrStr("invalid"),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Test with an unknown team name & invalid channel membership in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: ptrStr(model.NewId()),
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Test with a valid team & invalid channel membership in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Roles: ptrStr("invalid"),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Check no new member objects were created because all tests should have failed so far.
	if tmc, err := th.App.GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := th.App.GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount {
		t.Fatalf("Number of channel members not as expected")
	}

	// Test with a valid team & unknown channel name in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: ptrStr(model.NewId()),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Check only new team member object created because dry run mode.
	if tmc, err := th.App.GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount+1 {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := th.App.GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount {
		t.Fatalf("Number of channel members not as expected")
	}

	// Check team member properties.
	user, err := th.App.GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}
	if teamMember, err := th.App.GetTeamMember(team.Id, user.Id); err != nil {
		t.Fatalf("Failed to get team member from database.")
	} else if teamMember.Roles != "team_user" {
		t.Fatalf("Team member properties not as expected")
	}

	// Test with a valid team & valid channel name in apply mode.
	data.Teams = &[]UserTeamImportData{
		{
			Name: &teamName,
			Channels: &[]UserChannelImportData{
				{
					Name: &channelName,
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check only new channel member object created because dry run mode.
	if tmc, err := th.App.GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount+1 {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := th.App.GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount+1 {
		t.Fatalf("Number of channel members not as expected")
	}

	// Check channel member properties.
	if channelMember, err := th.App.GetChannelMember(channel.Id, user.Id); err != nil {
		t.Fatalf("Failed to get channel member from database.")
	} else if channelMember.Roles != "channel_user" || channelMember.NotifyProps[model.DESKTOP_NOTIFY_PROP] != "default" || channelMember.NotifyProps[model.PUSH_NOTIFY_PROP] != "default" || channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] != "all" {
		t.Fatalf("Channel member properties not as expected")
	}

	// Test with the properties of the team and channel membership changed.
	data.Teams = &[]UserTeamImportData{
		{
			Name:  &teamName,
			Roles: ptrStr("team_user team_admin"),
			Channels: &[]UserChannelImportData{
				{
					Name:  &channelName,
					Roles: ptrStr("channel_user channel_admin"),
					NotifyProps: &UserChannelNotifyPropsImportData{
						Desktop:    ptrStr(model.USER_NOTIFY_MENTION),
						Mobile:     ptrStr(model.USER_NOTIFY_MENTION),
						MarkUnread: ptrStr(model.USER_NOTIFY_MENTION),
					},
					Favorite: ptrBool(true),
				},
			},
		},
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check both member properties.
	if teamMember, err := th.App.GetTeamMember(team.Id, user.Id); err != nil {
		t.Fatalf("Failed to get team member from database.")
	} else if teamMember.Roles != "team_user team_admin" {
		t.Fatalf("Team member properties not as expected: %v", teamMember.Roles)
	}

	if channelMember, err := th.App.GetChannelMember(channel.Id, user.Id); err != nil {
		t.Fatalf("Failed to get channel member Desktop from database.")
	} else if channelMember.Roles != "channel_user channel_admin" || channelMember.NotifyProps[model.DESKTOP_NOTIFY_PROP] != model.USER_NOTIFY_MENTION || channelMember.NotifyProps[model.PUSH_NOTIFY_PROP] != model.USER_NOTIFY_MENTION || channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] != model.USER_NOTIFY_MENTION {
		t.Fatalf("Channel member properties not as expected")
	}

	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id, "true")

	// No more new member objects.
	if tmc, err := th.App.GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount+1 {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := th.App.GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount+1 {
		t.Fatalf("Number of channel members not as expected")
	}

	// Add a user with some preferences.
	username = model.NewId()
	data = UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#DCBD4E","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBj":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		UseMilitaryTime:    ptrStr("true"),
		CollapsePreviews:   ptrStr("true"),
		MessageDisplay:     ptrStr("compact"),
		ChannelDisplayMode: ptrStr("centered"),
		TutorialStep:       ptrStr("3"),
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check their values.
	user, err = th.App.GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_THEME, "", *data.Theme)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "use_military_time", *data.UseMilitaryTime)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "collapse_previews", *data.CollapsePreviews)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "message_display", *data.MessageDisplay)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "channel_display_mode", *data.ChannelDisplayMode)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, user.Id, *data.TutorialStep)

	// Change those preferences.
	data = UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#123456","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBj":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		UseMilitaryTime:    ptrStr("false"),
		CollapsePreviews:   ptrStr("false"),
		MessageDisplay:     ptrStr("clean"),
		ChannelDisplayMode: ptrStr("full"),
		TutorialStep:       ptrStr("2"),
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check their values again.
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_THEME, "", *data.Theme)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "use_military_time", *data.UseMilitaryTime)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "collapse_previews", *data.CollapsePreviews)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "message_display", *data.MessageDisplay)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "channel_display_mode", *data.ChannelDisplayMode)
	checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_TUTORIAL_STEPS, user.Id, *data.TutorialStep)

	// Set Notify Props
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_ALL),
		DesktopDuration:  ptrStr("5"),
		DesktopSound:     ptrStr("true"),
		Email:            ptrStr("true"),
		Mobile:           ptrStr(model.USER_NOTIFY_ALL),
		MobilePushStatus: ptrStr(model.STATUS_ONLINE),
		ChannelTrigger:   ptrStr("true"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ROOT),
		MentionKeys:      ptrStr("valid,misc"),
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	user, err = th.App.GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_ALL)
	checkNotifyProp(t, user, model.DESKTOP_DURATION_NOTIFY_PROP, "5")
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_ALL)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_ONLINE)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "true")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ROOT)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "valid,misc")

	// Change Notify Props
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_MENTION),
		DesktopDuration:  ptrStr("3"),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.USER_NOTIFY_NONE),
		MobilePushStatus: ptrStr(model.STATUS_AWAY),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ANY),
		MentionKeys:      ptrStr("misc"),
	}
	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	user, err = th.App.GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_MENTION)
	checkNotifyProp(t, user, model.DESKTOP_DURATION_NOTIFY_PROP, "3")
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_NONE)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_AWAY)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ANY)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "misc")

	// Check Notify Props get set on *create* user.
	username = model.NewId()
	data = UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	data.NotifyProps = &UserNotifyPropsImportData{
		Desktop:          ptrStr(model.USER_NOTIFY_MENTION),
		DesktopDuration:  ptrStr("3"),
		DesktopSound:     ptrStr("false"),
		Email:            ptrStr("false"),
		Mobile:           ptrStr(model.USER_NOTIFY_NONE),
		MobilePushStatus: ptrStr(model.STATUS_AWAY),
		ChannelTrigger:   ptrStr("false"),
		CommentsTrigger:  ptrStr(model.COMMENTS_NOTIFY_ANY),
		MentionKeys:      ptrStr("misc"),
	}

	if err := th.App.ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	user, err = th.App.GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	checkNotifyProp(t, user, model.DESKTOP_NOTIFY_PROP, model.USER_NOTIFY_MENTION)
	checkNotifyProp(t, user, model.DESKTOP_DURATION_NOTIFY_PROP, "3")
	checkNotifyProp(t, user, model.DESKTOP_SOUND_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.EMAIL_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.PUSH_NOTIFY_PROP, model.USER_NOTIFY_NONE)
	checkNotifyProp(t, user, model.PUSH_STATUS_NOTIFY_PROP, model.STATUS_AWAY)
	checkNotifyProp(t, user, model.CHANNEL_MENTIONS_NOTIFY_PROP, "false")
	checkNotifyProp(t, user, model.COMMENTS_NOTIFY_PROP, model.COMMENTS_NOTIFY_ANY)
	checkNotifyProp(t, user, model.MENTION_KEYS_NOTIFY_PROP, "misc")
}

func AssertAllPostsCount(t *testing.T, a *App, initialCount int64, change int64, teamName string) {
	if result := <-a.Srv.Store.Post().AnalyticsPostCount(teamName, false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if initialCount+change != result.Data.(int64) {
			debug.PrintStack()
			t.Fatalf("Did not find the expected number of posts.")
		}
	}
}

func TestImportImportPost(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Create a Team.
	teamName := model.NewId()
	th.App.ImportTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := th.App.GetTeamByName(teamName)
	if err != nil {
		t.Fatalf("Failed to get team from database.")
	}

	// Create a Channel.
	channelName := model.NewId()
	th.App.ImportChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	channel, err := th.App.GetChannelByName(channelName, team.Id)
	if err != nil {
		t.Fatalf("Failed to get channel from database.")
	}

	// Create a user.
	username := model.NewId()
	th.App.ImportUser(&UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user, err := th.App.GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	// Count the number of posts in the testing team.
	var initialPostCount int64
	if result := <-th.App.Srv.Store.Post().AnalyticsPostCount(team.Id, false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		initialPostCount = result.Data.(int64)
	}

	// Try adding an invalid post in dry run mode.
	data := &PostImportData{
		Team:    &teamName,
		Channel: &channelName,
		User:    &username,
	}
	if err := th.App.ImportPost(data, true); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post in dry run mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Hello"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportPost(data, true); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding an invalid post in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid team in apply mode.
	data = &PostImportData{
		Team:     ptrStr(model.NewId()),
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid channel in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  ptrStr(model.NewId()),
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid user in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     ptrStr(model.NewId()),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, team.Id)

	// Try adding a valid post in apply mode.
	time := model.GetMillis()
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &time,
	}
	if err := th.App.ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, time); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id {
			t.Fatal("Post properties not as expected")
		}
	}

	// Update the post.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &time,
	}
	if err := th.App.ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 1, team.Id)

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, time); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id {
			t.Fatal("Post properties not as expected")
		}
	}

	// Save the post with a different time.
	newTime := time + 1
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &newTime,
	}
	if err := th.App.ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 2, team.Id)

	// Save the post with a different message.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message 2"),
		CreateAt: &time,
	}
	if err := th.App.ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 3, team.Id)

	// Test with hashtags
	hashtagTime := time + 2
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message 2 #hashtagmashupcity"),
		CreateAt: &hashtagTime,
	}
	if err := th.App.ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 4, team.Id)

	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, hashtagTime); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id {
			t.Fatal("Post properties not as expected")
		}
		if post.Hashtags != "#hashtagmashupcity" {
			t.Fatalf("Hashtags not as expected: %s", post.Hashtags)
		}
	}

	// Post with flags.
	username2 := model.NewId()
	th.App.ImportUser(&UserImportData{
		Username: &username2,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user2, err := th.App.GetUserByUsername(username2)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	flagsTime := hashtagTime + 1
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message with Favorites"),
		CreateAt: &flagsTime,
		FlaggedBy: &[]string{
			username,
			username2,
		},
	}
	if err := th.App.ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 5, team.Id)

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(channel.Id, flagsTime); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != user.Id {
			t.Fatal("Post properties not as expected")
		}

		checkPreference(t, th.App, user.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
		checkPreference(t, th.App, user2.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
	}
}

func TestImportImportDirectChannel(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	// Check how many channels are in the database.
	var directChannelCount int64
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_DIRECT); r.Err == nil {
		directChannelCount = r.Data.(int64)
	} else {
		t.Fatalf("Failed to get direct channel count.")
	}

	var groupChannelCount int64
	if r := <-th.App.Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_GROUP); r.Err == nil {
		groupChannelCount = r.Data.(int64)
	} else {
		t.Fatalf("Failed to get group channel count.")
	}

	// Do an invalid channel in dry-run mode.
	data := DirectChannelImportData{
		Members: &[]string{
			model.NewId(),
		},
		Header: ptrStr("Channel Header"),
	}
	if err := th.App.ImportDirectChannel(&data, true); err == nil {
		t.Fatalf("Expected error due to invalid name.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid DIRECT channel with a nonexistent member in dry-run mode.
	data.Members = &[]string{
		model.NewId(),
		model.NewId(),
	}
	if err := th.App.ImportDirectChannel(&data, true); err != nil {
		t.Fatalf("Expected success as cannot validate existance of channel members in dry run mode.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid GROUP channel with a nonexistent member in dry-run mode.
	data.Members = &[]string{
		model.NewId(),
		model.NewId(),
		model.NewId(),
	}
	if err := th.App.ImportDirectChannel(&data, true); err != nil {
		t.Fatalf("Expected success as cannot validate existance of channel members in dry run mode.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do an invalid channel in apply mode.
	data.Members = &[]string{
		model.NewId(),
	}
	if err := th.App.ImportDirectChannel(&data, false); err == nil {
		t.Fatalf("Expected error due to invalid member (apply mode).")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid DIRECT channel.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}

	// Check that one more DIRECT channel is in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do the same DIRECT channel again.
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatalf("Expected success.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Update the channel's HEADER
	data.Header = ptrStr("New Channel Header 2")
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatalf("Expected success.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Get the channel to check that the header was updated.
	if channel, err := th.App.createDirectChannel(th.BasicUser.Id, th.BasicUser2.Id); err == nil || err.Id != store.CHANNEL_EXISTS_ERROR {
		t.Fatal("Should have got store.CHANNEL_EXISTS_ERROR")
	} else {
		if channel.Header != *data.Header {
			t.Fatal("Channel header has not been updated successfully.")
		}
	}

	// Do a GROUP channel with an extra invalid member.
	user3 := th.CreateUser()
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
		user3.Username,
		model.NewId(),
	}
	if err := th.App.ImportDirectChannel(&data, false); err == nil {
		t.Fatalf("Should have failed due to invalid member in list.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount)

	// Do a valid GROUP channel.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
		user3.Username,
	}
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatalf("Expected success.")
	}

	// Check that one more GROUP channel is in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount+1)

	// Do the same DIRECT channel again.
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatalf("Expected success.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount+1)

	// Update the channel's HEADER
	data.Header = ptrStr("New Channel Header 3")
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatalf("Expected success.")
	}

	// Check that no more channels are in the DB.
	AssertChannelCount(t, th.App, model.CHANNEL_DIRECT, directChannelCount+1)
	AssertChannelCount(t, th.App, model.CHANNEL_GROUP, groupChannelCount+1)

	// Get the channel to check that the header was updated.
	userIds := []string{
		th.BasicUser.Id,
		th.BasicUser2.Id,
		user3.Id,
	}
	if channel, err := th.App.createGroupChannel(userIds, th.BasicUser.Id); err.Id != store.CHANNEL_EXISTS_ERROR {
		t.Fatal("Should have got store.CHANNEL_EXISTS_ERROR")
	} else {
		if channel.Header != *data.Header {
			t.Fatal("Channel header has not been updated successfully.")
		}
	}

	// Import a channel with some favorites.
	data.Members = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	data.FavoritedBy = &[]string{
		th.BasicUser.Username,
		th.BasicUser2.Username,
	}
	if err := th.App.ImportDirectChannel(&data, false); err != nil {
		t.Fatal(err)
	}

	if channel, err := th.App.createDirectChannel(th.BasicUser.Id, th.BasicUser2.Id); err == nil || err.Id != store.CHANNEL_EXISTS_ERROR {
		t.Fatal("Should have got store.CHANNEL_EXISTS_ERROR")
	} else {
		checkPreference(t, th.App, th.BasicUser.Id, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id, "true")
		checkPreference(t, th.App, th.BasicUser2.Id, model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL, channel.Id, "true")
	}
}

func AssertChannelCount(t *testing.T, a *App, channelType string, expectedCount int64) {
	if r := <-a.Srv.Store.Channel().AnalyticsTypeCount("", channelType); r.Err == nil {
		count := r.Data.(int64)
		if count != expectedCount {
			debug.PrintStack()
			t.Fatalf("Channel count of type: %v. Expected: %v, Got: %v", channelType, expectedCount, count)
		}
	} else {
		debug.PrintStack()
		t.Fatalf("Failed to get channel count.")
	}
}

func TestImportImportDirectPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	// Create the DIRECT channel.
	channelData := DirectChannelImportData{
		Members: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
	}
	if err := th.App.ImportDirectChannel(&channelData, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}

	// Get the channel.
	var directChannel *model.Channel
	if channel, err := th.App.createDirectChannel(th.BasicUser.Id, th.BasicUser2.Id); err.Id != store.CHANNEL_EXISTS_ERROR {
		t.Fatal("Should have got store.CHANNEL_EXISTS_ERROR")
	} else {
		directChannel = channel
	}

	// Get the number of posts in the system.
	var initialPostCount int64
	if result := <-th.App.Srv.Store.Post().AnalyticsPostCount("", false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		initialPostCount = result.Data.(int64)
	}

	// Try adding an invalid post in dry run mode.
	data := &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, true); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in dry run mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, true); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding an invalid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			model.NewId(),
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != th.BasicUser.Id {
			t.Fatal("Post properties not as expected")
		}
	}

	// Import the post again.
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != th.BasicUser.Id {
			t.Fatal("Post properties not as expected")
		}
	}

	// Save the post with a different time.
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 2, "")

	// Save the post with a different message.
	data.Message = ptrStr("Message 2")
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 3, "")

	// Test with hashtags
	data.Message = ptrStr("Message 2 #hashtagmashupcity")
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != th.BasicUser.Id {
			t.Fatal("Post properties not as expected")
		}
		if post.Hashtags != "#hashtagmashupcity" {
			t.Fatalf("Hashtags not as expected: %s", post.Hashtags)
		}
	}

	// Test with some flags.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		FlaggedBy: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}

	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(directChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		checkPreference(t, th.App, th.BasicUser.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
		checkPreference(t, th.App, th.BasicUser2.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
	}

	// ------------------ Group Channel -------------------------

	// Create the GROUP channel.
	user3 := th.CreateUser()
	channelData = DirectChannelImportData{
		Members: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
	}
	if err := th.App.ImportDirectChannel(&channelData, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}

	// Get the channel.
	var groupChannel *model.Channel
	userIds := []string{
		th.BasicUser.Id,
		th.BasicUser2.Id,
		user3.Id,
	}
	if channel, err := th.App.createGroupChannel(userIds, th.BasicUser.Id); err.Id != store.CHANNEL_EXISTS_ERROR {
		t.Fatal("Should have got store.CHANNEL_EXISTS_ERROR")
	} else {
		groupChannel = channel
	}

	// Get the number of posts in the system.
	if result := <-th.App.Srv.Store.Post().AnalyticsPostCount("", false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		initialPostCount = result.Data.(int64)
	}

	// Try adding an invalid post in dry run mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, true); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in dry run mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, true); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding an invalid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
			model.NewId(),
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 0, "")

	// Try adding a valid post in apply mode.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != th.BasicUser.Id {
			t.Fatal("Post properties not as expected")
		}
	}

	// Import the post again.
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 1, "")

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != th.BasicUser.Id {
			t.Fatal("Post properties not as expected")
		}
	}

	// Save the post with a different time.
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 2, "")

	// Save the post with a different message.
	data.Message = ptrStr("Message 2")
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 3, "")

	// Test with hashtags
	data.Message = ptrStr("Message 2 #hashtagmashupcity")
	data.CreateAt = ptrInt64(*data.CreateAt + 1)
	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, th.App, initialPostCount, 4, "")

	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		if post.Message != *data.Message || post.CreateAt != *data.CreateAt || post.UserId != th.BasicUser.Id {
			t.Fatal("Post properties not as expected")
		}
		if post.Hashtags != "#hashtagmashupcity" {
			t.Fatalf("Hashtags not as expected: %s", post.Hashtags)
		}
	}

	// Test with some flags.
	data = &DirectPostImportData{
		ChannelMembers: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
			user3.Username,
		},
		FlaggedBy: &[]string{
			th.BasicUser.Username,
			th.BasicUser2.Username,
		},
		User:     ptrStr(th.BasicUser.Username),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}

	if err := th.App.ImportDirectPost(data, false); err != nil {
		t.Fatalf("Expected success: %v", err.Error())
	}

	// Check the post values.
	if result := <-th.App.Srv.Store.Post().GetPostsCreatedAt(groupChannel.Id, *data.CreateAt); result.Err != nil {
		t.Fatal(result.Err.Error())
	} else {
		posts := result.Data.([]*model.Post)
		if len(posts) != 1 {
			t.Fatal("Unexpected number of posts found.")
		}
		post := posts[0]
		checkPreference(t, th.App, th.BasicUser.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
		checkPreference(t, th.App, th.BasicUser2.Id, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id, "true")
	}
}

func TestImportImportLine(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	// Try import line with an invalid type.
	line := LineImportData{
		Type: "gibberish",
	}

	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with invalid type.")
	}

	// Try import line with team type but nil team.
	line.Type = "team"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line of type team with a nil team.")
	}

	// Try import line with channel type but nil channel.
	line.Type = "channel"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type channel with a nil channel.")
	}

	// Try import line with user type but nil user.
	line.Type = "user"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type uesr with a nil user.")
	}

	// Try import line with post type but nil post.
	line.Type = "post"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type post with a nil post.")
	}

	// Try import line with direct_channel type but nil direct_channel.
	line.Type = "direct_channel"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type direct_channel with a nil direct_channel.")
	}

	// Try import line with direct_post type but nil direct_post.
	line.Type = "direct_post"
	if err := th.App.ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type direct_post with a nil direct_post.")
	}
}

func TestImportBulkImport(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	teamName := model.NewId()
	channelName := model.NewId()
	username := model.NewId()
	username2 := model.NewId()
	username3 := model.NewId()

	// Run bulk import with a valid 1 of everything.
	data1 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username2 + `", "email": "` + username2 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "user", "user": {"username": "` + username3 + `", "email": "` + username3 + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username2 + `"]}}
{"type": "direct_channel", "direct_channel": {"members": ["` + username + `", "` + username2 + `", "` + username3 + `"]}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username2 + `"], "user": "` + username + `", "message": "Hello Direct Channel", "create_at": 123456789013}}
{"type": "direct_post", "direct_post": {"channel_members": ["` + username + `", "` + username2 + `", "` + username3 + `"], "user": "` + username + `", "message": "Hello Group Channel", "create_at": 123456789014}}`

	if err, line := th.App.BulkImport(strings.NewReader(data1), false, 2); err != nil || line != 0 {
		t.Fatalf("BulkImport should have succeeded: %v, %v", err.Error(), line)
	}

	// Run bulk import using a string that contains a line with invalid json.
	data2 := `{"type": "version", "version": 1`
	if err, line := th.App.BulkImport(strings.NewReader(data2), false, 2); err == nil || line != 1 {
		t.Fatalf("Should have failed due to invalid JSON on line 1.")
	}

	// Run bulk import using valid JSON but missing version line at the start.
	data3 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "kufjgnkxkrhhfgbrip6qxkfsaa", "email": "kufjgnkxkrhhfgbrip6qxkfsaa@example.com"}}
{"type": "user", "user": {"username": "bwshaim6qnc2ne7oqkd5b2s2rq", "email": "bwshaim6qnc2ne7oqkd5b2s2rq@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}`
	if err, line := th.App.BulkImport(strings.NewReader(data3), false, 2); err == nil || line != 1 {
		t.Fatalf("Should have failed due to missing version line on line 1.")
	}
}

func TestImportProcessImportDataFileVersionLine(t *testing.T) {
	data := LineImportData{
		Type:    "version",
		Version: ptrInt(1),
	}
	if version, err := processImportDataFileVersionLine(data); err != nil || version != 1 {
		t.Fatalf("Expected no error and version 1.")
	}

	data.Type = "NotVersion"
	if _, err := processImportDataFileVersionLine(data); err == nil {
		t.Fatalf("Expected error on invalid version line.")
	}

	data.Type = "version"
	data.Version = nil
	if _, err := processImportDataFileVersionLine(data); err == nil {
		t.Fatalf("Expected error on invalid version line.")
	}
}
