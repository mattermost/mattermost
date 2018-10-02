// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"context"
	dbsql "database/sql"
	"encoding/json"
	"errors"
	"fmt"
	sqltrace "log"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/mattermost/gorp"
	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	INDEX_TYPE_FULL_TEXT = "full_text"
	INDEX_TYPE_DEFAULT   = "default"
	DB_PING_ATTEMPTS     = 18
	DB_PING_TIMEOUT_SECS = 10
)

const (
	EXIT_GENERIC_FAILURE             = 1
	EXIT_CREATE_TABLE                = 100
	EXIT_DB_OPEN                     = 101
	EXIT_PING                        = 102
	EXIT_NO_DRIVER                   = 103
	EXIT_TABLE_EXISTS                = 104
	EXIT_TABLE_EXISTS_MYSQL          = 105
	EXIT_COLUMN_EXISTS               = 106
	EXIT_DOES_COLUMN_EXISTS_POSTGRES = 107
	EXIT_DOES_COLUMN_EXISTS_MYSQL    = 108
	EXIT_DOES_COLUMN_EXISTS_MISSING  = 109
	EXIT_CREATE_COLUMN_POSTGRES      = 110
	EXIT_CREATE_COLUMN_MYSQL         = 111
	EXIT_CREATE_COLUMN_MISSING       = 112
	EXIT_REMOVE_COLUMN               = 113
	EXIT_RENAME_COLUMN               = 114
	EXIT_MAX_COLUMN                  = 115
	EXIT_ALTER_COLUMN                = 116
	EXIT_CREATE_INDEX_POSTGRES       = 117
	EXIT_CREATE_INDEX_MYSQL          = 118
	EXIT_CREATE_INDEX_FULL_MYSQL     = 119
	EXIT_CREATE_INDEX_MISSING        = 120
	EXIT_REMOVE_INDEX_POSTGRES       = 121
	EXIT_REMOVE_INDEX_MYSQL          = 122
	EXIT_REMOVE_INDEX_MISSING        = 123
	EXIT_REMOVE_TABLE                = 134
	EXIT_CREATE_INDEX_SQLITE         = 135
	EXIT_REMOVE_INDEX_SQLITE         = 136
	EXIT_TABLE_EXISTS_SQLITE         = 137
	EXIT_DOES_COLUMN_EXISTS_SQLITE   = 138
)

type SqlSupplierOldStores struct {
	team                 store.TeamStore
	channel              store.ChannelStore
	post                 store.PostStore
	user                 store.UserStore
	audit                store.AuditStore
	cluster              store.ClusterDiscoveryStore
	compliance           store.ComplianceStore
	session              store.SessionStore
	oauth                store.OAuthStore
	system               store.SystemStore
	webhook              store.WebhookStore
	command              store.CommandStore
	commandWebhook       store.CommandWebhookStore
	preference           store.PreferenceStore
	license              store.LicenseStore
	token                store.TokenStore
	emoji                store.EmojiStore
	status               store.StatusStore
	fileInfo             store.FileInfoStore
	reaction             store.ReactionStore
	job                  store.JobStore
	userAccessToken      store.UserAccessTokenStore
	plugin               store.PluginStore
	channelMemberHistory store.ChannelMemberHistoryStore
	role                 store.RoleStore
	scheme               store.SchemeStore
	serviceTerms         store.ServiceTermsStore
}

type SqlSupplier struct {
	// rrCounter and srCounter should be kept first.
	// See https://github.com/mattermost/mattermost-server/pull/7281
	rrCounter      int64
	srCounter      int64
	next           store.LayeredStoreSupplier
	master         *gorp.DbMap
	replicas       []*gorp.DbMap
	searchReplicas []*gorp.DbMap
	oldStores      SqlSupplierOldStores
	settings       *model.SqlSettings
	lockedToMaster bool
}

func NewSqlSupplier(settings model.SqlSettings, metrics einterfaces.MetricsInterface) *SqlSupplier {
	supplier := &SqlSupplier{
		rrCounter: 0,
		srCounter: 0,
		settings:  &settings,
	}

	supplier.initConnection()

	enableExperimentalPublicChannelsMaterialization := true
	if settings.EnablePublicChannelsMaterialization != nil && !*settings.EnablePublicChannelsMaterialization {
		enableExperimentalPublicChannelsMaterialization = false
	}

	supplier.oldStores.team = NewSqlTeamStore(supplier)
	supplier.oldStores.channel = NewSqlChannelStoreExperimental(supplier, metrics, enableExperimentalPublicChannelsMaterialization)
	supplier.oldStores.post = NewSqlPostStore(supplier, metrics)
	supplier.oldStores.user = NewSqlUserStore(supplier, metrics)
	supplier.oldStores.audit = NewSqlAuditStore(supplier)
	supplier.oldStores.cluster = NewSqlClusterDiscoveryStore(supplier)
	supplier.oldStores.compliance = NewSqlComplianceStore(supplier)
	supplier.oldStores.session = NewSqlSessionStore(supplier)
	supplier.oldStores.oauth = NewSqlOAuthStore(supplier)
	supplier.oldStores.system = NewSqlSystemStore(supplier)
	supplier.oldStores.webhook = NewSqlWebhookStore(supplier, metrics)
	supplier.oldStores.command = NewSqlCommandStore(supplier)
	supplier.oldStores.commandWebhook = NewSqlCommandWebhookStore(supplier)
	supplier.oldStores.preference = NewSqlPreferenceStore(supplier)
	supplier.oldStores.license = NewSqlLicenseStore(supplier)
	supplier.oldStores.token = NewSqlTokenStore(supplier)
	supplier.oldStores.emoji = NewSqlEmojiStore(supplier, metrics)
	supplier.oldStores.status = NewSqlStatusStore(supplier)
	supplier.oldStores.fileInfo = NewSqlFileInfoStore(supplier, metrics)
	supplier.oldStores.job = NewSqlJobStore(supplier)
	supplier.oldStores.userAccessToken = NewSqlUserAccessTokenStore(supplier)
	supplier.oldStores.channelMemberHistory = NewSqlChannelMemberHistoryStore(supplier)
	supplier.oldStores.plugin = NewSqlPluginStore(supplier)
	supplier.oldStores.serviceTerms = NewSqlTermStore(supplier, metrics)

	initSqlSupplierReactions(supplier)
	initSqlSupplierRoles(supplier)
	initSqlSupplierSchemes(supplier)

	err := supplier.GetMaster().CreateTablesIfNotExists()
	if err != nil {
		mlog.Critical(fmt.Sprintf("Error creating database tables: %v", err))
		time.Sleep(time.Second)
		os.Exit(EXIT_CREATE_TABLE)
	}

	UpgradeDatabase(supplier)

	supplier.oldStores.team.(*SqlTeamStore).CreateIndexesIfNotExists()
	supplier.oldStores.channel.(*SqlChannelStoreExperimental).CreateIndexesIfNotExists()
	supplier.oldStores.post.(*SqlPostStore).CreateIndexesIfNotExists()
	supplier.oldStores.user.(*SqlUserStore).CreateIndexesIfNotExists()
	supplier.oldStores.audit.(*SqlAuditStore).CreateIndexesIfNotExists()
	supplier.oldStores.compliance.(*SqlComplianceStore).CreateIndexesIfNotExists()
	supplier.oldStores.session.(*SqlSessionStore).CreateIndexesIfNotExists()
	supplier.oldStores.oauth.(*SqlOAuthStore).CreateIndexesIfNotExists()
	supplier.oldStores.system.(*SqlSystemStore).CreateIndexesIfNotExists()
	supplier.oldStores.webhook.(*SqlWebhookStore).CreateIndexesIfNotExists()
	supplier.oldStores.command.(*SqlCommandStore).CreateIndexesIfNotExists()
	supplier.oldStores.commandWebhook.(*SqlCommandWebhookStore).CreateIndexesIfNotExists()
	supplier.oldStores.preference.(*SqlPreferenceStore).CreateIndexesIfNotExists()
	supplier.oldStores.license.(*SqlLicenseStore).CreateIndexesIfNotExists()
	supplier.oldStores.token.(*SqlTokenStore).CreateIndexesIfNotExists()
	supplier.oldStores.emoji.(*SqlEmojiStore).CreateIndexesIfNotExists()
	supplier.oldStores.status.(*SqlStatusStore).CreateIndexesIfNotExists()
	supplier.oldStores.fileInfo.(*SqlFileInfoStore).CreateIndexesIfNotExists()
	supplier.oldStores.job.(*SqlJobStore).CreateIndexesIfNotExists()
	supplier.oldStores.userAccessToken.(*SqlUserAccessTokenStore).CreateIndexesIfNotExists()
	supplier.oldStores.plugin.(*SqlPluginStore).CreateIndexesIfNotExists()
	supplier.oldStores.serviceTerms.(SqlServiceTermsStore).CreateIndexesIfNotExists()

	supplier.oldStores.preference.(*SqlPreferenceStore).DeleteUnusedFeatures()

	return supplier
}

func (s *SqlSupplier) SetChainNext(next store.LayeredStoreSupplier) {
	s.next = next
}

func (s *SqlSupplier) Next() store.LayeredStoreSupplier {
	return s.next
}

func setupConnection(con_type string, dataSource string, settings *model.SqlSettings) *gorp.DbMap {
	db, err := dbsql.Open(*settings.DriverName, dataSource)
	if err != nil {
		mlog.Critical(fmt.Sprintf("Failed to open SQL connection to err:%v", err.Error()))
		time.Sleep(time.Second)
		os.Exit(EXIT_DB_OPEN)
	}

	for i := 0; i < DB_PING_ATTEMPTS; i++ {
		mlog.Info(fmt.Sprintf("Pinging SQL %v database", con_type))
		ctx, cancel := context.WithTimeout(context.Background(), DB_PING_TIMEOUT_SECS*time.Second)
		defer cancel()
		err = db.PingContext(ctx)
		if err == nil {
			break
		} else {
			if i == DB_PING_ATTEMPTS-1 {
				mlog.Critical(fmt.Sprintf("Failed to ping DB, server will exit err=%v", err))
				time.Sleep(time.Second)
				os.Exit(EXIT_PING)
			} else {
				mlog.Error(fmt.Sprintf("Failed to ping DB retrying in %v seconds err=%v", DB_PING_TIMEOUT_SECS, err))
				time.Sleep(DB_PING_TIMEOUT_SECS * time.Second)
			}
		}
	}

	db.SetMaxIdleConns(*settings.MaxIdleConns)
	db.SetMaxOpenConns(*settings.MaxOpenConns)
	db.SetConnMaxLifetime(time.Duration(*settings.ConnMaxLifetimeMilliseconds) * time.Millisecond)

	var dbmap *gorp.DbMap

	connectionTimeout := time.Duration(*settings.QueryTimeout) * time.Second

	if *settings.DriverName == model.DATABASE_DRIVER_SQLITE {
		dbmap = &gorp.DbMap{Db: db, TypeConverter: mattermConverter{}, Dialect: gorp.SqliteDialect{}, QueryTimeout: connectionTimeout}
	} else if *settings.DriverName == model.DATABASE_DRIVER_MYSQL {
		dbmap = &gorp.DbMap{Db: db, TypeConverter: mattermConverter{}, Dialect: gorp.MySQLDialect{Engine: "InnoDB", Encoding: "UTF8MB4"}, QueryTimeout: connectionTimeout}
	} else if *settings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		dbmap = &gorp.DbMap{Db: db, TypeConverter: mattermConverter{}, Dialect: gorp.PostgresDialect{}, QueryTimeout: connectionTimeout}
	} else {
		mlog.Critical("Failed to create dialect specific driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_NO_DRIVER)
	}

	if settings.Trace {
		dbmap.TraceOn("", sqltrace.New(os.Stdout, "sql-trace:", sqltrace.Lmicroseconds))
	}

	return dbmap
}

func (s *SqlSupplier) initConnection() {
	s.master = setupConnection("master", *s.settings.DataSource, s.settings)

	if len(s.settings.DataSourceReplicas) > 0 {
		s.replicas = make([]*gorp.DbMap, len(s.settings.DataSourceReplicas))
		for i, replica := range s.settings.DataSourceReplicas {
			s.replicas[i] = setupConnection(fmt.Sprintf("replica-%v", i), replica, s.settings)
		}
	}

	if len(s.settings.DataSourceSearchReplicas) > 0 {
		s.searchReplicas = make([]*gorp.DbMap, len(s.settings.DataSourceSearchReplicas))
		for i, replica := range s.settings.DataSourceSearchReplicas {
			s.searchReplicas[i] = setupConnection(fmt.Sprintf("search-replica-%v", i), replica, s.settings)
		}
	}
}

func (ss *SqlSupplier) DriverName() string {
	return *ss.settings.DriverName
}

func (ss *SqlSupplier) GetCurrentSchemaVersion() string {
	version, _ := ss.GetMaster().SelectStr("SELECT Value FROM Systems WHERE Name='Version'")
	return version
}

func (ss *SqlSupplier) GetMaster() *gorp.DbMap {
	return ss.master
}

func (ss *SqlSupplier) GetSearchReplica() *gorp.DbMap {
	if len(ss.settings.DataSourceSearchReplicas) == 0 {
		return ss.GetReplica()
	}

	rrNum := atomic.AddInt64(&ss.srCounter, 1) % int64(len(ss.searchReplicas))
	return ss.searchReplicas[rrNum]
}

func (ss *SqlSupplier) GetReplica() *gorp.DbMap {
	if len(ss.settings.DataSourceReplicas) == 0 || ss.lockedToMaster {
		return ss.GetMaster()
	}

	rrNum := atomic.AddInt64(&ss.rrCounter, 1) % int64(len(ss.replicas))
	return ss.replicas[rrNum]
}

func (ss *SqlSupplier) TotalMasterDbConnections() int {
	return ss.GetMaster().Db.Stats().OpenConnections
}

func (ss *SqlSupplier) TotalReadDbConnections() int {
	if len(ss.settings.DataSourceReplicas) == 0 {
		return 0
	}

	count := 0
	for _, db := range ss.replicas {
		count = count + db.Db.Stats().OpenConnections
	}

	return count
}

func (ss *SqlSupplier) TotalSearchDbConnections() int {
	if len(ss.settings.DataSourceSearchReplicas) == 0 {
		return 0
	}

	count := 0
	for _, db := range ss.searchReplicas {
		count = count + db.Db.Stats().OpenConnections
	}

	return count
}

func (ss *SqlSupplier) MarkSystemRanUnitTests() {
	if result := <-ss.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		unitTests := props[model.SYSTEM_RAN_UNIT_TESTS]
		if len(unitTests) == 0 {
			systemTests := &model.System{Name: model.SYSTEM_RAN_UNIT_TESTS, Value: "1"}
			<-ss.System().Save(systemTests)
		}
	}
}

func (ss *SqlSupplier) DoesTableExist(tableName string) bool {
	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		count, err := ss.GetMaster().SelectInt(
			`SELECT count(relname) FROM pg_class WHERE relname=$1`,
			strings.ToLower(tableName),
		)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if table exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_TABLE_EXISTS)
		}

		return count > 0

	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt(
			`SELECT
		    COUNT(0) AS table_exists
			FROM
			    information_schema.TABLES
			WHERE
			    TABLE_SCHEMA = DATABASE()
			        AND TABLE_NAME = ?
		    `,
			tableName,
		)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if table exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_TABLE_EXISTS_MYSQL)
		}

		return count > 0

	} else if ss.DriverName() == model.DATABASE_DRIVER_SQLITE {
		count, err := ss.GetMaster().SelectInt(
			`SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
			tableName,
		)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if table exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_TABLE_EXISTS_SQLITE)
		}

		return count > 0

	} else {
		mlog.Critical("Failed to check if column exists because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_COLUMN_EXISTS)
		return false
	}
}

func (ss *SqlSupplier) DoesColumnExist(tableName string, columnName string) bool {
	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		count, err := ss.GetMaster().SelectInt(
			`SELECT COUNT(0)
			FROM   pg_attribute
			WHERE  attrelid = $1::regclass
			AND    attname = $2
			AND    NOT attisdropped`,
			strings.ToLower(tableName),
			strings.ToLower(columnName),
		)

		if err != nil {
			if err.Error() == "pq: relation \""+strings.ToLower(tableName)+"\" does not exist" {
				return false
			}

			mlog.Critical(fmt.Sprintf("Failed to check if column exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_DOES_COLUMN_EXISTS_POSTGRES)
		}

		return count > 0

	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt(
			`SELECT
		    COUNT(0) AS column_exists
		FROM
		    information_schema.COLUMNS
		WHERE
		    TABLE_SCHEMA = DATABASE()
		        AND TABLE_NAME = ?
		        AND COLUMN_NAME = ?`,
			tableName,
			columnName,
		)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if column exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_DOES_COLUMN_EXISTS_MYSQL)
		}

		return count > 0

	} else if ss.DriverName() == model.DATABASE_DRIVER_SQLITE {
		count, err := ss.GetMaster().SelectInt(
			`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name=?`,
			tableName,
			columnName,
		)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if column exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_DOES_COLUMN_EXISTS_SQLITE)
		}

		return count > 0

	} else {
		mlog.Critical("Failed to check if column exists because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_DOES_COLUMN_EXISTS_MISSING)
		return false
	}
}

func (ss *SqlSupplier) DoesTriggerExist(triggerName string) bool {
	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		count, err := ss.GetMaster().SelectInt(`
			SELECT
				COUNT(0)
			FROM
				pg_trigger
			WHERE
				tgname = $1
		`, triggerName)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if trigger exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_GENERIC_FAILURE)
		}

		return count > 0

	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		count, err := ss.GetMaster().SelectInt(`
			SELECT
				COUNT(0)
			FROM
				information_schema.triggers
			WHERE
				trigger_schema = DATABASE()
			AND	trigger_name = ?
		`, triggerName)

		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check if trigger exists %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_GENERIC_FAILURE)
		}

		return count > 0

	} else {
		mlog.Critical("Failed to check if column exists because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_GENERIC_FAILURE)
		return false
	}
}

func (ss *SqlSupplier) CreateColumnIfNotExists(tableName string, columnName string, mySqlColType string, postgresColType string, defaultValue string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create column %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_COLUMN_POSTGRES)
		}

		return true

	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + mySqlColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create column %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_COLUMN_MYSQL)
		}

		return true

	} else {
		mlog.Critical("Failed to create column because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_CREATE_COLUMN_MISSING)
		return false
	}
}

func (ss *SqlSupplier) CreateColumnIfNotExistsNoDefault(tableName string, columnName string, mySqlColType string, postgresColType string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create column %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_COLUMN_POSTGRES)
		}

		return true

	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + mySqlColType)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create column %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_COLUMN_MYSQL)
		}

		return true

	} else {
		mlog.Critical("Failed to create column because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_CREATE_COLUMN_MISSING)
		return false
	}
}

func (ss *SqlSupplier) RemoveColumnIfExists(tableName string, columnName string) bool {

	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " DROP COLUMN " + columnName)
	if err != nil {
		mlog.Critical(fmt.Sprintf("Failed to drop column %v", err))
		time.Sleep(time.Second)
		os.Exit(EXIT_REMOVE_COLUMN)
	}

	return true
}

func (ss *SqlSupplier) RemoveTableIfExists(tableName string) bool {
	if !ss.DoesTableExist(tableName) {
		return false
	}

	_, err := ss.GetMaster().ExecNoTimeout("DROP TABLE " + tableName)
	if err != nil {
		mlog.Critical(fmt.Sprintf("Failed to drop table %v", err))
		time.Sleep(time.Second)
		os.Exit(EXIT_REMOVE_TABLE)
	}

	return true
}

func (ss *SqlSupplier) RenameColumnIfExists(tableName string, oldColumnName string, newColumnName string, colType string) bool {
	if !ss.DoesColumnExist(tableName, oldColumnName) {
		return false
	}

	var err error
	if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " CHANGE " + oldColumnName + " " + newColumnName + " " + colType)
	} else if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " RENAME COLUMN " + oldColumnName + " TO " + newColumnName)
	}

	if err != nil {
		mlog.Critical(fmt.Sprintf("Failed to rename column %v", err))
		time.Sleep(time.Second)
		os.Exit(EXIT_RENAME_COLUMN)
	}

	return true
}

func (ss *SqlSupplier) GetMaxLengthOfColumnIfExists(tableName string, columnName string) string {
	if !ss.DoesColumnExist(tableName, columnName) {
		return ""
	}

	var result string
	var err error
	if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		result, err = ss.GetMaster().SelectStr("SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE table_name = '" + tableName + "' AND COLUMN_NAME = '" + columnName + "'")
	} else if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		result, err = ss.GetMaster().SelectStr("SELECT character_maximum_length FROM information_schema.columns WHERE table_name = '" + strings.ToLower(tableName) + "' AND column_name = '" + strings.ToLower(columnName) + "'")
	}

	if err != nil {
		mlog.Critical(fmt.Sprintf("Failed to get max length of column %v", err))
		time.Sleep(time.Second)
		os.Exit(EXIT_MAX_COLUMN)
	}

	return result
}

func (ss *SqlSupplier) AlterColumnTypeIfExists(tableName string, columnName string, mySqlColType string, postgresColType string) bool {
	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	var err error
	if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {
		_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " MODIFY " + columnName + " " + mySqlColType)
	} else if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + strings.ToLower(tableName) + " ALTER COLUMN " + strings.ToLower(columnName) + " TYPE " + postgresColType)
	}

	if err != nil {
		mlog.Critical(fmt.Sprintf("Failed to alter column type %v", err))
		time.Sleep(time.Second)
		os.Exit(EXIT_ALTER_COLUMN)
	}

	return true
}

func (ss *SqlSupplier) CreateUniqueIndexIfNotExists(indexName string, tableName string, columnName string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, []string{columnName}, INDEX_TYPE_DEFAULT, true)
}

func (ss *SqlSupplier) CreateIndexIfNotExists(indexName string, tableName string, columnName string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, []string{columnName}, INDEX_TYPE_DEFAULT, false)
}

func (ss *SqlSupplier) CreateCompositeIndexIfNotExists(indexName string, tableName string, columnNames []string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, columnNames, INDEX_TYPE_DEFAULT, false)
}

func (ss *SqlSupplier) CreateFullTextIndexIfNotExists(indexName string, tableName string, columnName string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, []string{columnName}, INDEX_TYPE_FULL_TEXT, false)
}

func (ss *SqlSupplier) createIndexIfNotExists(indexName string, tableName string, columnNames []string, indexType string, unique bool) bool {

	uniqueStr := ""
	if unique {
		uniqueStr = "UNIQUE "
	}

	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, errExists := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
		// It should fail if the index does not exist
		if errExists == nil {
			return false
		}

		query := ""
		if indexType == INDEX_TYPE_FULL_TEXT {
			if len(columnNames) != 1 {
				mlog.Critical("Unable to create multi column full text index")
				os.Exit(EXIT_CREATE_INDEX_POSTGRES)
			}
			columnName := columnNames[0]
			postgresColumnNames := convertMySQLFullTextColumnsToPostgres(columnName)
			query = "CREATE INDEX " + indexName + " ON " + tableName + " USING gin(to_tsvector('english', " + postgresColumnNames + "))"
		} else {
			query = "CREATE " + uniqueStr + "INDEX " + indexName + " ON " + tableName + " (" + strings.Join(columnNames, ", ") + ")"
		}

		_, err := ss.GetMaster().ExecNoTimeout(query)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create index %v, %v", errExists, err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_INDEX_POSTGRES)
		}
	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", tableName, indexName)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_INDEX_MYSQL)
		}

		if count > 0 {
			return false
		}

		fullTextIndex := ""
		if indexType == INDEX_TYPE_FULL_TEXT {
			fullTextIndex = " FULLTEXT "
		}

		_, err = ss.GetMaster().ExecNoTimeout("CREATE  " + uniqueStr + fullTextIndex + " INDEX " + indexName + " ON " + tableName + " (" + strings.Join(columnNames, ", ") + ")")
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_INDEX_FULL_MYSQL)
		}
	} else if ss.DriverName() == model.DATABASE_DRIVER_SQLITE {
		_, err := ss.GetMaster().ExecNoTimeout("CREATE INDEX IF NOT EXISTS " + indexName + " ON " + tableName + " (" + strings.Join(columnNames, ", ") + ")")
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to create index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_CREATE_INDEX_SQLITE)
		}
	} else {
		mlog.Critical("Failed to create index because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_CREATE_INDEX_MISSING)
	}

	return true
}

func (ss *SqlSupplier) RemoveIndexIfExists(indexName string, tableName string) bool {

	if ss.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
		// It should fail if the index does not exist
		if err != nil {
			return false
		}

		_, err = ss.GetMaster().ExecNoTimeout("DROP INDEX " + indexName)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to remove index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_REMOVE_INDEX_POSTGRES)
		}

		return true
	} else if ss.DriverName() == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", tableName, indexName)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to check index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_REMOVE_INDEX_MYSQL)
		}

		if count <= 0 {
			return false
		}

		_, err = ss.GetMaster().ExecNoTimeout("DROP INDEX " + indexName + " ON " + tableName)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to remove index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_REMOVE_INDEX_MYSQL)
		}
	} else if ss.DriverName() == model.DATABASE_DRIVER_SQLITE {
		_, err := ss.GetMaster().ExecNoTimeout("DROP INDEX IF EXISTS " + indexName)
		if err != nil {
			mlog.Critical(fmt.Sprintf("Failed to remove index %v", err))
			time.Sleep(time.Second)
			os.Exit(EXIT_REMOVE_INDEX_SQLITE)
		}
	} else {
		mlog.Critical("Failed to create index because of missing driver")
		time.Sleep(time.Second)
		os.Exit(EXIT_REMOVE_INDEX_MISSING)
	}

	return true
}

func IsUniqueConstraintError(err error, indexName []string) bool {
	unique := false
	if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
		unique = true
	}

	if mysqlErr, ok := err.(*mysql.MySQLError); ok && mysqlErr.Number == 1062 {
		unique = true
	}

	field := false
	for _, contain := range indexName {
		if strings.Contains(err.Error(), contain) {
			field = true
			break
		}
	}

	return unique && field
}

func (ss *SqlSupplier) GetAllConns() []*gorp.DbMap {
	all := make([]*gorp.DbMap, len(ss.replicas)+1)
	copy(all, ss.replicas)
	all[len(ss.replicas)] = ss.master
	return all
}

func (ss *SqlSupplier) Close() {
	mlog.Info("Closing SqlStore")
	ss.master.Db.Close()
	for _, replica := range ss.replicas {
		replica.Db.Close()
	}
}

func (ss *SqlSupplier) LockToMaster() {
	ss.lockedToMaster = true
}

func (ss *SqlSupplier) UnlockFromMaster() {
	ss.lockedToMaster = false
}

func (ss *SqlSupplier) Team() store.TeamStore {
	return ss.oldStores.team
}

func (ss *SqlSupplier) Channel() store.ChannelStore {
	return ss.oldStores.channel
}

func (ss *SqlSupplier) Post() store.PostStore {
	return ss.oldStores.post
}

func (ss *SqlSupplier) User() store.UserStore {
	return ss.oldStores.user
}

func (ss *SqlSupplier) Session() store.SessionStore {
	return ss.oldStores.session
}

func (ss *SqlSupplier) Audit() store.AuditStore {
	return ss.oldStores.audit
}

func (ss *SqlSupplier) ClusterDiscovery() store.ClusterDiscoveryStore {
	return ss.oldStores.cluster
}

func (ss *SqlSupplier) Compliance() store.ComplianceStore {
	return ss.oldStores.compliance
}

func (ss *SqlSupplier) OAuth() store.OAuthStore {
	return ss.oldStores.oauth
}

func (ss *SqlSupplier) System() store.SystemStore {
	return ss.oldStores.system
}

func (ss *SqlSupplier) Webhook() store.WebhookStore {
	return ss.oldStores.webhook
}

func (ss *SqlSupplier) Command() store.CommandStore {
	return ss.oldStores.command
}

func (ss *SqlSupplier) CommandWebhook() store.CommandWebhookStore {
	return ss.oldStores.commandWebhook
}

func (ss *SqlSupplier) Preference() store.PreferenceStore {
	return ss.oldStores.preference
}

func (ss *SqlSupplier) License() store.LicenseStore {
	return ss.oldStores.license
}

func (ss *SqlSupplier) Token() store.TokenStore {
	return ss.oldStores.token
}

func (ss *SqlSupplier) Emoji() store.EmojiStore {
	return ss.oldStores.emoji
}

func (ss *SqlSupplier) Status() store.StatusStore {
	return ss.oldStores.status
}

func (ss *SqlSupplier) FileInfo() store.FileInfoStore {
	return ss.oldStores.fileInfo
}

func (ss *SqlSupplier) Reaction() store.ReactionStore {
	return ss.oldStores.reaction
}

func (ss *SqlSupplier) Job() store.JobStore {
	return ss.oldStores.job
}

func (ss *SqlSupplier) UserAccessToken() store.UserAccessTokenStore {
	return ss.oldStores.userAccessToken
}

func (ss *SqlSupplier) ChannelMemberHistory() store.ChannelMemberHistoryStore {
	return ss.oldStores.channelMemberHistory
}

func (ss *SqlSupplier) Plugin() store.PluginStore {
	return ss.oldStores.plugin
}

func (ss *SqlSupplier) Role() store.RoleStore {
	return ss.oldStores.role
}

func (ss *SqlSupplier) ServiceTerms() store.ServiceTermsStore {
	return ss.oldStores.serviceTerms
}

func (ss *SqlSupplier) Scheme() store.SchemeStore {
	return ss.oldStores.scheme
}

func (ss *SqlSupplier) DropAllTables() {
	ss.master.TruncateTables()
}

type mattermConverter struct{}

func (me mattermConverter) ToDb(val interface{}) (interface{}, error) {

	switch t := val.(type) {
	case model.StringMap:
		return model.MapToJson(t), nil
	case map[string]string:
		return model.MapToJson(model.StringMap(t)), nil
	case model.StringArray:
		return model.ArrayToJson(t), nil
	case model.StringInterface:
		return model.StringInterfaceToJson(t), nil
	case map[string]interface{}:
		return model.StringInterfaceToJson(model.StringInterface(t)), nil
	}

	return val, nil
}

func (me mattermConverter) FromDb(target interface{}) (gorp.CustomScanner, bool) {
	switch target.(type) {
	case *model.StringMap:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_map"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *map[string]string:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_map"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *model.StringArray:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_array"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *model.StringInterface:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_interface"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	case *map[string]interface{}:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_interface"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{Holder: new(string), Target: target, Binder: binder}, true
	}

	return gorp.CustomScanner{}, false
}

func convertMySQLFullTextColumnsToPostgres(columnNames string) string {
	columns := strings.Split(columnNames, ", ")
	concatenatedColumnNames := ""
	for i, c := range columns {
		concatenatedColumnNames += c
		if i < len(columns)-1 {
			concatenatedColumnNames += " || ' ' || "
		}
	}

	return concatenatedColumnNames
}
