// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/Masterminds/squirrel"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/v5/store"
)

/*type SqlStore struct {
	master         *gorp.DbMap
	replicas       []*gorp.DbMap
	searchReplicas []*gorp.DbMap
	team           TeamStore
	channel        ChannelStore
	post           PostStore
	user           UserStore
	audit          AuditStore
	compliance     ComplianceStore
	session        SessionStore
	oauth          OAuthStore
	system         SystemStore
	webhook        WebhookStore
	command        CommandStore
	preference     PreferenceStore
	license        LicenseStore
	token          TokenStore
	emoji          EmojiStore
	status         StatusStore
	fileInfo       FileInfoStore
	reaction       ReactionStore
	jobStatus      JobStatusStore
	SchemaVersion  string
	rrCounter      int64
	srCounter      int64
}*/

type SqlStore interface {
	DriverName() string
	GetCurrentSchemaVersion() string
	GetMaster() *gorp.DbMap
	GetSearchReplica() *gorp.DbMap
	GetReplica() *gorp.DbMap
	TotalMasterDbConnections() int
	TotalReadDbConnections() int
	TotalSearchDbConnections() int
	MarkSystemRanUnitTests()
	DoesTableExist(tablename string) bool
	DoesColumnExist(tableName string, columName string) bool
	DoesTriggerExist(triggerName string) bool
	CreateColumnIfNotExists(tableName string, columnName string, mySqlColType string, postgresColType string, defaultValue string) bool
	CreateColumnIfNotExistsNoDefault(tableName string, columnName string, mySqlColType string, postgresColType string) bool
	RemoveColumnIfExists(tableName string, columnName string) bool
	RemoveTableIfExists(tableName string) bool
	RenameColumnIfExists(tableName string, oldColumnName string, newColumnName string, colType string) bool
	GetMaxLengthOfColumnIfExists(tableName string, columnName string) string
	AlterColumnTypeIfExists(tableName string, columnName string, mySqlColType string, postgresColType string) bool
	AlterColumnDefaultIfExists(tableName string, columnName string, mySqlColDefault *string, postgresColDefault *string) bool
	CreateUniqueIndexIfNotExists(indexName string, tableName string, columnName string) bool
	CreateIndexIfNotExists(indexName string, tableName string, columnName string) bool
	CreateCompositeIndexIfNotExists(indexName string, tableName string, columnNames []string) bool
	CreateFullTextIndexIfNotExists(indexName string, tableName string, columnName string) bool
	RemoveIndexIfExists(indexName string, tableName string) bool
	GetAllConns() []*gorp.DbMap
	Close()
	LockToMaster()
	UnlockFromMaster()
	Team() store.TeamStore
	Channel() store.ChannelStore
	Post() store.PostStore
	User() store.UserStore
	Bot() store.BotStore
	Audit() store.AuditStore
	ClusterDiscovery() store.ClusterDiscoveryStore
	Compliance() store.ComplianceStore
	Session() store.SessionStore
	OAuth() store.OAuthStore
	System() store.SystemStore
	Webhook() store.WebhookStore
	Command() store.CommandStore
	CommandWebhook() store.CommandWebhookStore
	Preference() store.PreferenceStore
	License() store.LicenseStore
	Token() store.TokenStore
	Emoji() store.EmojiStore
	Status() store.StatusStore
	FileInfo() store.FileInfoStore
	Reaction() store.ReactionStore
	Job() store.JobStore
	Plugin() store.PluginStore
	UserAccessToken() store.UserAccessTokenStore
	Role() store.RoleStore
	Scheme() store.SchemeStore
	TermsOfService() store.TermsOfServiceStore
	UserTermsOfService() store.UserTermsOfServiceStore
	LinkMetadata() store.LinkMetadataStore
	getQueryBuilder() sq.StatementBuilderType
}
