// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"net/http"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestLdapSyncCmd() {
	s.Run("Sync without errors", func() {
		printer.Clean()
		outputMessage := map[string]interface{}{"status": "ok"}

		s.client.
			EXPECT().
			SyncLdap(false).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := ldapSyncCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessage)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Not able to Sync", func() {
		printer.Clean()
		outputMessage := map[string]interface{}{"status": "error"}

		s.client.
			EXPECT().
			SyncLdap(false).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, nil).
			Times(1)

		err := ldapSyncCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(printer.GetLines()[0], outputMessage)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Sync with response error", func() {
		printer.Clean()
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			SyncLdap(false).
			Return(&model.Response{StatusCode: http.StatusBadRequest}, mockError).
			Times(1)

		err := ldapSyncCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
		s.Require().Equal(err, mockError)
		s.Require().Len(printer.GetLines(), 0)
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Sync with includeRemoveMembers", func() {
		printer.Clean()
		cmd := &cobra.Command{}
		cmd.Flags().Bool("include-removed-members", true, "")

		s.client.
			EXPECT().
			SyncLdap(true).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := ldapSyncCmdF(s.client, cmd, []string{})
		s.Require().Nil(err)
	})
}

func (s *MmctlUnitTestSuite) TestLdapMigrateID() {
	s.Run("Run successfully without errors", func() {
		printer.Clean()

		s.client.
			EXPECT().
			MigrateIdLdap("test-id").
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := ldapIDMigrateCmdF(s.client, &cobra.Command{}, []string{"test-id"})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Contains(printer.GetLines()[0], "test-id")
		s.Require().Len(printer.GetErrorLines(), 0)
	})

	s.Run("Unable to migrate", func() {
		printer.Clean()

		s.client.
			EXPECT().
			MigrateIdLdap("test-id").
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("test-error")).
			Times(1)

		err := ldapIDMigrateCmdF(s.client, &cobra.Command{}, []string{"test-id"})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
	})
}
