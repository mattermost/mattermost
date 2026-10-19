// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

func runCommand(th *TestHelper, provider app.CommandProvider, userID, channelID, command string) string {
	args := &model.CommandArgs{
		T:         i18n.GetUserTranslations("en"),
		UserId:    userID,
		TeamId:    th.BasicTeam.Id,
		ChannelId: channelID,
		Command:   command,
	}
	return provider.DoCommand(th.App, th.Context, args, "").Text
}

// LastPingAt defaults to zero, so the remote is offline and invitations to it are stored
// as pending instead of being sent over the network.
func seedRemoteCluster(t *testing.T, th *TestHelper, opts ...func(rc *model.RemoteCluster)) *model.RemoteCluster {
	t.Helper()
	rc := &model.RemoteCluster{
		RemoteId:    model.NewId(),
		Name:        "remote" + model.NewId(),
		DisplayName: "Remote " + model.NewId(),
		SiteURL:     "https://" + model.NewId() + ".example.com",
		Token:       model.NewId(),
		CreatorId:   th.BasicUser.Id,
	}
	for _, opt := range opts {
		opt(rc)
	}
	saved, appErr := th.App.AddRemoteCluster(rc)
	require.Nil(t, appErr)
	return saved
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

		name := "remote" + model.NewId()
		text := runCommand(th, &RemoteProvider{}, th.BasicUser.Id, th.BasicChannel.Id, "/secure-connection create --name "+name+" --password pwd")

		require.Equal(t, T("api.command_remote.permission_required", map[string]any{"Permission": "manage_secure_connections"}), text)
		require.Nil(t, findRemoteClusterByName(t, th, name), "no secure connection should be created without permission")
	})

	t.Run("missing action", func(t *testing.T) {
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection")
		require.Equal(t, T("api.command_remote.missing_command", map[string]any{"Actions": AvailableRemoteActions}), text)
	})

	t.Run("unknown action", func(t *testing.T) {
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection bogus --name foo")
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
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection create --name "+name)

		require.Equal(t, T("api.command_remote.missing_empty", map[string]any{"Arg": "password"}), text)
		require.Nil(t, findRemoteClusterByName(t, th, name))
	})

	t.Run("missing name", func(t *testing.T) {
		before := remoteClusterCount(t, th)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection create --password pwd")

		require.Equal(t, T("api.command_remote.missing_empty", map[string]any{"Arg": "name"}), text)
		require.Equal(t, before, remoteClusterCount(t, th))
	})

	t.Run("display name defaults to name", func(t *testing.T) {
		name := "remote" + model.NewId()
		runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection create --name "+name+" --password pwd")

		rc := findRemoteClusterByName(t, th, name)
		require.NotNil(t, rc)
		require.Equal(t, name, rc.DisplayName)
	})

	t.Run("explicit display name is used", func(t *testing.T) {
		name := "remote" + model.NewId()
		runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection create --name "+name+" --displayname Fancy --password pwd")

		rc := findRemoteClusterByName(t, th, name)
		require.NotNil(t, rc)
		require.Equal(t, "Fancy", rc.DisplayName)
	})

	t.Run("site URL not set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = siteURL })

		name := "remote" + model.NewId()
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection create --name "+name+" --password pwd")

		require.Equal(t, T("api.command_remote.site_url_not_set"), text)
		require.Nil(t, findRemoteClusterByName(t, th, name))
	})

	t.Run("success reply contains an invite that decrypts with the password", func(t *testing.T) {
		name := "remote" + model.NewId()
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection create --name "+name+" --password s3cret")

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

func newConfirmInviteServer(t *testing.T, status, errMsg string) (*httptest.Server, <-chan model.RemoteClusterInvite) {
	t.Helper()
	confirms := make(chan model.RemoteClusterInvite, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var frame model.RemoteClusterFrame
		if err := json.NewDecoder(r.Body).Decode(&frame); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/confirm_invite"):
			var confirm model.RemoteClusterInvite
			if json.Unmarshal(frame.Msg.Payload, &confirm) == nil {
				select {
				case confirms <- confirm:
				default:
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"status": status, "err": errMsg})
		case strings.HasSuffix(r.URL.Path, "/ping"):
			var ping model.RemoteClusterPing
			if err := json.Unmarshal(frame.Msg.Payload, &ping); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			ping.RecvAt = model.GetMillis()
			_ = json.NewEncoder(w).Encode(ping)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(ts.Close)
	return ts, confirms
}

// Waits for the background ping started by a successful accept so it does not race the
// fake remote server shutdown.
func waitForFirstPing(t *testing.T, th *TestHelper, remoteID string) {
	t.Helper()
	require.Eventually(t, func() bool {
		rc, appErr := th.App.GetRemoteCluster(remoteID, false)
		return appErr == nil && rc.LastPingAt != 0
	}, 10*time.Second, 20*time.Millisecond, "the first ping to the accepted remote did not complete")
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
				text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, tc.command)
				require.Equal(t, T("api.command_remote.missing_empty", map[string]any{"Arg": tc.missing}), text)
			})
		}
	})

	t.Run("wrong password", func(t *testing.T) {
		code, _ := makeInvite(t, "https://remote.example.com")
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password wrong --invite "+code)

		require.Equal(t, T("api.command_remote.decode_invitation.error", map[string]any{"Error": T("api.remote_cluster.invite_decrypt_error")}), text)
	})

	t.Run("malformed invite", func(t *testing.T) {
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite not*base64")

		require.Equal(t, T("api.command_remote.decode_invitation.error", map[string]any{"Error": T("api.remote_cluster.base64_decode_error")}), text)
	})

	t.Run("invalid name replies with the translated validation error", func(t *testing.T) {
		code, remoteID := makeInvite(t, "https://remote.example.com")
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name bad!name --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": T("model.cluster.is_valid.name.app_error")}), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, true)
		require.NotNil(t, appErr, "no secure connection should be stored")
	})

	t.Run("existing connection replies with a translated conflict message instead of the database error", func(t *testing.T) {
		// Accepting an invite for a connection that already exists under the same name
		// violates the RemoteClusters primary key.
		existing := seedRemoteCluster(t, th)
		code, appErr := th.App.CreateRemoteClusterInvite(existing.RemoteId, "https://remote.example.com", model.NewId(), password)
		require.Nil(t, appErr)

		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name "+existing.Name+" --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": T("api.remote_cluster.save_not_unique.app_error")}), text)
		rc, appErr := th.App.GetRemoteCluster(existing.RemoteId, false)
		require.Nil(t, appErr, "the existing connection must be left in place")
		assert.Equal(t, existing.SiteURL, rc.SiteURL)
	})

	t.Run("unreachable remote site replies with a translated error naming the address", func(t *testing.T) {
		ts := httptest.NewServer(http.NotFoundHandler())
		ts.Close()
		code, remoteID := makeInvite(t, ts.URL)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		unreachable := T("api.remote_cluster.accept_invitation.unreachable.app_error", map[string]any{"URL": ts.URL + "/" + remotecluster.ConfirmInviteURL})
		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": unreachable}), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.NotNil(t, appErr, "the unconfirmed connection must not remain active")
	})

	t.Run("remote site answering with a non-JSON page replies with a translated invalid response error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html><body>Proxy login required</body></html>"))
		}))
		t.Cleanup(ts.Close)
		code, remoteID := makeInvite(t, ts.URL)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": T("api.remote_cluster.accept_invitation.invalid_response.app_error")}), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.NotNil(t, appErr, "the unconfirmed connection must not remain active")
	})

	t.Run("unreachable remote site with markdown in its address replies with the address escaped", func(t *testing.T) {
		ts := httptest.NewServer(http.NotFoundHandler())
		ts.Close()
		code, remoteID := makeInvite(t, ts.URL+"/[click](https://evil.example.com)")
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		escapedURL := ts.URL + "/%5Bclick%5D%28https://evil.example.com%29/" + remotecluster.ConfirmInviteURL
		unreachable := T("api.remote_cluster.accept_invitation.unreachable.app_error", map[string]any{"URL": escapedURL})
		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": unreachable}), text)
		require.NotContains(t, text, "](")
		_, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.NotNil(t, appErr, "the unconfirmed connection must not remain active")
	})

	for _, tc := range []struct {
		name    string
		status  int
		body    string
		errorID string
	}{
		{"expired invite", http.StatusBadRequest, `{"id":"api.context.invitation_expired.error","message":"[click](https://evil.example.com)"}`, "api.remote_cluster.accept_invitation.expired.app_error"},
		{"remote error", http.StatusInternalServerError, `{"id":"api.command_remote.confirm_invitation.error","message":"[click](https://evil.example.com)"}`, "api.remote_cluster.accept_invitation.rejected.app_error"},
		{"unreadable error body", http.StatusBadGateway, "<html><body>Bad Gateway</body></html>", "api.remote_cluster.accept_invitation.invalid_response.app_error"},
		{"hardened mode remote error", http.StatusInternalServerError, `{"id":"","message":"Internal Server Error","detailed_error":"","request_id":"","status_code":500}`, "api.remote_cluster.accept_invitation.rejected.app_error"},
		{"JSON error body that is not an app error", http.StatusBadGateway, `{"error":"bad gateway"}`, "api.remote_cluster.accept_invitation.invalid_response.app_error"},
	} {
		t.Run("remote site answering with an error status: "+tc.name, func(t *testing.T) {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			t.Cleanup(ts.Close)
			code, remoteID := makeInvite(t, ts.URL)
			text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

			require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": T(tc.errorID)}), text)
			_, appErr := th.App.GetRemoteCluster(remoteID, false)
			require.NotNil(t, appErr, "the unconfirmed connection must not remain active")
		})
	}

	t.Run("remote site dropping the connection mid-body replies with a translated unreachable error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			conn, buf, err := w.(http.Hijacker).Hijack()
			if !assert.NoError(t, err) {
				return
			}
			_, _ = buf.WriteString("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 1024\r\n\r\n{\"status\":")
			_ = buf.Flush()
			_ = conn.Close()
		}))
		t.Cleanup(ts.Close)
		code, remoteID := makeInvite(t, ts.URL)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		unreachable := T("api.remote_cluster.accept_invitation.unreachable.app_error", map[string]any{"URL": ts.URL + "/" + remotecluster.ConfirmInviteURL})
		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": unreachable}), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.NotNil(t, appErr, "the unconfirmed connection must not remain active")
	})

	t.Run("malformed remote site address replies with a translated invalid address error", func(t *testing.T) {
		// CreateRemoteClusterInvite validates the address, so encrypt the invite directly as another server could.
		remoteID := model.NewId()
		invite := &model.RemoteClusterInvite{RemoteId: remoteID, SiteURL: "http://remote.example.com/\x7f", Token: model.NewId(), Version: 3}
		encrypted, err := invite.Encrypt(password)
		require.NoError(t, err)
		code := base64.URLEncoding.EncodeToString(encrypted)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		invalidURL := T("api.remote_cluster.accept_invitation.invalid_url.app_error", map[string]any{"URL": "http://remote.example.com/%7F/" + remotecluster.ConfirmInviteURL})
		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": invalidURL}), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.NotNil(t, appErr, "the unconfirmed connection must not remain active")
	})

	t.Run("site URL not set", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = siteURL })

		ts, _ := newConfirmInviteServer(t, model.StatusOk, "")
		code, remoteID := makeInvite(t, ts.URL)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.site_url_not_set"), text)
		_, appErr := th.App.GetRemoteCluster(remoteID, true)
		require.NotNil(t, appErr, "no secure connection should be stored")
	})

	t.Run("remote site rejects the invite with a translated reply that omits the remote's reason", func(t *testing.T) {
		ts, _ := newConfirmInviteServer(t, model.StatusFail, "[click here](https://evil.example.com) to fix your connection")
		code, remoteID := makeInvite(t, ts.URL)
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password "+password+" --invite "+code)

		require.Equal(t, T("api.command_remote.accept_invitation.error", map[string]any{"Error": T("api.remote_cluster.accept_invitation.rejected.app_error")}), text)

		_, appErr := th.App.GetRemoteCluster(remoteID, false)
		require.NotNil(t, appErr, "the refused connection must not remain active")
		rc, appErr := th.App.GetRemoteCluster(remoteID, true)
		require.Nil(t, appErr, "the refused connection is saved before the confirmation is sent")
		require.NotZero(t, rc.DeleteAt, "the refused connection must be deleted")
	})

	t.Run("success", func(t *testing.T) {
		ts, confirms := newConfirmInviteServer(t, model.StatusOk, "")
		code, remoteID := makeInvite(t, ts.URL)
		name := "remote" + model.NewId()
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name "+name+" --password "+password+" --invite "+code)

		require.Equal(t, "##### "+T("api.command_remote.accept_invitation", map[string]any{"SiteURL": ts.URL}), text)
		waitForFirstPing(t, th, remoteID)

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
		text := runCommand(th, &RemoteProvider{}, adminID, th.BasicChannel.Id, "/secure-connection accept --name remote"+model.NewId()+" --displayname Fancy --password "+password+" --invite "+code)
		require.Equal(t, "##### "+T("api.command_remote.accept_invitation", map[string]any{"SiteURL": ts.URL}), text)
		waitForFirstPing(t, th, remoteID)

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
	text := runCommand(th, &RemoteProvider{}, th.SystemAdminUser.Id, th.BasicChannel.Id, "/secure-connection accept --name remote1 --password s3cret --invite "+code)

	require.Equal(t, T("api.command_remote.service_not_enabled"), text)
}

func TestRemoteProviderDoStatusNoConnections(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	T := i18n.GetUserTranslations("en")

	text := runCommand(th, &RemoteProvider{}, th.SystemAdminUser.Id, th.BasicChannel.Id, "/secure-connection status")
	require.Equal(t, "** "+T("api.command_remote.remotes_not_found")+" **", text)
}

type failingGetAllRemoteClusterStore struct {
	store.RemoteClusterStore
	fail *atomic.Bool
}

func (s *failingGetAllRemoteClusterStore) GetAll(offset, limit int, filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, error) {
	if s.fail.Load() {
		return nil, errors.New(`pq: column rc.displayname does not exist`)
	}
	return s.RemoteClusterStore.GetAll(offset, limit, filter)
}

// failingGetAllStoreWrapper fails RemoteCluster().GetAll while fail is set; all other
// calls use the real store.
type failingGetAllStoreWrapper struct {
	store.Store
	fail atomic.Bool
}

func (w *failingGetAllStoreWrapper) RemoteCluster() store.RemoteClusterStore {
	return &failingGetAllRemoteClusterStore{RemoteClusterStore: w.Store.RemoteCluster(), fail: &w.fail}
}

func TestRemoteProviderDoStatusStoreFailure(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	wrapper := &failingGetAllStoreWrapper{Store: dbStore}
	th := setupTestHelper(wrapper, false, true, t, nil).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	userT := func(id string, args ...any) string {
		switch id {
		case "api.remote_cluster.get.app_error":
			return "user-locale fetch error"
		case "api.command_remote.fetch_status.error":
			return "fetch failed: " + args[0].(map[string]any)["Error"].(string)
		}
		return id
	}
	args := &model.CommandArgs{
		T:         userT,
		UserId:    th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		ChannelId: th.BasicChannel.Id,
		Command:   "/secure-connection status",
	}

	wrapper.fail.Store(true)
	defer wrapper.fail.Store(false)
	resp := (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "")
	require.NotNil(t, resp)
	require.Equal(t, "fetch failed: user-locale fetch error", resp.Text)
}

func TestRemoteProviderGetAutoCompleteListItems(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	rp := &RemoteProvider{}
	connectionIDArg := &model.AutocompleteArg{Name: "connectionID"}
	const removeParsed = "/secure-connection remove --connectionID "

	online := seedRemoteCluster(t, th, func(rc *model.RemoteCluster) { rc.LastPingAt = model.GetMillis() })
	offline := seedRemoteCluster(t, th)

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

type failingDeleteRemoteClusterStore struct {
	store.RemoteClusterStore
	wrapper *failingDeleteStoreWrapper
}

func (s *failingDeleteRemoteClusterStore) Delete(remoteClusterId string) (bool, error) {
	s.wrapper.deleteCalls.Add(1)
	if remoteClusterId == s.wrapper.failDeleteID {
		return false, errors.New("database is unavailable")
	}
	return s.RemoteClusterStore.Delete(remoteClusterId)
}

// failingDeleteStoreWrapper fails RemoteCluster().Delete for failDeleteID and counts
// every Delete call; all other calls use the real store.
type failingDeleteStoreWrapper struct {
	store.Store
	failDeleteID string
	deleteCalls  atomic.Int32
}

func (w *failingDeleteStoreWrapper) RemoteCluster() store.RemoteClusterStore {
	return &failingDeleteRemoteClusterStore{RemoteClusterStore: w.Store.RemoteCluster(), wrapper: w}
}

func TestRemoteProviderDoRemove(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()

	// The wrapper is installed before the server starts so the live store is never swapped.
	wrapper := &failingDeleteStoreWrapper{Store: dbStore, failDeleteID: model.NewId()}
	th := setupTestHelper(wrapper, false, true, t, nil).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	runRemove := func(t *testing.T, command string) string {
		t.Helper()
		args := &model.CommandArgs{
			T:         i18n.GetUserTranslations("en"),
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			ChannelId: th.BasicChannel.Id,
			Command:   command,
		}
		resp := (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "")
		require.NotNil(t, resp)
		return resp.Text
	}

	t.Run("removes an existing connection", func(t *testing.T) {
		rc := seedRemoteCluster(t, th)

		output := runRemove(t, "/secure-connection remove --connectionID "+rc.RemoteId)

		require.Equal(t, "##### Secure connection "+rc.RemoteId+" removed.", output)
		_, appErr := th.App.GetRemoteCluster(rc.RemoteId, false)
		require.NotNil(t, appErr, "removed connection must no longer be returned as active")
		deletedRC, appErr := th.App.GetRemoteCluster(rc.RemoteId, true)
		require.Nil(t, appErr)
		require.NotZero(t, deletedRC.DeleteAt)
	})

	t.Run("reports an unknown connection as not found", func(t *testing.T) {
		id := model.NewId()

		output := runRemove(t, "/secure-connection remove --connectionID "+id)

		require.Equal(t, "##### Secure connection "+id+" **NOT FOUND**.", output)
	})

	t.Run("reports a store error instead of not found", func(t *testing.T) {
		output := runRemove(t, "/secure-connection remove --connectionID "+wrapper.failDeleteID)

		require.Equal(t, "Could not remove secure connection: We encountered an error deleting the secure connection.", output)
	})

	t.Run("rejects a missing, empty, malformed or misquoted connectionID without deleting", func(t *testing.T) {
		for name, tc := range map[string]struct {
			command string
			reply   string
		}{
			"missing":      {"/secure-connection remove", "Missing or empty `connectionID`"},
			"empty":        {"/secure-connection remove --connectionID", "Missing or empty `connectionID`"},
			"empty quotes": {`/secure-connection remove --connectionID ""`, "Missing or empty `connectionID`"},
			"blank quotes": {`/secure-connection remove --connectionID " "`, "Missing or empty `connectionID`"},
			"malformed":    {"/secure-connection remove --connectionID foo", "`foo` is not a valid `connectionID`"},
			"stray word":   {"/secure-connection remove --connectionID foo bar", "Unexpected text near `--connectionID`. Wrap a value that contains spaces in quotes, and use double quotes if the value also contains an apostrophe."},
			"open quote":   {`/secure-connection remove --connectionID "foo`, "A quote near `--connectionID` is never closed."},
		} {
			t.Run(name, func(t *testing.T) {
				callsBefore := wrapper.deleteCalls.Load()

				output := runRemove(t, tc.command)

				require.Equal(t, tc.reply, output)
				require.Equal(t, callsBefore, wrapper.deleteCalls.Load(), "DeleteRemoteCluster must not be called without a valid connectionID")
			})
		}
	})
}

func TestRemoteProviderDoStatus(t *testing.T) {
	th := setupForSharedChannels(t).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	// seedRemote creates a remote cluster. When deleted is true it is soft-deleted
	// after creation so it carries a non-zero DeleteAt, mirroring a removed connection.
	seedRemote := func(t *testing.T, displayName string, createAt int64, deleted bool) {
		t.Helper()
		rc := seedRemoteCluster(t, th, func(rc *model.RemoteCluster) {
			rc.DisplayName = displayName
			rc.CreateAt = createAt
		})

		if deleted {
			_, appErr := th.App.DeleteRemoteCluster(rc.RemoteId)
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

func TestRemoteProviderDoCreateValidationFailure(t *testing.T) {
	th := setupConfig(t, func(cfg *model.Config) {
		*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
		*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
		*cfg.ServiceSettings.SiteURL = "http://localhost:8065"
	}).initBasic(t)
	th.addPermissionToRole(t, model.PermissionManageSecureConnections.Id, th.BasicUser.Roles)

	t.Run("add failure replies with the validation error translated for the user, without internal detail", func(t *testing.T) {
		userT := func(id string, args ...any) string {
			switch id {
			case "model.cluster.is_valid.name.app_error":
				return "user-locale invalid name"
			case "api.command_remote.add_remote.error":
				return "add failed: " + args[0].(map[string]any)["Error"].(string)
			}
			return id
		}

		args := &model.CommandArgs{
			T:         userT,
			UserId:    th.BasicUser.Id,
			TeamId:    th.BasicTeam.Id,
			ChannelId: th.BasicChannel.Id,
			Command:   "/secure-connection create --name bad!name --password secret",
		}

		resp := (&RemoteProvider{}).DoCommand(th.App, th.Context, args, "")
		require.NotNil(t, resp)
		require.Equal(t, "add failed: user-locale invalid name", resp.Text)

		list, appErr := th.App.GetAllRemoteClusters(0, 10, model.RemoteClusterQueryFilter{IncludeDeleted: true})
		require.Nil(t, appErr)
		require.Empty(t, list, "no secure connection should be saved for an invalid name")
	})
}
