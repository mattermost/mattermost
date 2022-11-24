// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package retrylayer

import (
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store/storetest/mocks"
)

func genStore() *mocks.Store {
	mock := &mocks.Store{}
	mock.On("Audit").Return(&mocks.AuditStore{})
	mock.On("Bot").Return(&mocks.BotStore{})
	mock.On("Channel").Return(&mocks.ChannelStore{})
	mock.On("ChannelMemberHistory").Return(&mocks.ChannelMemberHistoryStore{})
	mock.On("ClusterDiscovery").Return(&mocks.ClusterDiscoveryStore{})
	mock.On("RemoteCluster").Return(&mocks.RemoteClusterStore{})
	mock.On("Command").Return(&mocks.CommandStore{})
	mock.On("CommandWebhook").Return(&mocks.CommandWebhookStore{})
	mock.On("Compliance").Return(&mocks.ComplianceStore{})
	mock.On("Emoji").Return(&mocks.EmojiStore{})
	mock.On("FileInfo").Return(&mocks.FileInfoStore{})
	mock.On("UploadSession").Return(&mocks.UploadSessionStore{})
	mock.On("Group").Return(&mocks.GroupStore{})
	mock.On("Job").Return(&mocks.JobStore{})
	mock.On("License").Return(&mocks.LicenseStore{})
	mock.On("LinkMetadata").Return(&mocks.LinkMetadataStore{})
	mock.On("SharedChannel").Return(&mocks.SharedChannelStore{})
	mock.On("OAuth").Return(&mocks.OAuthStore{})
	mock.On("Plugin").Return(&mocks.PluginStore{})
	mock.On("Post").Return(&mocks.PostStore{})
	mock.On("Thread").Return(&mocks.ThreadStore{})
	mock.On("Preference").Return(&mocks.PreferenceStore{})
	mock.On("ProductNotices").Return(&mocks.ProductNoticesStore{})
	mock.On("Reaction").Return(&mocks.ReactionStore{})
	mock.On("RetentionPolicy").Return(&mocks.RetentionPolicyStore{})
	mock.On("Role").Return(&mocks.RoleStore{})
	mock.On("Scheme").Return(&mocks.SchemeStore{})
	mock.On("Session").Return(&mocks.SessionStore{})
	mock.On("Status").Return(&mocks.StatusStore{})
	mock.On("System").Return(&mocks.SystemStore{})
	mock.On("Team").Return(&mocks.TeamStore{})
	mock.On("TermsOfService").Return(&mocks.TermsOfServiceStore{})
	mock.On("Token").Return(&mocks.TokenStore{})
	mock.On("User").Return(&mocks.UserStore{})
	mock.On("UserAccessToken").Return(&mocks.UserAccessTokenStore{})
	mock.On("UserTermsOfService").Return(&mocks.UserTermsOfServiceStore{})
	mock.On("Webhook").Return(&mocks.WebhookStore{})
	mock.On("NotifyAdmin").Return(&mocks.NotifyAdminStore{})
	mock.On("PostPriority").Return(&mocks.PostPriorityStore{})
	mock.On("PostAcknowledgement").Return(&mocks.PostAcknowledgementStore{})
	return mock
}

func TestRetry(t *testing.T) {
	t.Run("on regular error should not retry", func(t *testing.T) {
		mock := genStore()
		mockBotStore := mock.Bot().(*mocks.BotStore)
		mockBotStore.On("Get", "test", false).Return(nil, errors.New("regular error")).Times(1)
		mock.On("Bot").Return(&mockBotStore)
		layer := New(mock)
		layer.Bot().Get("test", false)
		mockBotStore.AssertExpectations(t)
	})
	t.Run("on success should not retry", func(t *testing.T) {
		mock := genStore()
		mockBotStore := mock.Bot().(*mocks.BotStore)
		mockBotStore.On("Get", "test", false).Return(&model.Bot{}, nil).Times(1)
		mock.On("Bot").Return(&mockBotStore)
		layer := New(mock)
		layer.Bot().Get("test", false)
		mockBotStore.AssertExpectations(t)
	})
	t.Run("on mysql repeatable error should retry", func(t *testing.T) {
		mock := genStore()
		mockBotStore := mock.Bot().(*mocks.BotStore)
		mysqlErr := mysql.MySQLError{Number: uint16(1213), Message: "Deadlock"}
		mockBotStore.On("Get", "test", false).Return(nil, errors.Wrap(&mysqlErr, "test-error")).Times(3)
		mock.On("Bot").Return(&mockBotStore)
		layer := New(mock)
		layer.Bot().Get("test", false)
		mockBotStore.AssertExpectations(t)
	})
	t.Run("on mysql not repeatable error should not retry", func(t *testing.T) {
		mock := genStore()
		mockBotStore := mock.Bot().(*mocks.BotStore)
		mysqlErr := mysql.MySQLError{Number: uint16(1000), Message: "Not repeatable error"}
		mockBotStore.On("Get", "test", false).Return(nil, errors.Wrap(&mysqlErr, "test-error")).Times(1)
		mock.On("Bot").Return(&mockBotStore)
		layer := New(mock)
		layer.Bot().Get("test", false)
		mockBotStore.AssertExpectations(t)
	})

	t.Run("on postgres repeatable error should retry", func(t *testing.T) {
		for _, errCode := range []string{"40001", "40P01"} {
			t.Run("error "+errCode, func(t *testing.T) {
				mock := genStore()
				mockBotStore := mock.Bot().(*mocks.BotStore)
				pqErr := pq.Error{Code: pq.ErrorCode(errCode)}
				mockBotStore.On("Get", "test", false).Return(nil, errors.Wrap(&pqErr, "test-error")).Times(3)
				mock.On("Bot").Return(&mockBotStore)
				layer := New(mock)
				layer.Bot().Get("test", false)
				mockBotStore.AssertExpectations(t)
			})
		}
	})

	t.Run("on postgres not repeatable error should not retry", func(t *testing.T) {
		mock := genStore()
		mockBotStore := mock.Bot().(*mocks.BotStore)
		pqErr := pq.Error{Code: "20000"}
		mockBotStore.On("Get", "test", false).Return(nil, errors.Wrap(&pqErr, "test-error")).Times(1)
		mock.On("Bot").Return(&mockBotStore)
		layer := New(mock)
		layer.Bot().Get("test", false)
		mockBotStore.AssertExpectations(t)
	})
}
