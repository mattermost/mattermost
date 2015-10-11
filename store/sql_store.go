// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	l4g "code.google.com/p/log4go"
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
	"github.com/go-gorp/gorp"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	sqltrace "log"
	"math/rand"
	"os"
	"strings"
	"time"
)

type SqlStore struct {
	master   *gorp.DbMap
	replicas []*gorp.DbMap
	team     TeamStore
	channel  ChannelStore
	post     PostStore
	user     UserStore
	audit    AuditStore
	session  SessionStore
	oauth    OAuthStore
	system   SystemStore
	webhook  WebhookStore
}

func NewSqlStore() Store {

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

	schemaVersion := sqlStore.GetCurrentSchemaVersion()

	// If the version is already set then we are potentially in an 'upgrade needed' state
	if schemaVersion != "" {
		// Check to see if it's the most current database schema version
		if !model.IsCurrentVersion(schemaVersion) {
			// If we are upgrading from the previous version then print a warning and continue
			if model.IsPreviousVersion(schemaVersion) {
				l4g.Warn("The database schema version of " + schemaVersion + " appears to be out of date")
				l4g.Warn("Attempting to upgrade the database schema version to " + model.CurrentVersion)
			} else {
				// If this is an 'upgrade needed' state but the user is attempting to skip a version then halt the world
				l4g.Critical("The database schema version of " + schemaVersion + " cannot be upgraded.  You must not skip a version.")
				time.Sleep(time.Second)
				panic("The database schema version of " + schemaVersion + " cannot be upgraded.  You must not skip a version.")
			}
		}
	}

	sqlStore.team = NewSqlTeamStore(sqlStore)
	sqlStore.channel = NewSqlChannelStore(sqlStore)
	sqlStore.post = NewSqlPostStore(sqlStore)
	sqlStore.user = NewSqlUserStore(sqlStore)
	sqlStore.audit = NewSqlAuditStore(sqlStore)
	sqlStore.session = NewSqlSessionStore(sqlStore)
	sqlStore.oauth = NewSqlOAuthStore(sqlStore)
	sqlStore.system = NewSqlSystemStore(sqlStore)
	sqlStore.webhook = NewSqlWebhookStore(sqlStore)

	sqlStore.master.CreateTablesIfNotExists()

	sqlStore.team.(*SqlTeamStore).UpgradeSchemaIfNeeded()
	sqlStore.channel.(*SqlChannelStore).UpgradeSchemaIfNeeded()
	sqlStore.post.(*SqlPostStore).UpgradeSchemaIfNeeded()
	sqlStore.user.(*SqlUserStore).UpgradeSchemaIfNeeded()
	sqlStore.audit.(*SqlAuditStore).UpgradeSchemaIfNeeded()
	sqlStore.session.(*SqlSessionStore).UpgradeSchemaIfNeeded()
	sqlStore.oauth.(*SqlOAuthStore).UpgradeSchemaIfNeeded()
	sqlStore.system.(*SqlSystemStore).UpgradeSchemaIfNeeded()
	sqlStore.webhook.(*SqlWebhookStore).UpgradeSchemaIfNeeded()

	sqlStore.team.(*SqlTeamStore).CreateIndexesIfNotExists()
	sqlStore.channel.(*SqlChannelStore).CreateIndexesIfNotExists()
	sqlStore.post.(*SqlPostStore).CreateIndexesIfNotExists()
	sqlStore.user.(*SqlUserStore).CreateIndexesIfNotExists()
	sqlStore.audit.(*SqlAuditStore).CreateIndexesIfNotExists()
	sqlStore.session.(*SqlSessionStore).CreateIndexesIfNotExists()
	sqlStore.oauth.(*SqlOAuthStore).CreateIndexesIfNotExists()
	sqlStore.system.(*SqlSystemStore).CreateIndexesIfNotExists()
	sqlStore.webhook.(*SqlWebhookStore).CreateIndexesIfNotExists()

	if model.IsPreviousVersion(schemaVersion) {
		sqlStore.system.Update(&model.System{Name: "Version", Value: model.CurrentVersion})
		l4g.Warn("The database schema has been upgraded to version " + model.CurrentVersion)
	}

	if schemaVersion == "" {
		sqlStore.system.Save(&model.System{Name: "Version", Value: model.CurrentVersion})
		l4g.Info("The database schema has been set to version " + model.CurrentVersion)
	}

	return sqlStore
}

func setupConnection(con_type string, driver string, dataSource string, maxIdle int, maxOpen int, trace bool) *gorp.DbMap {

	db, err := dbsql.Open(driver, dataSource)
	if err != nil {
		l4g.Critical("Failed to open sql connection to err:%v", err)
		time.Sleep(time.Second)
		panic("Failed to open sql connection" + err.Error())
	}

	l4g.Info("Pinging sql %v database", con_type)
	err = db.Ping()
	if err != nil {
		l4g.Critical("Failed to ping db err:%v", err)
		time.Sleep(time.Second)
		panic("Failed to open sql connection " + err.Error())
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
		l4g.Critical("Failed to create dialect specific driver")
		time.Sleep(time.Second)
		panic("Failed to create dialect specific driver " + err.Error())
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

func (ss SqlStore) DoesTableExist(tableName string) bool {
	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		count, err := ss.GetMaster().SelectInt(
			`SELECT count(relname) FROM pg_class WHERE relname=$1`,
			strings.ToLower(tableName),
		)

		if err != nil {
			l4g.Critical("Failed to check if table exists %v", err)
			time.Sleep(time.Second)
			panic("Failed to check if table exists " + err.Error())
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
			l4g.Critical("Failed to check if table exists %v", err)
			time.Sleep(time.Second)
			panic("Failed to check if table exists " + err.Error())
		}

		return count > 0

	} else {
		l4g.Critical("Failed to check if column exists because of missing driver")
		time.Sleep(time.Second)
		panic("Failed to check if column exists because of missing driver")
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

			l4g.Critical("Failed to check if column exists %v", err)
			time.Sleep(time.Second)
			panic("Failed to check if column exists " + err.Error())
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
			l4g.Critical("Failed to check if column exists %v", err)
			time.Sleep(time.Second)
			panic("Failed to check if column exists " + err.Error())
		}

		return count > 0

	} else {
		l4g.Critical("Failed to check if column exists because of missing driver")
		time.Sleep(time.Second)
		panic("Failed to check if column exists because of missing driver")
	}

}

func (ss SqlStore) CreateColumnIfNotExists(tableName string, columnName string, mySqlColType string, postgresColType string, defaultValue string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			l4g.Critical("Failed to create column %v", err)
			time.Sleep(time.Second)
			panic("Failed to create column " + err.Error())
		}

		return true

	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
		_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " ADD " + columnName + " " + mySqlColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			l4g.Critical("Failed to create column %v", err)
			time.Sleep(time.Second)
			panic("Failed to create column " + err.Error())
		}

		return true

	} else {
		l4g.Critical("Failed to create column because of missing driver")
		time.Sleep(time.Second)
		panic("Failed to create column because of missing driver")
	}
}

func (ss SqlStore) RemoveColumnIfExists(tableName string, columnName string) bool {

	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " DROP COLUMN " + columnName)
	if err != nil {
		l4g.Critical("Failed to drop column %v", err)
		time.Sleep(time.Second)
		panic("Failed to drop column " + err.Error())
	}

	return true
}

// func (ss SqlStore) RenameColumnIfExists(tableName string, oldColumnName string, newColumnName string, colType string) bool {

// 	// XXX TODO FIXME this should be removed after 0.6.0
// 	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
// 		return false
// 	}

// 	if !ss.DoesColumnExist(tableName, oldColumnName) {
// 		return false
// 	}

// 	_, err := ss.GetMaster().Exec("ALTER TABLE " + tableName + " CHANGE " + oldColumnName + " " + newColumnName + " " + colType)

// 	if err != nil {
// 		l4g.Critical("Failed to rename column %v", err)
// 		time.Sleep(time.Second)
// 		panic("Failed to drop column " + err.Error())
// 	}

// 	return true
// }

func (ss SqlStore) CreateIndexIfNotExists(indexName string, tableName string, columnName string) {
	ss.createIndexIfNotExists(indexName, tableName, columnName, false)
}

func (ss SqlStore) CreateFullTextIndexIfNotExists(indexName string, tableName string, columnName string) {
	ss.createIndexIfNotExists(indexName, tableName, columnName, true)
}

func (ss SqlStore) createIndexIfNotExists(indexName string, tableName string, columnName string, fullText bool) {

	if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
		_, err := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
		// It should fail if the index does not exist
		if err == nil {
			return
		}

		query := ""
		if fullText {
			query = "CREATE INDEX " + indexName + " ON " + tableName + " USING gin(to_tsvector('english', " + columnName + "))"
		} else {
			query = "CREATE INDEX " + indexName + " ON " + tableName + " (" + columnName + ")"
		}

		_, err = ss.GetMaster().Exec(query)
		if err != nil {
			l4g.Critical("Failed to create index %v", err)
			time.Sleep(time.Second)
			panic("Failed to create index " + err.Error())
		}
	} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {

		count, err := ss.GetMaster().SelectInt("SELECT COUNT(0) AS index_exists FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() and table_name = ? AND index_name = ?", tableName, indexName)
		if err != nil {
			l4g.Critical("Failed to check index %v", err)
			time.Sleep(time.Second)
			panic("Failed to check index " + err.Error())
		}

		if count > 0 {
			return
		}

		fullTextIndex := ""
		if fullText {
			fullTextIndex = " FULLTEXT "
		}

		_, err = ss.GetMaster().Exec("CREATE " + fullTextIndex + " INDEX " + indexName + " ON " + tableName + " (" + columnName + ")")
		if err != nil {
			l4g.Critical("Failed to create index %v", err)
			time.Sleep(time.Second)
			panic("Failed to create index " + err.Error())
		}
	} else {
		l4g.Critical("Failed to create index because of missing driver")
		time.Sleep(time.Second)
		panic("Failed to create index because of missing driver")
	}
}

func IsUniqueConstraintError(err string, mysql string, postgres string) bool {
	unique := strings.Contains(err, "unique constraint") || strings.Contains(err, "Duplicate entry")
	field := strings.Contains(err, mysql) || strings.Contains(err, postgres)
	return unique && field
}

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
	l4g.Info("Closing SqlStore")
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

func (ss SqlStore) OAuth() OAuthStore {
	return ss.oauth
}

func (ss SqlStore) System() SystemStore {
	return ss.system
}

func (ss SqlStore) Webhook() WebhookStore {
	return ss.webhook
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
	}

	return val, nil
}

func (me mattermConverter) FromDb(target interface{}) (gorp.CustomScanner, bool) {
	switch target.(type) {
	case *model.StringMap:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New("FromDb: Unable to convert StringMap to *string")
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	case *model.StringArray:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New("FromDb: Unable to convert StringArray to *string")
			}
			b := []byte(*s)
			return json.Unmarshal(b, target)
		}
		return gorp.CustomScanner{new(string), target, binder}, true
	case *model.EncryptStringMap:
		binder := func(holder, target interface{}) error {
			s, ok := holder.(*string)
			if !ok {
				return errors.New("FromDb: Unable to convert EncryptStringMap to *string")
			}

			ue, err := decrypt([]byte(utils.Cfg.SqlSettings.AtRestEncryptKey), *s)
			if err != nil {
				return err
			}

			b := []byte(ue)
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
		return "", errors.New("short ciphertext")
	}

	macfn.Write(ciphertext[aes.BlockSize+macfn.Size():])
	expectedMac := macfn.Sum(nil)
	mac := ciphertext[aes.BlockSize : aes.BlockSize+macfn.Size()]
	if hmac.Equal(expectedMac, mac) != true {
		return "", errors.New("Incorrect MAC for the given ciphertext")
	}

	block, err := aes.NewCipher(ekey)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < aes.BlockSize {
		return "", errors.New("ciphertext too short")
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize+macfn.Size():]

	stream := cipher.NewCFBDecrypter(block, iv)

	stream.XORKeyStream(ciphertext, ciphertext)

	return fmt.Sprintf("%s", ciphertext), nil
}
