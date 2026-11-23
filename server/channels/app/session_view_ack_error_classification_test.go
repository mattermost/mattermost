// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

type storeErrCase struct {
	err    error
	id     string
	status int
}

func assertAppErrorFor(t *testing.T, tc storeErrCase, appErr *model.AppError) {
	t.Helper()
	require.NotNil(t, appErr)
	assert.Equal(t, tc.id, appErr.Id)
	assert.Equal(t, tc.status, appErr.StatusCode)
}

func TestSessionStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableUserAccessTokens = true
	})

	mockStore := &storemocks.Store{}
	sessionMock := &storemocks.SessionStore{}
	userMock := &storemocks.UserStore{}
	tokenMock := &storemocks.UserAccessTokenStore{}
	mockStore.On("Close").Return(nil)
	mockStore.On("Session").Return(sessionMock)
	mockStore.On("User").Return(userMock)
	mockStore.On("UserAccessToken").Return(tokenMock)
	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(mockStore)
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	notFound := fmt.Errorf("query: %w", store.NewErrNotFound("User", model.NewId()))
	invalid := fmt.Errorf("query: %w", store.NewErrInvalidInput("Session", "id", "x"))
	plain := errors.New("db down")
	wrapped := model.NewAppError("Save", "app.custom.error", nil, "", http.StatusTeapot)

	sessionMock.On("GetLRUSessions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]*model.Session{}, nil)

	t.Run("CreateSession", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{invalid, "app.session.save.existing.app_error", http.StatusBadRequest},
			{plain, "app.session.save.app_error", http.StatusInternalServerError},
		} {
			sessionMock.On("Save", mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id})
			assertAppErrorFor(t, tc, appErr)
		}
	})

	t.Run("createSessionForUserAccessToken", func(t *testing.T) {
		token := &model.UserAccessToken{Id: model.NewId(), Token: model.NewId(), UserId: th.BasicUser.Id, IsActive: true}
		tokenMock.On("GetByToken", token.Token).Return(token, nil)

		for _, tc := range []storeErrCase{
			{notFound, MissingAccountError, http.StatusNotFound},
			{plain, "app.user.get.app_error", http.StatusInternalServerError},
		} {
			userMock.On("Get", mock.Anything, token.UserId).Return(nil, tc.err).Once()
			_, appErr := th.App.createSessionForUserAccessToken(th.Context, token.Token)
			assertAppErrorFor(t, tc, appErr)
		}

		for _, tc := range []storeErrCase{
			{invalid, "app.session.save.existing.app_error", http.StatusBadRequest},
			{plain, "app.session.save.app_error", http.StatusInternalServerError},
		} {
			userMock.On("Get", mock.Anything, token.UserId).Return(th.BasicUser, nil).Once()
			sessionMock.On("Save", mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.createSessionForUserAccessToken(th.Context, token.Token)
			assertAppErrorFor(t, tc, appErr)
		}
	})

	t.Run("CreateUserAccessToken save", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.user_access_token.save.app_error", http.StatusInternalServerError},
		} {
			tokenMock.On("Save", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.CreateUserAccessToken(th.Context, &model.UserAccessToken{UserId: th.BasicUser.Id, Description: "d"})
			assertAppErrorFor(t, tc, appErr)
		}
	})

	t.Run("GetUserAccessToken", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{notFound, "app.user_access_token.get_by_user.app_error", http.StatusNotFound},
			{plain, "app.user_access_token.get_by_user.app_error", http.StatusInternalServerError},
		} {
			tokenMock.On("Get", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.GetUserAccessToken(model.NewId(), false)
			assertAppErrorFor(t, tc, appErr)
		}
	})
}

func TestPostAcknowledgementStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	post, _, appErr := th.App.CreatePostAsUser(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message",
	}, "", true)
	require.Nil(t, appErr)

	mockStore := &storemocks.Store{}
	postMock := &storemocks.PostStore{}
	channelMock := &storemocks.ChannelStore{}
	ackMock := &storemocks.PostAcknowledgementStore{}
	mockStore.On("Close").Return(nil)
	mockStore.On("Post").Return(postMock)
	mockStore.On("Channel").Return(channelMock)
	mockStore.On("PostAcknowledgement").Return(ackMock)
	postMock.On("GetSingle", mock.Anything, post.Id, false).Return(post, nil)
	channelMock.On("Get", th.BasicChannel.Id, true).Return(th.BasicChannel, nil)
	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(mockStore)
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	notFound := fmt.Errorf("query: %w", store.NewErrNotFound("PostAcknowledgement", post.Id))
	plain := errors.New("db down")
	wrapped := model.NewAppError("Save", "app.custom.error", nil, "", http.StatusTeapot)

	t.Run("SaveAcknowledgementForPost", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.acknowledgement.save.save.app_error", http.StatusInternalServerError},
		} {
			ackMock.On("SaveWithModel", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.SaveAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
			assertAppErrorFor(t, tc, appErr)
		}
	})

	t.Run("DeleteAcknowledgementForPost", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{notFound, "app.acknowledgement.get.app_error", http.StatusNotFound},
			{plain, "app.acknowledgement.get.app_error", http.StatusInternalServerError},
		} {
			ackMock.On("Get", post.Id, th.BasicUser.Id).Return(nil, tc.err).Once()
			appErr := th.App.DeleteAcknowledgementForPost(th.Context, post.Id, th.BasicUser.Id)
			assertAppErrorFor(t, tc, appErr)
		}
	})

	t.Run("SaveAcknowledgementsForPost", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.acknowledgement.batch_save.app_error", http.StatusInternalServerError},
		} {
			ackMock.On("BatchSave", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.SaveAcknowledgementsForPost(th.Context, post.Id, []string{th.BasicUser.Id})
			assertAppErrorFor(t, tc, appErr)
		}
	})

	t.Run("SaveAcknowledgementForPostWithModel", func(t *testing.T) {
		for _, tc := range []storeErrCase{
			{fmt.Errorf("wrap: %w", wrapped), "app.custom.error", http.StatusTeapot},
			{plain, "app.acknowledgement.save.save.app_error", http.StatusInternalServerError},
		} {
			ackMock.On("SaveWithModel", mock.Anything).Return(nil, tc.err).Once()
			_, appErr := th.App.SaveAcknowledgementForPostWithModel(th.Context, &model.PostAcknowledgement{PostId: post.Id, UserId: th.BasicUser.Id})
			assertAppErrorFor(t, tc, appErr)
		}
	})
}
