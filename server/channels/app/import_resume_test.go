// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/stretchr/testify/require"
)

// truncatedErrReader serves the first `keepLines` lines of data verbatim and then
// returns an error, simulating a process crash partway through the import stream.
type truncatedErrReader struct {
	data []byte
	pos  int
}

func (r *truncatedErrReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, fmt.Errorf("simulated crash")
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func firstNLines(s string, n int) []byte {
	lines := strings.SplitAfter(s, "\n")
	if n > len(lines) {
		n = len(lines)
	}
	return []byte(strings.Join(lines[:n], ""))
}

// buildResumeJSONL builds a scoped team export with U users and P root posts, each
// root carrying one reply (timestamped BEFORE its parent, to also exercise the B1
// clamp on the resume path) and one reaction.
func buildResumeJSONL(t *testing.T, teamName, chanName string, users []string, posts int) string {
	t.Helper()
	var sb strings.Builder
	enc := json.NewEncoder(&sb)
	version := 1
	scope := imports.ExportScopeAdditional{TeamName: teamName, ChannelName: chanName}
	scopeJSON, err := json.Marshal(scope)
	require.NoError(t, err)

	require.NoError(t, enc.Encode(imports.LineImportData{Type: "version", Version: &version,
		Info: &imports.VersionInfoImportData{Generator: "test", Version: "1.0", Created: "2024-01-01T00:00:00Z", Additional: scopeJSON}}))
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "team",
		Team: &imports.TeamImportData{Name: model.NewPointer(teamName), DisplayName: model.NewPointer("Resume Team"), Type: model.NewPointer("O")}}))
	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "channel",
		Channel: &imports.ChannelImportData{Team: model.NewPointer(teamName), Name: model.NewPointer(chanName), DisplayName: model.NewPointer("Resume Chan"), Type: &chanType}}))
	for _, u := range users {
		require.NoError(t, enc.Encode(imports.LineImportData{Type: "user", User: &imports.UserImportData{
			Username: model.NewPointer(u), Email: model.NewPointer(u + "@resume-test.example.com"),
			Teams: &[]imports.UserTeamImportData{{Name: model.NewPointer(teamName), Channels: &[]imports.UserChannelImportData{{Name: model.NewPointer(chanName)}}}}}}))
	}

	base := int64(1700000000000)
	for i := range posts {
		author := users[i%len(users)]
		ts := base + int64(i)*1000
		replyTs := ts - 500 // reply before parent -> exercises B1 clamp on replay
		require.NoError(t, enc.Encode(imports.LineImportData{Type: "post", Post: &imports.PostImportData{
			Team: model.NewPointer(teamName), Channel: model.NewPointer(chanName), User: model.NewPointer(author),
			Message: model.NewPointer(fmt.Sprintf("root-%d", i)), CreateAt: &ts,
			Reactions: &[]imports.ReactionImportData{{User: model.NewPointer(author), EmojiName: model.NewPointer("+1"), CreateAt: &ts}},
			Replies:   &[]imports.ReplyImportData{{User: model.NewPointer(author), Message: model.NewPointer(fmt.Sprintf("reply-%d", i)), CreateAt: &replyTs}},
		}}))
	}
	return sb.String()
}

func resumeCounts(t *testing.T, th *TestHelper, teamName, chanName string) (roots, replies, reactions int) {
	t.Helper()
	team, appErr := th.App.GetTeamByName(teamName)
	require.Nil(t, appErr)
	ch, appErr := th.App.GetChannelByName(th.Context, chanName, team.Id, false)
	require.Nil(t, appErr)
	db := th.GetSqlStore().GetMaster()
	require.NoError(t, db.Get(&roots, "SELECT COUNT(*) FROM Posts WHERE ChannelId=$1 AND RootId='' AND DeleteAt=0", ch.Id))
	require.NoError(t, db.Get(&replies, "SELECT COUNT(*) FROM Posts WHERE ChannelId=$1 AND RootId<>'' AND DeleteAt=0", ch.Id))
	require.NoError(t, db.Get(&reactions, "SELECT COUNT(*) FROM Reactions r JOIN Posts p ON r.PostId=p.Id WHERE p.ChannelId=$1 AND COALESCE(r.DeleteAt,0)=0", ch.Id))
	return
}

// TestScopedImportCrashAndResumeExactlyOnce proves the resume path (the code that
// activates for >100 MB imports) is exactly-once: a crash partway through the post
// phase, followed by a resume from the recorded checkpoint, yields the same counts
// as a clean full import — no lost posts, no duplicates.
func TestScopedImportCrashAndResumeExactlyOnce(t *testing.T) {
	mainHelper.Parallel(t)

	const teamName, chanName = "resume-team", "resume-chan"
	users := []string{"ru1", "ru2", "ru3", "ru4", "ru5"}
	const posts = 40
	jsonl := buildResumeJSONL(t, teamName, chanName, users, posts)

	// Reference: a clean full import on its own destination.
	ref := Setup(t).InitBasic(t)
	_, appErr := ref.App.BulkImportWithPathAndOpts(ref.Context, strings.NewReader(jsonl), nil, false, true, 1,
		"", model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive})
	require.Nil(t, appErr, "reference full import must succeed")
	wantRoots, wantReplies, wantReactions := resumeCounts(t, ref, teamName, chanName)
	require.Equal(t, posts, wantRoots, "sanity: reference should have all root posts")

	// Crash-and-resume on a second destination.
	th := Setup(t).InitBasic(t)

	// Import #1: crash partway through the post phase. Header is version+team+channel
	// (3 lines) + users (5 lines) = 8; stop after 8+18 = 26 lines (18 posts in).
	keep := 3 + len(users) + 18
	var lastCheckpoint int
	onCheckpoint := func(line int) {
		if line >= 0 {
			lastCheckpoint = line
		}
	}
	_, appErr = th.App.BulkImportWithPathAndOpts(th.Context,
		&truncatedErrReader{data: firstNLines(jsonl, keep)}, nil, false, true, 1, "",
		model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive, OnCheckpoint: onCheckpoint})
	require.NotNil(t, appErr, "import #1 must fail (simulated crash)")
	t.Logf("crash recorded checkpoint at line %d; partial posts imported", lastCheckpoint)

	// Import #2: resume from the recorded checkpoint with the full stream.
	_, appErr = th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(jsonl), nil, false, true, 1, "",
		model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive, ResumeFromLine: lastCheckpoint})
	require.Nil(t, appErr, "resume import must succeed")

	gotRoots, gotReplies, gotReactions := resumeCounts(t, th, teamName, chanName)
	require.Equal(t, wantRoots, gotRoots, "resumed roots must equal a clean full import — no loss, no duplicates")
	require.Equal(t, wantReplies, gotReplies, "resumed replies must equal a clean full import — no loss, no duplicates")
	require.Equal(t, wantReactions, gotReactions, "resumed reactions must equal a clean full import — no loss, no duplicates")

	// Resume again from the same checkpoint (repeated resume must stay exactly-once).
	_, appErr = th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(jsonl), nil, false, true, 1, "",
		model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive, ResumeFromLine: lastCheckpoint})
	require.Nil(t, appErr, "second resume must succeed")
	r2, rep2, rea2 := resumeCounts(t, th, teamName, chanName)
	require.Equal(t, wantRoots, r2, "repeated resume must not create duplicate roots")
	require.Equal(t, wantReplies, rep2, "repeated resume must not create duplicate replies")
	require.Equal(t, wantReactions, rea2, "repeated resume must not create duplicate reactions")
}
