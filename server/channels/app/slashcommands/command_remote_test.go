// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func runRemoteCommand(th *TestHelper, userID, command string) string {
	args := &model.CommandArgs{
		T:         i18n.GetUserTranslations("en"),
		UserId:    userID,
		TeamId:    th.BasicTeam.Id,
		ChannelId: th.BasicChannel.Id,
		Command:   command,
	}
	return (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "").Text
}

func findRemoteClusterByName(t *testing.T, th *TestHelper, name string) *model.RemoteCluster {
	t.Helper()
	all, appErr := th.App.GetAllRemoteClusters(0, 999999, model.RemoteClusterQueryFilter{})
	require.Nil(t, appErr)
	for _, rc := range all {
		if rc.Name == name {
			return rc
		}
	}
	return nil
}

func remoteClusterCount(t *testing.T, th *TestHelper) int {
	t.Helper()
	all, appErr := th.App.GetAllRemoteClusters(0, 999999, model.RemoteClusterQueryFilter{IncludeDeleted: true})
	require.Nil(t, appErr)
	return len(all)
}

func TestRemoteProviderDoCommand(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	T := i18n.GetUserTranslations("en")
	adminID := th.SystemAdminUser.Id

	t.Run("rejects users without manage_secure_connections", func(t *testing.T) {
		require.False(t, th.App.HasPermissionTo(th.Context, th.BasicUser.Id, model.PermissionManageSecureConnections))
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065" })

		text := runRemoteCommand(th, th.BasicUser.Id, "/secure-connection create --name "+model.NewId()+" --password pwd")

		require.Equal(t, T("api.command_remote.permission_required", map[string]any{"Permission": "manage_secure_connections"}), text)
		require.Zero(t, remoteClusterCount(t, th), "no secure connection should be created without permission")
	})

	t.Run("missing action", func(t *testing.T) {
		text := runRemoteCommand(th, adminID, "/secure-connection")
		require.Equal(t, T("api.command_remote.missing_command", map[string]any{"Actions": AvailableRemoteActions}), text)
	})

	t.Run("unknown action", func(t *testing.T) {
		text := runRemoteCommand(th, adminID, "/secure-connection bogus --name foo")
		require.Equal(t, T("api.command_remote.unknown_action", map[string]any{"Action": "bogus"}), text)
	})
}

func TestRemoteProviderDoCreate(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	T := i18n.GetUserTranslations("en")
	adminID := th.SystemAdminUser.Id
	const siteURL = "http://localhost:8065"
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = siteURL })

	t.Run("missing password", func(t *testing.T) {
		name := "remote" + model.NewId()
		text := runRemoteCommand(th, adminID, "/secure-connection create --name "+name)

		require.Equal(t, T("api.command_remote.missing_empty", map[string]any{"Arg": "password"}), text)
		require.Nil(t, findRemoteClusterByName(t, th, name))
	})

	t.Run("missing name", func(t *testing.T) {
		before := remoteClusterCount(t, th)
		text := runRemoteCommand(th, adminID, "/secure-connection create --password pwd")

		require.Equal(t, T("api.command_remote.missing_empty", map[string]any{"Arg": "name"}), text)
		require.Equal(t, before, remoteClusterCount(t, th))
	})

	t.Run("display name defaults to name", func(t *testing.T) {
		name := "remote" + model.NewId()
		runRemoteCommand(th, adminID, "/secure-connection create --name "+name+" --password pwd")

		rc := findRemoteClusterByName(t, th, name)
		require.NotNil(t, rc)
		require.Equal(t, name, rc.DisplayName)
	})

	t.Run("explicit display name is used", func(t *testing.T) {
		name := "remote" + model.NewId()
		runRemoteCommand(th, adminID, "/secure-connection create --name "+name+" --displayname Fancy --password pwd")

		rc := findRemoteClusterByName(t, th, name)
		require.NotNil(t, rc)
		require.Equal(t, "Fancy", rc.DisplayName)
	})

	t.Run("site URL not set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = siteURL })

		name := "remote" + model.NewId()
		text := runRemoteCommand(th, adminID, "/secure-connection create --name "+name+" --password pwd")

		require.Equal(t, T("api.command_remote.site_url_not_set"), text)
		require.Nil(t, findRemoteClusterByName(t, th, name))
	})

	t.Run("success reply contains an invite that decrypts with the password", func(t *testing.T) {
		name := "remote" + model.NewId()
		text := runRemoteCommand(th, adminID, "/secure-connection create --name "+name+" --password s3cret")

		require.True(t, strings.HasPrefix(text, "##### "+T("api.command_remote.invitation_created")+"\n"), text)
		require.Contains(t, text, siteURL)

		_, afterFence, found := strings.Cut(text, "```\n")
		require.True(t, found, "expected the invite code in a code block:\n%s", text)
		inviteCode, _, found := strings.Cut(afterFence, "\n```")
		require.True(t, found, "expected the invite code block to be closed:\n%s", text)

		rc := findRemoteClusterByName(t, th, name)
		require.NotNil(t, rc)

		invite, appErr := th.App.DecryptRemoteClusterInvite(inviteCode, "s3cret")
		require.Nil(t, appErr)
		assert.Equal(t, rc.RemoteId, invite.RemoteId)
		assert.Equal(t, rc.Token, invite.Token)
		assert.Equal(t, siteURL, invite.SiteURL)

		_, appErr = th.App.DecryptRemoteClusterInvite(inviteCode, "wrong")
		require.NotNil(t, appErr, "invite must not decrypt with a different password")
	})
}

// newConfirmInviteServer starts a fake remote site that answers the invite confirmation
// with the given status and error. Received confirmations are delivered on the returned channel.
func newConfirmInviteServer(t *testing.T, status, errMsg string) (*httptest.Server, <-chan model.RemoteClusterInvite) {
	t.Helper()
	confirms := make(chan model.RemoteClusterInvite, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/confirm_invite") {
			var frame model.RemoteClusterFrame
			var confirm model.RemoteClusterInvite
			if json.NewDecoder(r.Body).Decode(&frame) == nil && json.Unmarshal(frame.Msg.Payload, &confirm) == nil {
				select {
				case confirms <- confirm:
				default:
				}
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": status, "err": errMsg})
	}))
	t.Cleanup(ts.Close)
	return ts, confirms
}

func TestRemoteProviderDoAccept(t *testing.T) {
	T := i18n.GetUserTranslations("en")
	const siteURL = "http://localhost:8065"
	const password = "s3cret"

	th := setupForSharedChannels(t).initBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = siteURL })
	adminID := th.SystemAdminUser.Id

	makeInvite := func(t *testing.T, remoteSiteURL string) (string, string) {
		t.Helper()
		remoteID := model.NewId()
		code, appErr := th.App.CreateRemoteClusterInvite(remoteID, remoteSiteURL, model.NewId(), password)
		require.Nil(t, appErr)
		return code, remoteID
	}

	t.Run("missing arguments", func(t *testing.T) {
		code, _ := makeInvite(t, "https://remote.example.com")
		for _, tc := range []struct {
			missing string
			command string
		}{
			{"password", "/secure-connection accept --name remote1 --invite " + code},
			{"name", "/secure-connection accept --password " + password + " --invite " + code},
			{"invite", "/secure-connection accept --name remote1 --password " + password},
		} {
			t.Run(tc.missing, func(t *testing.T) {
				text := runRemoteCommand(th, adminID, tc.command)
				require.Equal(t, T("api.command_remote.missing_empty", map[string]any{"Arg": tc.missing}), text)
			})
		}
	})

	t.Run("wrong password", func(t *testing.T) {
		code, _ := makeInvite(t, "https://remote.example.com")
		text := runRemoteCommand(th, adminID, "/secure-connection accept --name remote1 --password wrong --invite "+code)

		require.True(t, strings.HasPrefix(text, T("api.command_remote.decode_invitation.error", map[string]any{"Error": ""})), text)
		require.Contains(t, text, T("api.remote_cluster.invite_decrypt_error"))
	})

	t.Run("malformed invite", func(t *testing.T) {
		text := runRemoteCommand(th, adminID, "/secure-connection accept --name remote1 --password "+password+" --invite not*base64")

		require.True(t, strings.HasPrefix(text, T("api.command_remote.decode_invitation.error", map[string]any{"Error": ""})), text)
		require.Contains(t, text, T("api.remote_cluster.base64_decode_error"))
	})

	t.Run("site URL not set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = siteURL })

		ts, _ := newConfirmInviteServer(t, model.StatusOk, "")
		code, remoteID := makeInvite(t, ts.URL)
		text := runRemoteCommand(th, adminID, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.site_url_not_set"), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, true)
		require.NotNil(t, appErr, "no secure connection should be stored")
	})

	t.Run("remote site rejects the invite", func(t *testing.T) {
		ts, _ := newConfirmInviteServer(t, model.StatusFail, "invite rejected by remote")
		code, _ := makeInvite(t, ts.URL)
		text := runRemoteCommand(th, adminID, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": "invite rejected by remote"}), text)
	})

	t.Run("success", func(t *testing.T) {
		ts, confirms := newConfirmInviteServer(t, model.StatusOk, "")
		code, remoteID := makeInvite(t, ts.URL)
		name := "remote" + model.NewId()
		text := runRemoteCommand(th, adminID, "/secure-connection accept --name "+name+" --password "+password+" --invite "+code)

		require.Equal(t, "##### "+T("api.command_remote.accept_invitation", map[string]any{"SiteURL": ts.URL}), text)

		select {
		case confirm := <-confirms:
			assert.Equal(t, siteURL, confirm.SiteURL, "confirmation must advertise this server's Site URL")
		default:
			require.Fail(t, "remote site did not receive an invite confirmation")
		}

		rc, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.Nil(t, appErr)
		assert.Equal(t, name, rc.Name)
		assert.Equal(t, name, rc.DisplayName, "display name should default to name")
		assert.Equal(t, adminID, rc.CreatorId)
	})

	t.Run("explicit display name is used", func(t *testing.T) {
		ts, _ := newConfirmInviteServer(t, model.StatusOk, "")
		code, remoteID := makeInvite(t, ts.URL)
		text := runRemoteCommand(th, adminID, "/secure-connection accept --name remote"+model.NewId()+" --displayname Fancy --password "+password+" --invite "+code)
		require.Equal(t, "##### "+T("api.command_remote.accept_invitation", map[string]any{"SiteURL": ts.URL}), text)

		rc, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.Nil(t, appErr)
		assert.Equal(t, "Fancy", rc.DisplayName)
	})
}

func TestRemoteProviderDoAcceptServiceNotEnabled(t *testing.T) {
	T := i18n.GetUserTranslations("en")
	th := setup(t).initBasic(t)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://localhost:8065" })
	require.Nil(t, th.Server.GetRemoteClusterService())

	code, appErr := th.App.CreateRemoteClusterInvite(model.NewId(), "https://remote.example.com", model.NewId(), "s3cret")
	require.Nil(t, appErr)
	text := runRemoteCommand(th, th.SystemAdminUser.Id, "/secure-connection accept --name remote1 --password s3cret --invite "+code)

	require.Equal(t, T("api.command_remote.service_not_enabled"), text)
}

func TestRemoteProviderDoStatusNoConnections(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	T := i18n.GetUserTranslations("en")

	text := runRemoteCommand(th, th.SystemAdminUser.Id, "/secure-connection status")
	require.Equal(t, "** "+T("api.command_remote.remotes_not_found")+" **", text)
}

func TestRemoteProviderGetAutoCompleteListItems(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	rp := &RemoteProvider{}
	connectionIDArg := &model.AutocompleteArg{Name: "connectionID"}
	const removeParsed = "/secure-connection remove --connectionID "

	seedRemote := func(t *testing.T, lastPingAt int64) *model.RemoteCluster {
		t.Helper()
		rc, appErr := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "remote" + model.NewId(),
			DisplayName: "Display " + model.NewId(),
			SiteURL:     "https://" + model.NewId() + ".example.com",
			Token:       model.NewId(),
			LastPingAt:  lastPingAt,
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, appErr)
		return rc
	}
	online := seedRemote(t, model.GetMillis())
	offline := seedRemote(t, 0)

	argsFor := func(userID string) *model.CommandArgs {
		return &model.CommandArgs{UserId: userID, TeamId: th.BasicTeam.Id, ChannelId: th.BasicChannel.Id}
	}

	t.Run("rejects users without manage_secure_connections", func(t *testing.T) {
		require.False(t, th.App.HasPermissionTo(th.Context, th.BasicUser.Id, model.PermissionManageSecureConnections))

		items, err := rp.GetAutoCompleteListItems(th.Context, th.App, argsFor(th.BasicUser.Id), connectionIDArg, removeParsed, "")
		require.Error(t, err)
		require.Empty(t, items)
	})

	t.Run("lists online and offline connections for remove", func(t *testing.T) {
		items, err := rp.GetAutoCompleteListItems(th.Context, th.App, argsFor(th.SystemAdminUser.Id), connectionIDArg, removeParsed, "")
		require.NoError(t, err)

		require.ElementsMatch(t, []model.AutocompleteListItem{
			{Item: online.RemoteId, HelpText: online.DisplayName + "  (" + online.SiteURL + ")"},
			{Item: offline.RemoteId, HelpText: offline.DisplayName + "  (" + offline.SiteURL + ")"},
		}, items)
	})

	t.Run("errors for other arguments", func(t *testing.T) {
		_, err := rp.GetAutoCompleteListItems(th.Context, th.App, argsFor(th.SystemAdminUser.Id), &model.AutocompleteArg{Name: "name"}, removeParsed, "")
		require.Error(t, err)

		_, err = rp.GetAutoCompleteListItems(th.Context, th.App, argsFor(th.SystemAdminUser.Id), connectionIDArg, "/secure-connection create --connectionID ", "")
		require.Error(t, err)
	})
}

func TestIsOnline(t *testing.T) {
	now := model.GetMillis()
	assert.True(t, isOnline(now-1000), "recent ping")
	assert.False(t, isOnline(now-model.RemoteOfflineAfterMillis-1000), "ping older than RemoteOfflineAfterMillis")
	assert.False(t, isOnline(0), "never pinged")
}

func TestRemoteProviderDoStatus(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	// seedRemote creates a remote cluster. When deleted is true it is soft-deleted
	// after creation so it carries a non-zero DeleteAt, mirroring a removed connection.
	seedRemote := func(t *testing.T, displayName string, createAt int64, deleted bool) {
		t.Helper()
		rc, appErr := th.App.AddRemoteCluster(&model.RemoteCluster{
			RemoteId:    model.NewId(),
			Name:        "remote-" + model.NewId(),
			DisplayName: displayName,
			SiteURL:     "https://" + model.NewId() + ".example.com",
			Token:       model.NewId(),
			CreateAt:    createAt,
			CreatorId:   th.BasicUser.Id,
		})
		require.Nil(t, appErr)

		if deleted {
			_, appErr = th.App.DeleteRemoteCluster(rc.RemoteId)
			require.Nil(t, appErr)
		}
	}

	// The store returns rows ordered by DisplayName (see sqlRemoteClusterStore.GetAll),
	// so without the fix the rows come back interleaved: AAA, BBB, CCC, DDD.
	//
	// CreateAt values are chosen so the fix's behavior is unambiguous:
	//   - Active group: CCC (100) must sort before AAA (300), proving the CreateAt
	//     ordering overrides the store's alphabetical order.
	//   - Deleted group: BBB and DDD share a CreateAt, so the stable sort must
	//     preserve their store order (BBB before DDD).
	// Expected final order: CCC, AAA, BBB, DDD.
	seedRemote(t, "AAA Active", 300, false)
	seedRemote(t, "BBB Deleted", 200, true)
	seedRemote(t, "CCC Active", 100, false)
	seedRemote(t, "DDD Deleted", 200, true)

	args := &model.CommandArgs{
		T:         func(s string, args ...any) string { return s },
		UserId:    th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		ChannelId: th.BasicChannel.Id,
		Command:   "/secure-connection status",
	}

	resp := (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "")
	require.NotNil(t, resp)
	output := resp.Text

	// separatorLine returns the Markdown table separator row (the line made up of
	// alignment cells) from the command output.
	separatorLine := func() string {
		for line := range strings.SplitSeq(output, "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "| :----") {
				return line
			}
		}
		return ""
	}

	t.Run("header separator has exactly nine cells matching the columns", func(t *testing.T) {
		sep := separatorLine()
		require.NotEmpty(t, sep, "expected a Markdown separator row in the output")
		require.Equal(t, "| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |", sep,
			"separator row must have exactly nine cells to match the nine-column header and data rows")
		require.Equal(t, 9, strings.Count(sep, ":----"), "separator must contain exactly nine alignment cells")
	})

	t.Run("data rows have nine cells matching the header", func(t *testing.T) {
		for line := range strings.SplitSeq(output, "\n") {
			if strings.Contains(line, "AAA Active") {
				// A row with 9 cells is delimited by 10 pipe characters.
				require.Equal(t, 10, strings.Count(line, "|"), "each data row must have nine cells")
				return
			}
		}
		require.Fail(t, "expected to find the AAA Active data row in the output")
	})

	t.Run("active connections sort before deleted ones, by CreateAt then stably", func(t *testing.T) {
		rowOrder := []string{"CCC Active", "AAA Active", "BBB Deleted", "DDD Deleted"}
		lastIdx := -1
		for _, name := range rowOrder {
			idx := strings.Index(output, name)
			require.GreaterOrEqual(t, idx, 0, "expected %q to appear in the status output", name)
			require.Greater(t, idx, lastIdx, "expected %q to appear after the previous row", name)
			lastIdx = idx
		}
	})
}
