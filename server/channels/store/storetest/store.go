// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"context"
	"database/sql"
	"time"

	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/channels/store"
	"github.com/mattermost/mattermost-server/v6/server/channels/store/storetest/mocks"
)

// Store can be used to provide mock stores for testing.
type Store struct {
	TeamStore                 mocks.TeamStore
	ChannelStore              mocks.ChannelStore
	PostStore                 mocks.PostStore
	UserStore                 mocks.UserStore
	RetentionPolicyStore      mocks.RetentionPolicyStore
	BotStore                  mocks.BotStore
	AuditStore                mocks.AuditStore
	ClusterDiscoveryStore     mocks.ClusterDiscoveryStore
	RemoteClusterStore        mocks.RemoteClusterStore
	ComplianceStore           mocks.ComplianceStore
	SessionStore              mocks.SessionStore
	OAuthStore                mocks.OAuthStore
	SystemStore               mocks.SystemStore
	WebhookStore              mocks.WebhookStore
	CommandStore              mocks.CommandStore
	CommandWebhookStore       mocks.CommandWebhookStore
	PreferenceStore           mocks.PreferenceStore
	LicenseStore              mocks.LicenseStore
	TokenStore                mocks.TokenStore
	EmojiStore                mocks.EmojiStore
	ThreadStore               mocks.ThreadStore
	StatusStore               mocks.StatusStore
	FileInfoStore             mocks.FileInfoStore
	UploadSessionStore        mocks.UploadSessionStore
	ReactionStore             mocks.ReactionStore
	JobStore                  mocks.JobStore
	UserAccessTokenStore      mocks.UserAccessTokenStore
	PluginStore               mocks.PluginStore
	ChannelMemberHistoryStore mocks.ChannelMemberHistoryStore
	RoleStore                 mocks.RoleStore
	SchemeStore               mocks.SchemeStore
	TermsOfServiceStore       mocks.TermsOfServiceStore
	GroupStore                mocks.GroupStore
	UserTermsOfServiceStore   mocks.UserTermsOfServiceStore
	LinkMetadataStore         mocks.LinkMetadataStore
	SharedChannelStore        mocks.SharedChannelStore
	ProductNoticesStore       mocks.ProductNoticesStore
	DraftStore                mocks.DraftStore
	context                   context.Context
	NotifyAdminStore          mocks.NotifyAdminStore
	PostPriorityStore         mocks.PostPriorityStore
	PostAcknowledgementStore  mocks.PostAcknowledgementStore
	TrueUpReviewStore         mocks.TrueUpReviewStore
}

func (s *Store) SetContext(context context.Context)                { s.context = context }
func (s *Store) Context() context.Context                          { return s.context }
func (s *Store) Team() store.TeamStore                             { return &s.TeamStore }
func (s *Store) Channel() store.ChannelStore                       { return &s.ChannelStore }
func (s *Store) Post() store.PostStore                             { return &s.PostStore }
func (s *Store) User() store.UserStore                             { return &s.UserStore }
func (s *Store) RetentionPolicy() store.RetentionPolicyStore       { return &s.RetentionPolicyStore }
func (s *Store) Bot() store.BotStore                               { return &s.BotStore }
func (s *Store) ProductNotices() store.ProductNoticesStore         { return &s.ProductNoticesStore }
func (s *Store) Audit() store.AuditStore                           { return &s.AuditStore }
func (s *Store) ClusterDiscovery() store.ClusterDiscoveryStore     { return &s.ClusterDiscoveryStore }
func (s *Store) RemoteCluster() store.RemoteClusterStore           { return &s.RemoteClusterStore }
func (s *Store) Compliance() store.ComplianceStore                 { return &s.ComplianceStore }
func (s *Store) Session() store.SessionStore                       { return &s.SessionStore }
func (s *Store) OAuth() store.OAuthStore                           { return &s.OAuthStore }
func (s *Store) System() store.SystemStore                         { return &s.SystemStore }
func (s *Store) Webhook() store.WebhookStore                       { return &s.WebhookStore }
func (s *Store) Command() store.CommandStore                       { return &s.CommandStore }
func (s *Store) CommandWebhook() store.CommandWebhookStore         { return &s.CommandWebhookStore }
func (s *Store) Preference() store.PreferenceStore                 { return &s.PreferenceStore }
func (s *Store) License() store.LicenseStore                       { return &s.LicenseStore }
func (s *Store) Token() store.TokenStore                           { return &s.TokenStore }
func (s *Store) Emoji() store.EmojiStore                           { return &s.EmojiStore }
func (s *Store) Thread() store.ThreadStore                         { return &s.ThreadStore }
func (s *Store) Status() store.StatusStore                         { return &s.StatusStore }
func (s *Store) FileInfo() store.FileInfoStore                     { return &s.FileInfoStore }
func (s *Store) UploadSession() store.UploadSessionStore           { return &s.UploadSessionStore }
func (s *Store) Reaction() store.ReactionStore                     { return &s.ReactionStore }
func (s *Store) Job() store.JobStore                               { return &s.JobStore }
func (s *Store) UserAccessToken() store.UserAccessTokenStore       { return &s.UserAccessTokenStore }
func (s *Store) Plugin() store.PluginStore                         { return &s.PluginStore }
func (s *Store) Role() store.RoleStore                             { return &s.RoleStore }
func (s *Store) Scheme() store.SchemeStore                         { return &s.SchemeStore }
func (s *Store) TermsOfService() store.TermsOfServiceStore         { return &s.TermsOfServiceStore }
func (s *Store) UserTermsOfService() store.UserTermsOfServiceStore { return &s.UserTermsOfServiceStore }
func (s *Store) Draft() store.DraftStore                           { return &s.DraftStore }
func (s *Store) ChannelMemberHistory() store.ChannelMemberHistoryStore {
	return &s.ChannelMemberHistoryStore
}
func (s *Store) TrueUpReview() store.TrueUpReviewStore   { return &s.TrueUpReviewStore }
func (s *Store) NotifyAdmin() store.NotifyAdminStore     { return &s.NotifyAdminStore }
func (s *Store) Group() store.GroupStore                 { return &s.GroupStore }
func (s *Store) LinkMetadata() store.LinkMetadataStore   { return &s.LinkMetadataStore }
func (s *Store) SharedChannel() store.SharedChannelStore { return &s.SharedChannelStore }
func (s *Store) PostPriority() store.PostPriorityStore   { return &s.PostPriorityStore }
func (s *Store) PostAcknowledgement() store.PostAcknowledgementStore {
	return &s.PostAcknowledgementStore
}
func (s *Store) MarkSystemRanUnitTests()            { /* do nothing */ }
func (s *Store) Close()                             { /* do nothing */ }
func (s *Store) LockToMaster()                      { /* do nothing */ }
func (s *Store) UnlockFromMaster()                  { /* do nothing */ }
func (s *Store) DropAllTables()                     { /* do nothing */ }
func (s *Store) GetDbVersion(bool) (string, error)  { return "", nil }
func (s *Store) GetInternalMasterDB() *sql.DB       { return nil }
func (s *Store) GetInternalReplicaDB() *sql.DB      { return nil }
func (s *Store) GetInternalReplicaDBs() []*sql.DB   { return nil }
func (s *Store) RecycleDBConnections(time.Duration) {}
func (s *Store) GetDBSchemaVersion() (int, error)   { return 1, nil }
func (s *Store) GetAppliedMigrations() ([]model.AppliedMigration, error) {
	return []model.AppliedMigration{}, nil
}
func (s *Store) TotalMasterDbConnections() int { return 1 }
func (s *Store) TotalReadDbConnections() int   { return 1 }
func (s *Store) TotalSearchDbConnections() int { return 1 }
func (s *Store) CheckIntegrity() <-chan model.IntegrityCheckResult {
	return make(chan model.IntegrityCheckResult)
}
func (s *Store) ReplicaLagAbs() error  { return nil }
func (s *Store) ReplicaLagTime() error { return nil }

func (s *Store) AssertExpectations(t mock.TestingT) bool {
	return mock.AssertExpectationsForObjects(t,
		&s.TeamStore,
		&s.ChannelStore,
		&s.PostStore,
		&s.UserStore,
		&s.BotStore,
		&s.AuditStore,
		&s.ClusterDiscoveryStore,
		&s.RemoteClusterStore,
		&s.ComplianceStore,
		&s.SessionStore,
		&s.OAuthStore,
		&s.SystemStore,
		&s.WebhookStore,
		&s.CommandStore,
		&s.CommandWebhookStore,
		&s.PreferenceStore,
		&s.LicenseStore,
		&s.TokenStore,
		&s.EmojiStore,
		&s.StatusStore,
		&s.FileInfoStore,
		&s.UploadSessionStore,
		&s.ReactionStore,
		&s.JobStore,
		&s.UserAccessTokenStore,
		&s.ChannelMemberHistoryStore,
		&s.PluginStore,
		&s.RoleStore,
		&s.SchemeStore,
		&s.ThreadStore,
		&s.ProductNoticesStore,
		&s.SharedChannelStore,
		&s.DraftStore,
		&s.NotifyAdminStore,
		&s.PostPriorityStore,
		&s.PostAcknowledgementStore,
	)
}
