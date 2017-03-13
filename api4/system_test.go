package api4

import (
	"strings"
	"testing"

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
