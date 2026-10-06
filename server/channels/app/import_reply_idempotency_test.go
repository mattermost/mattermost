// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/stretchr/testify/require"
)

// TestChannelMigrationReplyEarlierThanParentIdempotent guards against a
// re-import/resume creating a duplicate reply when the reply's source CreateAt
// is earlier than its parent post's CreateAt.
//
// importReplies clamps a reply's stored CreateAt up to the parent's when the
// source value is earlier, but the "does this reply already exist?" lookup keys
// on the original (un-clamped) source CreateAt. If the two disagree, the second
// import fails to find the already-stored reply and inserts a duplicate.
func TestChannelMigrationReplyEarlierThanParentIdempotent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const (
		teamName = "reply-idem-team"
		chanName = "reply-idem-chan"
		author   = "reply.idem.author"
	)

	var sb strings.Builder
	enc := json.NewEncoder(&sb)
	version := 1
	scope := imports.ExportScopeAdditional{TeamName: teamName, ChannelName: chanName}
	scopeJSON, err := json.Marshal(scope)
	require.NoError(t, err)

	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "version", Version: &version,
		Info: &imports.VersionInfoImportData{Generator: "test", Version: "1.0", Created: "2024-01-01T00:00:00Z", Additional: scopeJSON},
	}))
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{Name: model.NewPointer(teamName), DisplayName: model.NewPointer("Reply Idem Team"), Type: model.NewPointer("O")},
	}))
	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type:    "channel",
		Channel: &imports.ChannelImportData{Team: model.NewPointer(teamName), Name: model.NewPointer(chanName), DisplayName: model.NewPointer("Reply Idem Chan"), Type: &chanType},
	}))
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "user",
		User: &imports.UserImportData{
			Username: model.NewPointer(author), Email: model.NewPointer(author + "@mig-test.example.com"),
			Teams: &[]imports.UserTeamImportData{{Name: model.NewPointer(teamName), Channels: &[]imports.UserChannelImportData{{Name: model.NewPointer(chanName)}}}},
		},
	}))

	parentTs := int64(1700000000000)
	replyTs := parentTs - 5000 // reply is timestamped BEFORE its parent — triggers the clamp
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "post",
		Post: &imports.PostImportData{
			Team: model.NewPointer(teamName), Channel: model.NewPointer(chanName), User: model.NewPointer(author),
			Message: model.NewPointer("root post"), CreateAt: &parentTs,
			Replies: &[]imports.ReplyImportData{{
				User: model.NewPointer(author), Message: model.NewPointer("early reply"), CreateAt: &replyTs,
			}},
		},
	}))
	jsonl := sb.String()

	countReplies := func() int {
		team, appErr := th.App.GetTeamByName(teamName)
		require.Nil(t, appErr)
		ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
		require.Nil(t, appErr)
		var n int
		require.NoError(t, th.GetSqlStore().GetMaster().Get(&n,
			"SELECT COUNT(*) FROM Posts WHERE ChannelId = $1 AND RootId <> '' AND DeleteAt = 0", ch.Id))
		return n
	}

	_, appErr := scopedBulkImport(t, th.App, th.Context, strings.NewReader(jsonl), model.ImportedUsersInactive)
	require.Nil(t, appErr, "first import must succeed")
	require.Equal(t, 1, countReplies(), "first import must create exactly one reply")

	_, appErr = scopedBulkImport(t, th.App, th.Context, strings.NewReader(jsonl), model.ImportedUsersInactive)
	require.Nil(t, appErr, "second import must succeed")
	require.Equal(t, 1, countReplies(), "re-import must not duplicate a reply whose CreateAt precedes its parent")
}
