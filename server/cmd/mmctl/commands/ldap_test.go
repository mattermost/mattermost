// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestLdapSyncCmd() {
	s.Run("Sync without errors", func() {
		printer.Clean()
		outputMessage := map[string]any{"status": "ok"}

		s.client.
			EXPECT().
			SyncLdap(context.TODO(), false).
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
		outputMessage := map[string]any{"status": "error"}

		s.client.
			EXPECT().
			SyncLdap(context.TODO(), false).
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
			SyncLdap(context.TODO(), false).
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
			SyncLdap(context.TODO(), true).
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
			MigrateIdLdap(context.TODO(), "test-id").
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
			MigrateIdLdap(context.TODO(), "test-id").
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("test-error")).
			Times(1)

		err := ldapIDMigrateCmdF(s.client, &cobra.Command{}, []string{"test-id"})
		s.Require().NotNil(err)
		s.Require().Len(printer.GetLines(), 0)
	})
}

func (s *MmctlUnitTestSuite) TestLdapJobListCmdF() {
	s.Run("no LDAP jobs", func() {
		printer.Clean()
		var mockJobs []*model.Job

		cmd := &cobra.Command{}
		perPage := 10
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), model.JobTypeLdapSync, "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := ldapJobListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal("No jobs found", printer.GetLines()[0])
	})

	s.Run("some LDAP jobs", func() {
		printer.Clean()
		mockJobs := []*model.Job{
			{
				Id: model.NewId(),
			},
			{
				Id: model.NewId(),
			},
			{
				Id: model.NewId(),
			},
		}

		cmd := &cobra.Command{}
		perPage := 3
		cmd.Flags().Int("page", 0, "")
		cmd.Flags().Int("per-page", perPage, "")
		cmd.Flags().Bool("all", false, "")

		s.client.
			EXPECT().
			GetJobs(context.TODO(), model.JobTypeLdapSync, "", 0, perPage).
			Return(mockJobs, &model.Response{}, nil).
			Times(1)

		err := ldapJobListCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockJobs))
		s.Empty(printer.GetErrorLines())
		for i, line := range printer.GetLines() {
			s.Equal(mockJobs[i], line.(*model.Job))
		}
	})
}

func (s *MmctlUnitTestSuite) TestLdapJobShowCmdF() {
	s.Run("not found", func() {
		printer.Clean()

		jobID := model.NewId()

		s.client.
			EXPECT().
			GetJob(context.TODO(), jobID).
			Return(nil, &model.Response{StatusCode: http.StatusNotFound}, errors.New("not found")).
			Times(1)

		err := ldapJobShowCmdF(s.client, &cobra.Command{}, []string{jobID})
		s.Require().NotNil(err)
		s.Empty(printer.GetLines())
		s.Empty(printer.GetErrorLines())
	})

	s.Run("found", func() {
		printer.Clean()
		mockJob := &model.Job{
			Id: model.NewId(),
		}

		s.client.
			EXPECT().
			GetJob(context.TODO(), mockJob.Id).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := ldapJobShowCmdF(s.client, &cobra.Command{}, []string{mockJob.Id})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("shell completion", func() {
		s.Run("no match for empty argument", func() {
			r, dir := ldapJobShowCompletionF(context.Background(), s.client, nil, nil, "")
			s.Equal(cobra.ShellCompDirectiveNoFileComp, dir)
			s.Equal([]string{}, r)
		})

		s.Run("one element matches", func() {
			mockJobs := []*model.Job{
				{
					Id: "0_id",
				},
				{
					Id: "1_id",
				},
				{
					Id: "2_id",
				},
			}

			s.client.
				EXPECT().
				GetJobsByType(context.Background(), model.JobTypeLdapSync, 0, DefaultPageSize).
				Return(mockJobs, &model.Response{}, nil).
				Times(1)

			r, dir := ldapJobShowCompletionF(context.Background(), s.client, nil, nil, "1")
			s.Equal(cobra.ShellCompDirectiveNoFileComp, dir)
			s.Equal([]string{"1_id"}, r)
		})

		s.Run("more elements then the limit match", func() {
			var mockJobs []*model.Job
			for i := 0; i < 100; i++ {
				mockJobs = append(mockJobs, &model.Job{
					Id: fmt.Sprintf("id_%d", i),
				})
			}

			var expected []string
			for i := 0; i < shellCompletionMaxItems; i++ {
				expected = append(expected, fmt.Sprintf("id_%d", i))
			}

			s.client.
				EXPECT().
				GetJobsByType(context.Background(), model.JobTypeLdapSync, 0, DefaultPageSize).
				Return(mockJobs, &model.Response{}, nil).
				Times(1)

			r, dir := ldapJobShowCompletionF(context.Background(), s.client, nil, nil, "id_")
			s.Equal(cobra.ShellCompDirectiveNoFileComp, dir)
			s.Equal(expected, r)
		})
	})
}
