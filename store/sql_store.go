// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	crand "crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	dbsql "database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"io"
	sqltrace "log"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/go-gorp/gorp"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	INDEX_TYPE_FULL_TEXT = "full_text"
	INDEX_TYPE_DEFAULT   = "default"
)

type SqlStore struct {
	master        *gorp.DbMap
	replicas      []*gorp.DbMap
	team          TeamStore
	channel       ChannelStore
	post          PostStore
	user          UserStore
	audit         AuditStore
	compliance    ComplianceStore
	session       SessionStore
	oauth         OAuthStore
	system        SystemStore
	webhook       WebhookStore
	command       CommandStore
	preference    PreferenceStore
	license       LicenseStore
	recovery      PasswordRecoveryStore
	emoji         EmojiStore
	status        StatusStore
	SchemaVersion string
}

func initConnection() *SqlStore {
	sqlStore := &SqlStore{}

	sqlStore.master = setupConnection("master", utils.Cfg.SqlSettings.DriverName,
		utils.Cfg.SqlSettings.DataSource, utils.Cfg.SqlSettings.MaxIdleConns,
		utils.Cfg.SqlSettings.MaxOpenConns, utils.Cfg.SqlSettings.Trace)

	if len(utils.Cfg.SqlSettings.DataSourceReplicas) == 0 {
		sqlStore.replicas = make([]*gorp.DbMap, 1)
		sqlStore.replicas[0] = setupConnection(fmt.Sprintf("replica-%v", 0), utils.Cfg.SqlSettings.DriverName, utils.Cfg.SqlSettings.DataSource,
			utils.Cfg.SqlSettings.MaxIdleConns, utils.Cfg.SqlSettings.MaxOpenConns,
			utils.Cfg.SqlSettings.Trace)
	} else {
		sqlStore.replicas = make([]*gorp.DbMap, len(utils.Cfg.SqlSettings.DataSourceReplicas))
		for i, replica := range utils.Cfg.SqlSettings.DataSourceReplicas {
			sqlStore.replicas[i] = setupConnection(fmt.Sprintf("replica-%v", i), utils.Cfg.SqlSettings.DriverName, replica,
				utils.Cfg.SqlSettings.MaxIdleConns, utils.Cfg.SqlSettings.MaxOpenConns,
				utils.Cfg.SqlSettings.Trace)
		}
	}

	sqlStore.SchemaVersion = sqlStore.GetCurrentSchemaVersion()
	return sqlStore
}

func NewSqlStore() Store {

	sqlStore := initConnection()

	// If the version is already set then we are potentially in an 'upgrade needed' state
	if sqlStore.SchemaVersion != "" {
		// Check to see if it's the most current database schema version
		if !model.IsCurrentVersion(sqlStore.SchemaVersion) {
			// If we are upgrading from the previous version then print a warning and continue
			if model.IsPreviousVersionsSupported(sqlStore.SchemaVersion) {
				l4g.Warn(utils.T("store.sql.schema_out_of_date.warn"), sqlStore.SchemaVersion)
				l4g.Warn(utils.T("store.sql.schema_upgrade_attempt.warn"), model.CurrentVersion)
			} else {
				// If this is an 'upgrade needed' state but the user is attempting to skip a version then halt the world
				l4g.Critical(utils.T("store.sql.schema_version.critical"), sqlStore.SchemaVersion)
				time.Sleep(time.Second)
				panic(fmt.Sprintf(utils.T("store.sql.schema_version.critical"), sqlStore.SchemaVersion))
			}
		}
	}

	// This is a special case for upgrading the schema to the 3.0 user model
	// ADDED for 3.0 REMOVE for 3.4
	if sqlStore.SchemaVersion == "2.2.0" ||
		sqlStore.SchemaVersion == "2.1.0" ||
		sqlStore.SchemaVersion == "2.0.0" {
		l4g.Critical("The database version of %v cannot be automatically upgraded to 3.0 schema", sqlStore.SchemaVersion)
		l4g.Critical("You will need to run the command line tool './platform -upgrade_db_30'")
		l4g.Critical("Please see 'http://www.mattermost.org/upgrade-to-3-0/' for more information on how to upgrade.")
		time.Sleep(time.Second)
		os.Exit(1)
	}

	sqlStore.team = NewSqlTeamStore(sqlStore)
	sqlStore.channel = NewSqlChannelStore(sqlStore)
	sqlStore.post = NewSqlPostStore(sqlStore)
	sqlStore.user = NewSqlUserStore(sqlStore)
	sqlStore.audit = NewSqlAuditStore(sqlStore)
	sqlStore.compliance = NewSqlComplianceStore(sqlStore)
	sqlStore.session = NewSqlSessionStore(sqlStore)
	sqlStore.oauth = NewSqlOAuthStore(sqlStore)
	sqlStore.system = NewSqlSystemStore(sqlStore)
	sqlStore.webhook = NewSqlWebhookStore(sqlStore)
	sqlStore.command = NewSqlCommandStore(sqlStore)
	sqlStore.preference = NewSqlPreferenceStore(sqlStore)
	sqlStore.license = NewSqlLicenseStore(sqlStore)
	sqlStore.recovery = NewSqlPasswordRecoveryStore(sqlStore)
	sqlStore.emoji = NewSqlEmojiStore(sqlStore)
	sqlStore.status = NewSqlStatusStore(sqlStore)

	err := sqlStore.master.CreateTablesIfNotExists()
	if err != nil {
		l4g.Critical(utils.T("store.sql.creating_tables.critical"), err)
		time.Sleep(time.Second)
		os.Exit(1)
	}

	sqlStore.team.(*SqlTeamStore).UpgradeSchemaIfNeeded()
	sqlStore.channel.(*SqlChannelStore).UpgradeSchemaIfNeeded()
	sqlStore.post.(*SqlPostStore).UpgradeSchemaIfNeeded()
	sqlStore.user.(*SqlUserStore).UpgradeSchemaIfNeeded()
	sqlStore.audit.(*SqlAuditStore).UpgradeSchemaIfNeeded()
	sqlStore.compliance.(*SqlComplianceStore).UpgradeSchemaIfNeeded()
	sqlStore.session.(*SqlSessionStore).UpgradeSchemaIfNeeded()
	sqlStore.oauth.(*SqlOAuthStore).UpgradeSchemaIfNeeded()
	sqlStore.system.(*SqlSystemStore).UpgradeSchemaIfNeeded()
	sqlStore.webhook.(*SqlWebhookStore).UpgradeSchemaIfNeeded()
	sqlStore.command.(*SqlCommandStore).UpgradeSchemaIfNeeded()
	sqlStore.preference.(*SqlPreferenceStore).UpgradeSchemaIfNeeded()
	sqlStore.license.(*SqlLicenseStore).UpgradeSchemaIfNeeded()
	sqlStore.recovery.(*SqlPasswordRecoveryStore).UpgradeSchemaIfNeeded()
	sqlStore.emoji.(*SqlEmojiStore).UpgradeSchemaIfNeeded()
	sqlStore.status.(*SqlStatusStore).UpgradeSchemaIfNeeded()

	sqlStore.team.(*SqlTeamStore).CreateIndexesIfNotExists()
	sqlStore.channel.(*SqlChannelStore).CreateIndexesIfNotExists()
	sqlStore.post.(*SqlPostStore).CreateIndexesIfNotExists()
	sqlStore.user.(*SqlUserStore).CreateIndexesIfNotExists()
	sqlStore.audit.(*SqlAuditStore).CreateIndexesIfNotExists()
	sqlStore.compliance.(*SqlComplianceStore).CreateIndexesIfNotExists()
	sqlStore.session.(*SqlSessionStore).CreateIndexesIfNotExists()
	sqlStore.oauth.(*SqlOAuthStore).CreateIndexesIfNotExists()
	sqlStore.system.(*SqlSystemStore).CreateIndexesIfNotExists()
	sqlStore.webhook.(*SqlWebhookStore).CreateIndexesIfNotExists()
	sqlStore.command.(*SqlCommandStore).CreateIndexesIfNotExists()
	sqlStore.preference.(*SqlPreferenceStore).CreateIndexesIfNotExists()
	sqlStore.license.(*SqlLicenseStore).CreateIndexesIfNotExists()
	sqlStore.recovery.(*SqlPasswordRecoveryStore).CreateIndexesIfNotExists()
	sqlStore.emoji.(*SqlEmojiStore).CreateIndexesIfNotExists()
	sqlStore.status.(*SqlStatusStore).CreateIndexesIfNotExists()

	sqlStore.preference.(*SqlPreferenceStore).DeleteUnusedFeatures()

	if model.IsPreviousVersionsSupported(sqlStore.SchemaVersion) && !model.IsCurrentVersion(sqlStore.SchemaVersion) {
		sqlStore.system.Update(&model.System{Name: "Version", Value: model.CurrentVersion})
		sqlStore.SchemaVersion = model.CurrentVersion
		l4g.Warn(utils.T("store.sql.upgraded.warn"), model.CurrentVersion)
	}

	if sqlStore.SchemaVersion == "" {
		sqlStore.system.Save(&model.System{Name: "Version", Value: model.CurrentVersion})
		sqlStore.SchemaVersion = model.CurrentVersion
		l4g.Info(utils.T("store.sql.schema_set.info"), model.CurrentVersion)
	}

	return sqlStore
}

// ADDED for 3.0 REMOVE for 3.4
// This is a special case for upgrading the schema to the 3.0 user model
func NewSqlStoreForUpgrade30() *SqlStore {
	sqlStore := initConnection()

	sqlStore.team = NewSqlTeamStore(sqlStore)
	sqlStore.user = NewSqlUserStore(sqlStore)
	sqlStore.system = NewSqlSystemStore(sqlStore)

	err := sqlStore.master.CreateTablesIfNotExists()
	if err != nil {
		l4g.Critical(utils.T("store.sql.creating_tables.critical"), err)
		time.Sleep(time.Second)
		os.Exit(1)
	}

	return sqlStore
}

func setupConnection(con_type string, driver string, dataSource string, maxIdle int, maxOpen int, trace bool) *gorp.DbMap {

	db, err := dbsql.Open(driver, dataSource)
	if err != nil {
		l4g.Critical(utils.T("store.sql.open_conn.critical"), err)
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.open_conn.critical"), err.Error()))
	}

	l4g.Info(utils.T("store.sql.pinging.info"), con_type)
	err = db.Ping()
	if err != nil {
		l4g.Critical(utils.T("store.sql.ping.critical"), err)
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.open_conn.panic"), err.Error()))
	}

	db.SetMaxIdleConns(maxIdle)
	db.SetMaxOpenConns(maxOpen)

	var dbmap *gorp.DbMap

	if driver == "sqlite3" {
		dbmap = &gorp.DbMap{Db: db, TypeConverter: mattermConverter{}, Dialect: gorp.SqliteDialect{}}
	} else if driver == model.DATABASE_DRIVER_MYSQL {
		dbmap = &gorp.DbMap{Db: db, TypeConverter: mattermConverter{}, Dialect: gorp.MySQLDialect{Engine: "InnoDB", Encoding: "UTF8MB4"}}
	} else if driver == model.DATABASE_DRIVER_POSTGRES {
		dbmap = &gorp.DbMap{Db: db, TypeConverter: mattermConverter{}, Dialect: gorp.PostgresDialect{}}
	} else {
		l4g.Critical(utils.T("store.sql.dialect_driver.critical"))
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.dialect_driver.panic"), err.Error()))
	}

	if trace {
		dbmap.TraceOn("", sqltrace.New(os.Stdout, "sql-trace:", sqltrace.Lmicroseconds))
	}

	return dbmap
}

func (ss SqlStore) GetCurrentSchemaVersion() string {
	version, _ := ss.GetMaster().SelectStr("SELECT Value FROM Systems WHERE Name='Version'")
	return version
}

func (ss SqlStore) MarkSystemRanUnitTests() {
	if result := <-ss.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		unitTests := props[model.SYSTEM_RAN_UNIT_TESTS]
		if len(unitTests) == 0 {
			systemTests := &model.System{Name: model.SYSTEM_RAN_UNIT_TESTS, Value: "1"}
			<-ss.System().Save(systemTests)
		}
	}
}

func (ss SqlStore) DoesTableExist(tableName string) bool {
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		count, err := ss.GetMaster().SelectInt(
			`SELECT count(relname) FROM pg_class WHERE relname=$1`,
			strings.ToLower(tableName),
		)

		if err != nil {
			l4g.Critical(utils.T("store.sql.table_exists.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.table_exists.critical"), err.Error()))
		}

		return count > 0

	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {

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
			l4g.Critical(utils.T("store.sql.table_exists.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.table_exists.critical"), err.Error()))
		}

		return count > 0

	} else {
		l4g.Critical(utils.T("store.sql.column_exists_missing_driver.critical"))
		time.Sleep(time.Second)
		panic(utils.T("store.sql.column_exists_missing_driver.critical"))
	}

}

func (ss SqlStore) DoesColumnExist(tableName string, columnName string) bool {
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
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

			l4g.Critical(utils.T("store.sql.column_exists.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.column_exists.critical"), err.Error()))
		}

		return count > 0

	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {

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
			l4g.Critical(utils.T("store.sql.column_exists.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.column_exists.critical"), err.Error()))
		}

		return count > 0

	} else {
		l4g.Critical(utils.T("store.sql.column_exists_missing_driver.critical"))
		time.Sleep(time.Second)
		panic(utils.T("store.sql.column_exists_missing_driver.critical"))
	}

}

func (ss SqlStore) CreateColumnIfNotExists(tableName string, columnName string, mySqlColType string, postgresColType string, defaultValue string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			l4g.Critical(utils.T("store.sql.create_column.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.create_column.critical"), err.Error()))
		}

		return true

	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " ADD " + columnName + " " + mySqlColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			l4g.Critical(utils.T("store.sql.create_column.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.create_column.critical"), err.Error()))
		}

		return true

	} else {
		l4g.Critical(utils.T("store.sql.create_column_missing_driver.critical"))
		time.Sleep(time.Second)
		panic(utils.T("store.sql.create_column_missing_driver.critical"))
	}
}

func (ss SqlStore) RemoveColumnIfExists(tableName string, columnName string) bool {

	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " DROP COLUMN " + columnName)
	if err != nil {
		l4g.Critical(utils.T("store.sql.drop_column.critical"), err)
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.drop_column.critical"), err.Error()))
	}

	return true
}

func (ss SqlStore) RenameColumnIfExists(tableName string, oldColumnName string, newColumnName string, colType string) bool {
	if !ss.DoesColumnExist(tableName, oldColumnName) {
		return false
	}

	var err error
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		_, err = ss.GetMaster().Exec("ALTER TABLE " + tableName + " CHANGE " + oldColumnName + " " + newColumnName + " " + colType)
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err = ss.GetMaster().Exec("ALTER TABLE " + tableName + " RENAME COLUMN " + oldColumnName + " TO " + newColumnName)
	}

	if err != nil {
		l4g.Critical(utils.T("store.sql.rename_column.critical"), err)
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.rename_column.critical"), err.Error()))
	}

	return true
}

func (ss SqlStore) GetMaxLengthOfColumnIfExists(tableName string, columnName string) string {
	if !ss.DoesColumnExist(tableName, columnName) {
		return ""
	}

	var result string
	var err error
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		result, err = ss.GetMaster().SelectStr("SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE table_name = '" + tableName + "' AND COLUMN_NAME = '" + columnName + "'")
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		result, err = ss.GetMaster().SelectStr("SELECT character_maximum_length FROM information_schema.columns WHERE table_name = '" + strings.ToLower(tableName) + "' AND column_name = '" + strings.ToLower(columnName) + "'")
	}

	if err != nil {
		l4g.Critical(utils.T("store.sql.maxlength_column.critical"), err)
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.maxlength_column.critical"), err.Error()))
	}

	return result
}

func (ss SqlStore) AlterColumnTypeIfExists(tableName string, columnName string, mySqlColType string, postgresColType string) bool {
	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	var err error
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		_, err = ss.GetMaster().Exec("ALTER TABLE " + tableName + " MODIFY " + columnName + " " + mySqlColType)
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err = ss.GetMaster().Exec("ALTER TABLE " + strings.ToLower(tableName) + " ALTER COLUMN " + strings.ToLower(columnName) + " TYPE " + postgresColType)
	}

	if err != nil {
		l4g.Critical(utils.T("store.sql.alter_column_type.critical"), err)
		time.Sleep(time.Second)
		panic(fmt.Sprintf(utils.T("store.sql.alter_column_type.critical"), err.Error()))
	}

	return true
}

func (ss SqlStore) CreateUniqueIndexIfNotExists(indexName string, tableName string, columnName string) {
	ss.createIndexIfNotExists(indexName, tableName, columnName, INDEX_TYPE_DEFAULT, true)
}

func (ss SqlStore) CreateIndexIfNotExists(indexName string, tableName string, columnName string) {
	ss.createIndexIfNotExists(indexName, tableName, columnName, INDEX_TYPE_DEFAULT, false)
}

func (ss SqlStore) CreateFullTextIndexIfNotExists(indexName string, tableName string, columnName string) {
	ss.createIndexIfNotExists(indexName, tableName, columnName, INDEX_TYPE_FULL_TEXT, false)
}

func (ss SqlStore) createIndexIfNotExists(indexName string, tableName string, columnName string, indexType string, unique bool) {

	uniqueStr := ""
	if unique {
		uniqueStr = "UNIQUE "
	}

	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
		// It should fail if the index does not exist
		if err == nil {
			return
		}

		query := ""
		if indexType == INDEX_TYPE_FULL_TEXT {
			query = "CREATE INDEX " + indexName + " ON " + tableName + " USING gin(to_tsvector('english', " + columnName + "))"
		} else {
			query = "CREATE " + uniqueStr + "INDEX " + indexName + " ON " + tableName + " (" + columnName + ")"
		}

		_, err = ss.GetMaster().Exec(query)
		if err != nil {
			l4g.Critical(utils.T("store.sql.create_index.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.create_index.critical"), err.Error()))
		}
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", tableName, indexName)
		if err != nil {
			l4g.Critical(utils.T("store.sql.check_index.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.check_index.critical"), err.Error()))
		}

		if count > 0 {
			return
		}

		fullTextIndex := ""
		if indexType == INDEX_TYPE_FULL_TEXT {
			fullTextIndex = " FULLTEXT "
		}

		_, err = ss.GetMaster().Exec("CREATE  " + uniqueStr + fullTextIndex + " INDEX " + indexName + " ON " + tableName + " (" + columnName + ")")
		if err != nil {
			l4g.Critical(utils.T("store.sql.create_index.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.create_index.critical"), err.Error()))
		}
	} else {
		l4g.Critical(utils.T("store.sql.create_index_missing_driver.critical"))
		time.Sleep(time.Second)
		panic(utils.T("store.sql.create_index_missing_driver.critical"))
	}
}

func (ss SqlStore) RemoveIndexIfExists(indexName string, tableName string) {

	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
		// It should fail if the index does not exist
		if err == nil {
			return
		}

		_, err = ss.GetMaster().Exec("DROP INDEX " + indexName)
		if err != nil {
			l4g.Critical(utils.T("store.sql.remove_index.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.remove_index.critical"), err.Error()))
		}
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", tableName, indexName)
		if err != nil {
			l4g.Critical(utils.T("store.sql.check_index.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.check_index.critical"), err.Error()))
		}

		if count > 0 {
			return
		}

		_, err = ss.GetMaster().Exec("DROP INDEX " + indexName + " ON " + tableName)
		if err != nil {
			l4g.Critical(utils.T("store.sql.remove_index.critical"), err)
			time.Sleep(time.Second)
			panic(fmt.Sprintf(utils.T("store.sql.remove_index.critical"), err.Error()))
		}
	} else {
		l4g.Critical(utils.T("store.sql.create_index_missing_driver.critical"))
		time.Sleep(time.Second)
		panic(utils.T("store.sql.create_index_missing_driver.critical"))
	}
}

func IsUniqueConstraintError(err string, indexName []string) bool {
	unique := strings.Contains(err, "unique constraint") || strings.Contains(err, "Duplicate entry")
	field := false
	for _, contain := range indexName {
		if strings.Contains(err, contain) {
			field = true
			break
		}
	}

	return unique && field
}

// func (ss SqlStore) GetColumnDataType(tableName, columnName string) string {
// 	dataType, err := ss.GetMaster().SelectStr("SELECT data_type FROM INFORMATION_SCHEMA.COLUMNS where table_name = :Tablename AND column_name = :Columnname", map[string]interface{}{
// 		"Tablename":  tableName,
// 		"Columnname": columnName,
// 	})
// 	if err != nil {
// 		l4g.Critical(utils.T("store.sql.table_column_type.critical"), columnName, tableName, err.Error())
// 		time.Sleep(time.Second)
// 		panic(fmt.Sprintf(utils.T("store.sql.table_column_type.critical"), columnName, tableName, err.Error()))
// 	}

// 	return dataType
// }

func (ss SqlStore) GetMaster() *gorp.DbMap {
	return ss.master
}

func (ss SqlStore) GetReplica() *gorp.DbMap {
	return ss.replicas[rand.Intn(len(ss.replicas))]
}

func (ss SqlStore) GetAllConns() []*gorp.DbMap {
	all := make([]*gorp.DbMap, len(ss.replicas)+1)
	copy(all, ss.replicas)
	all[len(ss.replicas)] = ss.master
	return all
}

func (ss SqlStore) Close() {
	l4g.Info(utils.T("store.sql.closing.info"))
	ss.master.Db.Close()
	for _, replica := range ss.replicas {
		replica.Db.Close()
	}
}

func (ss SqlStore) Team() TeamStore {
	return ss.team
}

func (ss SqlStore) Channel() ChannelStore {
	return ss.channel
}

func (ss SqlStore) Post() PostStore {
	return ss.post
}

func (ss SqlStore) User() UserStore {
	return ss.user
}

func (ss SqlStore) Session() SessionStore {
	return ss.session
}

func (ss SqlStore) Audit() AuditStore {
	return ss.audit
}

func (ss SqlStore) Compliance() ComplianceStore {
	return ss.compliance
}

func (ss SqlStore) OAuth() OAuthStore {
	return ss.oauth
}

func (ss SqlStore) System() SystemStore {
	return ss.system
}

func (ss SqlStore) Webhook() WebhookStore {
	return ss.webhook
}

func (ss SqlStore) Command() CommandStore {
	return ss.command
}

func (ss SqlStore) Preference() PreferenceStore {
	return ss.preference
}

func (ss SqlStore) License() LicenseStore {
	return ss.license
}

func (ss SqlStore) PasswordRecovery() PasswordRecoveryStore {
	return ss.recovery
}

func (ss SqlStore) Emoji() EmojiStore {
	return ss.emoji
}

func (ss SqlStore) Status() StatusStore {
	return ss.status
}

func (ss SqlStore) DropAllTables() {
	ss.master.TruncateTables()
}

type mattermConverter struct{}

func (me mattermConverter) ToDb(val interface{}) (interface{}, error) {

	switch t := val.(type) {
	case model.StringMap:
		return model.MapToJson(t), nil
	case model.StringArray:
		return model.ArrayToJson(t), nil
	case model.EncryptStringMap:
		return encrypt([]byte(utils.Cfg.SqlSettings.AtRestEncryptKey), model.MapToJson(t))
	case model.StringInterface:
		return model.StringInterfaceToJson(t), nil
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
		return gorp.CustomScanner{new(string), target, binder}, true
	case *model.StringArray:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_array"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	case *model.EncryptStringMap:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_encrypt_string_map"))
			}

			ue, err := decrypt([]byte(utils.Cfg.SqlSettings.AtRestEncryptKey), *s)
			if err != nil {
				return err
			}

			b := []byte(ue)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	case *model.StringInterface:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New(utils.T("store.sql.convert_string_interface"))
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	}

	return gorp.CustomScanner{}, false
}

func encrypt(key []byte, text string) (string, error) {

	if text == "" || text == "{}" {
		return "", nil
	}

	plaintext := []byte(text)
	skey := sha512.Sum512(key)
	ekey, akey := skey[:32], skey[32:]

	block, err := aes.NewCipher(ekey)
	if err != nil {
		return "", err
	}

	macfn := hmac.New(sha256.New, akey)
	ciphertext := make([]byte, aes.BlockSize+macfn.Size()+len(plaintext))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(crand.Reader, iv); err != nil {
		return "", err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize+macfn.Size():], plaintext)
	macfn.Write(ciphertext[aes.BlockSize+macfn.Size():])
	mac := macfn.Sum(nil)
	copy(ciphertext[aes.BlockSize:aes.BlockSize+macfn.Size()], mac)

	return base64.URLEncoding.EncodeToString(ciphertext), nil
}

func decrypt(key []byte, cryptoText string) (string, error) {

	if cryptoText == "" || cryptoText == "{}" {
		return "{}", nil
	}

	ciphertext, err := base64.URLEncoding.DecodeString(cryptoText)
	if err != nil {
		return "", err
	}

	skey := sha512.Sum512(key)
	ekey, akey := skey[:32], skey[32:]
	macfn := hmac.New(sha256.New, akey)
	if len(ciphertext) < aes.BlockSize+macfn.Size() {
		return "", errors.New(utils.T("store.sql.short_ciphertext"))
	}

	macfn.Write(ciphertext[aes.BlockSize+macfn.Size():])
	expectedMac := macfn.Sum(nil)
	mac := ciphertext[aes.BlockSize : aes.BlockSize+macfn.Size()]
	if hmac.Equal(expectedMac, mac) != true {
		return "", errors.New(utils.T("store.sql.incorrect_mac"))
	}

	block, err := aes.NewCipher(ekey)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < aes.BlockSize {
		return "", errors.New(utils.T("store.sql.too_short_ciphertext"))
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize+macfn.Size():]

	stream := cipher.NewCFBDecrypter(block, iv)

	stream.XORKeyStream(ciphertext, ciphertext)

	return fmt.Sprintf("%s", ciphertext), nil
}
