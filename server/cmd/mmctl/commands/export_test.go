// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestExportCreateCmdF() {
	s.Run("create export", func() {
		printer.Clean()
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{
				"include_attachments":       "true",
				"include_roles_and_schemes": "true",
			},
		}

		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		err := exportCreateCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("create export without attachments", func() {
		printer.Clean()
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{
				"include_roles_and_schemes": "true",
			},
		}

		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("no-attachments", true, "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("create export without roles and schemes", func() {
		printer.Clean()
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{
				"include_attachments": "true",
			},
		}

		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().Bool("no-roles-and-schemes", true, "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("create export with team filter", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: "teamid1", Name: "myteam"}
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{
				"include_attachments":       "true",
				"include_roles_and_schemes": "true",
				"team_name":                 "myteam",
			},
		}

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), "myteam", "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "myteam", "")
		cmd.Flags().String("channel", "", "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("create export with team and channel filter", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: "teamid1", Name: "myteam"}
		mockChannel := &model.Channel{Id: "chanid1", Name: "mychannel"}
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{
				"include_attachments":       "true",
				"include_roles_and_schemes": "true",
				"team_name":                 "myteam",
				"channel_name":              "mychannel",
			},
		}

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), "myteam", "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByName(context.TODO(), "mychannel", "teamid1", "").
			Return(mockChannel, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "myteam", "")
		cmd.Flags().String("channel", "mychannel", "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})

	s.Run("create export with non-existent team fails immediately", func() {
		printer.Clean()

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), "nosuchteam", "").
			Return(nil, &model.Response{}, fmt.Errorf("not found")).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "nosuchteam", "")
		cmd.Flags().String("channel", "", "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().NotNil(err)
		s.Contains(err.Error(), "nosuchteam")
		s.Empty(printer.GetLines())
	})

	s.Run("create export with non-existent channel fails immediately", func() {
		printer.Clean()
		mockTeam := &model.Team{Id: "teamid1", Name: "myteam"}

		s.client.
			EXPECT().
			GetTeamByName(context.TODO(), "myteam", "").
			Return(mockTeam, &model.Response{}, nil).
			Times(1)
		s.client.
			EXPECT().
			GetChannelByName(context.TODO(), "nosuchannel", "teamid1", "").
			Return(nil, &model.Response{}, fmt.Errorf("not found")).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "myteam", "")
		cmd.Flags().String("channel", "nosuchannel", "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().NotNil(err)
		s.Contains(err.Error(), "nosuchannel")
		s.Empty(printer.GetLines())
	})

	s.Run("create export without team filter omits team_name key", func() {
		printer.Clean()
		mockJob := &model.Job{
			Type: model.JobTypeExportProcess,
			Data: map[string]string{
				"include_attachments":       "true",
				"include_roles_and_schemes": "true",
			},
		}

		s.client.
			EXPECT().
			CreateJob(context.TODO(), mockJob).
			Return(mockJob, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("team", "", "")
		cmd.Flags().String("channel", "", "")

		err := exportCreateCmdF(s.client, cmd, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Empty(printer.GetErrorLines())
		s.Equal(mockJob, printer.GetLines()[0].(*model.Job))
	})
}

func (s *MmctlUnitTestSuite) TestExportDeleteCmdF() {
	printer.Clean()

	exportName := "export.zip"

	s.client.
		EXPECT().
		DeleteExport(context.TODO(), exportName).
		Return(&model.Response{StatusCode: http.StatusOK}, nil).
		Times(1)

	err := exportDeleteCmdF(s.client, &cobra.Command{}, []string{exportName})
	s.Require().Nil(err)
	s.Len(printer.GetLines(), 1)
	s.Len(printer.GetErrorLines(), 0)
	s.Equal(fmt.Sprintf(`Export file "%s" has been deleted`, exportName), printer.GetLines()[0])
}

func (s *MmctlUnitTestSuite) TestExportListCmdF() {
	s.Run("no exports", func() {
		printer.Clean()
		var mockExports []string

		s.client.
			EXPECT().
			ListExports(context.TODO()).
			Return(mockExports, &model.Response{}, nil).
			Times(1)

		err := exportListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Equal("No export files found", printer.GetLines()[0])
	})

	s.Run("some exports", func() {
		printer.Clean()
		mockExports := []string{
			"export1.zip",
			"export2.zip",
			"export3.zip",
		}

		s.client.
			EXPECT().
			ListExports(context.TODO()).
			Return(mockExports, &model.Response{}, nil).
			Times(1)

		err := exportListCmdF(s.client, &cobra.Command{}, nil)
		s.Require().Nil(err)
		s.Len(printer.GetLines(), len(mockExports))
		s.Len(printer.GetErrorLines(), 0)
		for i, line := range printer.GetLines() {
			s.Equal(mockExports[i], line)
		}
	})
}
