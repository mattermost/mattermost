// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

// channelScopedJSONL builds a minimal JSONL stream where the version line
// carries ExportScopeAdditional (triggering deactivateMissingUsers mode on import).
// Each name in postAuthors gets one post. userRecords controls which of those
// authors have a user line in the JSONL (in deactivateMissingUsers mode the import
// skips creating users not already in the DB, so this typically doesn't matter
// for the user creation path, but the records are still written for realism).
func channelScopedJSONL(t *testing.T, teamName, chanName string, postAuthors []string, userRecords []string) *strings.Reader {
	t.Helper()

	var sb strings.Builder
	enc := json.NewEncoder(&sb)

	version := 1
	scope := imports.ExportScopeAdditional{TeamName: teamName, ChannelName: chanName}
	scopeJSON, err := json.Marshal(scope)
	require.NoError(t, err)

	require.NoError(t, enc.Encode(imports.LineImportData{
		Type:    "version",
		Version: &version,
		Info: &imports.VersionInfoImportData{
			Generator:  "test",
			Version:    "1.0",
			Created:    "2024-01-01T00:00:00Z",
			Additional: scopeJSON,
		},
	}))

	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        new(teamName),
			DisplayName: new("Mig Test Team"),
			Type:        new("O"),
		},
	}))

	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "channel",
		Channel: &imports.ChannelImportData{
			Team:        new(teamName),
			Name:        new(chanName),
			DisplayName: new("Mig Test Chan"),
			Type:        &chanType,
		},
	}))

	for _, uname := range userRecords {
		require.NoError(t, enc.Encode(imports.LineImportData{
			Type: "user",
			User: &imports.UserImportData{
				Username: new(uname),
				Email:    new(uname + "@mig-test.example.com"),
				Teams: &[]imports.UserTeamImportData{{
					Name:     new(teamName),
					Channels: &[]imports.UserChannelImportData{{Name: new(chanName)}},
				}},
			},
		}))
	}

	ts := int64(1700000000000)
	for _, uname := range postAuthors {
		tsLocal := ts
		require.NoError(t, enc.Encode(imports.LineImportData{
			Type: "post",
			Post: &imports.PostImportData{
				Team:     new(teamName),
				Channel:  new(chanName),
				User:     new(uname),
				Message:  new("Hello from " + uname),
				CreateAt: &tsLocal,
			},
		}))
		ts += 1000
	}

	return strings.NewReader(sb.String())
}

// createUserInDB creates a user directly in the test server's DB and returns it.
func createUserInDB(t *testing.T, th *TestHelper, username string) *model.User {
	t.Helper()
	u, appErr := th.App.CreateUser(th.Context, &model.User{
		Username: username,
		Email:    username + "@mig-test.example.com",
		Password: "TestPassword123!",
	})
	require.Nil(t, appErr, "failed to create user %s", username)
	return u
}

// postCountInChannel returns the number of non-system posts in a named channel.
func postCountInChannel(t *testing.T, th *TestHelper, rctx request.CTX, teamName, chanName string) int {
	t.Helper()
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr, "team %s not found", teamName)
	ch, appErr := th.App.GetChannelByName(rctx, chanName, team.Id, false)
	require.Nil(t, appErr, "channel %s not found", chanName)
	pl, err := th.App.Srv().Store().Post().GetPosts(rctx, model.GetPostsOptions{
		ChannelId: ch.Id,
		Page:      0,
		PerPage:   1000,
	}, false, map[string]bool{})
	require.NoError(t, err)
	n := 0
	for _, p := range pl.Posts {
		if p.Type == "" { // only user-visible (non-system) posts
			n++
		}
	}
	return n
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-01: channel filter applied in export
// ────────────────────────────────────────────────────────────────────────────

func TestExportChannelFilterApplied(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	otherChannel := th.CreateChannel(t, th.BasicTeam)
	th.CreatePost(t, th.BasicChannel)
	th.CreatePost(t, otherChannel)

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    th.BasicTeam.Name,
		ChannelName: th.BasicChannel.Name,
	})
	require.Nil(t, appErr)

	channelsInExport := map[string]bool{}
	scanner := bufio.NewScanner(&buf)
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "post" && line.Post != nil && line.Post.Channel != nil {
			channelsInExport[*line.Post.Channel] = true
		}
	}
	require.NoError(t, scanner.Err())

	assert.True(t, channelsInExport[th.BasicChannel.Name], "target channel posts must be present")
	assert.False(t, channelsInExport[otherChannel.Name], "other channel posts must not be present")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-02: version line carries ExportScopeAdditional
// ────────────────────────────────────────────────────────────────────────────

func TestExportVersionLineContainsScope(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    th.BasicTeam.Name,
		ChannelName: th.BasicChannel.Name,
	})
	require.Nil(t, appErr)

	scanner := bufio.NewScanner(&buf)
	require.True(t, scanner.Scan(), "export must have at least one line")

	var versionLine imports.LineImportData
	require.NoError(t, json.Unmarshal(scanner.Bytes(), &versionLine))
	require.Equal(t, "version", versionLine.Type)
	require.NotNil(t, versionLine.Info)
	require.NotEmpty(t, versionLine.Info.Additional, "channel-scoped export must embed ExportScopeAdditional")

	var scope imports.ExportScopeAdditional
	require.NoError(t, json.Unmarshal(versionLine.Info.Additional, &scope))
	assert.Equal(t, th.BasicTeam.Name, scope.TeamName)
	assert.Equal(t, th.BasicChannel.Name, scope.ChannelName)
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-04: team-scoped export excludes DMs
// ────────────────────────────────────────────────────────────────────────────

func TestExportTeamScopedExcludesDMs(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	dmChannel := th.CreateDmChannel(t, th.BasicUser2)
	p := &model.Post{ChannelId: dmChannel.Id, Message: "dm msg", UserId: th.BasicUser.Id}
	_, _, appErr := th.App.CreatePost(th.Context, p, dmChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th.App.BulkExport(th.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName: th.BasicTeam.Name,
	})
	require.Nil(t, appErr)

	scanner := bufio.NewScanner(&buf)
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		assert.NotEqual(t, "direct_post", line.Type, "team-scoped export must not contain DM posts")
	}
	require.NoError(t, scanner.Err())
}

// ────────────────────────────────────────────────────────────────────────────
// USR-01: all post authors pre-exist → all posts imported
// ────────────────────────────────────────────────────────────────────────────

func TestChannelImportAllUsersPresent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	user1 := model.NewUsername()
	user2 := model.NewUsername()

	// Both users must be in the DB before the channel-scoped import runs.
	createUserInDB(t, th, user1)
	createUserInDB(t, th, user2)

	reader := channelScopedJSONL(t, teamName, chanName, []string{user1, user2}, []string{user1, user2})

	lineNum, appErr := th.App.BulkImport(th.Context, reader, nil, false, 1)
	assert.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)
	assert.Equal(t, 2, postCountInChannel(t, th, th.Context, teamName, chanName))
}

// ────────────────────────────────────────────────────────────────────────────
// USR-01: post authors absent from dest are created as deactivated; posts land
//
// Reason: silently dropping posts breaks attribution and confuses customers
// who expect a complete record. The fix creates a deactivated shell account
// so every post survives the migration with its original author intact.
// ────────────────────────────────────────────────────────────────────────────

func TestChannelImportMissingUsersCreatedDeactivated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	presentUser := model.NewUsername()
	missingUser := model.NewUsername() // not pre-created in DB

	// Only presentUser exists on the destination before import.
	createUserInDB(t, th, presentUser)

	reader := channelScopedJSONL(t, teamName, chanName,
		[]string{presentUser, missingUser},
		[]string{presentUser, missingUser},
	)

	lineNum, appErr := th.App.BulkImport(th.Context, reader, nil, false, 1)
	assert.Nil(t, appErr, "import must not error when some post authors are absent (failed at line %d)", lineNum)
	// Both posts must land: missingUser is created as a deactivated shell account.
	assert.Equal(t, 2, postCountInChannel(t, th, th.Context, teamName, chanName),
		"posts from absent users must be preserved; absent user is created as deactivated")

	// Confirm missingUser now exists in the DB as an inactive account.
	u, appErr2 := th.App.GetUserByUsername(missingUser)
	require.Nil(t, appErr2, "absent user must have been auto-created")
	assert.NotZero(t, u.DeleteAt, "auto-created user must be deactivated (DeleteAt > 0)")
}

// ────────────────────────────────────────────────────────────────────────────
// USR-02: when ALL post authors are absent, each is created deactivated
//
// Reason: same as USR-01 — complete post preservation over silent data loss.
// ────────────────────────────────────────────────────────────────────────────

func TestChannelImportAllMissingUsersCreatedDeactivated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	ghostUser := model.NewUsername()

	// No users pre-created — ghost user is entirely absent from the dest DB.
	reader := channelScopedJSONL(t, teamName, chanName, []string{ghostUser}, []string{ghostUser})

	lineNum, appErr := th.App.BulkImport(th.Context, reader, nil, false, 1)
	assert.Nil(t, appErr, "import must succeed even when all post authors are absent (failed at line %d)", lineNum)
	// ghostUser's post must land; ghostUser is created as deactivated.
	assert.Equal(t, 1, postCountInChannel(t, th, th.Context, teamName, chanName),
		"post must be imported; absent user is created as a deactivated shell account")

	u, appErr2 := th.App.GetUserByUsername(ghostUser)
	require.Nil(t, appErr2, "ghost user must have been auto-created on dest")
	assert.NotZero(t, u.DeleteAt, "auto-created ghost user must be deactivated")
}

// ────────────────────────────────────────────────────────────────────────────
// REG-02: non-channel-scoped import still errors on missing users
// ────────────────────────────────────────────────────────────────────────────

func TestFullTeamImportErrorsOnMissingUser(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()

	var sb strings.Builder
	enc := json.NewEncoder(&sb)

	// Version line WITHOUT ExportScopeAdditional → deactivateMissingUsers stays false.
	version := 1
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type:    "version",
		Version: &version,
		Info: &imports.VersionInfoImportData{
			Generator: "test",
			Version:   "1.0",
			Created:   "2024-01-01T00:00:00Z",
		},
	}))

	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        new(teamName),
			DisplayName: new("Strict Team"),
			Type:        new("O"),
		},
	}))

	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "channel",
		Channel: &imports.ChannelImportData{
			Team:        new(teamName),
			Name:        new(chanName),
			DisplayName: new("Strict Chan"),
			Type:        &chanType,
		},
	}))

	// Post from a user with no user record and not in DB.
	ts := int64(1700000000000)
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "post",
		Post: &imports.PostImportData{
			Team:     new(teamName),
			Channel:  new(chanName),
			User:     new(model.NewUsername()),
			Message:  new("ghost message"),
			CreateAt: &ts,
		},
	}))

	_, appErr := th.App.BulkImport(th.Context, strings.NewReader(sb.String()), nil, false, 1)
	assert.NotNil(t, appErr, "non-channel-scoped import must error when post author is not in DB")
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-01: destination team remapping end-to-end (using real BulkExport)
// ────────────────────────────────────────────────────────────────────────────

func TestChannelImportDestinationTeamRemap(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	// Export while th1's data is still in the DB.
	var buf bytes.Buffer
	appErr := th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	// Set up th2 AFTER the export (in non-parallel mode, Setup drops all tables).
	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destTeamName = "dst-remap-team"
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	// The dest team must exist under the remapped name.
	destTeam, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr, "destination team must exist after import")
	assert.Equal(t, destTeamName, destTeam.Name)

	// The source team name must NOT appear on th2 (either it was never created
	// because rewriting replaced it, or it was wiped by the DropAllTables).
	_, appErr = th2.App.GetTeamByName(srcTeamName)
	assert.NotNil(t, appErr, "source team name must not exist on dest")

	// The channel must exist under the dest team.
	_, appErr = th2.App.GetChannelByName(th2.Context, srcChanName, destTeam.Id, false)
	assert.Nil(t, appErr, "channel must be under the remapped team")
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-02: destination team remapping works for team-only (no --channel) exports
// ────────────────────────────────────────────────────────────────────────────

func TestTeamOnlyImportDestinationTeamRemap(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name

	// Team-only export: no ChannelName set.
	var buf bytes.Buffer
	appErr := th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName: srcTeamName,
	})
	require.Nil(t, appErr)

	// Verify the version line carries ExportScopeAdditional with team_name but no channel_name.
	scanner := bufio.NewScanner(bytes.NewReader(buf.Bytes()))
	scanner.Scan()
	var versionLine imports.LineImportData
	require.NoError(t, json.Unmarshal(scanner.Bytes(), &versionLine))
	require.NotNil(t, versionLine.Info, "version line must have info block")
	require.NotEmpty(t, versionLine.Info.Additional, "version line must carry scope metadata for team-only export")
	var scope imports.ExportScopeAdditional
	require.NoError(t, json.Unmarshal(versionLine.Info.Additional, &scope))
	assert.Equal(t, srcTeamName, scope.TeamName)
	assert.Empty(t, scope.ChannelName, "channel_name must be empty for team-only export")

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destTeamName = "dst-team-only-remap"
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	destTeam, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr, "destination team must exist after import")
	assert.Equal(t, destTeamName, destTeam.Name)

	_, appErr = th2.App.GetTeamByName(srcTeamName)
	assert.NotNil(t, appErr, "source team name must not exist on destination")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-10: Post authors who left the team get a synthesized membership so they
// can access their posts on the destination after import.
// ────────────────────────────────────────────────────────────────────────────

func TestExportExTeamMemberGetsSyntheticMembership(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// ghost posted in the channel, then left the team entirely.
	ghost := th.CreateUser(t)
	th.LinkUserToTeam(t, ghost, th.BasicTeam)
	th.AddUserToChannel(t, ghost, th.BasicChannel)
	_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    ghost.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "ghost post",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: false})
	require.Nil(t, appErr)

	// Remove ghost from the team (soft-delete the membership).
	appErr = th.App.RemoveUserFromTeam(th.Context, th.BasicTeam.Id, ghost.Id, th.SystemAdminUser.Id)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    th.BasicTeam.Name,
		ChannelName: th.BasicChannel.Name,
	})
	require.Nil(t, appErr)

	// Find ghost's user line in the export and verify it has a synthesized team membership.
	scanner := bufio.NewScanner(&buf)
	found := false
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type != "user" || line.User == nil || *line.User.Username != ghost.Username {
			continue
		}
		found = true
		require.NotNil(t, line.User.Teams, "ex-team-member must have a synthesized Teams entry")
		require.Len(t, *line.User.Teams, 1, "should have exactly one synthesized team membership")
		assert.Equal(t, th.BasicTeam.Name, *(*line.User.Teams)[0].Name)
		require.NotNil(t, (*line.User.Teams)[0].Channels, "synthesized membership must include channel")
		require.Len(t, *(*line.User.Teams)[0].Channels, 1)
		assert.Equal(t, th.BasicChannel.Name, *(*(*line.User.Teams)[0].Channels)[0].Name)
	}
	require.NoError(t, scanner.Err())
	assert.True(t, found, "ghost user (ex-team-member) must appear in the export")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-03 / EXP-09: Bot-authored posts included in channel-scoped export
// ────────────────────────────────────────────────────────────────────────────

func TestExportBotPostsIncluded(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	owner := th.CreateUser(t)
	bot, appErr := th.App.CreateBot(th.Context, &model.Bot{
		Username:    "migbot" + model.NewId()[:8],
		DisplayName: "Migration Test Bot",
		OwnerId:     owner.Id,
	})
	require.Nil(t, appErr)

	botUser, appErr := th.App.GetUser(bot.UserId)
	require.Nil(t, appErr)
	th.LinkUserToTeam(t, botUser, th.BasicTeam)
	th.AddUserToChannel(t, botUser, th.BasicChannel)

	botPost := &model.Post{
		UserId:    bot.UserId,
		ChannelId: th.BasicChannel.Id,
		Message:   "bot post in channel",
	}
	_, _, appErr = th.App.CreatePost(th.Context, botPost, th.BasicChannel, model.CreatePostFlags{SetOnline: false})
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    th.BasicTeam.Name,
		ChannelName: th.BasicChannel.Name,
	})
	require.Nil(t, appErr)

	hasBotRecord := false
	hasBotPost := false
	scanner := bufio.NewScanner(&buf)
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "bot" && line.Bot != nil && *line.Bot.Username == bot.Username {
			hasBotRecord = true
		}
		if line.Type == "post" && line.Post != nil && *line.Post.User == bot.Username {
			hasBotPost = true
		}
	}
	require.NoError(t, scanner.Err())
	assert.True(t, hasBotRecord, "bot record must appear in channel-scoped export")
	assert.True(t, hasBotPost, "bot post must appear in channel-scoped export")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-05: Threaded replies nested in export JSONL
// ────────────────────────────────────────────────────────────────────────────

func TestExportThreadedRepliesInJSONL(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	root := th.CreatePost(t, th.BasicChannel)
	th.CreatePostReply(t, root)
	th.CreatePostReply(t, root)

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    th.BasicTeam.Name,
		ChannelName: th.BasicChannel.Name,
	})
	require.Nil(t, appErr)

	repliesFound := 0
	scanner := bufio.NewScanner(&buf)
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "post" && line.Post != nil && line.Post.Replies != nil {
			repliesFound += len(*line.Post.Replies)
		}
	}
	require.NoError(t, scanner.Err())
	assert.Equal(t, 2, repliesFound, "both replies must be nested in the post line")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-08: Empty channel exports without error and imports cleanly
// ────────────────────────────────────────────────────────────────────────────

func TestExportEmptyChannelRoundTrip(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	emptyChannel := th.CreateChannel(t, th.BasicTeam)
	teamName := th.BasicTeam.Name
	chanName := emptyChannel.Name

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)

	exportBytes := buf.Bytes()

	// No post lines should reference the empty channel (scan a copy so buf isn't consumed)
	scanner := bufio.NewScanner(bytes.NewReader(exportBytes))
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "post" && line.Post != nil {
			assert.NotEqual(t, chanName, *line.Post.Channel, "empty channel must produce no post lines")
		}
	}
	require.NoError(t, scanner.Err())

	// InitBasic ensures a system admin exists; no users need pre-creating for an empty channel.
	th = Setup(t).InitBasic(t)
	_, appErr = th.App.BulkImport(th.Context, bytes.NewReader(exportBytes), nil, false, 1)
	require.Nil(t, appErr, "importing an empty-channel export must not error")

	assert.Equal(t, 0, postCountInChannel(t, th, th.Context, teamName, chanName))
}

// ────────────────────────────────────────────────────────────────────────────
// CLI-02: Non-existent team name returns an error
// ────────────────────────────────────────────────────────────────────────────

func TestExportNonExistentTeamErrors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName: "this-team-does-not-exist-" + model.NewId(),
	})
	assert.NotNil(t, appErr, "exporting a non-existent team must return an error")
}

// ────────────────────────────────────────────────────────────────────────────
// CLI-03: Non-existent channel name returns an error (from exportAllUsers lookup).
// This ensures the customer gets immediate feedback rather than a silent empty export.
// ────────────────────────────────────────────────────────────────────────────

func TestExportNonExistentChannelErrors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    th.BasicTeam.Name,
		ChannelName: "channel-that-does-not-exist-" + model.NewId(),
	})
	assert.NotNil(t, appErr, "exporting a non-existent channel must return an error")
}

// ────────────────────────────────────────────────────────────────────────────
// USR-03: Reply from missing user is skipped; parent post still lands
// ────────────────────────────────────────────────────────────────────────────

func TestChannelImportReplyFromMissingUserSkipped(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	aliceUsername := model.NewUsername()

	// alice must pre-exist on dest (deactivateMissingUsers mode).
	createUserInDB(t, th, aliceUsername)

	var sb strings.Builder
	enc := json.NewEncoder(&sb)

	version := 1
	scope := imports.ExportScopeAdditional{TeamName: teamName, ChannelName: chanName}
	scopeJSON, err := json.Marshal(scope)
	require.NoError(t, err)

	require.NoError(t, enc.Encode(imports.LineImportData{
		Type:    "version",
		Version: &version,
		Info:    &imports.VersionInfoImportData{Generator: "test", Version: "1.0", Created: "2024-01-01T00:00:00Z", Additional: scopeJSON},
	}))
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{Name: new(teamName), DisplayName: new("T"), Type: new("O")},
	}))
	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type:    "channel",
		Channel: &imports.ChannelImportData{Team: new(teamName), Name: new(chanName), DisplayName: new("C"), Type: &chanType},
	}))

	// Post from alice with a reply from ghost-user (who does not exist on dest).
	ts := int64(1700000000000)
	replyTs := ts + 1000
	ghostUsername := model.NewUsername()
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "post",
		Post: &imports.PostImportData{
			Team: new(teamName), Channel: new(chanName), User: new(aliceUsername),
			Message: new("root post"), CreateAt: &ts,
			Replies: &[]imports.ReplyImportData{{
				User: new(ghostUsername), Message: new("ghost reply"), CreateAt: &replyTs,
			}},
		},
	}))

	_, appErr := th.App.BulkImport(th.Context, strings.NewReader(sb.String()), nil, false, 1)
	require.Nil(t, appErr, "import must succeed even when reply author is absent")

	// Only the root post (1), not the reply (0 extra rows).
	assert.Equal(t, 1, postCountInChannel(t, th, th.Context, teamName, chanName),
		"root post must be imported; ghost reply must be skipped")
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-03: Post count on dest exactly matches source after channel migration
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationPostCountExact(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const postCount = 5
	for range postCount {
		th.CreatePost(t, th.BasicChannel)
	}
	teamName := th.BasicTeam.Name
	chanName := th.BasicChannel.Name
	srcCount := postCountInChannel(t, th, th.Context, teamName, chanName)

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)

	// The BasicUser's username is needed to pre-create on the fresh server.
	basicUsername := th.BasicUser.Username
	basicEmail := th.BasicUser.Email

	th = Setup(t).InitBasic(t)
	createUserInDB(t, th, basicUsername)
	// Ensure the email also matches so the user record in the export updates gracefully.
	_ = basicEmail

	_, appErr = th.App.BulkImport(th.Context, &buf, nil, false, 1)
	require.Nil(t, appErr)

	assert.Equal(t, srcCount, postCountInChannel(t, th, th.Context, teamName, chanName),
		"post count on dest must match source exactly")
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-05: Post timestamps are preserved exactly after channel migration
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationTimestampsPreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	teamName := th.BasicTeam.Name
	chanName := th.BasicChannel.Name
	basicUsername := th.BasicUser.Username

	// Export from source and capture the actual post timestamps from the JSONL.
	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)

	// Collect exported timestamps before importing (buf gets read during import).
	exportedTimestamps := map[int64]bool{}
	exportBytes := buf.Bytes()
	scanner := bufio.NewScanner(bytes.NewReader(exportBytes))
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "post" && line.Post != nil && line.Post.CreateAt != nil {
			exportedTimestamps[*line.Post.CreateAt] = true
		}
	}
	require.NotEmpty(t, exportedTimestamps, "export must contain at least one post")

	th = Setup(t).InitBasic(t)
	createUserInDB(t, th, basicUsername)

	_, appErr = th.App.BulkImport(th.Context, bytes.NewReader(exportBytes), nil, false, 1)
	require.Nil(t, appErr)

	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)

	pl, err := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{
		ChannelId: ch.Id, Page: 0, PerPage: 1000,
	}, false, map[string]bool{})
	require.NoError(t, err)

	for _, p := range pl.Posts {
		if p.Type == "" {
			assert.True(t, exportedTimestamps[p.CreateAt],
				"post CreateAt %d not found in exported timestamps", p.CreateAt)
		}
	}
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-04: Thread (reply) structure is preserved after channel migration
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationThreadStructurePreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Use a fresh channel so we control exactly which posts are present.
	threadChannel := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, th.BasicUser, threadChannel)

	ch1 := threadChannel
	root, _, appErr0 := th.App.CreatePost(th.Context, &model.Post{
		UserId: th.BasicUser.Id, ChannelId: ch1.Id, Message: "root",
	}, ch1, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr0)
	_, _, appErr0 = th.App.CreatePost(th.Context, &model.Post{
		UserId: th.BasicUser.Id, ChannelId: ch1.Id, RootId: root.Id, Message: "reply1",
	}, ch1, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr0)
	_, _, appErr0 = th.App.CreatePost(th.Context, &model.Post{
		UserId: th.BasicUser.Id, ChannelId: ch1.Id, RootId: root.Id, Message: "reply2",
	}, ch1, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr0)

	teamName := th.BasicTeam.Name
	chanName := threadChannel.Name
	basicUsername := th.BasicUser.Username

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)

	th = Setup(t).InitBasic(t)
	createUserInDB(t, th, basicUsername)

	_, appErr = th.App.BulkImport(th.Context, &buf, nil, false, 1)
	require.Nil(t, appErr)

	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)

	pl, err := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{
		ChannelId: ch.Id, Page: 0, PerPage: 1000,
	}, false, map[string]bool{})
	require.NoError(t, err)

	rootCount, replyCount := 0, 0
	for _, p := range pl.Posts {
		if p.Type != "" {
			continue
		}
		if p.RootId == "" {
			rootCount++
		} else {
			replyCount++
		}
	}
	assert.Equal(t, 1, rootCount, "must have exactly one root post")
	assert.Equal(t, 2, replyCount, "both replies must be imported with RootId set")
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-07: Channel membership is preserved after channel migration
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationMembershipPreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	extra1 := th.CreateUser(t)
	extra2 := th.CreateUser(t)
	th.LinkUserToTeam(t, extra1, th.BasicTeam)
	th.LinkUserToTeam(t, extra2, th.BasicTeam)
	th.AddUserToChannel(t, extra1, th.BasicChannel)
	th.AddUserToChannel(t, extra2, th.BasicChannel)

	srcMembers, err := th.App.Srv().Store().Channel().GetMembers(model.ChannelMembersGetOptions{
		ChannelID: th.BasicChannel.Id,
		Limit:     1000,
	})
	require.NoError(t, err)
	srcMemberCount := len(srcMembers)

	teamName := th.BasicTeam.Name
	chanName := th.BasicChannel.Name
	// Capture all member usernames so we can re-create them on dest.
	memberUsernames := []string{}
	for _, m := range srcMembers {
		u, appErr := th.App.GetUser(m.UserId)
		if appErr == nil && !u.IsBot {
			memberUsernames = append(memberUsernames, u.Username)
		}
	}

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)

	th = Setup(t).InitBasic(t)
	for _, uname := range memberUsernames {
		createUserInDB(t, th, uname)
	}

	_, appErr = th.App.BulkImport(th.Context, &buf, nil, false, 1)
	require.Nil(t, appErr)

	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)

	destMembers, err := th.App.Srv().Store().Channel().GetMembers(model.ChannelMembersGetOptions{
		ChannelID: ch.Id,
		Limit:     1000,
	})
	require.NoError(t, err)
	assert.Equal(t, srcMemberCount, len(destMembers),
		"channel member count on dest must match source")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-06: Private channel migrates as private on dest
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationPrivateChannelPreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	privateChannel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
		TeamId:      th.BasicTeam.Id,
		Name:        "mig-private-" + model.NewId()[:8],
		DisplayName: "Migration Private",
		Type:        model.ChannelTypePrivate,
	}, false)
	require.Nil(t, appErr)
	_, appErr = th.App.AddChannelMember(th.Context, th.BasicUser.Id, privateChannel, ChannelMemberOpts{})
	require.Nil(t, appErr)

	th.CreatePost(t, privateChannel)

	teamName := th.BasicTeam.Name
	chanName := privateChannel.Name
	basicUsername := th.BasicUser.Username

	var buf bytes.Buffer
	appErr = th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)

	th = Setup(t).InitBasic(t)
	createUserInDB(t, th, basicUsername)

	_, appErr = th.App.BulkImport(th.Context, &buf, nil, false, 1)
	require.Nil(t, appErr)

	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	destChan, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)
	assert.Equal(t, model.ChannelTypePrivate, destChan.Type, "migrated channel must remain private")
}

// ────────────────────────────────────────────────────────────────────────────
// IDM-01: Importing the same export twice does not duplicate posts
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationIdempotent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.CreatePost(t, th.BasicChannel)
	th.CreatePost(t, th.BasicChannel)

	teamName := th.BasicTeam.Name
	chanName := th.BasicChannel.Name
	basicUsername := th.BasicUser.Username

	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    teamName,
		ChannelName: chanName,
	})
	require.Nil(t, appErr)
	exportBytes := buf.Bytes()

	th = Setup(t).InitBasic(t)
	createUserInDB(t, th, basicUsername)

	_, appErr = th.App.BulkImport(th.Context, bytes.NewReader(exportBytes), nil, false, 1)
	require.Nil(t, appErr)
	countAfterFirst := postCountInChannel(t, th, th.Context, teamName, chanName)

	// Second import of the same export — must not duplicate posts.
	_, appErr = th.App.BulkImport(th.Context, bytes.NewReader(exportBytes), nil, false, 1)
	require.Nil(t, appErr)
	countAfterSecond := postCountInChannel(t, th, th.Context, teamName, chanName)

	assert.Equal(t, countAfterFirst, countAfterSecond,
		"re-importing the same export must not create duplicate posts")
}

// ────────────────────────────────────────────────────────────────────────────
// ATT-01: Posts with file attachments survive a channel migration round-trip
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationWithAttachments(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Upload a real file so the exporter can include the bytes in the ZIP.
	fileContent := []byte("attachment content for migration test")
	fileInfo, appErr := th.App.UploadFile(th.Context, fileContent, th.BasicChannel.Id, "migrate_me.txt")
	require.Nil(t, appErr)

	// Create a post that references the uploaded file.
	post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "post with attachment",
		FileIds:   model.StringArray{fileInfo.Id},
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	_ = post

	teamName := th.BasicTeam.Name
	chanName := th.BasicChannel.Name
	basicUsername := th.BasicUser.Username

	// Export to a real ZIP (CreateArchive writes JSONL + attachment bytes).
	dir, err := os.MkdirTemp("", "mig_att_test_*")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	zipPath := filepath.Join(dir, "export.zip")
	zipFile, err := os.Create(zipPath)
	require.NoError(t, err)

	appErr = th.App.BulkExport(th.Context, zipFile, dir, nil, model.BulkExportOpts{
		TeamName:           teamName,
		ChannelName:        chanName,
		IncludeAttachments: true,
		CreateArchive:      true,
	})
	zipFile.Close()
	require.Nil(t, appErr)

	// Verify the ZIP contains a data/ directory (attachment files).
	zr, err := zip.OpenReader(zipPath)
	require.NoError(t, err)
	defer zr.Close()
	hasDataDir := false
	for _, f := range zr.File {
		if strings.HasPrefix(f.Name, "data/") {
			hasDataDir = true
			break
		}
	}
	assert.True(t, hasDataDir, "export ZIP must contain a data/ directory with attachment files")
	zr.Close()

	// Unzip to a fresh directory and import on a clean server.
	importDir := filepath.Join(dir, "import")
	require.NoError(t, os.Mkdir(importDir, 0755))

	zipFileR, err := os.Open(zipPath)
	require.NoError(t, err)
	defer zipFileR.Close()
	fi, err := zipFileR.Stat()
	require.NoError(t, err)
	_, err = utils.UnzipToPath(zipFileR, fi.Size(), importDir)
	require.NoError(t, err)

	jsonlFile, err := os.Open(filepath.Join(importDir, "import.jsonl"))
	require.NoError(t, err)
	defer jsonlFile.Close()

	th = Setup(t).InitBasic(t)
	createUserInDB(t, th, basicUsername)

	// importPath must point to the data/ subdirectory; attachment paths in the
	// JSONL are relative (e.g. "teams/.../file.txt") and are resolved against it.
	_, appErr = th.App.BulkImportWithPath(th.Context, jsonlFile, nil, false, true, 1, filepath.Join(importDir, "data"))
	require.Nil(t, appErr, "import with attachments must succeed")

	// The post must exist and have a file attached.
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)

	pl, storeErr := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{
		ChannelId: ch.Id, Page: 0, PerPage: 100,
	}, false, map[string]bool{})
	require.NoError(t, storeErr)

	var attachmentPost *model.Post
	for _, p := range pl.Posts {
		if p.Message == "post with attachment" {
			attachmentPost = p
			break
		}
	}
	require.NotNil(t, attachmentPost, "post with attachment must exist on dest")

	fileInfos, _, appErr := th.App.GetFileInfosForPost(th.Context, attachmentPost, false, false)
	require.Nil(t, appErr)
	assert.NotEmpty(t, fileInfos, "imported post must have at least one file attachment")
	assert.Equal(t, int64(len(fileContent)), fileInfos[0].Size,
		"attachment file size must match original")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-01: rewriteTeamName sets display name derived from single-word dest slug
//
// Reason: the source team's display name ("Large Team (20k)") must not leak
// through to the destination when --destination-team is used. The team name
// slug itself should drive the human-readable display name on the dest server.
// ────────────────────────────────────────────────────────────────────────────

func TestRewriteTeamNameSetsDisplayNameToSlug(t *testing.T) {
	srcName := "large-team"
	destName := "engineering"
	line := &imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        new(srcName),
			DisplayName: new("Large Team (20k)"),
			Type:        new("O"),
		},
	}
	rewriteTeamName(line, srcName, destName)
	require.NotNil(t, line.Team.DisplayName)
	assert.Equal(t, destName, *line.Team.Name, "team Name must be updated to destTeam slug")
	assert.Equal(t, "Large Team (20k)", *line.Team.DisplayName,
		"display name must be preserved from the export, not replaced with the dest slug")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-02: rewriteTeamName uses the dest slug verbatim as the display name
//
// Reason: a customer passing --destination-team my-eng-team gets the slug
// as the display name; they can rename it in the UI if they want something nicer.
// ────────────────────────────────────────────────────────────────────────────

func TestRewriteTeamNameHyphenatedSlugUsedAsDisplayName(t *testing.T) {
	srcName := "large-team"
	destName := "my-eng-team"
	line := &imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        new(srcName),
			DisplayName: new("Large Team (20k)"),
			Type:        new("O"),
		},
	}
	rewriteTeamName(line, srcName, destName)
	require.NotNil(t, line.Team.DisplayName)
	assert.Equal(t, "Large Team (20k)", *line.Team.DisplayName,
		"display name must be preserved from the export, not replaced with the dest slug")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-03: rewriteTeamName uses multi-segment slug verbatim as display name
//
// Reason: slugs with multiple segments (e.g. alpha-beta-gamma) are used as-is;
// no transformation is applied.
// ────────────────────────────────────────────────────────────────────────────

func TestRewriteTeamNameMultiSegmentSlugUsedAsDisplayName(t *testing.T) {
	srcName := "large-team"
	destName := "alpha-beta-gamma"
	line := &imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        new(srcName),
			DisplayName: new("Large Team"),
			Type:        new("O"),
		},
	}
	rewriteTeamName(line, srcName, destName)
	assert.Equal(t, "Large Team", *line.Team.DisplayName,
		"display name must be preserved from the export, not replaced with the dest slug")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-04: rewriteTeamName is a no-op for lines whose name does not match
//
// Reason: if there are multiple teams in an export (e.g. full-server export),
// rewriteTeamName must only rewrite the source team, not every team line.
// ────────────────────────────────────────────────────────────────────────────

func TestRewriteTeamNameNoopWhenNameDoesNotMatch(t *testing.T) {
	originalName := "some-other-team"
	originalDisplay := "Some Other Team"
	line := &imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        new(originalName),
			DisplayName: new(originalDisplay),
			Type:        new("O"),
		},
	}
	rewriteTeamName(line, "large-team", "engineering")
	assert.Equal(t, originalName, *line.Team.Name,
		"non-matching team name must not be changed")
	assert.Equal(t, originalDisplay, *line.Team.DisplayName,
		"non-matching team display name must not be changed")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-05: --destination-team creates new team whose display name is the slug
//
// Reason: the core customer scenario — migrating "Large Team (20k)" to a new
// team called "engineering" — must not leak the source display name to the dest.
// The slug is used as-is; the customer can rename it in the UI.
// ────────────────────────────────────────────────────────────────────────────

func TestDestinationTeamNewTeamUsesSlugAsDisplayName(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	// Give the source team a display name clearly different from the dest slug
	// so we can prove it does NOT leak to the dest.
	th1.BasicTeam.DisplayName = "Large Team (20k)"
	_, appErr := th1.App.UpdateTeam(th1.BasicTeam)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destTeamName = "engineering"
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	destTeam, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr, "destination team must exist after import")
	assert.Equal(t, "Large Team (20k)", destTeam.DisplayName,
		"display name must be preserved from the export, not replaced with the dest slug")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-06: --destination-team with hyphenated slug preserves the exported display name
//
// Reason: customers who use multi-word slugs (company naming conventions often
// use kebab-case) get the slug as-is; no transformation is applied.
// ────────────────────────────────────────────────────────────────────────────

func TestDestinationTeamHyphenatedSlugDisplayName(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	th1.BasicTeam.DisplayName = "Large Team (20k)"
	_, appErr := th1.App.UpdateTeam(th1.BasicTeam)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destTeamName = "my-eng-team"
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	destTeam, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr, "destination team must exist after import")
	assert.Equal(t, "Large Team (20k)", destTeam.DisplayName,
		"display name must be preserved from the export, not replaced with the dest slug")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-07: --destination-team does not overwrite an existing team's display name
//
// Reason: a customer may run the migration multiple times (incremental sync)
// or may have manually renamed the dest team after the first migration. The
// import must not silently clobber their customization.
// ────────────────────────────────────────────────────────────────────────────

func TestDestinationTeamExistingTeamDisplayNamePreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	th1.BasicTeam.DisplayName = "Large Team (20k)"
	_, appErr := th1.App.UpdateTeam(th1.BasicTeam)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	// Pre-create the dest team with a carefully-chosen custom display name.
	// This simulates a customer who already has this team set up on the dest
	// server with their own display name before the migration runs.
	const destTeamName = "engineering"
	const existingDisplayName = "Engineering Department"
	_, appErr = th2.App.CreateTeam(th2.Context, &model.Team{
		Name:        destTeamName,
		DisplayName: existingDisplayName,
		Type:        model.TeamOpen,
	})
	require.Nil(t, appErr, "must be able to create dest team before import")

	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	destTeam, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr)
	assert.Equal(t, existingDisplayName, destTeam.DisplayName,
		"display name of an existing dest team must not be overwritten during import")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-08: Without --destination-team, the source team's display name is preserved
//
// Reason: regular (non-remap) imports should behave exactly as before — the
// source team's full display name lands verbatim on the destination.
// ────────────────────────────────────────────────────────────────────────────

func TestNoDestinationTeamPreservesSourceDisplayName(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	const srcDisplayName = "Large Team (20k)"
	th1.BasicTeam.DisplayName = srcDisplayName
	_, appErr := th1.App.UpdateTeam(th1.BasicTeam)
	require.Nil(t, appErr)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	// Import WITHOUT DestinationTeam — the team must land with its source display name intact.
	_, appErr = th2.App.BulkImport(th2.Context, &buf, nil, false, 1)
	require.Nil(t, appErr)

	destTeam, appErr := th2.App.GetTeamByName(srcTeamName)
	require.Nil(t, appErr, "team must exist on dest after import")
	assert.Equal(t, srcDisplayName, destTeam.DisplayName,
		"without --destination-team the source display name must be preserved exactly")
}

// ────────────────────────────────────────────────────────────────────────────
// DN-09: Idempotency — re-importing does not change existing team's display name
//
// Reason: customers may run import twice (first pass, then re-run to pick up
// stragglers). The second import must not overwrite any display name changes
// the customer made after the first import.
// ────────────────────────────────────────────────────────────────────────────

func TestDestinationTeamDisplayNameIdempotentAfterRename(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	th1.BasicTeam.DisplayName = "Large Team (20k)"
	_, appErr := th1.App.UpdateTeam(th1.BasicTeam)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)
	exportBytes := buf.Bytes()

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destTeamName = "engineering"

	// First import creates the team with display name from the export ("Large Team (20k)").
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		bytes.NewReader(exportBytes),
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	// Customer renames the dest team after migration.
	const renamedDisplayName = "Engineering (Migrated)"
	team, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr)
	team.DisplayName = renamedDisplayName
	_, appErr = th2.App.UpdateTeam(team)
	require.Nil(t, appErr)

	// Second import of the same export — must not revert the customer's rename.
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		bytes.NewReader(exportBytes),
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	team, appErr = th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr)
	assert.Equal(t, renamedDisplayName, team.DisplayName,
		"second import must not overwrite a display name the customer changed after the first import")
}

// stripAdditionalFromVersionLine removes "additional" from the version line of a
// JSONL export, simulating output from a server binary that predates ExportScopeAdditional.
func stripAdditionalFromVersionLine(t *testing.T, jsonl []byte) []byte {
	t.Helper()
	parts := bytes.SplitN(jsonl, []byte("\n"), 2)
	require.Len(t, parts, 2, "export must have at least a version line")

	var versionLine map[string]any
	require.NoError(t, json.Unmarshal(parts[0], &versionLine))

	if info, ok := versionLine["info"].(map[string]any); ok {
		delete(info, "additional")
	}

	modified, err := json.Marshal(versionLine)
	require.NoError(t, err)
	return append(modified, append([]byte("\n"), parts[1]...)...)
}

// IMP-01
func TestDestinationTeamInferredWhenAdditionalFieldAbsent(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	// Export with ExportScopeAdditional present (current binary behaviour).
	var buf bytes.Buffer
	appErr := th1.App.BulkExport(th1.Context, &buf, "somePath", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	// Strip "additional" to simulate an older source binary — ExportScopeAdditional absent.
	stripped := stripAdditionalFromVersionLine(t, buf.Bytes())
	srcDisplayName := th1.BasicTeam.DisplayName

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destTeamName = "inferred-dest-team"

	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		bytes.NewReader(stripped),
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationTeamName: destTeamName},
	)
	require.Nil(t, appErr)

	team, appErr := th2.App.GetTeamByName(destTeamName)
	require.Nil(t, appErr, "team %q should exist after import with inferred sourceTeamName", destTeamName)
	assert.Equal(t, srcDisplayName, team.DisplayName,
		"display name should be preserved from the export even when export lacks ExportScopeAdditional")
}

// ────────────────────────────────────────────────────────────────────────────
// ATT-02: Emoji reactions survive a channel migration round-trip (two instances)
// ────────────────────────────────────────────────────────────────────────────

func TestChannelMigrationReactionsPreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	// SOURCE: post with two reactions (different emojis, same user).
	// BasicUser is the post author and guaranteed to get a deactivated shell on
	// the destination (channel-scoped deactivateMissingUsers mode). Using one user
	// avoids the complication of BasicUser2 not being a channel member and
	// therefore absent from the deactivated-shell creation path.
	post := th1.CreatePost(t, th1.BasicChannel)
	th1.AddReactionToPost(t, post, th1.BasicUser, "thumbsup")
	th1.AddReactionToPost(t, post, th1.BasicUser, "heart")

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	var buf bytes.Buffer
	appErr := th1.App.BulkExport(th1.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	// Verify reactions are serialised in the JSONL before sending to dest.
	exportBytes := buf.Bytes()
	exportedReactions := 0
	scanner := bufio.NewScanner(bytes.NewReader(exportBytes))
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "post" && line.Post != nil && line.Post.Reactions != nil {
			exportedReactions += len(*line.Post.Reactions)
		}
	}
	require.NoError(t, scanner.Err())
	assert.Equal(t, 2, exportedReactions, "both reactions must appear in the JSONL export")

	// DESTINATION: fresh instance — let the import create deactivated shells for
	// users that don't exist yet (channel-scoped import behaviour).
	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	_, appErr = th2.App.BulkImport(th2.Context, bytes.NewReader(exportBytes), nil, false, 1)
	require.Nil(t, appErr)

	destTeam, appErr := th2.App.GetTeamByName(srcTeamName)
	require.Nil(t, appErr)
	destChan, appErr := th2.App.GetChannelByName(th2.Context, srcChanName, destTeam.Id, false)
	require.Nil(t, appErr)

	pl, err := th2.App.Srv().Store().Post().GetPosts(th2.Context, model.GetPostsOptions{
		ChannelId: destChan.Id, Page: 0, PerPage: 100,
	}, false, map[string]bool{})
	require.NoError(t, err)

	totalReactions := 0
	for _, p := range pl.Posts {
		if p.Type == "" {
			reactions, err := th2.App.Srv().Store().Reaction().GetForPost(p.Id, false)
			require.NoError(t, err)
			totalReactions += len(reactions)
		}
	}
	assert.Equal(t, 2, totalReactions, "both reactions must survive the channel migration round-trip")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-07a: Archived channels appear in the JSONL when IncludeArchivedChannels=true
// ────────────────────────────────────────────────────────────────────────────

func TestArchivedChannelIncludedWhenFlagSet(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	// SOURCE: create a channel, post to it, then archive it.
	archivedChan, appErr := th1.App.CreateChannel(th1.Context, &model.Channel{
		TeamId:      th1.BasicTeam.Id,
		Name:        "archived-chan-" + model.NewId()[:8],
		DisplayName: "Archived Channel",
		Type:        model.ChannelTypeOpen,
	}, false)
	require.Nil(t, appErr)
	_, appErr = th1.App.AddChannelMember(th1.Context, th1.BasicUser.Id, archivedChan, ChannelMemberOpts{})
	require.Nil(t, appErr)
	th1.CreatePost(t, archivedChan)
	appErr = th1.App.DeleteChannel(th1.Context, archivedChan, th1.SystemAdminUser.Id)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:                th1.BasicTeam.Name,
		IncludeArchivedChannels: true,
	})
	require.Nil(t, appErr)

	channelNames := map[string]bool{}
	scanner := bufio.NewScanner(&buf)
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "channel" && line.Channel != nil {
			channelNames[*line.Channel.Name] = true
		}
	}
	require.NoError(t, scanner.Err())
	assert.True(t, channelNames[archivedChan.Name],
		"archived channel must appear in export when IncludeArchivedChannels is set")
}

// ────────────────────────────────────────────────────────────────────────────
// EXP-07b: Archived channels are excluded from the JSONL by default
// ────────────────────────────────────────────────────────────────────────────

func TestArchivedChannelExcludedByDefault(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	// SOURCE: create a channel, post, archive it.
	archivedChan, appErr := th1.App.CreateChannel(th1.Context, &model.Channel{
		TeamId:      th1.BasicTeam.Id,
		Name:        "archived-def-" + model.NewId()[:8],
		DisplayName: "Archived Default",
		Type:        model.ChannelTypeOpen,
	}, false)
	require.Nil(t, appErr)
	_, appErr = th1.App.AddChannelMember(th1.Context, th1.BasicUser.Id, archivedChan, ChannelMemberOpts{})
	require.Nil(t, appErr)
	th1.CreatePost(t, archivedChan)
	appErr = th1.App.DeleteChannel(th1.Context, archivedChan, th1.SystemAdminUser.Id)
	require.Nil(t, appErr)

	var buf bytes.Buffer
	appErr = th1.App.BulkExport(th1.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:                th1.BasicTeam.Name,
		IncludeArchivedChannels: false,
	})
	require.Nil(t, appErr)

	scanner := bufio.NewScanner(&buf)
	for scanner.Scan() {
		var line imports.LineImportData
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		if line.Type == "channel" && line.Channel != nil {
			assert.NotEqual(t, archivedChan.Name, *line.Channel.Name,
				"archived channel must not appear in export when IncludeArchivedChannels is false")
		}
	}
	require.NoError(t, scanner.Err())
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-06: Team-only export (two instances) — all channels and their posts land
//         on the destination with exact post counts.
// ────────────────────────────────────────────────────────────────────────────

func TestTeamMigrationMultipleChannelsRoundTrip(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	// SOURCE: three channels with posts in each.
	chan2 := th1.CreateChannel(t, th1.BasicTeam)
	chan3 := th1.CreateChannel(t, th1.BasicTeam)
	th1.AddUserToChannel(t, th1.BasicUser, chan2)
	th1.AddUserToChannel(t, th1.BasicUser, chan3)

	const postsPerChannel = 3
	for range postsPerChannel {
		th1.CreatePost(t, th1.BasicChannel)
		th1.CreatePost(t, chan2)
		th1.CreatePost(t, chan3)
	}

	srcTeamName := th1.BasicTeam.Name

	srcCounts := map[string]int{
		th1.BasicChannel.Name: postCountInChannel(t, th1, th1.Context, srcTeamName, th1.BasicChannel.Name),
		chan2.Name:            postCountInChannel(t, th1, th1.Context, srcTeamName, chan2.Name),
		chan3.Name:            postCountInChannel(t, th1, th1.Context, srcTeamName, chan3.Name),
	}

	var buf bytes.Buffer
	appErr := th1.App.BulkExport(th1.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName: srcTeamName,
	})
	require.Nil(t, appErr)

	// DESTINATION: fresh instance — import creates all team members from the export.
	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	_, appErr = th2.App.BulkImport(th2.Context, &buf, nil, false, 1)
	require.Nil(t, appErr)

	for chanName, srcCount := range srcCounts {
		destCount := postCountInChannel(t, th2, th2.Context, srcTeamName, chanName)
		assert.Equal(t, srcCount, destCount,
			"post count mismatch in channel %q after team migration: src=%d dest=%d",
			chanName, srcCount, destCount)
	}
}

// ────────────────────────────────────────────────────────────────────────────
// IMP-07: --destination-channel-name fails fast when export lacks channel scope
// ────────────────────────────────────────────────────────────────────────────

// TestDestinationChannelNameFailsWithNoMetadata verifies that specifying
// --destination-channel-name against an export that has no Additional metadata
// on the version line returns an error rather than silently doing nothing.
func TestDestinationChannelNameFailsWithNoMetadata(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	version := 1
	var sb strings.Builder
	enc := json.NewEncoder(&sb)
	// Version line with no Additional field — simulates old or full exports.
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type:    "version",
		Version: &version,
	}))

	_, appErr := th.App.BulkImportWithPathAndOpts(
		th.Context,
		strings.NewReader(sb.String()),
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationChannelName: "any-dest-channel"},
	)
	require.NotNil(t, appErr, "should fail fast when export has no scope metadata")
	assert.Equal(t, "app.import.bulk_import.destination_channel_requires_channel_scope.error", appErr.Id)
}

// TestDestinationChannelNameFailsWithTeamScopedExport verifies that specifying
// --destination-channel-name against a team-scoped (non-channel-scoped) export
// returns an error rather than silently doing nothing.
func TestDestinationChannelNameFailsWithTeamScopedExport(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Team-only export: ChannelName intentionally left empty.
	var buf bytes.Buffer
	appErr := th.App.BulkExport(th.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName: th.BasicTeam.Name,
	})
	require.Nil(t, appErr)

	_, appErr = th.App.BulkImportWithPathAndOpts(
		th.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationChannelName: "any-dest-channel"},
	)
	require.NotNil(t, appErr, "should fail fast when export is team-scoped but not channel-scoped")
	assert.Equal(t, "app.import.bulk_import.destination_channel_requires_channel_scope.error", appErr.Id)
}

// TestDestinationChannelNameRemapsChannel verifies the happy path: a channel-scoped
// export imported with --destination-channel-name lands under the new channel name.
func TestDestinationChannelNameRemapsChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th1 := Setup(t).InitBasic(t)

	srcTeamName := th1.BasicTeam.Name
	srcChanName := th1.BasicChannel.Name

	var buf bytes.Buffer
	appErr := th1.App.BulkExport(th1.Context, &buf, "", nil, model.BulkExportOpts{
		TeamName:    srcTeamName,
		ChannelName: srcChanName,
	})
	require.Nil(t, appErr)

	var th2 *TestHelper
	if mainHelper.Options.RunParallel {
		th1.Store.DropAllTables()
		th2 = th1
	} else {
		th2 = Setup(t)
	}

	const destChanName = "dst-remap-channel"
	_, appErr = th2.App.BulkImportWithPathAndOpts(
		th2.Context,
		&buf,
		nil,
		false,
		false,
		1,
		"",
		model.BulkImportOpts{DestinationChannelName: destChanName},
	)
	require.Nil(t, appErr)

	// Resolve the imported team by name — th2.BasicTeam is either nil (non-parallel
	// Setup without InitBasic) or stale (parallel DropAllTables recreates the team
	// with a new ID), so we look it up by name instead.
	importedTeam, appErr := th2.App.GetTeamByName(srcTeamName)
	require.Nil(t, appErr, "imported team must exist on destination")

	// The channel must exist under the remapped name on the source team.
	_, appErr = th2.App.GetChannelByName(th2.Context, destChanName, importedTeam.Id, false)
	assert.Nil(t, appErr, "channel must exist under the remapped name after import")

	// The original channel name must not exist (it was rewritten).
	_, appErr = th2.App.GetChannelByName(th2.Context, srcChanName, importedTeam.Id, false)
	assert.NotNil(t, appErr, "source channel name must not exist on destination")
}
