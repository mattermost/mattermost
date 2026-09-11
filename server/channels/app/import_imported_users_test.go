// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
)

// ────────────────────────────────────────────────────────────────────────────
// --imported-users: the access posture for accounts a scoped import creates.
//
// There is no safe default. On a new instance the users are moving to,
// deactivating everyone locks out the whole population, and SSO users have no
// self-service path back in. On an instance that already holds other people's
// content, activating accounts built from weak identity matches hands out access.
// The server cannot tell the two destinations apart, so the operator has to say.
//
// Outside the choice, and asserted here under both values: a delete_at supplied
// by the source is always preserved, bots stay active, and accounts that already
// exist on the destination are matched rather than created.
// ────────────────────────────────────────────────────────────────────────────

const millisPerDayTest = int64(24 * 60 * 60 * 1000)

type postureTestUser struct {
	username string
	email    string
	// authService is "" for a local (email/password) account, otherwise
	// model.UserAuthServiceLdap or model.UserAuthServiceSaml.
	authService string
	authData    string
	// deleteAt models a user revoked on the source server before the export.
	deleteAt int64
}

func (u postureTestUser) importData() *imports.UserImportData {
	d := &imports.UserImportData{
		Username: model.NewPointer(u.username),
		Email:    model.NewPointer(u.email),
	}
	if u.authService != "" {
		d.AuthService = model.NewPointer(u.authService)
		d.AuthData = model.NewPointer(u.authData)
	}
	if u.deleteAt != 0 {
		d.DeleteAt = model.NewPointer(u.deleteAt)
	}
	return d
}

func newPostureUser(authService string) postureTestUser {
	username := model.NewUsername()
	u := postureTestUser{
		username: username,
		email:    username + "@posture-test.example.com",
	}
	if authService != "" {
		u.authService = authService
		u.authData = model.NewId() + "@posture-test.example.com"
	}
	return u
}

// postureArchive builds a team-scoped JSONL archive. The scope metadata on the
// version line is what puts the importer in scoped mode, which is what makes
// --imported-users required.
func postureArchive(t *testing.T, teamName, chanName string, users []postureTestUser, botOwner string) string {
	t.Helper()
	return buildPostureArchive(t, teamName, chanName, users, botOwner, true)
}

// unscopedPostureArchive builds the same content with no scope metadata, i.e. what
// a full-instance backup looks like. It must import without the flag.
func unscopedPostureArchive(t *testing.T, teamName, chanName string, users []postureTestUser) string {
	t.Helper()
	return buildPostureArchive(t, teamName, chanName, users, "", false)
}

func buildPostureArchive(t *testing.T, teamName, chanName string, users []postureTestUser, botOwner string, scoped bool) string {
	t.Helper()

	var sb strings.Builder
	enc := json.NewEncoder(&sb)

	version := 1
	info := &imports.VersionInfoImportData{
		Generator: "test",
		Version:   "1.0",
		Created:   "2024-01-01T00:00:00Z",
	}
	if scoped {
		scope, err := json.Marshal(imports.ExportScopeAdditional{TeamName: teamName})
		require.NoError(t, err)
		info.Additional = scope
	}
	require.NoError(t, enc.Encode(imports.LineImportData{Type: "version", Version: &version, Info: info}))

	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "team",
		Team: &imports.TeamImportData{
			Name:        model.NewPointer(teamName),
			DisplayName: model.NewPointer("Posture Test Team"),
			Type:        model.NewPointer("O"),
		},
	}))

	chanType := model.ChannelTypeOpen
	require.NoError(t, enc.Encode(imports.LineImportData{
		Type: "channel",
		Channel: &imports.ChannelImportData{
			Team:        model.NewPointer(teamName),
			Name:        model.NewPointer(chanName),
			DisplayName: model.NewPointer("Posture Test Chan"),
			Type:        &chanType,
		},
	}))

	for _, u := range users {
		data := u.importData()
		data.Teams = &[]imports.UserTeamImportData{{
			Name:     model.NewPointer(teamName),
			Channels: &[]imports.UserChannelImportData{{Name: model.NewPointer(chanName)}},
		}}
		require.NoError(t, enc.Encode(imports.LineImportData{Type: "user", User: data}))
	}

	if botOwner != "" {
		require.NoError(t, enc.Encode(imports.LineImportData{
			Type: "bot",
			Bot: &imports.BotImportData{
				Username:    model.NewPointer("posture-bot-" + model.NewId()[:8]),
				Owner:       model.NewPointer(botOwner),
				DisplayName: model.NewPointer("Posture Bot"),
			},
		}))
	}

	ts := int64(1700000000000)
	for _, u := range users {
		if u.deleteAt != 0 {
			// Revoked users still authored content that has to land.
			continue
		}
		tsLocal := ts
		require.NoError(t, enc.Encode(imports.LineImportData{
			Type: "post",
			Post: &imports.PostImportData{
				Team:     model.NewPointer(teamName),
				Channel:  model.NewPointer(chanName),
				User:     model.NewPointer(u.username),
				Message:  model.NewPointer("Hello from " + u.username),
				CreateAt: &tsLocal,
			},
		}))
		ts += 1000
	}

	return sb.String()
}

// postureZip wraps the JSONL in a zip so the importer runs its preflight passes —
// checkSSOProviderConfig and, critically, preCreateSSOUsers, which is where the
// posture has to be applied for SSO users. Without an attachments reader those
// passes are skipped entirely and the SSO path under test never executes.
func postureZip(t *testing.T, jsonl string) *zip.Reader {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("import.jsonl")
	require.NoError(t, err)
	_, err = w.Write([]byte(jsonl))
	require.NoError(t, err)
	require.NoError(t, zw.Close())

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	require.NoError(t, err)
	return zr
}

// runPostureImport imports the archive with an explicit posture. SkipPreflight
// keeps the SSO provider check from failing on a test server with LDAP and SAML
// disabled; the pre-creation pass it gates still runs.
func runPostureImport(t *testing.T, th *TestHelper, jsonl string, posture model.ImportedUsersPosture) (int, *model.AppError) {
	t.Helper()
	return th.App.BulkImportWithPathAndOpts(
		th.Context, strings.NewReader(jsonl), postureZip(t, jsonl),
		false, false, 1, "",
		model.BulkImportOpts{ImportedUsers: posture, SkipPreflight: true},
	)
}

// createPostureUserInDB pre-creates the account on the destination with the same
// email the archive carries. The email has to match: SqlUserStore.Update rejects
// the whole update for an LDAP user whose email differs, which is a pre-existing
// protection unrelated to the posture under test.
func createPostureUserInDB(t *testing.T, th *TestHelper, u postureTestUser) *model.User {
	t.Helper()
	created, appErr := th.App.CreateUser(th.Context, &model.User{
		Username: u.username,
		Email:    u.email,
		Password: "TestPassword123!",
	})
	require.Nil(t, appErr, "failed to pre-create %s on the destination", u.username)
	return created
}

func fetchUser(t *testing.T, th *TestHelper, username string) *model.User {
	t.Helper()
	u, err := th.App.Srv().Store().User().GetByUsername(username)
	require.NoError(t, err, "user %s must exist on the destination", username)
	return u
}

func assertImportedInactiveTag(t *testing.T, u *model.User, want bool) {
	t.Helper()
	tag, ok := u.GetProp(model.UserPropsKeyImportedInactive)
	if want {
		require.True(t, ok, "%s must carry the importedInactive prop so admins can find it for review", u.Username)
		assert.Equal(t, "true", tag)
		return
	}
	assert.False(t, ok, "%s must not be tagged importedInactive under --imported-users=active", u.Username)
}

// ────────────────────────────────────────────────────────────────────────────
// 1. active into an empty destination: users arrive usable
// ────────────────────────────────────────────────────────────────────────────

func TestScopedImportImportedUsersActive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()

	local := newPostureUser("")
	ldap := newPostureUser(model.UserAuthServiceLdap)
	saml := newPostureUser(model.UserAuthServiceSaml)
	users := []postureTestUser{local, ldap, saml}

	lineNum, appErr := runPostureImport(t, th, postureArchive(t, teamName, chanName, users, ""), model.ImportedUsersActive)
	require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

	for _, u := range users {
		created := fetchUser(t, th, u.username)
		assert.Zero(t, created.DeleteAt, "%s (%s) must arrive active under --imported-users=active", u.username, u.authService)
		assertImportedInactiveTag(t, created, false)

		// The posture only matters if it actually reaches the login path: a
		// non-zero DeleteAt is rejected there regardless of auth provider, which
		// is exactly what makes "inactive" fatal for an all-SSO customer.
		assert.Nil(t, checkUserNotDisabled(created), "%s must pass the login active-check", u.username)
	}

	assert.Equal(t, len(users), postCountInChannel(t, th, th.Context, teamName, chanName))
}

// ────────────────────────────────────────────────────────────────────────────
// 2. inactive: today's behavior, unchanged
// ────────────────────────────────────────────────────────────────────────────

func TestScopedImportImportedUsersInactive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()

	users := []postureTestUser{
		newPostureUser(""),
		newPostureUser(model.UserAuthServiceLdap),
		newPostureUser(model.UserAuthServiceSaml),
	}

	lineNum, appErr := runPostureImport(t, th, postureArchive(t, teamName, chanName, users, ""), model.ImportedUsersInactive)
	require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

	for _, u := range users {
		created := fetchUser(t, th, u.username)
		assert.NotZero(t, created.DeleteAt, "%s (%s) must arrive deactivated under --imported-users=inactive", u.username, u.authService)
		assertImportedInactiveTag(t, created, true)
		assert.NotNil(t, checkUserNotDisabled(created), "a deactivated account must be rejected at login")
	}
}

// ────────────────────────────────────────────────────────────────────────────
// 3. source delete_at survives both values, for every auth provider
//
// This is the half of the policy doing real access-control work, and it is
// deliberately outside the operator's control: a user revoked on the source must
// never be re-enabled by a migration, and must keep their original timestamp
// rather than being stamped with the import time.
// ────────────────────────────────────────────────────────────────────────────

func TestScopedImportPreservesSourceDeleteAtUnderBothPostures(t *testing.T) {
	mainHelper.Parallel(t)

	for _, posture := range []model.ImportedUsersPosture{model.ImportedUsersActive, model.ImportedUsersInactive} {
		t.Run(string(posture), func(t *testing.T) {
			th := Setup(t)

			teamName := model.NewRandomTeamName()
			chanName := model.NewId()

			revokedAt := model.GetMillis() - 400*millisPerDayTest
			var users []postureTestUser
			for _, svc := range []string{"", model.UserAuthServiceLdap, model.UserAuthServiceSaml} {
				u := newPostureUser(svc)
				u.deleteAt = revokedAt
				users = append(users, u)
			}
			// One live user alongside them, so the assertion is about the revoked
			// slice specifically and not about the import deactivating everything.
			live := newPostureUser(model.UserAuthServiceLdap)
			users = append(users, live)

			lineNum, appErr := runPostureImport(t, th, postureArchive(t, teamName, chanName, users, ""), posture)
			require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

			for _, u := range users[:3] {
				created := fetchUser(t, th, u.username)
				assert.Equal(t, revokedAt, created.DeleteAt,
					"%s (%s) was revoked on the source; the migration must preserve that exact timestamp under --imported-users=%s",
					u.username, u.authService, posture)
			}

			liveUser := fetchUser(t, th, live.username)
			if posture == model.ImportedUsersActive {
				assert.Zero(t, liveUser.DeleteAt, "a user who was not revoked at the source must arrive active")
			} else {
				assert.NotZero(t, liveUser.DeleteAt)
			}
		})
	}
}

// ────────────────────────────────────────────────────────────────────────────
// 4. no choice supplied on a scoped archive: fail at the version line
// ────────────────────────────────────────────────────────────────────────────

func TestScopedImportRequiresImportedUsersChoice(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	users := []postureTestUser{
		newPostureUser(""),
		newPostureUser(model.UserAuthServiceLdap),
		newPostureUser(model.UserAuthServiceSaml),
	}
	jsonl := postureArchive(t, teamName, chanName, users, "")

	lineNum, appErr := th.App.BulkImportWithPathAndOpts(
		th.Context, strings.NewReader(jsonl), postureZip(t, jsonl),
		false, false, 1, "",
		model.BulkImportOpts{SkipPreflight: true},
	)

	require.NotNil(t, appErr, "a scoped import with no --imported-users value must fail")
	assert.Equal(t, "app.import.bulk_import.imported_users_choice_required.error", appErr.Id)
	assert.Equal(t, 1, lineNum, "the guard must fire at the version line")

	// Nothing may have been written. In particular the SSO pre-creation pass runs
	// off the same version line and would otherwise have created shells already.
	_, teamErr := th.App.GetTeamByName(teamName)
	assert.NotNil(t, teamErr, "no team may be created before the choice is validated")
	for _, u := range users {
		_, err := th.App.Srv().Store().User().GetByUsername(u.username)
		assert.Error(t, err, "no user rows may be written before the choice is validated (%s)", u.username)
	}
}

func TestImportedUsersPostureIsValid(t *testing.T) {
	assert.True(t, model.ImportedUsersActive.IsValid())
	assert.True(t, model.ImportedUsersInactive.IsValid())
	assert.False(t, model.ImportedUsersUnset.IsValid(), "an unstated choice must not pass validation")
	assert.False(t, model.ImportedUsersPosture("Active").IsValid(), "the value is case-sensitive")
	assert.False(t, model.ImportedUsersPosture("true").IsValid())
}

// ────────────────────────────────────────────────────────────────────────────
// 5. a full-instance restore must not demand the flag
// ────────────────────────────────────────────────────────────────────────────

func TestUnscopedImportDoesNotRequireImportedUsersChoice(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	teamName := model.NewRandomTeamName()
	chanName := model.NewId()
	users := []postureTestUser{
		newPostureUser(""),
		newPostureUser(model.UserAuthServiceLdap),
	}
	jsonl := unscopedPostureArchive(t, teamName, chanName, users)

	lineNum, appErr := th.App.BulkImport(th.Context, strings.NewReader(jsonl), nil, false, 1)
	require.Nil(t, appErr, "a full-instance import must not require --imported-users (failed at line %d)", lineNum)

	// And it keeps its existing behavior: a restore creates active accounts.
	for _, u := range users {
		created := fetchUser(t, th, u.username)
		assert.Zero(t, created.DeleteAt, "full-instance import behavior must be unchanged")
		assertImportedInactiveTag(t, created, false)
	}
}

// ────────────────────────────────────────────────────────────────────────────
// 6. SSO users, where the previous bug lived
//
// preCreateSSOUsers creates shells ahead of the main pass, which then *matches*
// them via GetByAuth rather than creating them — so importUser's creation-time
// policy never fires for these users. The posture has to be applied at the
// pre-creation site, and it has to be applied at creation time, because
// SqlUserStore.Update restores the previous DeleteAt on a non-trusted update.
// ────────────────────────────────────────────────────────────────────────────

func TestPreCreateSSOUserHonorsImportedUsers(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	for _, svc := range []string{model.UserAuthServiceLdap, model.UserAuthServiceSaml} {
		t.Run(svc+"/active", func(t *testing.T) {
			u := newPostureUser(svc)
			appErr := th.App.preCreateSSOUser(th.Context, u.importData(), true, model.ImportedUsersActive)
			require.Nil(t, appErr)

			created := fetchUser(t, th, u.username)
			assert.Zero(t, created.DeleteAt, "an SSO shell must arrive active under --imported-users=active")
			assertImportedInactiveTag(t, created, false)
		})

		t.Run(svc+"/inactive", func(t *testing.T) {
			u := newPostureUser(svc)
			appErr := th.App.preCreateSSOUser(th.Context, u.importData(), true, model.ImportedUsersInactive)
			require.Nil(t, appErr)

			created := fetchUser(t, th, u.username)
			assert.NotZero(t, created.DeleteAt)
			assertImportedInactiveTag(t, created, true)
		})

		t.Run(svc+"/source delete_at wins over an active choice", func(t *testing.T) {
			u := newPostureUser(svc)
			u.deleteAt = model.GetMillis() - 500*millisPerDayTest

			appErr := th.App.preCreateSSOUser(th.Context, u.importData(), true, model.ImportedUsersActive)
			require.Nil(t, appErr)

			created := fetchUser(t, th, u.username)
			assert.Equal(t, u.deleteAt, created.DeleteAt,
				"a source-revoked SSO user must stay revoked with their original timestamp even under --imported-users=active")
		})
	}
}

// TestScopedImportSSOUsersEndToEndPosture exercises the same thing through the
// whole pipeline, where the pre-creation pass and the main pass both run. An
// aggregate "all users exist" count hid this defect before; the assertions here
// slice by auth service for the same reason.
func TestScopedImportSSOUsersEndToEndPosture(t *testing.T) {
	mainHelper.Parallel(t)

	for _, posture := range []model.ImportedUsersPosture{model.ImportedUsersActive, model.ImportedUsersInactive} {
		t.Run(string(posture), func(t *testing.T) {
			th := Setup(t)

			teamName := model.NewRandomTeamName()
			chanName := model.NewId()

			bySvc := map[string][]postureTestUser{
				model.UserAuthServiceLdap: {newPostureUser(model.UserAuthServiceLdap), newPostureUser(model.UserAuthServiceLdap)},
				model.UserAuthServiceSaml: {newPostureUser(model.UserAuthServiceSaml), newPostureUser(model.UserAuthServiceSaml)},
			}
			var users []postureTestUser
			for _, svc := range []string{model.UserAuthServiceLdap, model.UserAuthServiceSaml} {
				users = append(users, bySvc[svc]...)
			}

			lineNum, appErr := runPostureImport(t, th, postureArchive(t, teamName, chanName, users, ""), posture)
			require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

			for svc, svcUsers := range bySvc {
				for _, u := range svcUsers {
					created := fetchUser(t, th, u.username)

					// The pre-creation pass anchored them on auth_data, and the main
					// pass matched rather than created. Confirm that actually happened,
					// or the posture assertion below proves nothing about this path.
					require.NotNil(t, created.AuthData)
					assert.Equal(t, u.authData, *created.AuthData)
					assert.Equal(t, svc, created.AuthService)

					if posture == model.ImportedUsersActive {
						assert.Zero(t, created.DeleteAt, "%s user %s must arrive active", svc, u.username)
						assertImportedInactiveTag(t, created, false)
					} else {
						assert.NotZero(t, created.DeleteAt, "%s user %s must arrive deactivated", svc, u.username)
						assertImportedInactiveTag(t, created, true)
					}
				}
			}
		})
	}
}

// TestAllSSOPopulationPostureReconciliation runs an all-SSO population end to end
// and reconciles it sliced by auth service.
//
// A migration population that is mostly local accounts hides posture defects in
// the SSO path: an aggregate "all users exist" count stays correct while every
// SSO account lands with the wrong access posture. The population here is
// deliberately all-SSO, evenly split LDAP and SAML, with a tenth revoked at the
// source, and every assertion below is per-provider rather than aggregate.
func TestAllSSOPopulationPostureReconciliation(t *testing.T) {
	mainHelper.Parallel(t)

	const (
		usersPerService   = 100
		revokedPerService = 10
	)

	for _, posture := range []model.ImportedUsersPosture{model.ImportedUsersActive, model.ImportedUsersInactive} {
		t.Run(string(posture), func(t *testing.T) {
			th := Setup(t)

			// Larger than the 50-member default, so this models a real migration
			// population rather than a handful of users.
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.TeamSettings.MaxUsersPerTeam = 500
			})

			teamName := model.NewRandomTeamName()
			chanName := model.NewId()
			revokedAt := model.GetMillis() - 400*millisPerDayTest

			var users []postureTestUser
			for _, svc := range []string{model.UserAuthServiceLdap, model.UserAuthServiceSaml} {
				for i := range usersPerService {
					u := newPostureUser(svc)
					// Spread the revoked users through both providers rather than
					// clustering them, so a per-provider slice is meaningful.
					if i%(usersPerService/revokedPerService) == 0 {
						u.deleteAt = revokedAt
					}
					users = append(users, u)
				}
			}

			lineNum, appErr := runPostureImport(t, th, postureArchive(t, teamName, chanName, users, ""), posture)
			require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

			for _, svc := range []string{model.UserAuthServiceLdap, model.UserAuthServiceSaml} {
				svcUsers, sErr := th.App.Srv().Store().User().GetAllUsingAuthService(svc)
				require.NoError(t, sErr)
				require.Len(t, svcUsers, usersPerService, "every %s user must land on the destination", svc)

				active, revoked := 0, 0
				for _, u := range svcUsers {
					switch {
					case u.DeleteAt == revokedAt:
						revoked++
					case u.DeleteAt == 0:
						active++
					}
				}

				assert.Equal(t, revokedPerService, revoked,
					"%s users revoked at the source must keep their original timestamp under --imported-users=%s", svc, posture)

				if posture == model.ImportedUsersActive {
					assert.Equal(t, usersPerService-revokedPerService, active,
						"every %s user not revoked at the source must be able to sign in under --imported-users=active", svc)
				} else {
					assert.Zero(t, active,
						"--imported-users=inactive must leave no %s account active", svc)
				}
			}
		})
	}
}

// ────────────────────────────────────────────────────────────────────────────
// 7. bots are outside the choice entirely
// ────────────────────────────────────────────────────────────────────────────

func TestScopedImportBotsStayActiveUnderBothPostures(t *testing.T) {
	mainHelper.Parallel(t)

	for _, posture := range []model.ImportedUsersPosture{model.ImportedUsersActive, model.ImportedUsersInactive} {
		t.Run(string(posture), func(t *testing.T) {
			th := Setup(t)

			teamName := model.NewRandomTeamName()
			chanName := model.NewId()
			owner := newPostureUser(model.UserAuthServiceLdap)

			jsonl := postureArchive(t, teamName, chanName, []postureTestUser{owner}, owner.username)
			lineNum, appErr := runPostureImport(t, th, jsonl, posture)
			require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

			bots, err := th.App.Srv().Store().Bot().GetAll(&model.BotGetOptions{
				Page:           0,
				PerPage:        100,
				IncludeDeleted: true,
			})
			require.NoError(t, err)
			require.NotEmpty(t, bots, "the archive's bot must have been imported")

			for _, b := range bots {
				botUser, bErr := th.App.Srv().Store().User().Get(th.Context, b.UserId)
				require.NoError(t, bErr)
				assert.Zero(t, botUser.DeleteAt, "bots must stay active under --imported-users=%s", posture)
				assertImportedInactiveTag(t, botUser, false)
			}
		})
	}
}

// ────────────────────────────────────────────────────────────────────────────
// 8. accounts that already exist on the destination are matched, not created
//
// Common when both instances share an LDAP or SAML directory. Customer docs must
// not describe "inactive" as covering everyone the migration touched.
// ────────────────────────────────────────────────────────────────────────────

func TestScopedImportExistingDestinationUsersUnaffected(t *testing.T) {
	mainHelper.Parallel(t)

	for _, posture := range []model.ImportedUsersPosture{model.ImportedUsersActive, model.ImportedUsersInactive} {
		t.Run(string(posture), func(t *testing.T) {
			th := Setup(t)

			teamName := model.NewRandomTeamName()
			chanName := model.NewId()

			// An SSO account that already exists on the destination, matched by
			// auth_data, and a local account matched by username.
			existingSSO := newPostureUser(model.UserAuthServiceLdap)
			destSSO := createPostureUserInDB(t, th, existingSSO)
			_, err := th.App.Srv().Store().User().UpdateAuthData(destSSO.Id, existingSSO.authService, &existingSSO.authData, destSSO.Email, false)
			require.NoError(t, err)

			existingLocal := newPostureUser("")
			createPostureUserInDB(t, th, existingLocal)

			// Plus one genuinely new account, so the import is doing the thing the
			// posture governs and the assertion below is a contrast, not a no-op.
			created := newPostureUser(model.UserAuthServiceSaml)

			users := []postureTestUser{existingSSO, existingLocal, created}
			lineNum, appErr := runPostureImport(t, th, postureArchive(t, teamName, chanName, users, ""), posture)
			require.Nil(t, appErr, "import must succeed (failed at line %d)", lineNum)

			for _, u := range []postureTestUser{existingSSO, existingLocal} {
				after := fetchUser(t, th, u.username)
				assert.Zero(t, after.DeleteAt,
					"%s already existed on the destination and must not be touched by --imported-users=%s", u.username, posture)
				assertImportedInactiveTag(t, after, false)
			}

			newUser := fetchUser(t, th, created.username)
			if posture == model.ImportedUsersActive {
				assert.Zero(t, newUser.DeleteAt)
			} else {
				assert.NotZero(t, newUser.DeleteAt, "the account the import created does follow the choice")
			}
		})
	}
}
