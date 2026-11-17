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

// TestScopedImportSkipsMissingTeamMembership guards against a scoped import
// aborting when a user's team membership references a team that does not exist
// on the destination (e.g. deleted or renamed between runs). The import should
// skip that membership and continue — mirroring how channel memberships for a
// missing channel are skipped — rather than failing the whole job. Before the
// fix, the missing team was dereferenced as a nil *model.Team and panicked.
func TestScopedImportSkipsMissingTeamMembership(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const realTeam, ghostTeam = "real-team", "ghost-team"
	const realChan = "real-chan"
	const username = "miss.user"

	var sb strings.Builder
	enc := json.NewEncoder(&sb)
	version := 1
	scope := imports.ExportScopeAdditional{TeamName: realTeam}
	scopeJSON, err := json.Marshal(scope)
	require.NoError(t, err)

	require.NoError(t, enc.Encode(imports.LineImportData{Type: "version", Version: &version,
		Info: &imports.VersionInfoImportData{Generator: "test", Version: "1.0", Created: "2024-01-01T00:00:00Z", Additional: scopeJSON}}))
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "team",
		Team: &imports.TeamImportData{Name: model.NewPointer(realTeam), DisplayName: model.NewPointer("Real Team"), Type: model.NewPointer("O")}}))
	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "channel",
		Channel: &imports.ChannelImportData{Team: model.NewPointer(realTeam), Name: model.NewPointer(realChan), DisplayName: model.NewPointer("Real Chan"), Type: &chanType}}))
	// Note: no team line for ghostTeam — it will not exist on the destination.

	require.NoError(t, enc.Encode(imports.LineImportData{Type: "user", User: &imports.UserImportData{
		Username: model.NewPointer(username), Email: model.NewPointer(username + "@mig-test.example.com"),
		Teams: &[]imports.UserTeamImportData{
			{
				Name: model.NewPointer(realTeam),
				Channels: &[]imports.UserChannelImportData{
					{Name: model.NewPointer(realChan)},
				},
			},
			{Name: model.NewPointer(ghostTeam)}, // missing on destination
		},
	}}))

	_, appErr := scopedBulkImport(t, th.App, th.Context, strings.NewReader(sb.String()), model.ImportedUsersInactive)
	require.Nil(t, appErr, "a missing team membership must not abort a scoped import")

	// The real team membership must still have been applied.
	team, appErr := th.App.GetTeamByName(realTeam)
	require.Nil(t, appErr)
	u, err := th.App.Srv().Store().User().GetByUsername(username)
	require.NoError(t, err)
	_, mErr := th.App.Srv().Store().Team().GetMember(th.Context, team.Id, u.Id)
	require.NoError(t, mErr, "user should be a member of the team that does exist on the destination")
}
