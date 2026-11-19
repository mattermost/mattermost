// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

func TestDoSecurityUpdateCheck(t *testing.T) {
	mainHelper.Parallel(t)

	setup := func(t *testing.T) *TestHelper {
		th := Setup(t).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableSecurityFixAlert = true })
		_, err := th.App.Srv().Store().System().PermanentDeleteByName(model.SystemLastSecurityTime)
		require.NoError(t, err)
		return th
	}

	runCheck := func(t *testing.T, th *TestHelper, securityURL string, timeout time.Duration) {
		t.Helper()
		done := make(chan struct{})
		go func() {
			th.Server.doSecurityUpdateCheck(securityURL, &http.Client{Timeout: timeout})
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(timeout + 10*time.Second):
			require.FailNow(t, "security update check did not return after the client timeout")
		}
	}

	t.Run("returns when the security endpoint never replies", func(t *testing.T) {
		th := setup(t)
		var reached atomic.Bool
		release := make(chan struct{})
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reached.Store(true)
			<-release
		}))
		defer ts.Close()
		defer close(release)

		runCheck(t, th, ts.URL, 500*time.Millisecond)

		assert.True(t, reached.Load(), "security endpoint was never requested")
	})

	t.Run("returns when the bulletin endpoint never replies", func(t *testing.T) {
		th := setup(t)
		bulletinID := model.NewId()
		var reached atomic.Bool
		release := make(chan struct{})
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/security" {
				_ = json.NewEncoder(w).Encode(model.SecurityBulletins{{Id: bulletinID, AppliesToVersion: model.CurrentVersion}})
				return
			}
			if r.URL.Path == "/bulletins/"+bulletinID {
				reached.Store(true)
			}
			<-release
		}))
		defer ts.Close()
		defer close(release)

		runCheck(t, th, ts.URL, 500*time.Millisecond)

		require.True(t, reached.Load(), "bulletin endpoint was never requested")

		_, err := th.App.Srv().Store().System().GetByName("SecurityBulletin_" + bulletinID)
		assert.Error(t, err, "bulletin must not be marked as seen when its details could not be fetched")
	})

	t.Run("emails admins and marks a bulletin for the running version as seen", func(t *testing.T) {
		th := setup(t)
		th.ConfigureInbucketMail()
		require.NoError(t, mail.DeleteMailBox(th.SystemAdminUser.Email))

		bulletinID := model.NewId()
		otherVersionBulletinID := model.NewId()
		bulletinBody := "Security bulletin " + bulletinID
		var mut sync.Mutex
		var securityQuery string
		var requestedPaths []string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mut.Lock()
			defer mut.Unlock()
			requestedPaths = append(requestedPaths, r.URL.Path)
			switch r.URL.Path {
			case "/security":
				securityQuery = r.URL.RawQuery
				_ = json.NewEncoder(w).Encode(model.SecurityBulletins{
					{Id: bulletinID, AppliesToVersion: model.CurrentVersion},
					{Id: otherVersionBulletinID, AppliesToVersion: "0.0.1"},
				})
			case "/bulletins/" + bulletinID:
				_, _ = w.Write([]byte(bulletinBody))
			default:
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		defer ts.Close()

		runCheck(t, th, ts.URL, securityUpdateCheckTimeout)

		mut.Lock()
		defer mut.Unlock()
		assert.Equal(t, []string{"/security", "/bulletins/" + bulletinID}, requestedPaths)
		assert.Contains(t, securityQuery, PropSecurityID+"="+th.Server.ServerId())

		seen, err := th.App.Srv().Store().System().GetByName("SecurityBulletin_" + bulletinID)
		require.NoError(t, err)
		assert.Equal(t, bulletinID, seen.Value)

		_, err = th.App.Srv().Store().System().GetByName("SecurityBulletin_" + otherVersionBulletinID)
		assert.Error(t, err, "bulletins for other versions must be ignored")

		var mailbox mail.JSONMessageHeaderInbucket
		require.Eventually(t, func() bool {
			mailbox, err = mail.GetMailBox(th.SystemAdminUser.Email)
			return err == nil && len(mailbox) > 0
		}, 10*time.Second, 200*time.Millisecond)
		require.Len(t, mailbox, 1)
		assert.Equal(t, i18n.T("mattermost.bulletin.subject"), mailbox[0].Subject)

		message, err := mail.GetMessageFromMailbox(th.SystemAdminUser.Email, mailbox[0].ID)
		require.NoError(t, err)
		assert.Contains(t, message.Body.HTML+message.Body.Text, bulletinBody)
	})
}
