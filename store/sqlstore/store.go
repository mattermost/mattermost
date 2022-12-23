// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	dbsql "database/sql"
	"fmt"
	"log"
	"path"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/morph"
	sq "github.com/mattermost/squirrel"

	"github.com/mattermost/morph/drivers"
	ms "github.com/mattermost/morph/drivers/mysql"
	ps "github.com/mattermost/morph/drivers/postgres"

	"github.com/go-sql-driver/mysql"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	mbindata "github.com/mattermost/morph/sources/embedded"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/db"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

type migrationDirection string

const (
	IndexTypeFullText                 = "full_text"
	IndexTypeFullTextFunc             = "full_text_func"
	IndexTypeDefault                  = "default"
	PGDupTableErrorCode               = "42P07"      // see https://github.com/lib/pq/blob/master/error.go#L268
	MySQLDupTableErrorCode            = uint16(1050) // see https://dev.mysql.com/doc/mysql-errors/5.7/en/server-error-reference.html#error_er_table_exists_error
	PGForeignKeyViolationErrorCode    = "23503"
	MySQLForeignKeyViolationErrorCode = 1452
	PGDuplicateObjectErrorCode        = "42710"
	MySQLDuplicateObjectErrorCode     = 1022
	DBPingAttempts                    = 18
	DBPingTimeoutSecs                 = 10
	// This is a numerical version string by postgres. The format is
	// 2 characters for major, minor, and patch version prior to 10.
	// After 10, it's major and minor only.
	// 10.1 would be 100001.
	// 9.6.3 would be 90603.
	minimumRequiredPostgresVersion = 100000
	// major*1000 + minor*100 + patch
	minimumRequiredMySQLVersion = 5712

	migrationsDirectionUp   migrationDirection = "up"
	migrationsDirectionDown migrationDirection = "down"

	replicaLagPrefix = "replica-lag"

	RemoteClusterSiteURLUniqueIndex = "remote_clusters_site_url_unique"
)

var tablesToCheckForCollation = []string{"incomingwebhooks", "preferences", "users", "uploadsessions", "channels", "publicchannels"}

type SqlStoreStores struct {
	team                 store.TeamStore
	channel              store.ChannelStore
	post                 store.PostStore
	retentionPolicy      store.RetentionPolicyStore
	thread               store.ThreadStore
	user                 store.UserStore
	bot                  store.BotStore
	audit                store.AuditStore
	cluster              store.ClusterDiscoveryStore
	remoteCluster        store.RemoteClusterStore
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
	uploadSession        store.UploadSessionStore
	reaction             store.ReactionStore
	job                  store.JobStore
	userAccessToken      store.UserAccessTokenStore
	plugin               store.PluginStore
	channelMemberHistory store.ChannelMemberHistoryStore
	role                 store.RoleStore
	scheme               store.SchemeStore
	TermsOfService       store.TermsOfServiceStore
	productNotices       store.ProductNoticesStore
	group                store.GroupStore
	UserTermsOfService   store.UserTermsOfServiceStore
	linkMetadata         store.LinkMetadataStore
	sharedchannel        store.SharedChannelStore
	draft                store.DraftStore
	notifyAdmin          store.NotifyAdminStore
	postPriority         store.PostPriorityStore
	postAcknowledgement  store.PostAcknowledgementStore
	trueUpReviewStatus   store.TrueUpReviewStore
}

type SqlStore struct {
	// rrCounter and srCounter should be kept first.
	// See https://github.com/mattermost/mattermost-server/v6/pull/7281
	rrCounter int64
	srCounter int64

	masterX *sqlxDBWrapper

	ReplicaXs []*sqlxDBWrapper

	searchReplicaXs []*sqlxDBWrapper

	replicaLagHandles []*dbsql.DB
	stores            SqlStoreStores
	settings          *model.SqlSettings
	lockedToMaster    bool
	context           context.Context
	license           *model.License
	licenseMutex      sync.RWMutex
	metrics           einterfaces.MetricsInterface

	isBinaryParam             bool
	pgDefaultTextSearchConfig string
}

func New(settings model.SqlSettings, metrics einterfaces.MetricsInterface) *SqlStore {
	store := &SqlStore{
		rrCounter: 0,
		srCounter: 0,
		settings:  &settings,
		metrics:   metrics,
	}

	store.initConnection()

	ver, err := store.GetDbVersion(true)
	if err != nil {
		mlog.Fatal("Error while getting DB version.", mlog.Err(err))
	}

	ok, err := store.ensureMinimumDBVersion(ver)
	if !ok {
		mlog.Fatal("Error while checking DB version.", mlog.Err(err))
	}

	err = store.ensureDatabaseCollation()
	if err != nil {
		mlog.Fatal("Error while checking DB collation.", mlog.Err(err))
	}

	err = store.migrate(migrationsDirectionUp)
	if err != nil {
		mlog.Fatal("Failed to apply database migrations.", mlog.Err(err))
	}

	store.isBinaryParam, err = store.computeBinaryParam()
	if err != nil {
		mlog.Fatal("Failed to compute binary param", mlog.Err(err))
	}

	store.pgDefaultTextSearchConfig, err = store.computeDefaultTextSearchConfig()
	if err != nil {
		mlog.Fatal("Failed to compute default text search config", mlog.Err(err))
	}

	store.stores.team = newSqlTeamStore(store)
	store.stores.channel = newSqlChannelStore(store, metrics)
	store.stores.post = newSqlPostStore(store, metrics)
	store.stores.retentionPolicy = newSqlRetentionPolicyStore(store, metrics)
	store.stores.user = newSqlUserStore(store, metrics)
	store.stores.bot = newSqlBotStore(store, metrics)
	store.stores.audit = newSqlAuditStore(store)
	store.stores.cluster = newSqlClusterDiscoveryStore(store)
	store.stores.remoteCluster = newSqlRemoteClusterStore(store)
	store.stores.compliance = newSqlComplianceStore(store)
	store.stores.session = newSqlSessionStore(store)
	store.stores.oauth = newSqlOAuthStore(store)
	store.stores.system = newSqlSystemStore(store)
	store.stores.webhook = newSqlWebhookStore(store, metrics)
	store.stores.command = newSqlCommandStore(store)
	store.stores.commandWebhook = newSqlCommandWebhookStore(store)
	store.stores.preference = newSqlPreferenceStore(store)
	store.stores.license = newSqlLicenseStore(store)
	store.stores.token = newSqlTokenStore(store)
	store.stores.emoji = newSqlEmojiStore(store, metrics)
	store.stores.status = newSqlStatusStore(store)
	store.stores.fileInfo = newSqlFileInfoStore(store, metrics)
	store.stores.uploadSession = newSqlUploadSessionStore(store)
	store.stores.thread = newSqlThreadStore(store)
	store.stores.job = newSqlJobStore(store)
	store.stores.userAccessToken = newSqlUserAccessTokenStore(store)
	store.stores.channelMemberHistory = newSqlChannelMemberHistoryStore(store)
	store.stores.plugin = newSqlPluginStore(store)
	store.stores.TermsOfService = newSqlTermsOfServiceStore(store, metrics)
	store.stores.UserTermsOfService = newSqlUserTermsOfServiceStore(store)
	store.stores.linkMetadata = newSqlLinkMetadataStore(store)
	store.stores.sharedchannel = newSqlSharedChannelStore(store)
	store.stores.reaction = newSqlReactionStore(store)
	store.stores.role = newSqlRoleStore(store)
	store.stores.scheme = newSqlSchemeStore(store)
	store.stores.group = newSqlGroupStore(store)
	store.stores.productNotices = newSqlProductNoticesStore(store)
	store.stores.draft = newSqlDraftStore(store, metrics)
	store.stores.notifyAdmin = newSqlNotifyAdminStore(store)
	store.stores.postPriority = newSqlPostPriorityStore(store)
	store.stores.postAcknowledgement = newSqlPostAcknowledgementStore(store)
	store.stores.trueUpReviewStatus = newSqlTrueUpReviewStore(store)

	store.stores.preference.(*SqlPreferenceStore).deleteUnusedFeatures()

	return store
}

// SetupConnection sets up the connection to the database and pings it to make sure it's alive.
// It also applies any database configuration settings that are required.
func SetupConnection(connType string, dataSource string, settings *model.SqlSettings) *dbsql.DB {
	db, err := dbsql.Open(*settings.DriverName, dataSource)
	if err != nil {
		mlog.Fatal("Failed to open SQL connection to err.", mlog.Err(err))
	}

	for i := 0; i < DBPingAttempts; i++ {
		mlog.Info("Pinging SQL", mlog.String("database", connType))
		ctx, cancel := context.WithTimeout(context.Background(), DBPingTimeoutSecs*time.Second)
		defer cancel()
		err = db.PingContext(ctx)
		if err == nil {
			break
		} else {
			if i == DBPingAttempts-1 {
				mlog.Fatal("Failed to ping DB, server will exit.", mlog.Err(err))
			} else {
				mlog.Error("Failed to ping DB", mlog.Err(err), mlog.Int("retrying in seconds", DBPingTimeoutSecs))
				time.Sleep(DBPingTimeoutSecs * time.Second)
			}
		}
	}

	if strings.HasPrefix(connType, replicaLagPrefix) {
		// If this is a replica lag connection, we just open one connection.
		//
		// Arguably, if the query doesn't require a special credential, it does take up
		// one extra connection from the replica DB. But falling back to the replica
		// data source when the replica lag data source is null implies an ordering constraint
		// which makes things brittle and is not a good design.
		// If connections are an overhead, it is advised to use a connection pool.
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
	} else {
		db.SetMaxIdleConns(*settings.MaxIdleConns)
		db.SetMaxOpenConns(*settings.MaxOpenConns)
	}
	db.SetConnMaxLifetime(time.Duration(*settings.ConnMaxLifetimeMilliseconds) * time.Millisecond)
	db.SetConnMaxIdleTime(time.Duration(*settings.ConnMaxIdleTimeMilliseconds) * time.Millisecond)

	return db
}

func (ss *SqlStore) SetContext(context context.Context) {
	ss.context = context
}

func (ss *SqlStore) Context() context.Context {
	return ss.context
}

func noOpMapper(s string) string { return s }

func (ss *SqlStore) initConnection() {
	dataSource := *ss.settings.DataSource
	if ss.DriverName() == model.DatabaseDriverMysql {
		// TODO: We ignore the readTimeout datasource parameter for MySQL since QueryTimeout
		// covers that already. Ideally we'd like to do this only for the upgrade
		// step. To be reviewed in MM-35789.
		var err error
		dataSource, err = ResetReadTimeout(dataSource)
		if err != nil {
			mlog.Fatal("Failed to reset read timeout from datasource.", mlog.Err(err), mlog.String("src", dataSource))
		}
	}

	handle := SetupConnection("master", dataSource, ss.settings)
	ss.masterX = newSqlxDBWrapper(sqlx.NewDb(handle, ss.DriverName()),
		time.Duration(*ss.settings.QueryTimeout)*time.Second,
		*ss.settings.Trace)
	if ss.DriverName() == model.DatabaseDriverMysql {
		ss.masterX.MapperFunc(noOpMapper)
	}

	if len(ss.settings.DataSourceReplicas) > 0 {
		ss.ReplicaXs = make([]*sqlxDBWrapper, len(ss.settings.DataSourceReplicas))
		for i, replica := range ss.settings.DataSourceReplicas {
			handle := SetupConnection(fmt.Sprintf("replica-%v", i), replica, ss.settings)
			ss.ReplicaXs[i] = newSqlxDBWrapper(sqlx.NewDb(handle, ss.DriverName()),
				time.Duration(*ss.settings.QueryTimeout)*time.Second,
				*ss.settings.Trace)
			if ss.DriverName() == model.DatabaseDriverMysql {
				ss.ReplicaXs[i].MapperFunc(noOpMapper)
			}
		}
	}

	if len(ss.settings.DataSourceSearchReplicas) > 0 {
		ss.searchReplicaXs = make([]*sqlxDBWrapper, len(ss.settings.DataSourceSearchReplicas))
		for i, replica := range ss.settings.DataSourceSearchReplicas {
			handle := SetupConnection(fmt.Sprintf("search-replica-%v", i), replica, ss.settings)
			ss.searchReplicaXs[i] = newSqlxDBWrapper(sqlx.NewDb(handle, ss.DriverName()),
				time.Duration(*ss.settings.QueryTimeout)*time.Second,
				*ss.settings.Trace)
			if ss.DriverName() == model.DatabaseDriverMysql {
				ss.searchReplicaXs[i].MapperFunc(noOpMapper)
			}
		}
	}

	if len(ss.settings.ReplicaLagSettings) > 0 {
		ss.replicaLagHandles = make([]*dbsql.DB, len(ss.settings.ReplicaLagSettings))
		for i, src := range ss.settings.ReplicaLagSettings {
			if src.DataSource == nil {
				continue
			}
			ss.replicaLagHandles[i] = SetupConnection(fmt.Sprintf(replicaLagPrefix+"-%d", i), *src.DataSource, ss.settings)
		}
	}
}

func (ss *SqlStore) DriverName() string {
	return *ss.settings.DriverName
}

// specialSearchChars have special meaning and can be treated as spaces
func (ss *SqlStore) specialSearchChars() []string {
	chars := []string{
		"<",
		">",
		"+",
		"-",
		"(",
		")",
		"~",
		":",
	}

	// Postgres can handle "@" without any errors
	// Also helps postgres in enabling search for EmailAddresses
	if ss.DriverName() != model.DatabaseDriverPostgres {
		chars = append(chars, "@")
	}

	return chars
}

// computeBinaryParam returns whether the data source uses binary_parameters
// when using Postgres
func (ss *SqlStore) computeBinaryParam() (bool, error) {
	if ss.DriverName() != model.DatabaseDriverPostgres {
		return false, nil
	}

	return DSNHasBinaryParam(*ss.settings.DataSource)
}

func (ss *SqlStore) computeDefaultTextSearchConfig() (string, error) {
	if ss.DriverName() != model.DatabaseDriverPostgres {
		return "", nil
	}

	var defaultTextSearchConfig string
	err := ss.GetMasterX().Get(&defaultTextSearchConfig, `SHOW default_text_search_config`)
	return defaultTextSearchConfig, err
}

func (ss *SqlStore) IsBinaryParamEnabled() bool {
	return ss.isBinaryParam
}

// GetDbVersion returns the version of the database being used.
// If numerical is set to true, it attempts to return a numerical version string
// that can be parsed by callers.
func (ss *SqlStore) GetDbVersion(numerical bool) (string, error) {
	var sqlVersion string
	if ss.DriverName() == model.DatabaseDriverPostgres {
		if numerical {
			sqlVersion = `SHOW server_version_num`
		} else {
			sqlVersion = `SHOW server_version`
		}
	} else if ss.DriverName() == model.DatabaseDriverMysql {
		sqlVersion = `SELECT version()`
	} else {
		return "", errors.New("Not supported driver")
	}

	var version string
	err := ss.GetReplicaX().Get(&version, sqlVersion)
	if err != nil {
		return "", err
	}

	return version, nil

}

func (ss *SqlStore) GetMasterX() *sqlxDBWrapper {
	return ss.masterX
}

func (ss *SqlStore) SetMasterX(db *sql.DB) {
	ss.masterX = newSqlxDBWrapper(sqlx.NewDb(db, ss.DriverName()),
		time.Duration(*ss.settings.QueryTimeout)*time.Second,
		*ss.settings.Trace)
	if ss.DriverName() == model.DatabaseDriverMysql {
		ss.masterX.MapperFunc(noOpMapper)
	}
}

func (ss *SqlStore) GetInternalMasterDB() *sql.DB {
	return ss.GetMasterX().DB.DB
}

func (ss *SqlStore) GetSearchReplicaX() *sqlxDBWrapper {
	if !ss.hasLicense() {
		return ss.GetMasterX()
	}

	if len(ss.settings.DataSourceSearchReplicas) == 0 {
		return ss.GetReplicaX()
	}

	rrNum := atomic.AddInt64(&ss.srCounter, 1) % int64(len(ss.searchReplicaXs))
	return ss.searchReplicaXs[rrNum]
}

func (ss *SqlStore) GetReplicaX() *sqlxDBWrapper {
	if len(ss.settings.DataSourceReplicas) == 0 || ss.lockedToMaster || !ss.hasLicense() {
		return ss.GetMasterX()
	}

	rrNum := atomic.AddInt64(&ss.rrCounter, 1) % int64(len(ss.ReplicaXs))
	return ss.ReplicaXs[rrNum]
}

func (ss *SqlStore) GetInternalReplicaDBs() []*sql.DB {
	if len(ss.settings.DataSourceReplicas) == 0 || ss.lockedToMaster || !ss.hasLicense() {
		return []*sql.DB{
			ss.GetMasterX().DB.DB,
		}
	}

	dbs := make([]*sql.DB, len(ss.ReplicaXs))
	for i, rx := range ss.ReplicaXs {
		dbs[i] = rx.DB.DB
	}

	return dbs
}

func (ss *SqlStore) GetInternalReplicaDB() *sql.DB {
	if len(ss.settings.DataSourceReplicas) == 0 || ss.lockedToMaster || !ss.hasLicense() {
		return ss.GetMasterX().DB.DB
	}

	rrNum := atomic.AddInt64(&ss.rrCounter, 1) % int64(len(ss.ReplicaXs))
	return ss.ReplicaXs[rrNum].DB.DB
}

func (ss *SqlStore) TotalMasterDbConnections() int {
	return ss.GetMasterX().Stats().OpenConnections
}

// ReplicaLagAbs queries all the replica databases to get the absolute replica lag value
// and updates the Prometheus metric with it.
func (ss *SqlStore) ReplicaLagAbs() error {
	for i, item := range ss.settings.ReplicaLagSettings {
		if item.QueryAbsoluteLag == nil || *item.QueryAbsoluteLag == "" {
			continue
		}
		var binDiff float64
		var node string
		err := ss.replicaLagHandles[i].QueryRow(*item.QueryAbsoluteLag).Scan(&node, &binDiff)
		if err != nil {
			return err
		}
		// There is no nil check needed here because it's called from the metrics store.
		ss.metrics.SetReplicaLagAbsolute(node, binDiff)
	}
	return nil
}

// ReplicaLagAbs queries all the replica databases to get the time-based replica lag value
// and updates the Prometheus metric with it.
func (ss *SqlStore) ReplicaLagTime() error {
	for i, item := range ss.settings.ReplicaLagSettings {
		if item.QueryTimeLag == nil || *item.QueryTimeLag == "" {
			continue
		}
		var timeDiff float64
		var node string
		err := ss.replicaLagHandles[i].QueryRow(*item.QueryTimeLag).Scan(&node, &timeDiff)
		if err != nil {
			return err
		}
		// There is no nil check needed here because it's called from the metrics store.
		ss.metrics.SetReplicaLagTime(node, timeDiff)
	}
	return nil
}

func (ss *SqlStore) TotalReadDbConnections() int {
	if len(ss.settings.DataSourceReplicas) == 0 {
		return 0
	}

	count := 0
	for _, db := range ss.ReplicaXs {
		count = count + db.Stats().OpenConnections
	}

	return count
}

func (ss *SqlStore) TotalSearchDbConnections() int {
	if len(ss.settings.DataSourceSearchReplicas) == 0 {
		return 0
	}

	count := 0
	for _, db := range ss.searchReplicaXs {
		count = count + db.Stats().OpenConnections
	}

	return count
}

func (ss *SqlStore) MarkSystemRanUnitTests() {
	props, err := ss.System().Get()
	if err != nil {
		return
	}

	unitTests := props[model.SystemRanUnitTests]
	if unitTests == "" {
		systemTests := &model.System{Name: model.SystemRanUnitTests, Value: "1"}
		ss.System().Save(systemTests)
	}
}

func (ss *SqlStore) DoesTableExist(tableName string) bool {
	if ss.DriverName() == model.DatabaseDriverPostgres {
		var count int64
		err := ss.GetMasterX().Get(&count,
			`SELECT count(relname) FROM pg_class WHERE relname=$1`,
			strings.ToLower(tableName),
		)

		if err != nil {
			mlog.Fatal("Failed to check if table exists", mlog.Err(err))
		}

		return count > 0

	} else if ss.DriverName() == model.DatabaseDriverMysql {
		var count int64
		err := ss.GetMasterX().Get(&count,
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
			mlog.Fatal("Failed to check if table exists", mlog.Err(err))
		}

		return count > 0

	} else {
		mlog.Fatal("Failed to check if column exists because of missing driver")
		return false
	}
}

func (ss *SqlStore) DoesColumnExist(tableName string, columnName string) bool {
	if ss.DriverName() == model.DatabaseDriverPostgres {
		var count int64
		err := ss.GetMasterX().Get(&count,
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

			mlog.Fatal("Failed to check if column exists", mlog.Err(err))
		}

		return count > 0

	} else if ss.DriverName() == model.DatabaseDriverMysql {
		var count int64
		err := ss.GetMasterX().Get(&count,
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
			mlog.Fatal("Failed to check if column exists", mlog.Err(err))
		}

		return count > 0

	} else {
		mlog.Fatal("Failed to check if column exists because of missing driver")
		return false
	}
}

func (ss *SqlStore) DoesTriggerExist(triggerName string) bool {
	if ss.DriverName() == model.DatabaseDriverPostgres {
		var count int64
		err := ss.GetMasterX().Get(&count, `
			SELECT
				COUNT(0)
			FROM
				pg_trigger
			WHERE
				tgname = $1
		`, triggerName)

		if err != nil {
			mlog.Fatal("Failed to check if trigger exists", mlog.Err(err))
		}

		return count > 0

	} else if ss.DriverName() == model.DatabaseDriverMysql {
		var count int64
		err := ss.GetMasterX().Get(&count, `
			SELECT
				COUNT(0)
			FROM
				information_schema.triggers
			WHERE
				trigger_schema = DATABASE()
			AND	trigger_name = ?
		`, triggerName)

		if err != nil {
			mlog.Fatal("Failed to check if trigger exists", mlog.Err(err))
		}

		return count > 0

	} else {
		mlog.Fatal("Failed to check if column exists because of missing driver")
		return false
	}
}

func (ss *SqlStore) CreateColumnIfNotExists(tableName string, columnName string, mySqlColType string, postgresColType string, defaultValue string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	if ss.DriverName() == model.DatabaseDriverPostgres {
		_, err := ss.GetMasterX().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			mlog.Fatal("Failed to create column", mlog.Err(err))
		}

		return true

	} else if ss.DriverName() == model.DatabaseDriverMysql {
		_, err := ss.GetMasterX().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + mySqlColType + " DEFAULT '" + defaultValue + "'")
		if err != nil {
			mlog.Fatal("Failed to create column", mlog.Err(err))
		}

		return true

	} else {
		mlog.Fatal("Failed to create column because of missing driver")
		return false
	}
}

func (ss *SqlStore) RemoveTableIfExists(tableName string) bool {
	if !ss.DoesTableExist(tableName) {
		return false
	}

	_, err := ss.GetMasterX().ExecNoTimeout("DROP TABLE " + tableName)
	if err != nil {
		mlog.Fatal("Failed to drop table", mlog.Err(err))
	}

	return true
}

func IsConstraintAlreadyExistsError(err error) bool {
	switch dbErr := err.(type) {
	case *pq.Error:
		if dbErr.Code == PGDuplicateObjectErrorCode {
			return true
		}
	case *mysql.MySQLError:
		if dbErr.Number == MySQLDuplicateObjectErrorCode {
			return true
		}
	}
	return false
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

func (ss *SqlStore) GetAllConns() []*sqlxDBWrapper {
	all := make([]*sqlxDBWrapper, len(ss.ReplicaXs)+1)
	copy(all, ss.ReplicaXs)
	all[len(ss.ReplicaXs)] = ss.masterX
	return all
}

// RecycleDBConnections closes active connections by setting the max conn lifetime
// to d, and then resets them back to their original duration.
func (ss *SqlStore) RecycleDBConnections(d time.Duration) {
	// Get old time.
	originalDuration := time.Duration(*ss.settings.ConnMaxLifetimeMilliseconds) * time.Millisecond
	// Set the max lifetimes for all connections.
	for _, conn := range ss.GetAllConns() {
		conn.SetConnMaxLifetime(d)
	}
	// Wait for that period with an additional 2 seconds of scheduling delay.
	time.Sleep(d + 2*time.Second)
	// Reset max lifetime back to original value.
	for _, conn := range ss.GetAllConns() {
		conn.SetConnMaxLifetime(originalDuration)
	}
}

func (ss *SqlStore) Close() {
	ss.masterX.Close()
	for _, replica := range ss.ReplicaXs {
		replica.Close()
	}

	for _, replica := range ss.searchReplicaXs {
		replica.Close()
	}
}

func (ss *SqlStore) LockToMaster() {
	ss.lockedToMaster = true
}

func (ss *SqlStore) UnlockFromMaster() {
	ss.lockedToMaster = false
}

func (ss *SqlStore) Team() store.TeamStore {
	return ss.stores.team
}

func (ss *SqlStore) Channel() store.ChannelStore {
	return ss.stores.channel
}

func (ss *SqlStore) Post() store.PostStore {
	return ss.stores.post
}

func (ss *SqlStore) RetentionPolicy() store.RetentionPolicyStore {
	return ss.stores.retentionPolicy
}

func (ss *SqlStore) User() store.UserStore {
	return ss.stores.user
}

func (ss *SqlStore) Bot() store.BotStore {
	return ss.stores.bot
}

func (ss *SqlStore) Session() store.SessionStore {
	return ss.stores.session
}

func (ss *SqlStore) Audit() store.AuditStore {
	return ss.stores.audit
}

func (ss *SqlStore) ClusterDiscovery() store.ClusterDiscoveryStore {
	return ss.stores.cluster
}

func (ss *SqlStore) RemoteCluster() store.RemoteClusterStore {
	return ss.stores.remoteCluster
}

func (ss *SqlStore) Compliance() store.ComplianceStore {
	return ss.stores.compliance
}

func (ss *SqlStore) OAuth() store.OAuthStore {
	return ss.stores.oauth
}

func (ss *SqlStore) System() store.SystemStore {
	return ss.stores.system
}

func (ss *SqlStore) Webhook() store.WebhookStore {
	return ss.stores.webhook
}

func (ss *SqlStore) Command() store.CommandStore {
	return ss.stores.command
}

func (ss *SqlStore) CommandWebhook() store.CommandWebhookStore {
	return ss.stores.commandWebhook
}

func (ss *SqlStore) Preference() store.PreferenceStore {
	return ss.stores.preference
}

func (ss *SqlStore) License() store.LicenseStore {
	return ss.stores.license
}

func (ss *SqlStore) Token() store.TokenStore {
	return ss.stores.token
}

func (ss *SqlStore) Emoji() store.EmojiStore {
	return ss.stores.emoji
}

func (ss *SqlStore) Status() store.StatusStore {
	return ss.stores.status
}

func (ss *SqlStore) FileInfo() store.FileInfoStore {
	return ss.stores.fileInfo
}

func (ss *SqlStore) UploadSession() store.UploadSessionStore {
	return ss.stores.uploadSession
}

func (ss *SqlStore) Reaction() store.ReactionStore {
	return ss.stores.reaction
}

func (ss *SqlStore) Job() store.JobStore {
	return ss.stores.job
}

func (ss *SqlStore) UserAccessToken() store.UserAccessTokenStore {
	return ss.stores.userAccessToken
}

func (ss *SqlStore) ChannelMemberHistory() store.ChannelMemberHistoryStore {
	return ss.stores.channelMemberHistory
}

func (ss *SqlStore) Plugin() store.PluginStore {
	return ss.stores.plugin
}

func (ss *SqlStore) Thread() store.ThreadStore {
	return ss.stores.thread
}

func (ss *SqlStore) Role() store.RoleStore {
	return ss.stores.role
}

func (ss *SqlStore) TermsOfService() store.TermsOfServiceStore {
	return ss.stores.TermsOfService
}

func (ss *SqlStore) ProductNotices() store.ProductNoticesStore {
	return ss.stores.productNotices
}

func (ss *SqlStore) UserTermsOfService() store.UserTermsOfServiceStore {
	return ss.stores.UserTermsOfService
}

func (ss *SqlStore) Scheme() store.SchemeStore {
	return ss.stores.scheme
}

func (ss *SqlStore) Group() store.GroupStore {
	return ss.stores.group
}

func (ss *SqlStore) LinkMetadata() store.LinkMetadataStore {
	return ss.stores.linkMetadata
}

func (ss *SqlStore) NotifyAdmin() store.NotifyAdminStore {
	return ss.stores.notifyAdmin
}

func (ss *SqlStore) SharedChannel() store.SharedChannelStore {
	return ss.stores.sharedchannel
}

func (ss *SqlStore) PostPriority() store.PostPriorityStore {
	return ss.stores.postPriority
}

func (ss *SqlStore) Draft() store.DraftStore {
	return ss.stores.draft
}

func (ss *SqlStore) PostAcknowledgement() store.PostAcknowledgementStore {
	return ss.stores.postAcknowledgement
}

func (ss *SqlStore) TrueUpReview() store.TrueUpReviewStore {
	return ss.stores.trueUpReviewStatus
}

func (ss *SqlStore) DropAllTables() {
	if ss.DriverName() == model.DatabaseDriverPostgres {
		ss.masterX.Exec(`DO
			$func$
			BEGIN
			   EXECUTE
			   (SELECT 'TRUNCATE TABLE ' || string_agg(oid::regclass::text, ', ') || ' CASCADE'
			    FROM   pg_class
			    WHERE  relkind = 'r'  -- only tables
			    AND    relnamespace = 'public'::regnamespace
				AND NOT relname = 'db_migrations'
			   );
			END
			$func$;`)
	} else {
		tables := []string{}
		ss.masterX.Select(&tables, `show tables`)
		for _, t := range tables {
			if t != "db_migrations" {
				ss.masterX.Exec(`TRUNCATE TABLE ` + t)
			}
		}
	}
}

func (ss *SqlStore) getQueryBuilder() sq.StatementBuilderType {
	return sq.StatementBuilder.PlaceholderFormat(ss.getQueryPlaceholder())
}

func (ss *SqlStore) getQueryPlaceholder() sq.PlaceholderFormat {
	if ss.DriverName() == model.DatabaseDriverPostgres {
		return sq.Dollar
	}
	return sq.Question
}

// getSubQueryBuilder is necessary to generate the SQL query and args to pass to sub-queries because squirrel does not support WHERE clause in sub-queries.
func (ss *SqlStore) getSubQueryBuilder() sq.StatementBuilderType {
	return sq.StatementBuilder.PlaceholderFormat(sq.Question)
}

func (ss *SqlStore) CheckIntegrity() <-chan model.IntegrityCheckResult {
	results := make(chan model.IntegrityCheckResult)
	go CheckRelationalIntegrity(ss, results)
	return results
}

func (ss *SqlStore) UpdateLicense(license *model.License) {
	ss.licenseMutex.Lock()
	defer ss.licenseMutex.Unlock()
	ss.license = license
}

func (ss *SqlStore) GetLicense() *model.License {
	return ss.license
}

func (ss *SqlStore) hasLicense() bool {
	ss.licenseMutex.Lock()
	hasLicense := ss.license != nil
	ss.licenseMutex.Unlock()

	return hasLicense
}

func (ss *SqlStore) migrate(direction migrationDirection) error {
	assets := db.Assets()

	assetsList, err := assets.ReadDir(path.Join("migrations", ss.DriverName()))
	if err != nil {
		return err
	}

	assetNamesForDriver := make([]string, len(assetsList))
	for i, entry := range assetsList {
		assetNamesForDriver[i] = entry.Name()
	}

	src, err := mbindata.WithInstance(&mbindata.AssetSource{
		Names: assetNamesForDriver,
		AssetFunc: func(name string) ([]byte, error) {
			return assets.ReadFile(path.Join("migrations", ss.DriverName(), name))
		},
	})
	if err != nil {
		return err
	}

	var driver drivers.Driver
	switch ss.DriverName() {
	case model.DatabaseDriverMysql:
		dataSource, rErr := ResetReadTimeout(*ss.settings.DataSource)
		if rErr != nil {
			mlog.Fatal("Failed to reset read timeout from datasource.", mlog.Err(rErr), mlog.String("src", *ss.settings.DataSource))
			return rErr
		}
		dataSource, err = AppendMultipleStatementsFlag(dataSource)
		if err != nil {
			return err
		}
		db := SetupConnection("master", dataSource, ss.settings)
		driver, err = ms.WithInstance(db)
		defer db.Close()
	case model.DatabaseDriverPostgres:
		driver, err = ps.WithInstance(ss.GetMasterX().DB.DB)
	default:
		err = fmt.Errorf("unsupported database type %s for migration", ss.DriverName())
	}
	if err != nil {
		return err
	}

	opts := []morph.EngineOption{
		morph.WithLogger(log.New(&morphWriter{}, "", log.Lshortfile)),
		morph.WithLock("mm-lock-key"),
		morph.SetStatementTimeoutInSeconds(*ss.settings.MigrationsStatementTimeoutSeconds),
	}
	engine, err := morph.New(context.Background(), driver, src, opts...)
	if err != nil {
		return err
	}
	defer engine.Close()

	switch direction {
	case migrationsDirectionDown:
		_, err = engine.ApplyDown(-1)
		return err
	default:
		return engine.ApplyAll()
	}
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

// IsDuplicate checks whether an error is a duplicate key error, which comes when processes are competing on creating the same
// tables in the database.
func IsDuplicate(err error) bool {
	var pqErr *pq.Error
	var mysqlErr *mysql.MySQLError
	switch {
	case errors.As(errors.Cause(err), &pqErr):
		if pqErr.Code == PGDupTableErrorCode {
			return true
		}
	case errors.As(errors.Cause(err), &mysqlErr):
		if mysqlErr.Number == MySQLDupTableErrorCode {
			return true
		}
	}

	return false
}

// ensureMinimumDBVersion gets the DB version and ensures it is
// above the required minimum version requirements.
func (ss *SqlStore) ensureMinimumDBVersion(ver string) (bool, error) {
	switch *ss.settings.DriverName {
	case model.DatabaseDriverPostgres:
		intVer, err2 := strconv.Atoi(ver)
		if err2 != nil {
			return false, fmt.Errorf("cannot parse DB version: %v", err2)
		}
		if intVer < minimumRequiredPostgresVersion {
			return false, fmt.Errorf("minimum Postgres version requirements not met. Found: %s, Wanted: %s", versionString(intVer, *ss.settings.DriverName), versionString(minimumRequiredPostgresVersion, *ss.settings.DriverName))
		}
	case model.DatabaseDriverMysql:
		// Usually a version string is of the form 5.6.49-log, 10.4.5-MariaDB etc.
		if strings.Contains(strings.ToLower(ver), "maria") {
			mlog.Warn("MariaDB detected. You are using an unsupported database. Please consider using MySQL or Postgres.")
			return true, nil
		}
		parts := strings.Split(ver, "-")
		if len(parts) < 1 {
			return false, fmt.Errorf("cannot parse MySQL DB version: %s", ver)
		}
		// Get the major and minor versions.
		versions := strings.Split(parts[0], ".")
		if len(versions) < 3 {
			return false, fmt.Errorf("cannot parse MySQL DB version: %s", ver)
		}
		majorVer, err2 := strconv.Atoi(versions[0])
		if err2 != nil {
			return false, fmt.Errorf("cannot parse MySQL DB version: %w", err2)
		}
		minorVer, err2 := strconv.Atoi(versions[1])
		if err2 != nil {
			return false, fmt.Errorf("cannot parse MySQL DB version: %w", err2)
		}
		patchVer, err2 := strconv.Atoi(versions[2])
		if err2 != nil {
			return false, fmt.Errorf("cannot parse MySQL DB version: %w", err2)
		}
		intVer := majorVer*1000 + minorVer*100 + patchVer
		if intVer < minimumRequiredMySQLVersion {
			return false, fmt.Errorf("minimum MySQL version requirements not met. Found: %s, Wanted: %s", versionString(intVer, *ss.settings.DriverName), versionString(minimumRequiredMySQLVersion, *ss.settings.DriverName))
		}
	}
	return true, nil
}

func (ss *SqlStore) ensureDatabaseCollation() error {
	if *ss.settings.DriverName != model.DatabaseDriverMysql {
		return nil
	}

	var connCollation struct {
		Variable_name string
		Value         string
	}
	if err := ss.GetMasterX().Get(&connCollation, "SHOW VARIABLES LIKE 'collation_connection'"); err != nil {
		return errors.Wrap(err, "unable to select variables")
	}

	// we compare table collation with the connection collation value so that we can
	// catch collation mismatches for tables we have a migration for.
	for _, tableName := range tablesToCheckForCollation {
		// we check if table exists because this code runs before the migrations applied
		// which means if there is a fresh db, we may fail on selecting the table_collation
		var exists int
		if err := ss.GetMasterX().Get(&exists, "SELECT count(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) = ?", tableName); err != nil {
			return errors.Wrap(err, fmt.Sprintf("unable to check if table exists for collation check: %q", tableName))
		} else if exists == 0 {
			continue
		}

		var tableCollation string
		if err := ss.GetMasterX().Get(&tableCollation, "SELECT table_collation FROM information_schema.tables WHERE table_schema = DATABASE() AND LOWER(table_name) = ?", tableName); err != nil {
			return errors.Wrap(err, fmt.Sprintf("unable to get table collation: %q", tableName))
		}

		if tableCollation != connCollation.Value {
			mlog.Warn("Table collation mismatch", mlog.String("table_name", tableName), mlog.String("connection_collation", connCollation.Value), mlog.String("table_collation", tableCollation))
		}
	}

	return nil
}

// versionString converts an integer representation of a DB version
// to a pretty-printed string.
// Postgres doesn't follow three-part version numbers from 10.0 onwards:
// https://www.postgresql.org/docs/13/libpq-status.html#LIBPQ-PQSERVERVERSION.
// For MySQL, we consider a major*1000 + minor*100 + patch format.
func versionString(v int, driver string) string {
	switch driver {
	case model.DatabaseDriverPostgres:
		minor := v % 10000
		major := v / 10000
		return strconv.Itoa(major) + "." + strconv.Itoa(minor)
	case model.DatabaseDriverMysql:
		minor := v % 1000
		major := v / 1000
		patch := minor % 100
		minor = minor / 100
		return strconv.Itoa(major) + "." + strconv.Itoa(minor) + "." + strconv.Itoa(patch)
	}
	return ""
}

func (ss *SqlStore) toReserveCase(str string) string {
	if ss.DriverName() == model.DatabaseDriverPostgres {
		return fmt.Sprintf("%q", str)
	}

	return fmt.Sprintf("`%s`", strings.Title(str))
}

func (ss *SqlStore) GetDBSchemaVersion() (int, error) {
	var version int
	if err := ss.GetMasterX().Get(&version, "SELECT Version FROM db_migrations ORDER BY Version DESC LIMIT 1"); err != nil {
		return 0, errors.Wrap(err, "unable to select from db_migrations")
	}
	return version, nil
}

func (ss *SqlStore) GetAppliedMigrations() ([]model.AppliedMigration, error) {
	migrations := []model.AppliedMigration{}
	if err := ss.GetMasterX().Select(&migrations, "SELECT Version, Name FROM db_migrations ORDER BY Version DESC"); err != nil {
		return nil, errors.Wrap(err, "unable to select from db_migrations")
	}

	return migrations, nil
}
