package api4

import (
	"strings"
	"testing"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestGetPing(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	b, _ := Client.GetPing()
	if b == false {
		t.Fatal()
	}
}

func TestGetConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	_, resp := Client.GetConfig()
	CheckForbiddenStatus(t, resp)

	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	if len(cfg.TeamSettings.SiteName) == 0 {
		t.Fatal()
	}

	if *cfg.LdapSettings.BindPassword != model.FAKE_SETTING && len(*cfg.LdapSettings.BindPassword) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.FileSettings.PublicLinkSalt != model.FAKE_SETTING {
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

func TestReloadConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	flag, resp := Client.ReloadConfig()
	CheckForbiddenStatus(t, resp)
	if flag == true {
		t.Fatal("should not Reload the config due no permission.")
	}

	flag, resp = th.SystemAdminClient.ReloadConfig()
	CheckNoError(t, resp)
	if flag == false {
		t.Fatal("should Reload the config")
	}

	utils.Cfg.TeamSettings.MaxUsersPerTeam = 50
	*utils.Cfg.TeamSettings.EnableOpenServer = true
}

func TestUpdateConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	cfg := app.GetConfig()

	_, resp := Client.UpdateConfig(cfg)
	CheckForbiddenStatus(t, resp)

	SiteName := utils.Cfg.TeamSettings.SiteName

	cfg.TeamSettings.SiteName = "MyFancyName"
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	if len(cfg.TeamSettings.SiteName) == 0 {
		t.Fatal()
	} else {
		if cfg.TeamSettings.SiteName != "MyFancyName" {
			t.Log("It should update the SiteName")
			t.Fatal()
		}
	}

	//Revert the change
	cfg.TeamSettings.SiteName = SiteName
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	if len(cfg.TeamSettings.SiteName) == 0 {
		t.Fatal()
	} else {
		if cfg.TeamSettings.SiteName != SiteName {
			t.Log("It should update the SiteName")
			t.Fatal()
		}
	}
}

func TestGetAudits(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	audits, resp := th.SystemAdminClient.GetAudits(0, 100, "")
	CheckNoError(t, resp)

	if len(audits) == 0 {
		t.Fatal("should not be empty")
	}

	audits, resp = th.SystemAdminClient.GetAudits(0, 1, "")
	CheckNoError(t, resp)

	if len(audits) != 1 {
		t.Fatal("should only be 1")
	}

	audits, resp = th.SystemAdminClient.GetAudits(1, 1, "")
	CheckNoError(t, resp)

	if len(audits) != 1 {
		t.Fatal("should only be 1")
	}

	_, resp = th.SystemAdminClient.GetAudits(-1, -1, "")
	CheckNoError(t, resp)

	_, resp = Client.GetAudits(0, 100, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetAudits(0, 100, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestEmailTest(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	SendEmailNotifications := utils.Cfg.EmailSettings.SendEmailNotifications
	SMTPServer := utils.Cfg.EmailSettings.SMTPServer
	SMTPPort := utils.Cfg.EmailSettings.SMTPPort
	FeedbackEmail := utils.Cfg.EmailSettings.FeedbackEmail
	defer func() {
		utils.Cfg.EmailSettings.SendEmailNotifications = SendEmailNotifications
		utils.Cfg.EmailSettings.SMTPServer = SMTPServer
		utils.Cfg.EmailSettings.SMTPPort = SMTPPort
		utils.Cfg.EmailSettings.FeedbackEmail = FeedbackEmail
	}()

	utils.Cfg.EmailSettings.SendEmailNotifications = false
	utils.Cfg.EmailSettings.SMTPServer = ""
	utils.Cfg.EmailSettings.SMTPPort = ""
	utils.Cfg.EmailSettings.FeedbackEmail = ""

	_, resp := Client.TestEmail()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.TestEmail()
	CheckErrorMessage(t, resp, "api.admin.test_email.missing_server")
	CheckInternalErrorStatus(t, resp)
}

func TestDatabaseRecycle(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	_, resp := Client.DatabaseRecycle()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.DatabaseRecycle()
	CheckNoError(t, resp)
}

func TestInvalidateCaches(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	flag, resp := Client.InvalidateCaches()
	CheckForbiddenStatus(t, resp)
	if flag == true {
		t.Fatal("should not clean the cache due no permission.")
	}

	flag, resp = th.SystemAdminClient.InvalidateCaches()
	CheckNoError(t, resp)
	if flag == false {
		t.Fatal("should clean the cache")
	}
}

func TestGetLogs(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	for i := 0; i < 20; i++ {
		l4g.Info(i)
	}

	logs, resp := th.SystemAdminClient.GetLogs(0, 10)
	CheckNoError(t, resp)

	if len(logs) != 10 {
		t.Log(len(logs))
		t.Fatal("wrong length")
	}

	logs, resp = th.SystemAdminClient.GetLogs(1, 10)
	CheckNoError(t, resp)

	if len(logs) != 10 {
		t.Log(len(logs))
		t.Fatal("wrong length")
	}

	logs, resp = th.SystemAdminClient.GetLogs(-1, -1)
	CheckNoError(t, resp)

	if len(logs) == 0 {
		t.Fatal("should not be empty")
	}

	_, resp = Client.GetLogs(0, 10)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetLogs(0, 10)
	CheckUnauthorizedStatus(t, resp)
}
