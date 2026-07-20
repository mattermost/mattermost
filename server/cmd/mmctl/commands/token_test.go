// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	gomock "github.com/golang/mock/gomock"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/spf13/cobra"
)

func TestParseExpiresIn(t *testing.T) {
	for name, tc := range map[string]struct {
		input   string
		want    time.Duration
		wantErr bool
	}{
		"days":                 {input: "30d", want: 30 * 24 * time.Hour},
		"single day":           {input: "1d", want: 24 * time.Hour},
		"hours":                {input: "12h", want: 12 * time.Hour},
		"compound stdlib":      {input: "1h30m", want: 90 * time.Minute},
		"minutes":              {input: "45m", want: 45 * time.Minute},
		"non-numeric days":     {input: "xd", wantErr: true},
		"non-numeric stdlib":   {input: "abc", wantErr: true},
		"empty":                {input: "", wantErr: true},
		"days beyond cap":      {input: "36501d", wantErr: true},
		"days at cap accepted": {input: "36500d", want: 36500 * 24 * time.Hour},
	} {
		t.Run(name, func(t *testing.T) {
			got, err := parseExpiresIn(tc.input)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func (s *MmctlUnitTestSuite) TestGenerateTokenForAUserCmd() {
	s.Run("Should generate a token for a user", func() {
		printer.Clean()

		userArg := "userId1"
		mockUser := model.User{Id: "userId1", Email: "user1@example.com", Username: "user1"}
		mockToken := model.UserAccessToken{Token: "token-id", Description: "token-desc"}

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), userArg, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given username")).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), userArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateUserAccessToken(context.TODO(), mockUser.Id, mockToken.Description, int64(0)).
			Return(&mockToken, &model.Response{}, nil).
			Times(1)

		err := generateTokenForAUserCmdF(s.client, &cobra.Command{}, []string{mockUser.Id, mockToken.Description})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(&mockToken, printer.GetLines()[0])
	})

	s.Run("Should fail on an invalid username", func() {
		printer.Clean()

		userArg := "some-text"
		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), userArg, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given username")).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), userArg, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given ID")).
			Times(1)

		err := generateTokenForAUserCmdF(s.client, &cobra.Command{}, []string{userArg, "description"})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), fmt.Sprintf("could not retrieve user information of %q", userArg))
	})

	s.Run("Should fail if can't create tokens for a valid user", func() {
		printer.Clean()

		userArg := "user1"
		mockUser := model.User{Id: "userId1", Email: "user1@example.com", Username: "user1"}

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), userArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			CreateUserAccessToken(context.TODO(), mockUser.Id, "description", int64(0)).
			Return(nil, &model.Response{}, errors.New("error-message")).
			Times(1)

		err := generateTokenForAUserCmdF(s.client, &cobra.Command{}, []string{"user1", "description"})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), fmt.Sprintf("could not create token for %q:", "user1"))
	})

	s.Run("Should pass a positive expires_at when --expires-in is set", func() {
		printer.Clean()

		userArg := "userId1"
		mockUser := model.User{Id: "userId1", Email: "user1@example.com", Username: "user1"}
		mockToken := model.UserAccessToken{Token: "token-id", Description: "ci-token"}

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), userArg, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given username")).
			Times(1)
		s.client.
			EXPECT().
			GetUser(context.TODO(), userArg, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		now := time.Now()
		s.client.
			EXPECT().
			CreateUserAccessToken(context.TODO(), mockUser.Id, mockToken.Description, gomock.AssignableToTypeOf(int64(0))).
			DoAndReturn(func(_ context.Context, _, _ string, expiresAt int64) (*model.UserAccessToken, *model.Response, error) {
				// 90 days = 7_776_000_000 ms; allow generous slack for clock between Now() calls.
				expected := now.Add(90 * 24 * time.Hour).UnixMilli()
				s.Require().InDelta(expected, expiresAt, float64(time.Minute.Milliseconds()))
				return &mockToken, &model.Response{}, nil
			}).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("expires-in", "", "")
		s.Require().NoError(cmd.Flags().Set("expires-in", "90d"))

		err := generateTokenForAUserCmdF(s.client, cmd, []string{mockUser.Id, mockToken.Description})
		s.Require().NoError(err)
	})

	s.Run("Should reject invalid --expires-in", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("expires-in", "", "")
		s.Require().NoError(cmd.Flags().Set("expires-in", "not-a-duration"))

		err := generateTokenForAUserCmdF(s.client, cmd, []string{"userId1", "desc"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "invalid --expires-in")
	})

	s.Run("Should reject non-positive --expires-in", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("expires-in", "", "")
		s.Require().NoError(cmd.Flags().Set("expires-in", "-5h"))

		err := generateTokenForAUserCmdF(s.client, cmd, []string{"userId1", "desc"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "must be positive")
	})
}

func (s *MmctlUnitTestSuite) TestListTokensOfAUserCmdF() {
	s.Run("Should list access tokens of a user", func() {
		printer.Clean()

		command := cobra.Command{}
		command.Flags().Int("page", 0, "")
		command.Flags().Int("per-page", 2, "")
		command.Flags().Bool("all", true, "")
		command.Flags().Bool("active", false, "")
		command.Flags().Bool("inactive", false, "")

		mockUser := model.User{Id: "userId1", Email: "user1@example.com", Username: "user1"}
		mockToken1 := model.UserAccessToken{IsActive: true, Id: "token-1-id", Description: "token-1-desc"}
		mockToken2 := model.UserAccessToken{IsActive: false, Id: "token-2-id", Description: "token-2-desc"}

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), mockUser.Id, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given username")).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), mockUser.Id, "").
			Return(&mockUser, &model.Response{}, nil).
			Times(1)

		s.client.
			EXPECT().
			GetUserAccessTokensForUser(context.TODO(), mockUser.Id, 0, 9999).
			Return(
				[]*model.UserAccessToken{&mockToken1, &mockToken2},
				&model.Response{}, nil,
			).Times(1)

		err := listTokensOfAUserCmdF(s.client, &command, []string{mockUser.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 2)
		s.Require().Equal(&mockToken1, printer.GetLines()[0])
		s.Require().Equal(&mockToken2, printer.GetLines()[1])
	})

	s.Run("Should list only active user access tokens of a user", func() {
		printer.Clean()

		command := cobra.Command{}
		command.Flags().Int("page", 0, "")
		command.Flags().Int("per-page", 2, "")
		command.Flags().Bool("all", false, "")
		command.Flags().Bool("active", true, "")
		command.Flags().Bool("inactive", false, "")

		mockUser := model.User{Id: "userId1", Email: "user1@example.com", Username: "user1"}
		mockToken1 := model.UserAccessToken{IsActive: true, Id: "token-1-id", Description: "token-1-desc"}
		mockToken2 := model.UserAccessToken{IsActive: false, Id: "token-2-id", Description: "token-2-desc"}

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), mockUser.Email, "").
			Return(&mockUser, &model.Response{}, errors.New("no user found with the given email")).
			Times(1)

		s.client.
			EXPECT().
			GetUserAccessTokensForUser(context.TODO(), mockUser.Id, 0, 2).
			Return(
				[]*model.UserAccessToken{&mockToken1, &mockToken2},
				&model.Response{}, nil,
			).Times(1)

		err := listTokensOfAUserCmdF(s.client, &command, []string{mockUser.Email})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(&mockToken1, printer.GetLines()[0])
	})

	s.Run("Should err on a absent user", func() {
		printer.Clean()

		userArg := "test-user"
		command := cobra.Command{}
		command.Flags().Int("page", 0, "")
		command.Flags().Int("per-page", 2, "")
		command.Flags().Bool("all", false, "")
		command.Flags().Bool("active", false, "")
		command.Flags().Bool("inactive", false, "")

		s.client.
			EXPECT().
			GetUserByUsername(context.TODO(), userArg, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given username")).
			Times(1)

		s.client.
			EXPECT().
			GetUser(context.TODO(), userArg, "").
			Return(nil, &model.Response{}, errors.New("no user found with the given user ID")).
			Times(1)

		err := listTokensOfAUserCmdF(s.client, &command, []string{userArg})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), fmt.Sprintf("could not retrieve user information of %q", userArg))
	})

	s.Run("Should error if there are no user access tokens for a valid user", func() {
		printer.Clean()

		command := cobra.Command{}
		command.Flags().Int("page", 0, "")
		command.Flags().Int("per-page", 2, "")
		command.Flags().Bool("all", false, "")
		command.Flags().Bool("active", true, "")
		command.Flags().Bool("inactive", false, "")

		mockUser := model.User{Id: "userId1", Email: "user1@example.com", Username: "user1"}

		s.client.
			EXPECT().
			GetUserByEmail(context.TODO(), mockUser.Email, "").
			Return(&mockUser, &model.Response{}, errors.New("no user found with the given email")).
			Times(1)

		s.client.
			EXPECT().
			GetUserAccessTokensForUser(context.TODO(), mockUser.Id, 0, 2).
			Return(
				[]*model.UserAccessToken{},
				&model.Response{}, nil,
			).Times(1)

		err := listTokensOfAUserCmdF(s.client, &command, []string{mockUser.Email})
		s.Require().NotNil(err)
		s.Require().Equal(err.Error(), fmt.Sprintf("there are no tokens for the %q", mockUser.Email))
	})
}

func (s *MmctlUnitTestSuite) TestRotateTokenCmdF() {
	s.Run("Should rotate a token and print the new secret", func() {
		printer.Clean()

		tokenID := "xwt6numaubyj9mqjfkqjk5pfqr"
		mockToken := model.UserAccessToken{Id: tokenID, Token: "new-secret-value", Description: "ci-token"}

		s.client.
			EXPECT().
			RotateUserAccessToken(context.TODO(), tokenID, int64(0)).
			Return(&mockToken, &model.Response{}, nil).
			Times(1)

		err := rotateTokenCmdF(s.client, &cobra.Command{}, []string{tokenID})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 1)
		s.Require().Equal(&mockToken, printer.GetLines()[0])
	})

	s.Run("Should pass expiry when --expires-in is set", func() {
		printer.Clean()

		tokenID := "xwt6numaubyj9mqjfkqjk5pfqr"
		mockToken := model.UserAccessToken{Id: tokenID, Token: "new-secret-value", Description: "ci-token"}

		now := time.Now()
		s.client.
			EXPECT().
			RotateUserAccessToken(context.TODO(), tokenID, gomock.AssignableToTypeOf(int64(0))).
			DoAndReturn(func(_ context.Context, _ string, expiresAt int64) (*model.UserAccessToken, *model.Response, error) {
				expected := now.Add(30 * 24 * time.Hour).UnixMilli()
				s.Require().InDelta(expected, expiresAt, float64(time.Minute.Milliseconds()))
				return &mockToken, &model.Response{}, nil
			}).
			Times(1)

		cmd := &cobra.Command{}
		cmd.Flags().String("expires-in", "", "")
		s.Require().NoError(cmd.Flags().Set("expires-in", "30d"))

		err := rotateTokenCmdF(s.client, cmd, []string{tokenID})
		s.Require().NoError(err)
	})

	s.Run("Should fail if the server rejects the rotation", func() {
		printer.Clean()

		tokenID := "xwt6numaubyj9mqjfkqjk5pfqr"

		s.client.
			EXPECT().
			RotateUserAccessToken(context.TODO(), tokenID, int64(0)).
			Return(nil, &model.Response{}, errors.New("token not found")).
			Times(1)

		err := rotateTokenCmdF(s.client, &cobra.Command{}, []string{tokenID})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), fmt.Sprintf("could not rotate token %q", tokenID))
	})

	s.Run("Should reject invalid --expires-in", func() {
		printer.Clean()

		cmd := &cobra.Command{}
		cmd.Flags().String("expires-in", "", "")
		s.Require().NoError(cmd.Flags().Set("expires-in", "not-a-duration"))

		err := rotateTokenCmdF(s.client, cmd, []string{"some-token-id"})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "invalid --expires-in")
	})
}

func (s *MmctlUnitTestSuite) TestRevokeTokenForAUserCmdF() {
	s.Run("Should revoke user access tokens", func() {
		printer.Clean()

		mockToken1 := model.UserAccessToken{Id: "123456"}
		mockToken2 := model.UserAccessToken{Id: "234567"}

		s.client.
			EXPECT().
			RevokeUserAccessToken(context.TODO(), mockToken1.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		s.client.
			EXPECT().
			RevokeUserAccessToken(context.TODO(), mockToken2.Id).
			Return(&model.Response{StatusCode: http.StatusOK}, nil).
			Times(1)

		err := revokeTokenForAUserCmdF(s.client, &cobra.Command{}, []string{mockToken1.Id, mockToken2.Id})
		s.Require().Nil(err)
		s.Require().Len(printer.GetLines(), 0)
	})

	s.Run("Should fail if can't revoke user access token", func() {
		s.client.
			EXPECT().
			RevokeUserAccessToken(context.TODO(), "token-id").
			Return(&model.Response{StatusCode: http.StatusBadRequest}, errors.New("some-error")).
			Times(1)

		err := revokeTokenForAUserCmdF(s.client, &cobra.Command{}, []string{"token-id"})
		s.Require().NotNil(err)
		s.Require().Contains(err.Error(), fmt.Sprintf("could not revoke token %q", "token-id"))
	})
}
