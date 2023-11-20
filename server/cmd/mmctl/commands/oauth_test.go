// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func (s *MmctlUnitTestSuite) TestListOAuthAppsCmd() {
	oauthAppID := "oauthAppID"
	oauthAppName := "oauthAppName"
	userID := "userID"

	s.Run("Listing all oauth apps", func() {
		printer.Clean()

		mockOAuthApp := model.OAuthApp{
			Id:        oauthAppID,
			Name:      oauthAppName,
			CreatorId: userID,
		}
		mockUser := model.User{Id: mockOAuthApp.CreatorId, Username: "mockuser"}

		s.client.
			EXPECT().
			GetOAuthApps(context.Background(), 0, 100000000).
			Return([]*model.OAuthApp{&mockOAuthApp}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUsersByIds(context.Background(), []string{mockOAuthApp.CreatorId}).
			Return([]*model.User{&mockUser}, &model.Response{}, nil).
			Times(1)

		err := listOAuthAppsCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().Nil(err)
		s.Len(printer.GetLines(), 1)
		s.Len(printer.GetErrorLines(), 0)
		s.Require().Equal(&mockOAuthApp, printer.GetLines()[0])
	})

	s.Run("Unable to list oauth apps", func() {
		printer.Clean()

		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetOAuthApps(context.Background(), 0, 100000000).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := listOAuthAppsCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.EqualError(err, "Failed to fetch oauth2 apps: mock error")
	})

	s.Run("Unable to get users for oauth apps", func() {
		printer.Clean()

		mockOAuthApp := model.OAuthApp{
			Id:        oauthAppID,
			Name:      oauthAppName,
			CreatorId: userID,
		}
		mockError := errors.New("mock error")

		s.client.
			EXPECT().
			GetOAuthApps(context.Background(), 0, 100000000).
			Return([]*model.OAuthApp{&mockOAuthApp}, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUsersByIds(context.Background(), []string{mockOAuthApp.CreatorId}).
			Return(nil, &model.Response{}, mockError).
			Times(1)

		err := listOAuthAppsCmdF(s.client, &cobra.Command{}, []string{})
		s.Require().NotNil(err)
		s.Len(printer.GetLines(), 0)
		s.EqualError(err, "Failed to fetch users for oauth2 apps: mock error")
	})
}
