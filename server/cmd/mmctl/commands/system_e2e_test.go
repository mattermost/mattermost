// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"time"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlE2ETestSuite) TestGetBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

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

func (s *MmctlE2ETestSuite) TestSetBusyCmd() {
	s.SetupEnterpriseTestHelper().InitBasic()

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
	s.SetupEnterpriseTestHelper().InitBasic()

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
