// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build unit
// +build unit

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

func (s *MmctlUnitTestSuite) TestReportPostsCmdF() {
	s.Run("no channel specified", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{""})
		s.Require().EqualError(err, "Unable to find channel ''")
	})

	s.Run("invalid time-field", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "invalid_field", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().EqualError(err, "time-field must be either 'create_at' or 'update_at'")
	})

	s.Run("invalid sort-direction", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "invalid", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().EqualError(err, "sort-direction must be either 'asc' or 'desc'")
	})

	s.Run("invalid per-page (too large)", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 2000, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Contains(err.Error(), "per-page must be between 1 and")
	})

	s.Run("invalid per-page (zero)", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 0, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Contains(err.Error(), "per-page must be between 1 and")
	})

	s.Run("API error when getting posts", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockError := errors.New("api error occurred")

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForReporting(context.TODO(), model.ReportPostOptions{
				ChannelId:                         channelID,
				EndTime:                           int64(0),
				TimeField:                         "create_at",
				SortDirection:                     "asc",
				PerPage:                           100,
				IncludeDeleted:                    false,
				ExcludeChannelMetadataSystemPosts: false,
				IncludeMetadata:                   false,
			}, model.ReportPostOptionsCursor{
				CursorTime: int64(0),
				CursorId:   "",
			}).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Contains(err.Error(), "failed to get posts for reporting")
	})

	s.Run("successfully get posts with no next cursor", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockPost1 := &model.Post{Id: "post1", Message: "message1", UserId: userID, ChannelId: channelID}
		mockPost2 := &model.Post{Id: "post2", Message: "message2", UserId: userID, ChannelId: channelID}
		mockResponse := &model.ReportPostListResponse{
			Posts: map[string]*model.Post{
				"post1": mockPost1,
				"post2": mockPost2,
			},
			NextCursor: nil,
		}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForReporting(context.TODO(), model.ReportPostOptions{
				ChannelId:                         channelID,
				EndTime:                           int64(0),
				TimeField:                         "create_at",
				SortDirection:                     "asc",
				PerPage:                           100,
				IncludeDeleted:                    false,
				ExcludeChannelMetadataSystemPosts: false,
				IncludeMetadata:                   false,
			}, model.ReportPostOptionsCursor{
				CursorTime: int64(0),
				CursorId:   "",
			}).
			Return(mockResponse, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("successfully get posts with next cursor", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockPost1 := &model.Post{Id: "post1", Message: "message1", UserId: userID, ChannelId: channelID}
		nextCursor := &model.ReportPostOptionsCursor{
			CursorTime: int64(1735488123456),
			CursorId:   "post1",
		}
		mockResponse := &model.ReportPostListResponse{
			Posts: map[string]*model.Post{
				"post1": mockPost1,
			},
			NextCursor: nextCursor,
		}

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForReporting(context.TODO(), model.ReportPostOptions{
				ChannelId:                         channelID,
				EndTime:                           int64(0),
				TimeField:                         "create_at",
				SortDirection:                     "asc",
				PerPage:                           100,
				IncludeDeleted:                    false,
				ExcludeChannelMetadataSystemPosts: false,
				IncludeMetadata:                   false,
			}, model.ReportPostOptionsCursor{
				CursorTime: int64(0),
				CursorId:   "",
			}).
			Return(mockResponse, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", int64(0), "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("successfully get posts with custom cursor", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockPost1 := &model.Post{Id: "post1", Message: "message1", UserId: userID, ChannelId: channelID}
		mockResponse := &model.ReportPostListResponse{
			Posts: map[string]*model.Post{
				"post1": mockPost1,
			},
			NextCursor: nil,
		}

		customCursorTime := int64(1735488000000)
		customCursorId := "custompost123"

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForReporting(context.TODO(), model.ReportPostOptions{
				ChannelId:                         channelID,
				EndTime:                           int64(0),
				TimeField:                         "create_at",
				SortDirection:                     "asc",
				PerPage:                           100,
				IncludeDeleted:                    false,
				ExcludeChannelMetadataSystemPosts: false,
				IncludeMetadata:                   false,
			}, model.ReportPostOptionsCursor{
				CursorTime: customCursorTime,
				CursorId:   customCursorId,
			}).
			Return(mockResponse, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "create_at", "")
		cmd.Flags().String("sort-direction", "asc", "")
		cmd.Flags().Int64("end-time", int64(0), "")
		cmd.Flags().Int64("cursor-time", customCursorTime, "")
		cmd.Flags().String("cursor-id", customCursorId, "")
		cmd.Flags().Int("per-page", 100, "")
		cmd.Flags().Bool("include-deleted", false, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", false, "")
		cmd.Flags().Bool("include-metadata", false, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})

	s.Run("successfully get posts with all options enabled", func() {
		printer.Clean()
		mockChannel := model.Channel{Name: channelName, Id: channelID}
		mockPost1 := &model.Post{Id: "post1", Message: "message1", UserId: userID, ChannelId: channelID}
		mockResponse := &model.ReportPostListResponse{
			Posts: map[string]*model.Post{
				"post1": mockPost1,
			},
			NextCursor: nil,
		}

		customCursorTime := int64(1735400000000)

		s.client.
			EXPECT().
			GetChannel(context.TODO(), channelName, "").
			Return(&mockChannel, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetPostsForReporting(context.TODO(), model.ReportPostOptions{
				ChannelId:                         channelID,
				EndTime:                           int64(1735488000000),
				TimeField:                         "update_at",
				SortDirection:                     "desc",
				PerPage:                           500,
				IncludeDeleted:                    true,
				ExcludeChannelMetadataSystemPosts: true,
				IncludeMetadata:                   true,
			}, model.ReportPostOptionsCursor{
				CursorTime: customCursorTime,
				CursorId:   "",
			}).
			Return(mockResponse, &model.Response{}, nil).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("time-field", "update_at", "")
		cmd.Flags().String("sort-direction", "desc", "")
		cmd.Flags().Int64("end-time", int64(1735488000000), "")
		cmd.Flags().Int64("cursor-time", customCursorTime, "")
		cmd.Flags().String("cursor-id", "", "")
		cmd.Flags().Int("per-page", 500, "")
		cmd.Flags().Bool("include-deleted", true, "")
		cmd.Flags().Bool("exclude-channel-metadata-system-posts", true, "")
		cmd.Flags().Bool("include-metadata", true, "")

		err := reportPostsCmdF(s.client, cmd, []string{channelName})
		s.Require().Nil(err)
		s.Len(printer.GetErrorLines(), 0)
	})
}
