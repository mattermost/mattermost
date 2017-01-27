// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/platform/model"
	"strings"
	"testing"
)

func ptrStr(s string) *string {
	return &s
}

func ptrInt64(i int64) *int64 {
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
		Type:            ptrStr("XXX"),
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
	data.Type = ptrStr("XXX")
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
			t.Fatalf("Team did not get saved in apply run mode.", r.Data.(int64), teamsCount)
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
			t.Fatalf("Team alterations did not get saved in apply run mode.", r.Data.(int64), teamsCount)
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
	var team *model.Team
	if te, err := GetTeamByName(teamName); err != nil {
		t.Fatalf("Failed to get team from database.")
	} else {
		team = te
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
}

func TestImportBulkImport(t *testing.T) {
	_ = Setup()

	teamName := model.NewId()
	channelName := model.NewId()

	// Run bulk import with a valid 1 of everything.
	data1 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "` + teamName + `"}}
{"type": "channel", "channel": {"type": "O", "display_name": "xr6m6udffngark2uekvr3hoeny", "team": "` + teamName + `", "name": "` + channelName + `"}}`

	if err, line := BulkImport(strings.NewReader(data1), false); err != nil || line != 0 {
		t.Fatalf("BulkImport should have succeeded: %v, %v", err.Error(), line)
	}

	// Run bulk import using a string that contains a line with invalid json.
	data2 := `{"type": "team", "team": {"type": "O", "display_name": "lskmw2d7a5ao7ppwqh5ljchvr4", "name": "vinewy665jam3n6oxzhsdgajly"}`
	if err, line := BulkImport(strings.NewReader(data2), false); err == nil || line != 1 {
		t.Fatalf("Should have failed due to invalid JSON on line 1.")
	}
}
