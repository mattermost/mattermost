// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
)

func (s *MmctlE2ETestSuite) TestCreateIncomingWebhookCmd() {
	s.SetupTestHelper().InitBasic(s.T())

	s.Run("provided values should be consistent with the created webhook", func() {
		printer.Clean()

		s.cmd.Flags().String("channel", s.th.BasicChannel.Id, "")
		s.cmd.Flags().String("user", s.th.BasicUser2.Username, "")
		s.cmd.Flags().String("display-name", "webhook-test-1", "")
		s.cmd.Flags().String("description", "webhook-test-1-desc", "")
		s.cmd.Flags().Bool("lock-to-channel", true, "")

		err := createIncomingWebhookCmdF(s.th.SystemAdminClient, s.cmd, nil)
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Len(printer.GetErrorLines(), 0)

		hook := printer.GetLines()[0].(*model.IncomingWebhook)
		s.Require().Equal(s.th.BasicUser2.Id, hook.UserId)
		s.Require().Equal(s.th.BasicChannel.Id, hook.ChannelId)
		s.Require().Equal("webhook-test-1", hook.DisplayName)
		s.Require().Equal("webhook-test-1-desc", hook.Description)
		s.Require().True(hook.ChannelLocked)
	})
}
