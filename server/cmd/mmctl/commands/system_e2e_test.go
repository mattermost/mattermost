// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"
)

func (s *MmctlE2ETestSuite) TestGetBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())

	s.th.App.Srv().Platform().Busy.Set(time.Minute)
	defer s.th.App.Srv().Platform().Busy.Clear()

	s.Run("MM-T3979 Should fail when regular user attempts to get server busy status", func() {
		printer.Clean()

		err := getBusyCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3956 Get server busy status", func(c client.Client) {
		printer.Clean()

		err := getBusyCmdF(c, &cobra.Command{}, nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		state, ok := printer.GetLines()[0].(*model.ServerBusyState)
		s.Require().True(ok, true)
		s.Require().True(state.Busy, true)
		s.Require().Len(printer.GetErrorLines(), 0)
	})
}

// TestLocalOnlyPrecheckSubprocess is invoked in a subprocess to verify that
// localOnlyPrecheck exits when local mode is disabled.
func TestLocalOnlyPrecheckSubprocess(t *testing.T) {
	if os.Getenv("MMCTL_TEST_LOCAL_ONLY_PRECHECK") != "1" {
		return
	}

	viper.Set("local", false)
	localOnlyPrecheck(SystemNukeUsersCmd, nil)
	os.Exit(0)
}

func requireLocalOnlyPrecheckBlocked(t *testing.T) {
	t.Helper()

	cmd := exec.Command(os.Args[0], "-test.run=^TestLocalOnlyPrecheckSubprocess$", "-test.count=1")
	cmd.Env = append(os.Environ(), "MMCTL_TEST_LOCAL_ONLY_PRECHECK=1")
	err := cmd.Run()

	exitErr, ok := err.(*exec.ExitError)
	require.True(t, ok, "expected process to exit, got %v", err)
	require.Equal(t, 1, exitErr.ExitCode())
}

func (s *MmctlE2ETestSuite) assertUsersNotDeleted() {
	users, appErr := s.th.App.GetUsersPage(&model.UserGetOptions{
		Page:    0,
		PerPage: 10,
	}, true)
	s.Require().Nil(appErr)
	s.Require().NotZero(len(users))
}

func (s *MmctlE2ETestSuite) TestNukeUsersCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	s.Run("Delete all user as unpriviliged user should not work", func() {
		printer.Clean()

		previousLocal := viper.GetBool("local")
		viper.Set("local", false)
		defer viper.Set("local", previousLocal)

		requireLocalOnlyPrecheckBlocked(s.T())
		s.assertUsersNotDeleted()
	})

	s.Run("Delete all user as system admin through the port API should not work", func() {
		printer.Clean()

		previousLocal := viper.GetBool("local")
		viper.Set("local", false)
		defer viper.Set("local", previousLocal)

		requireLocalOnlyPrecheckBlocked(s.T())
		s.assertUsersNotDeleted()
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
			_, appErr := s.th.App.CreateUser(s.th.Context, &userData)
			s.Require().Nil(appErr)
		}

		previousLocal := viper.GetBool("local")
		viper.Set("local", true)
		defer viper.Set("local", previousLocal)

		err := SystemNukeUsersCmd.ParseFlags([]string{"--confirm"})
		s.Require().NoError(err)
		defer func() {
			_ = SystemNukeUsersCmd.Flags().Set("confirm", "false")
		}()

		localOnlyPrecheck(SystemNukeUsersCmd, nil)
		err = nukeUsersCmdF(s.th.LocalClient, SystemNukeUsersCmd, []string{})
		s.Require().NoError(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(printer.GetLines()[0], "All users successfully deleted")

		users, appErr := s.th.App.GetUsersPage(&model.UserGetOptions{
			Page:    0,
			PerPage: 10,
		}, true)
		s.Require().Nil(appErr)
		s.Require().Zero(len(users))
	})
}

func (s *MmctlE2ETestSuite) TestSetBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic(s.T())

	s.th.App.Srv().Platform().Busy.Clear()
	cmd := &cobra.Command{}
	cmd.Flags().Uint("seconds", 60, "")

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

		err := clearBusyCmdF(s.th.Client, &cobra.Command{}, nil)
		s.Require().Error(err)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.RunForSystemAdminAndLocal("MM-T3958 Clear server status to busy", func(c client.Client) {
		printer.Clean()

		err := clearBusyCmdF(c, &cobra.Command{}, nil)
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

		err := systemSupportPacketCmdF(s.th.SystemAdminClient, SystemSupportPacketCmd, []string{})
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

		systemSupportPacketCmd := &cobra.Command{}
		systemSupportPacketCmd.Flags().StringP("output-file", "o", "", "Define the output file name")
		err := systemSupportPacketCmd.ParseFlags([]string{"-o", "foo.zip"})
		s.Require().NoError(err)

		defer func() {
			s.Require().NoError(os.Remove("foo.zip"))
		}()

		err = systemSupportPacketCmdF(s.th.SystemAdminClient, systemSupportPacketCmd, []string{})
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
