// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"strings"
	"testing"
)

func TestGetLogs(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()

	if _, err := th.BasicClient.GetLogs(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if logs, err := th.SystemAdminClient.GetLogs(); err != nil {
		t.Fatal(err)
	} else if len(logs.Data.([]string)) <= 0 {
		t.Fatal()
	}
}

func TestGetClusterInfos(t *testing.T) {
	th := Setup().InitSystemAdmin().InitBasic()

	if _, err := th.BasicClient.GetClusterStatus(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if _, err := th.SystemAdminClient.GetClusterStatus(); err != nil {
		t.Fatal(err)
	}
}

func TestGetAllAudits(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.GetAllAudits(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if audits, err := th.SystemAdminClient.GetAllAudits(); err != nil {
		t.Fatal(err)
	} else if len(audits.Data.(model.Audits)) <= 0 {
		t.Fatal()
	}
}

func TestGetConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.GetConfig(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if result, err := th.SystemAdminClient.GetConfig(); err != nil {
		t.Fatal(err)
	} else {
		cfg := result.Data.(*model.Config)

		if len(cfg.TeamSettings.SiteName) == 0 {
			t.Fatal()
		}

		if *cfg.LdapSettings.BindPassword != model.FAKE_SETTING && len(*cfg.LdapSettings.BindPassword) != 0 {
			t.Fatal("did not sanitize properly")
		}
		if cfg.FileSettings.PublicLinkSalt != model.FAKE_SETTING {
			t.Fatal("did not sanitize properly")
		}
		if cfg.FileSettings.AmazonS3SecretAccessKey != model.FAKE_SETTING && len(cfg.FileSettings.AmazonS3SecretAccessKey) != 0 {
			t.Fatal("did not sanitize properly")
		}
		if cfg.EmailSettings.InviteSalt != model.FAKE_SETTING {
			t.Fatal("did not sanitize properly")
		}
		if cfg.EmailSettings.PasswordResetSalt != model.FAKE_SETTING {
			t.Fatal("did not sanitize properly")
		}
		if cfg.EmailSettings.SMTPPassword != model.FAKE_SETTING && len(cfg.EmailSettings.SMTPPassword) != 0 {
			t.Fatal("did not sanitize properly")
		}
		if cfg.GitLabSettings.Secret != model.FAKE_SETTING && len(cfg.GitLabSettings.Secret) != 0 {
			t.Fatal("did not sanitize properly")
		}
		if cfg.SqlSettings.DataSource != model.FAKE_SETTING {
			t.Fatal("did not sanitize properly")
		}
		if cfg.SqlSettings.AtRestEncryptKey != model.FAKE_SETTING {
			t.Fatal("did not sanitize properly")
		}
		if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceReplicas) != 0 {
			t.Fatal("did not sanitize properly")
		}
	}
}

func TestReloadConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.ReloadConfig(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if _, err := th.SystemAdminClient.ReloadConfig(); err != nil {
		t.Fatal(err)
	}

	utils.Cfg.TeamSettings.MaxUsersPerTeam = 50
	*utils.Cfg.TeamSettings.EnableOpenServer = true
}

func TestSaveConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.SaveConfig(utils.Cfg); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	*utils.Cfg.TeamSettings.EnableOpenServer = false

	if _, err := th.SystemAdminClient.SaveConfig(utils.Cfg); err != nil {
		t.Fatal(err)
	}

	*utils.Cfg.TeamSettings.EnableOpenServer = true
}

func TestRecycleDatabaseConnection(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.RecycleDatabaseConnection(); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if _, err := th.SystemAdminClient.RecycleDatabaseConnection(); err != nil {
		t.Fatal(err)
	}
}

func TestEmailTest(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.TestEmail(utils.Cfg); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if _, err := th.SystemAdminClient.TestEmail(utils.Cfg); err == nil {
		t.Fatal("should have errored")
	} else {
		println(err.Id)
		if err.Id != "api.admin.test_email.missing_server" {
			t.Fatal(err)
		}
	}
}

func TestGetTeamAnalyticsStandard(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	th.CreatePrivateChannel(th.BasicClient, th.BasicTeam)

	if _, err := th.BasicClient.GetTeamAnalytics(th.BasicTeam.Id, "standard"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if result, err := th.SystemAdminClient.GetTeamAnalytics(th.BasicTeam.Id, "standard"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "channel_open_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[0].Value != 3 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "channel_private_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "unique_user_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Value != 2 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "team_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}

	if result, err := th.SystemAdminClient.GetSystemAnalytics("standard"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "channel_open_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[0].Value < 3 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "channel_private_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "unique_user_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "team_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestGetPostCount(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	// manually update creation time, since it's always set to 0 upon saving and we only retrieve posts < today
	Srv.Store.(*store.SqlStore).GetMaster().Exec("UPDATE Posts SET CreateAt = :CreateAt WHERE ChannelId = :ChannelId",
		map[string]interface{}{"ChannelId": th.BasicChannel.Id, "CreateAt": utils.MillisFromTime(utils.Yesterday())})

	if _, err := th.BasicClient.GetTeamAnalytics(th.BasicTeam.Id, "post_counts_day"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if result, err := th.SystemAdminClient.GetTeamAnalytics(th.BasicTeam.Id, "post_counts_day"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestUserCountsWithPostsByDay(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	// manually update creation time, since it's always set to 0 upon saving and we only retrieve posts < today
	Srv.Store.(*store.SqlStore).GetMaster().Exec("UPDATE Posts SET CreateAt = :CreateAt WHERE ChannelId = :ChannelId",
		map[string]interface{}{"ChannelId": th.BasicChannel.Id, "CreateAt": utils.MillisFromTime(utils.Yesterday())})

	if _, err := th.BasicClient.GetTeamAnalytics(th.BasicTeam.Id, "user_counts_with_posts_day"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if result, err := th.SystemAdminClient.GetTeamAnalytics(th.BasicTeam.Id, "user_counts_with_posts_day"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Value != 1 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestGetTeamAnalyticsExtra(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	th.CreatePost(th.BasicClient, th.BasicChannel)

	if _, err := th.BasicClient.GetTeamAnalytics("", "extra_counts"); err == nil {
		t.Fatal("Shouldn't have permissions")
	}

	if result, err := th.SystemAdminClient.GetTeamAnalytics(th.BasicTeam.Id, "extra_counts"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "file_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[0].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "hashtag_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "incoming_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "outgoing_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "command_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Value != 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[5].Name != "session_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[5].Value == 0 {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}

	if result, err := th.SystemAdminClient.GetSystemAnalytics("extra_counts"); err != nil {
		t.Fatal(err)
	} else {
		rows := result.Data.(model.AnalyticsRows)

		if rows[0].Name != "file_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[1].Name != "hashtag_post_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[2].Name != "incoming_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[3].Name != "outgoing_webhook_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[4].Name != "command_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}

		if rows[5].Name != "session_count" {
			t.Log(rows.ToJson())
			t.Fatal()
		}
	}
}

func TestAdminResetMfa(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()

	if _, err := th.BasicClient.AdminResetMfa("12345678901234567890123456"); err == nil {
		t.Fatal("should have failed - not an admin")
	}

	if _, err := th.SystemAdminClient.AdminResetMfa(""); err == nil {
		t.Fatal("should have failed - empty user id")
	}

	if _, err := th.SystemAdminClient.AdminResetMfa("12345678901234567890123456"); err == nil {
		t.Fatal("should have failed - bad user id")
	}

	if _, err := th.SystemAdminClient.AdminResetMfa(th.BasicUser.Id); err == nil {
		t.Fatal("should have failed - not licensed or configured")
	}

	// need to add more test cases when enterprise bits can be loaded into tests
}

func TestAdminResetPassword(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient
	team := th.SystemAdminTeam

	user := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "passwd1"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	LinkUserToTeam(user, team)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	if _, err := Client.AdminResetPassword("", "newpwd1"); err == nil {
		t.Fatal("Should have errored - empty user id")
	}

	if _, err := Client.AdminResetPassword("123", "newpwd1"); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	if _, err := Client.AdminResetPassword("12345678901234567890123456", "newpwd1"); err == nil {
		t.Fatal("Should have errored - bad user id")
	}

	if _, err := Client.AdminResetPassword("12345678901234567890123456", "newp"); err == nil {
		t.Fatal("Should have errored - password too short")
	}

	authData := model.NewId()
	user2 := &model.User{Email: strings.ToLower(model.NewId()) + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", AuthData: &authData, AuthService: "random"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	LinkUserToTeam(user2, team)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	if _, err := Client.AdminResetPassword(user.Id, "newpwd1"); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user.Id, "newpwd1"))
	Client.SetTeamId(team.Id)

	if _, err := Client.AdminResetPassword(user.Id, "newpwd1"); err == nil {
		t.Fatal("Should have errored - not sytem admin")
	}
}

func TestAdminLdapSyncNow(t *testing.T) {
	th := Setup().InitSystemAdmin()
	Client := th.SystemAdminClient

	if _, err := Client.LdapSyncNow(); err != nil {
		t.Fatal("Returned Failure")
	}
}
