// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"runtime/debug"
	"strings"
	"testing"
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

	// Invalid desktop notify props.
	data[0].NotifyProps.Desktop = ptrStr("mention")
	data[0].NotifyProps.MarkUnread = ptrStr("invalid")
	if err := validateUserChannelsImportData(&data); err == nil {
		t.Fatal("Should have failed with invalid mark_unread notify props.")
	}

	// Empty notify props.
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

func TestImportImportTeam(t *testing.T) {
	_ = Setup()

	// Check how many teams are in the database.
	var teamsCount int64
	if r := <-Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
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
	if err := ImportTeam(&data, true); err == nil {
		t.Fatalf("Should have received an error importing an invalid team.")
	}

	// Do a valid team in dry-run mode.
	data.Type = ptrStr("O")
	if err := ImportTeam(&data, true); err != nil {
		t.Fatalf("Received an error validating valid team.")
	}

	// Check that no more teams are in the DB.
	if r := <-Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64) != teamsCount {
			t.Fatalf("Teams got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Do an invalid team in apply mode, check db changes.
	data.Type = ptrStr("XYZ")
	if err := ImportTeam(&data, false); err == nil {
		t.Fatalf("Import should have failed on invalid team.")
	}

	// Check that no more teams are in the DB.
	if r := <-Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64) != teamsCount {
			t.Fatalf("Invalid team got persisted.")
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Do a valid team in apply mode, check db changes.
	data.Type = ptrStr("O")
	if err := ImportTeam(&data, false); err != nil {
		t.Fatalf("Received an error importing valid team.")
	}

	// Check that one more team is in the DB.
	if r := <-Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64)-1 != teamsCount {
			t.Fatalf("Team did not get saved in apply run mode. analytics=%v teamcount=%v", r.Data.(int64), teamsCount)
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Get the team and check that all the fields are correct.
	if team, err := GetTeamByName(*data.Name); err != nil {
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
	if err := ImportTeam(&data, false); err != nil {
		t.Fatalf("Received an error importing updated valid team.")
	}

	if r := <-Srv.Store.Team().AnalyticsTeamCount(); r.Err == nil {
		if r.Data.(int64)-1 != teamsCount {
			t.Fatalf("Team alterations did not get saved in apply run mode. analytics=%v teamcount=%v", r.Data.(int64), teamsCount)
		}
	} else {
		t.Fatalf("Failed to get team count.")
	}

	// Get the team and check that all fields are correct.
	if team, err := GetTeamByName(*data.Name); err != nil {
		t.Fatalf("Failed to get team from database.")
	} else {
		if team.DisplayName != *data.DisplayName || team.Type != *data.Type || team.Description != *data.Description || team.AllowOpenInvite != *data.AllowOpenInvite {
			t.Fatalf("Updated team properties do not match import data.")
		}
	}
}

func TestImportImportChannel(t *testing.T) {
	_ = Setup()

	// Import a Team.
	teamName := model.NewId()
	ImportTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := GetTeamByName(teamName)
	if err != nil {
		t.Fatalf("Failed to get team from database.")
	}

	// Check how many channels are in the database.
	var channelCount int64
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
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
	if err := ImportChannel(&data, true); err == nil {
		t.Fatalf("Expected error due to invalid name.")
	}

	// Check that no more channels are in the DB.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Channels got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel with a nonexistent team in dry-run mode.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	if err := ImportChannel(&data, true); err != nil {
		t.Fatalf("Expected success as cannot validate channel name in dry run mode.")
	}

	// Check that no more channels are in the DB.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Channels got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel in dry-run mode.
	data.Team = &teamName
	if err := ImportChannel(&data, true); err != nil {
		t.Fatalf("Expected success as valid team.")
	}

	// Check that no more channels are in the DB.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Channels got persisted in dry run mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do an invalid channel in apply mode.
	data.Name = nil
	if err := ImportChannel(&data, false); err == nil {
		t.Fatalf("Expected error due to invalid name (apply mode).")
	}

	// Check that no more channels are in the DB.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Invalid channel got persisted in apply mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel in apply mode with a nonexistant team.
	data.Name = ptrStr("channelname")
	data.Team = ptrStr(model.NewId())
	if err := ImportChannel(&data, false); err == nil {
		t.Fatalf("Expected error due to non-existant team (apply mode).")
	}

	// Check that no more channels are in the DB.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Invalid team channel got persisted in apply mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Do a valid channel in apply mode.
	data.Team = &teamName
	if err := ImportChannel(&data, false); err != nil {
		t.Fatalf("Expected success in apply mode: %v", err.Error())
	}

	// Check that no more channels are in the DB.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount+1 {
			t.Fatalf("Channels did not get persisted in apply mode: found %v expected %v + 1", r.Data.(int64), channelCount)
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Get the Channel and check all the fields are correct.
	if channel, err := GetChannelByName(*data.Name, team.Id); err != nil {
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
	if err := ImportChannel(&data, false); err != nil {
		t.Fatalf("Expected success in apply mode: %v", err.Error())
	}

	// Check channel count the same.
	if r := <-Srv.Store.Channel().AnalyticsTypeCount("", model.CHANNEL_OPEN); r.Err == nil {
		if r.Data.(int64) != channelCount {
			t.Fatalf("Updated channel did not get correctly persisted in apply mode.")
		}
	} else {
		t.Fatalf("Failed to get channel count.")
	}

	// Get the Channel and check all the fields are correct.
	if channel, err := GetChannelByName(*data.Name, team.Id); err != nil {
		t.Fatalf("Failed to get channel from database.")
	} else {
		if channel.Name != *data.Name || channel.DisplayName != *data.DisplayName || channel.Type != *data.Type || channel.Header != *data.Header || channel.Purpose != *data.Purpose {
			t.Fatalf("Updated team properties do not match Import Data.")
		}
	}

}

func TestImportImportUser(t *testing.T) {
	_ = Setup()

	// Check how many users are in the database.
	var userCount int64
	if r := <-Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		userCount = r.Data.(int64)
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do an invalid user in dry-run mode.
	data := UserImportData{
		Username: ptrStr("n" + model.NewId()),
	}
	if err := ImportUser(&data, true); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	// Check that no more users are in the DB.
	if r := <-Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do a valid user in dry-run mode.
	data = UserImportData{
		Username: ptrStr("n" + model.NewId()),
		Email:    ptrStr(model.NewId() + "@example.com"),
	}
	if err := ImportUser(&data, true); err != nil {
		t.Fatalf("Should have succeeded to import valid user.")
	}

	// Check that no more users are in the DB.
	if r := <-Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
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
	if err := ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed to import invalid user.")
	}

	// Check that no more users are in the DB.
	if r := <-Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Do a valid user in apply mode.
	username := "n" + model.NewId()
	data = UserImportData{
		Username:  &username,
		Email:     ptrStr(model.NewId() + "@example.com"),
		Nickname:  ptrStr(model.NewId()),
		FirstName: ptrStr(model.NewId()),
		LastName:  ptrStr(model.NewId()),
		Position:  ptrStr(model.NewId()),
	}
	if err := ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded to import valid user.")
	}

	// Check that one more user is in the DB.
	if r := <-Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount+1 {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Get the user and check all the fields are correct.
	if user, err := GetUserByUsername(username); err != nil {
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

		if user.Locale != *utils.Cfg.LocalizationSettings.DefaultClientLocale {
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
	if err := ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded to update valid user %v", err)
	}

	// Check user count the same.
	if r := <-Srv.Store.User().GetTotalUsersCount(); r.Err == nil {
		if r.Data.(int64) != userCount+1 {
			t.Fatalf("Unexpected number of users")
		}
	} else {
		t.Fatalf("Failed to get user count.")
	}

	// Get the user and check all the fields are correct.
	if user, err := GetUserByUsername(username); err != nil {
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

	// Test team and channel memberships
	teamName := model.NewId()
	ImportTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := GetTeamByName(teamName)
	if err != nil {
		t.Fatalf("Failed to get team from database.")
	}

	channelName := model.NewId()
	ImportChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	channel, err := GetChannelByName(channelName, team.Id)
	if err != nil {
		t.Fatalf("Failed to get channel from database.")
	}

	username = "n" + model.NewId()
	data = UserImportData{
		Username:  &username,
		Email:     ptrStr(model.NewId() + "@example.com"),
		Nickname:  ptrStr(model.NewId()),
		FirstName: ptrStr(model.NewId()),
		LastName:  ptrStr(model.NewId()),
		Position:  ptrStr(model.NewId()),
	}

	teamMembers, err := GetTeamMembers(team.Id, 0, 1000)
	if err != nil {
		t.Fatalf("Failed to get team member count")
	}
	teamMemberCount := len(teamMembers)

	channelMemberCount, err := GetChannelMemberCount(channel.Id)
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
	if err := ImportUser(&data, true); err == nil {
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
	if err := ImportUser(&data, true); err == nil {
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
	if err := ImportUser(&data, true); err == nil {
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
	if err := ImportUser(&data, true); err != nil {
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
	if err := ImportUser(&data, true); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check no new member objects were created because dry run mode.
	if tmc, err := GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := GetChannelMemberCount(channel.Id); err != nil {
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
	if err := ImportUser(&data, false); err == nil {
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
	if err := ImportUser(&data, false); err == nil {
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
	if err := ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Check no new member objects were created because all tests should have failed so far.
	if tmc, err := GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := GetChannelMemberCount(channel.Id); err != nil {
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
	if err := ImportUser(&data, false); err == nil {
		t.Fatalf("Should have failed.")
	}

	// Check only new team member object created because dry run mode.
	if tmc, err := GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount+1 {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount {
		t.Fatalf("Number of channel members not as expected")
	}

	// Check team member properties.
	user, err := GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}
	if teamMember, err := GetTeamMember(team.Id, user.Id); err != nil {
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
	if err := ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check only new channel member object created because dry run mode.
	if tmc, err := GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount+1 {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount+1 {
		t.Fatalf("Number of channel members not as expected")
	}

	// Check channel member properties.
	if channelMember, err := GetChannelMember(channel.Id, user.Id); err != nil {
		t.Fatalf("Failed to get channel member from database.")
	} else if channelMember.Roles != "channel_user" || channelMember.NotifyProps[model.DESKTOP_NOTIFY_PROP] != "default" || channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] != "all" {
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
						MarkUnread: ptrStr(model.USER_NOTIFY_MENTION),
					},
				},
			},
		},
	}
	if err := ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check both member properties.
	if teamMember, err := GetTeamMember(team.Id, user.Id); err != nil {
		t.Fatalf("Failed to get team member from database.")
	} else if teamMember.Roles != "team_user team_admin" {
		t.Fatalf("Team member properties not as expected: %v", teamMember.Roles)
	}

	if channelMember, err := GetChannelMember(channel.Id, user.Id); err != nil {
		t.Fatalf("Failed to get channel member Desktop from database.")
	} else if channelMember.Roles != "channel_user channel_admin" && channelMember.NotifyProps[model.DESKTOP_NOTIFY_PROP] == model.USER_NOTIFY_MENTION && channelMember.NotifyProps[model.MARK_UNREAD_NOTIFY_PROP] == model.USER_NOTIFY_MENTION {
		t.Fatalf("Channel member properties not as expected")
	}

	// No more new member objects.
	if tmc, err := GetTeamMembers(team.Id, 0, 1000); err != nil {
		t.Fatalf("Failed to get Team Member Count")
	} else if len(tmc) != teamMemberCount+1 {
		t.Fatalf("Number of team members not as expected")
	}

	if cmc, err := GetChannelMemberCount(channel.Id); err != nil {
		t.Fatalf("Failed to get Channel Member Count")
	} else if cmc != channelMemberCount+1 {
		t.Fatalf("Number of channel members not as expected")
	}

	// Add a user with some preferences.
	username = "n" + model.NewId()
	data = UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#DCBD4E","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBj":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		SelectedFont:       ptrStr("Roboto Slab"),
		UseMilitaryTime:    ptrStr("true"),
		NameFormat:         ptrStr("nickname_full_name"),
		CollapsePreviews:   ptrStr("true"),
		MessageDisplay:     ptrStr("compact"),
		ChannelDisplayMode: ptrStr("centered"),
	}
	if err := ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check their values.
	user, err = GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	if res := <-Srv.Store.Preference().GetCategory(user.Id, model.PREFERENCE_CATEGORY_THEME); res.Err != nil {
		t.Fatalf("Failed to get theme category preferences")
	} else {
		preferences := res.Data.(model.Preferences)
		for _, preference := range preferences {
			if preference.Name == "" && preference.Value != *data.Theme {
				t.Fatalf("Preference does not match.")
			}
		}
	}

	if res := <-Srv.Store.Preference().GetCategory(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS); res.Err != nil {
		t.Fatalf("Failed to get display category preferences")
	} else {
		preferences := res.Data.(model.Preferences)
		for _, preference := range preferences {
			if preference.Name == "selected_font" && preference.Value != *data.SelectedFont {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "use_military_time" && preference.Value != *data.UseMilitaryTime {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "name_format" && preference.Value != *data.NameFormat {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "collapse_previews" && preference.Value != *data.CollapsePreviews {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "message_display" && preference.Value != *data.MessageDisplay {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "channel_display_mode" && preference.Value != *data.ChannelDisplayMode {
				t.Fatalf("Preference does not match.")
			}
		}
	}

	// Change those preferences.
	data = UserImportData{
		Username:           &username,
		Email:              ptrStr(model.NewId() + "@example.com"),
		Theme:              ptrStr(`{"awayIndicator":"#123456","buttonBg":"#23A2FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBj":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`),
		SelectedFont:       ptrStr("Lato"),
		UseMilitaryTime:    ptrStr("false"),
		NameFormat:         ptrStr("full_name"),
		CollapsePreviews:   ptrStr("false"),
		MessageDisplay:     ptrStr("clean"),
		ChannelDisplayMode: ptrStr("full"),
	}
	if err := ImportUser(&data, false); err != nil {
		t.Fatalf("Should have succeeded.")
	}

	// Check their values again.
	if res := <-Srv.Store.Preference().GetCategory(user.Id, model.PREFERENCE_CATEGORY_THEME); res.Err != nil {
		t.Fatalf("Failed to get theme category preferences")
	} else {
		preferences := res.Data.(model.Preferences)
		for _, preference := range preferences {
			if preference.Name == "" && preference.Value != *data.Theme {
				t.Fatalf("Preference does not match.")
			}
		}
	}

	if res := <-Srv.Store.Preference().GetCategory(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS); res.Err != nil {
		t.Fatalf("Failed to get display category preferences")
	} else {
		preferences := res.Data.(model.Preferences)
		for _, preference := range preferences {
			if preference.Name == "selected_font" && preference.Value != *data.SelectedFont {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "use_military_time" && preference.Value != *data.UseMilitaryTime {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "name_format" && preference.Value != *data.NameFormat {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "collapse_previews" && preference.Value != *data.CollapsePreviews {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "message_display" && preference.Value != *data.MessageDisplay {
				t.Fatalf("Preference does not match.")
			}

			if preference.Name == "channel_display_mode" && preference.Value != *data.ChannelDisplayMode {
				t.Fatalf("Preference does not match.")
			}
		}
	}
}

func AssertAllPostsCount(t *testing.T, initialCount int64, change int64, teamName string) {
	if result := <-Srv.Store.Post().AnalyticsPostCount(teamName, false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		if initialCount+change != result.Data.(int64) {
			debug.PrintStack()
			t.Fatalf("Did not find the expected number of posts.")
		}
	}
}

func TestImportImportPost(t *testing.T) {
	_ = Setup()

	// Create a Team.
	teamName := model.NewId()
	ImportTeam(&TeamImportData{
		Name:        &teamName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	team, err := GetTeamByName(teamName)
	if err != nil {
		t.Fatalf("Failed to get team from database.")
	}

	// Create a Channel.
	channelName := model.NewId()
	ImportChannel(&ChannelImportData{
		Team:        &teamName,
		Name:        &channelName,
		DisplayName: ptrStr("Display Name"),
		Type:        ptrStr("O"),
	}, false)
	channel, err := GetChannelByName(channelName, team.Id)
	if err != nil {
		t.Fatalf("Failed to get channel from database.")
	}

	// Create a user.
	username := "n" + model.NewId()
	ImportUser(&UserImportData{
		Username: &username,
		Email:    ptrStr(model.NewId() + "@example.com"),
	}, false)
	user, err := GetUserByUsername(username)
	if err != nil {
		t.Fatalf("Failed to get user from database.")
	}

	// Count the number of posts in the testing team.
	var initialPostCount int64
	if result := <-Srv.Store.Post().AnalyticsPostCount(team.Id, false, false); result.Err != nil {
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
	if err := ImportPost(data, true); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, initialPostCount, 0, team.Id)

	// Try adding a valid post in dry run mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Hello"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := ImportPost(data, true); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, initialPostCount, 0, team.Id)

	// Try adding an invalid post in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid team in apply mode.
	data = &PostImportData{
		Team:     ptrStr(model.NewId()),
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid channel in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  ptrStr(model.NewId()),
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, initialPostCount, 0, team.Id)

	// Try adding a valid post with invalid user in apply mode.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     ptrStr(model.NewId()),
		Message:  ptrStr("Message"),
		CreateAt: ptrInt64(model.GetMillis()),
	}
	if err := ImportPost(data, false); err == nil {
		t.Fatalf("Expected error.")
	}
	AssertAllPostsCount(t, initialPostCount, 0, team.Id)

	// Try adding a valid post in apply mode.
	time := model.GetMillis()
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message"),
		CreateAt: &time,
	}
	if err := ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, initialPostCount, 1, team.Id)

	// Check the post values.
	if result := <-Srv.Store.Post().GetPostsCreatedAt(channel.Id, time); result.Err != nil {
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
	if err := ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, initialPostCount, 1, team.Id)

	// Check the post values.
	if result := <-Srv.Store.Post().GetPostsCreatedAt(channel.Id, time); result.Err != nil {
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
	if err := ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, initialPostCount, 2, team.Id)

	// Save the post with a different message.
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message 2"),
		CreateAt: &time,
	}
	if err := ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, initialPostCount, 3, team.Id)

	// Test with hashtags
	hashtagTime := time + 2
	data = &PostImportData{
		Team:     &teamName,
		Channel:  &channelName,
		User:     &username,
		Message:  ptrStr("Message 2 #hashtagmashupcity"),
		CreateAt: &hashtagTime,
	}
	if err := ImportPost(data, false); err != nil {
		t.Fatalf("Expected success.")
	}
	AssertAllPostsCount(t, initialPostCount, 4, team.Id)

	if result := <-Srv.Store.Post().GetPostsCreatedAt(channel.Id, hashtagTime); result.Err != nil {
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
}

func TestImportImportLine(t *testing.T) {
	_ = Setup()

	// Try import line with an invalid type.
	line := LineImportData{
		Type: "gibberish",
	}

	if err := ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with invalid type.")
	}

	// Try import line with team type but nil team.
	line.Type = "team"
	if err := ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line of type team with a nil team.")
	}

	// Try import line with channel type but nil channel.
	line.Type = "channel"
	if err := ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type channel with a nil channel.")
	}

	// Try import line with user type but nil user.
	line.Type = "user"
	if err := ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type uesr with a nil user.")
	}

	// Try import line with post type but nil post.
	line.Type = "post"
	if err := ImportLine(line, false); err == nil {
		t.Fatalf("Expected an error when importing a line with type post with a nil post.")
	}
}

func TestImportBulkImport(t *testing.T) {
	_ = Setup()

	teamName := model.NewId()
	channelName := model.NewId()
	username := "n" + model.NewId()

	// Run bulk import with a valid 1 of everything.
	data1 := `{"type": "version", "version": 1}
{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "` + username + `", "email": "` + username + `@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}
{"type": "post", "post": {"team": "` + teamName + `", "channel": "` + channelName + `", "user": "` + username + `", "message": "Hello World", "create_at": 123456789012}}`

	if err, line := BulkImport(strings.NewReader(data1), false); err != nil || line != 0 {
		t.Fatalf("BulkImport should have succeeded: %v, %v", err.Error(), line)
	}

	// Run bulk import using a string that contains a line with invalid json.
	data2 := `{"type": "version", "version": 1`
	if err, line := BulkImport(strings.NewReader(data2), false); err == nil || line != 1 {
		t.Fatalf("Should have failed due to invalid JSON on line 1.")
	}

	// Run bulk import using valid JSON but missing version line at the start.
	data3 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}
{"type": "user", "user": {"username": "kufjgnkxkrhhfgbrip6qxkfsaa", "email": "kufjgnkxkrhhfgbrip6qxkfsaa@example.com"}}
{"type": "user", "user": {"username": "bwshaim6qnc2ne7oqkd5b2s2rq", "email": "bwshaim6qnc2ne7oqkd5b2s2rq@example.com", "teams": [{"name": "` + teamName + `", "channels": [{"name": "` + channelName + `"}]}]}}`
	if err, line := BulkImport(strings.NewReader(data3), false); err == nil || line != 1 {
		t.Fatalf("Should have failed due to missing version line on line 1.")
	}
}

func TestImportProcessImportDataFileVersionLine(t *testing.T) {
	_ = Setup()

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
