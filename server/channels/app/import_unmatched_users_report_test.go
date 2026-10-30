// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/stretchr/testify/require"
)

// TestScopedImportReportsUnmatchedUsers is the end-to-end guard for the operator-facing
// "which users/memberships could not be matched on the new server" log. It runs a real
// scoped import whose export references:
//   - a user that exists on the destination (matched, must NOT be reported),
//   - a user absent from the destination (reported: username_not_found + created_inactive),
//   - a membership for a team absent from the destination (reported: team_not_found),
//   - a membership for a channel absent from the destination (reported: channel_not_found),
//
// then asserts the ImportReport accumulated exactly those entries and that they round-trip
// through WriteUnmatchedUsersCSV. The existing scopedBulkImport helper discards the report,
// so this is the only coverage tying a real import run to the report contents.
func TestScopedImportReportsUnmatchedUsers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const realTeam, ghostTeam = "rep-real-team", "rep-ghost-team"
	const realChan, ghostChan = "rep-real-chan", "rep-ghost-chan"
	const existingUser, ghostUser = "rep.existing.user", "rep.ghost.user"

	// existing.user already lives on the destination, so it must match and stay out of the report.
	_ = createUserInDB(t, th, existingUser)

	var sb strings.Builder
	enc := json.NewEncoder(&sb)
	version := 1
	scope := imports.ExportScopeAdditional{TeamName: realTeam}
	scopeJSON, err := json.Marshal(scope)
	require.NoError(t, err)

	require.NoError(t, enc.Encode(imports.LineImportData{Type: "version", Version: &version,
		Info: &imports.VersionInfoImportData{Generator: "test", Version: "1.0", Created: "2024-01-01T00:00:00Z", Additional: scopeJSON}}))
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "team",
		Team: &imports.TeamImportData{Name: model.NewPointer(realTeam), DisplayName: model.NewPointer("Rep Real Team"), Type: model.NewPointer("O")}}))
	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "channel",
		Channel: &imports.ChannelImportData{Team: model.NewPointer(realTeam), Name: model.NewPointer(realChan), DisplayName: model.NewPointer("Rep Real Chan"), Type: &chanType}}))
	// Note: no lines for ghostTeam / ghostChan — they do not exist on the destination.

	// existing.user: matched. Its memberships reference a missing channel and a missing team.
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "user", User: &imports.UserImportData{
		Username: model.NewPointer(existingUser), Email: model.NewPointer(existingUser + "@mig-test.example.com"),
		Teams: &[]imports.UserTeamImportData{
			{
				Name: model.NewPointer(realTeam),
				Channels: &[]imports.UserChannelImportData{
					{Name: model.NewPointer(realChan)},
					{Name: model.NewPointer(ghostChan)}, // missing channel
				},
			},
			{Name: model.NewPointer(ghostTeam)}, // missing team
		},
	}}))

	// ghost.user: absent from the destination. A shell is created (inactive) and the user is reported.
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "user", User: &imports.UserImportData{
		Username: model.NewPointer(ghostUser), Email: model.NewPointer(ghostUser + "@mig-test.example.com"),
		Teams: &[]imports.UserTeamImportData{{
			Name:     model.NewPointer(realTeam),
			Channels: &[]imports.UserChannelImportData{{Name: model.NewPointer(realChan)}},
		}},
	}}))

	_, report, appErr := th.App.BulkImportWithPathAndOpts(th.Context, strings.NewReader(sb.String()), nil, false, true, 1, "",
		model.BulkImportOpts{ImportedUsers: model.ImportedUsersInactive})
	require.Nil(t, appErr, "scoped import with unmatched users/memberships must not abort")
	require.NotNil(t, report)

	want := []imports.UnmatchedUser{
		{Username: ghostUser, Reason: "username_not_found", Action: imports.UnmatchedUserCreatedInactive},
		{Username: existingUser, Team: realTeam, Channel: ghostChan, Reason: "channel_not_found", Action: imports.UnmatchedUserMembershipSkipped},
		{Username: existingUser, Team: ghostTeam, Reason: "team_not_found", Action: imports.UnmatchedUserMembershipSkipped},
	}
	require.ElementsMatch(t, want, report.UnmatchedUsers.All(),
		"report must contain exactly the unmatched user and the two skipped memberships")

	// The same data must round-trip through the operator-facing CSV: header + one row per entry.
	var buf bytes.Buffer
	n, err := report.WriteUnmatchedUsersCSV(&buf)
	require.NoError(t, err)
	require.Equal(t, len(want), n, "CSV row count must match the number of unmatched entries")

	rows, err := csv.NewReader(&buf).ReadAll()
	require.NoError(t, err)
	require.Len(t, rows, len(want)+1, "CSV must have a header row plus one row per entry")
	require.Equal(t, []string{"username", "auth_service", "team", "channel", "reason", "action"}, rows[0])

	reasonByUser := map[string]string{}
	for _, r := range rows[1:] {
		reasonByUser[r[0]+"|"+r[2]+"|"+r[3]] = r[4]
	}
	require.Equal(t, "username_not_found", reasonByUser[ghostUser+"||"])
	require.Equal(t, "channel_not_found", reasonByUser[existingUser+"|"+realTeam+"|"+ghostChan])
	require.Equal(t, "team_not_found", reasonByUser[existingUser+"|"+ghostTeam+"|"])
}
