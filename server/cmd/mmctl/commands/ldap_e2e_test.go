// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func configForLdap(th *api4.TestHelper) {
	ldapHost := os.Getenv("CI_LDAP_HOST")
	if ldapHost == "" {
		ldapHost = testutils.GetInterface(*th.App.Config().LdapSettings.LdapPort)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableMultifactorAuthentication = true
		*cfg.LdapSettings.Enable = true
		*cfg.LdapSettings.EnableSync = true
		*cfg.LdapSettings.LdapServer = "dockerhost"
		*cfg.LdapSettings.BaseDN = "dc=mm,dc=test,dc=com"
		*cfg.LdapSettings.LdapServer = ldapHost
		*cfg.LdapSettings.BindUsername = "cn=admin,dc=mm,dc=test,dc=com"
		*cfg.LdapSettings.BindPassword = "mostest"
		*cfg.LdapSettings.FirstNameAttribute = "cn"
		*cfg.LdapSettings.LastNameAttribute = "sn"
		*cfg.LdapSettings.NicknameAttribute = "cn"
		*cfg.LdapSettings.EmailAttribute = "mail"
		*cfg.LdapSettings.UsernameAttribute = "uid"
		*cfg.LdapSettings.IdAttribute = "cn"
		*cfg.LdapSettings.LoginIdAttribute = "uid"
		*cfg.LdapSettings.SkipCertificateVerification = true
		*cfg.LdapSettings.GroupFilter = ""
		*cfg.LdapSettings.GroupDisplayNameAttribute = "cN"
		*cfg.LdapSettings.GroupIdAttribute = "entRyUuId"
		*cfg.LdapSettings.MaxPageSize = 0
	})

	th.App.Srv().SetLicense(model.NewTestLicense("ldap"))
}

func (s *MmctlE2ETestSuite) TestLdapSyncCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	configForLdap(s.th)

	s.Run("MM-T3971 Should not allow regular user to start LDAP sync job", func() {
		printer.Clean()

		err := ldapSyncCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T2529 Should start LDAP sync job", func(c client.Client) {
		printer.Clean()

		jobs, appErr := s.th.App.GetJobsByTypePage(s.th.Context, model.JobTypeLdapSync, 0, 100)
		s.Require().Nil(appErr)
		initialNumJobs := len(jobs)

		err := ldapSyncCmdF(c, &cobra.Command{}, nil)
		s.Require().NoError(err)

		s.Require().NotEmpty(printer.GetLines())
		s.Require().Equal(printer.GetLines()[0], map[string]any{"status": "ok"})
		s.Require().Len(printer.GetErrorLines(), 0)

		// we need to wait a bit for job creation
		time.Sleep(time.Second)

		jobs, appErr = s.th.App.GetJobsByTypePage(s.th.Context, model.JobTypeLdapSync, 0, 100)
		s.Require().Nil(appErr)
		s.Require().NotEmpty(jobs)
		s.Assert().Equal(initialNumJobs+1, len(jobs))
	})
}

func (s *MmctlE2ETestSuite) TestLdapIDMigrateCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	configForLdap(s.th)
	s.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.LdapSettings.IdAttribute = "uid" })

	// use existing ldap user from the test-data.ldif script
	// dn: uid=dev.one,ou=testusers,dc=mm,dc=test,dc=com
	// cn: Dev1
	// userPassword: Password1
	ldapUser, appErr := s.th.App.AuthenticateUserForLogin(s.th.Context, "", "dev.one", "Password1", "", "", true)
	s.Require().Nil(appErr)
	s.Require().NotNil(ldapUser)
	s.Require().Equal(model.UserAuthServiceLdap, ldapUser.AuthService)
	s.Require().Equal("dev.one", *ldapUser.AuthData)

	s.Run("MM-T3973 Should not allow regular user to migrate LDAP ID attribute", func() {
		printer.Clean()

		err := ldapIDMigrateCmdF(s.th.Client, &cobra.Command{}, []string{"objectGUID"})
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3972 Should migrate LDAP ID attribute", func(c client.Client) {
		printer.Clean()

		err := ldapIDMigrateCmdF(c, &cobra.Command{}, []string{"cn"})
		s.Require().NoError(err)
		defer func() {
			s.Require().Nil(s.th.App.MigrateIdLDAP(s.th.Context, "uid"))
		}()

		s.Require().NotEmpty(printer.GetLines())
		s.Require().Equal(printer.GetLines()[0], "AD/LDAP IdAttribute migration complete. You can now change your IdAttribute to: "+"cn")
		s.Require().Len(printer.GetErrorLines(), 0)

		updatedUser, appErr := s.th.App.GetUser(ldapUser.Id)
		s.Require().Nil(appErr)
		s.Require().Equal("Dev1", *updatedUser.AuthData)
	})
}

func (s *MmctlE2ETestSuite) TestLdapJobListCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()
	configForLdap(s.th)

	s.Run("Should not allow regular user to list LDAP groups", func() {
		printer.Clean()

		err := ldapJobListCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("No LDAP jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", 200, "")
		cmd.Flags().Bool("all", false, "")

		err := ldapJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.RunForSystemAdminAndLocal("get some LDAP sync jobs", func(c client.Client) {
		printer.Clean()

		cmd := &cobra.Command{}
		perPage := 2
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		_, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
			Type: model.JobTypeLdapSync,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job2, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
			Type: model.JobTypeLdapSync,
		})
		s.Require().Nil(appErr)

		time.Sleep(time.Millisecond)

		job3, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
			Type: model.JobTypeLdapSync,
		})
		s.Require().Nil(appErr)

		err := ldapJobListCmdF(c, cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), perPage)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Equal(job3, printer.GetLines()[0].(*model.Job))
		s.Require().Equal(job2, printer.GetLines()[1].(*model.Job))
	})
}

func (s *MmctlE2ETestSuite) TestLdapJobShowCmdF() {
	s.SetupEnterpriseTestHelper().InitBasic()
	configForLdap(s.th)

	job, appErr := s.th.App.CreateJob(s.th.Context, &model.Job{
		Type: model.JobTypeLdapSync,
	})
	s.Require().Nil(appErr)

	time.Sleep(time.Millisecond)

	s.Run("no permissions", func() {
		printer.Clean()

		err := ldapJobShowCmdF(s.th.Client, &cobra.Command{}, []string{job.Id})
		s.Require().EqualError(err, "failed to get LDAP sync job: You do not have the appropriate permissions.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("not found", func(c client.Client) {
		printer.Clean()

		err := ldapJobShowCmdF(c, &cobra.Command{}, []string{model.NewId()})
		s.Require().ErrorContains(err, "failed to get LDAP sync job: Unable to get the job.")
		s.Require().Empty(printer.GetLines())
		s.Require().Empty(printer.GetErrorLines())
	})

	s.RunForSystemAdminAndLocal("found", func(c client.Client) {
		printer.Clean()

		err := ldapJobShowCmdF(c, &cobra.Command{}, []string{job.Id})
		s.Require().Nil(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(job, printer.GetLines()[0].(*model.Job))
	})
}
