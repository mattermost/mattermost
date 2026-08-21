// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *MmctlE2ETestSuite) TestGetBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())

	s.th.App.Srv().Platform().Busy.Set(time.Minute)
	defer s.th.App.Srv().Platform().Busy.Clear()

	s.Run("MM-T3979 Should fail when regular user attempts to get server busy status", func() {
		printer.Clean()

		err := getBusyCmdF(s.th.Client, newTestCmd(s.T(), nil), nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3956 Get server busy status", func(c client.Client) {
		printer.Clean()

		err := getBusyCmdF(c, newTestCmd(s.T(), nil), nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		state, ok := printer.GetLines()[0].(*model.ServerBusyState)
		s.Require().True(ok, true)
		s.Require().True(state.Busy, true)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

func (s *MmctlE2ETestSuite) TestNukeUsersCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	s.Run("Delete all users as unprivileged user should not work", func() {
		printer.Clean()

		cmd := newTestCmd(s.T(), SystemNukeUsersCmd)
		s.Require().NoError(cmd.Flags().Set("confirm", "true"))

		err := nukeUsersCmdF(s.th.Client, cmd, []string{})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)

		// expect users not deleted
		users, err := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(err)
		s.Require().NotZero(len(users))
	})

	s.Run("Delete all users as system admin through the port API should not work", func() {
		printer.Clean()

		cmd := newTestCmd(s.T(), SystemNukeUsersCmd)
		s.Require().NoError(cmd.Flags().Set("confirm", "true"))

		err := nukeUsersCmdF(s.th.SystemAdminClient, cmd, []string{})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.Len(printer.GetErrorLines(), 0)

		// expect users not deleted
		users, err := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(err)
		s.Require().NotZero(len(users))
	})

	s.Run("Delete all users through local mode should work correctly", func() {
		printer.Clean()

		// populate with some user
		for range 10 {
			userData := model.User{
				Username: "fakeuser" + model.NewRandomString(10),
				Password: model.NewTestPassword(),
				Email:    s.th.GenerateTestEmail(),
			}
			_, err := s.th.App.CreateUser(s.th.Context, &userData)
			s.Require().Nil(err)
		}

		cmd := newTestCmd(s.T(), SystemNukeUsersCmd)
		s.Require().NoError(cmd.Flags().Set("confirm", "true"))

		// delete all users only works on local mode
		err := nukeUsersCmdF(s.th.LocalClient, cmd, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(printer.GetLines()[0], "All users successfully deleted")

		// expect users deleted
		users, err := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(err)
		s.Require().Zero(len(users))
	})
}

func (s *MmctlE2ETestSuite) TestSetBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())

	s.th.App.Srv().Platform().Busy.Clear()
	cmd := newTestCmd(s.T(), SystemSetBusyCmd)
	s.Require().NoError(cmd.Flags().Set("seconds", "60"))

	s.Run("MM-T3980 Should fail when regular user attempts to set server busy status", func() {
		printer.Clean()

		err := setBusyCmdF(s.th.Client, cmd, nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3957 Set server status to busy", func(c client.Client) {
		printer.Clean()

		err := setBusyCmdF(c, cmd, nil)
		s.Require().NoError(err)
		defer func() {
			s.th.App.Srv().Platform().Busy.Clear()
			s.Require().False(s.th.App.Srv().Platform().Busy.IsBusy())
		}()
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], map[string]string{"status": "ok"})
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().True(s.th.App.Srv().Platform().Busy.IsBusy())
	})
}

func (s *MmctlE2ETestSuite) TestClearBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())

	s.th.App.Srv().Platform().Busy.Set(time.Minute)
	defer s.th.App.Srv().Platform().Busy.Clear()

	s.Run("MM-T3981 Should fail when regular user attempts to clear server busy status", func() {
		printer.Clean()

		err := clearBusyCmdF(s.th.Client, newTestCmd(s.T(), nil), nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3958 Clear server status to busy", func(c client.Client) {
		printer.Clean()

		err := clearBusyCmdF(c, newTestCmd(s.T(), nil), nil)
		s.Require().NoError(err)
		defer func() {
			s.th.App.Srv().Platform().Busy.Set(time.Minute)
			s.Require().True(s.th.App.Srv().Platform().Busy.IsBusy())
		}()
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], map[string]string{"status": "ok"})
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().False(s.th.App.Srv().Platform().Busy.IsBusy())
	})
}

func (s *MmctlE2ETestSuite) TestSupportPacketCmdF() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())

	printer.SetFormat(printer.FormatPlain)
	s.T().Cleanup(func() { printer.SetFormat(printer.FormatJSON) })

	s.Run("Download Support Packet with default filename", func() {
		printer.Clean()

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)
		err := systemSupportPacketCmdF(s.th.SystemAdminClient, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], "Downloading Support Packet")
		s.Require().Contains(printer.GetLines()[1], "Downloaded Support Packet to ")
		s.Require().Len(printer.GetErrorLines(), 0)

		var found bool

		entries, err := os.ReadDir(".")
		s.Require().NoError(err)
		for _, e := range entries {
			if strings.HasPrefix(e.Name(), "mm_support_packet_") && strings.HasSuffix(e.Name(), ".zip") {
				b, err := os.ReadFile(e.Name())
				s.NoError(err)

				s.NotEmpty(b, b)

				s.T().Cleanup(func() {
					err = os.Remove(e.Name())
					s.Require().NoError(err)
				})

				found = true
			}
		}
		s.True(found)
	})

	s.Run("Download Support Packet with custom filename", func() {
		printer.Clean()

		cmd := newTestCmd(s.T(), SystemSupportPacketCmd)
		s.Require().NoError(cmd.Flags().Set("output-file", "foo.zip"))

		defer func() {
			s.Require().NoError(os.Remove("foo.zip"))
		}()

		err := systemSupportPacketCmdF(s.th.SystemAdminClient, cmd, []string{})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 0)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(printer.GetLines()[0], "Downloading Support Packet")
		s.Require().Equal(printer.GetLines()[1], "Downloaded Support Packet to foo.zip")

		b, err := os.ReadFile("foo.zip")
		s.Require().NoError(err)
		s.NotNil(b, b)
	})
}
