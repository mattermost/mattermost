package api4

import (
	"strings"
	"testing"

	"github.com/mattermost/platform/model"
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
