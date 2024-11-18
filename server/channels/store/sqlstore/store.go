// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"
	"database/sql"
	dbsql "database/sql"
	"fmt"
	"path"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	sqlUtils "github.com/mattermost/mattermost/server/public/utils/sql"

	sq "github.com/mattermost/squirrel"

	"github.com/go-sql-driver/mysql"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"github.com/mattermost/morph/models"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/db"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
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
	DBPingAttempts                    = 5
	DBReplicaPingAttempts             = 2
	// This is a numerical version string by postgres. The format is
	// 2 characters for major, minor, and patch version prior to 10.
	// After 10, it's major and minor only.
	// 10.1 would be 100001.
	// 9.6.3 would be 90603.
	minimumRequiredPostgresVersion = 110000
	// major*1000 + minor*100 + patch
	minimumRequiredMySQLVersion = 8000

	migrationsDirectionUp   migrationDirection = "up"
	migrationsDirectionDown migrationDirection = "down"

	replicaLagPrefix = "replica-lag"

	RemoteClusterSiteURLUniqueIndex = "remote_clusters_site_url_unique"
)

var tablesToCheckForCollation = []string{"incomingwebhooks", "preferences", "users", "uploadsessions", "channels", "publicchannels"}

type SqlStoreStores struct {
	team                       store.TeamStore
	channel                    store.ChannelStore
	post                       store.PostStore
	retentionPolicy            store.RetentionPolicyStore
	thread                     store.ThreadStore
	user                       store.UserStore
	bot                        store.BotStore
	audit                      store.AuditStore
	cluster                    store.ClusterDiscoveryStore
	remoteCluster              store.RemoteClusterStore
	compliance                 store.ComplianceStore
	session                    store.SessionStore
	oauth                      store.OAuthStore
	outgoingOAuthConnection    store.OutgoingOAuthConnectionStore
	system                     store.SystemStore
	webhook                    store.WebhookStore
	command                    store.CommandStore
	commandWebhook             store.CommandWebhookStore
	preference                 store.PreferenceStore
	license                    store.LicenseStore
	token                      store.TokenStore
	emoji                      store.EmojiStore
	status                     store.StatusStore
	fileInfo                   store.FileInfoStore
	uploadSession              store.UploadSessionStore
	reaction                   store.ReactionStore
	job                        store.JobStore
	userAccessToken            store.UserAccessTokenStore
	plugin                     store.PluginStore
	channelMemberHistory       store.ChannelMemberHistoryStore
	role                       store.RoleStore
	scheme                     store.SchemeStore
	TermsOfService             store.TermsOfServiceStore
	productNotices             store.ProductNoticesStore
	group                      store.GroupStore
	UserTermsOfService         store.UserTermsOfServiceStore
	linkMetadata               store.LinkMetadataStore
	sharedchannel              store.SharedChannelStore
	draft                      store.DraftStore
	notifyAdmin                store.NotifyAdminStore
	postPriority               store.PostPriorityStore
	postAcknowledgement        store.PostAcknowledgementStore
	postPersistentNotification store.PostPersistentNotificationStore
	desktopTokens              store.DesktopTokensStore
	channelBookmarks           store.ChannelBookmarkStore
	scheduledPost              store.ScheduledPostStore
}

type SqlStore struct {
	// rrCounter and srCounter should be kept first.
	// See https://github.com/mattermost/mattermost/server/v8/channels/pull/7281
	rrCounter int64
	srCounter int64

	masterX *sqlxDBWrapper

	ReplicaXs []*atomic.Pointer[sqlxDBWrapper]

	searchReplicaXs []*atomic.Pointer[sqlxDBWrapper]

	replicaLagHandles []*dbsql.DB
	stores            SqlStoreStores
	settings          *model.SqlSettings
	lockedToMaster    bool
	context           context.Context
	license           *model.License
	licenseMutex      sync.RWMutex
	logger            mlog.LoggerIFace
	metrics           einterfaces.MetricsInterface

	isBinaryParam             bool
	pgDefaultTextSearchConfig string

	quitMonitor chan struct{}
	wgMonitor   *sync.WaitGroup
}

func New(settings model.SqlSettings, logger mlog.LoggerIFace, metrics einterfaces.MetricsInterface) (*SqlStore, error) {
	store := &SqlStore{
		rrCounter:   0,
		srCounter:   0,
		settings:    &settings,
		metrics:     metrics,
		logger:      logger,
		quitMonitor: make(chan struct{}),
		wgMonitor:   &sync.WaitGroup{},
	}

	err := store.initConnection()
	if err != nil {
		return nil, errors.Wrap(err, "error setting up connections")
	}

	store.wgMonitor.Add(1)
	go store.monitorReplicas()

	ver, err := store.GetDbVersion(true)
	if err != nil {
		return nil, errors.Wrap(err, "error while getting DB version")
	}

	ok, err := store.ensureMinimumDBVersion(ver)
	if !ok {
		return nil, errors.Wrap(err, "error while checking DB version")
	}

	err = store.ensureDatabaseCollation()
	if err != nil {
		return nil, errors.Wrap(err, "error while checking DB collation")
	}

	err = store.migrate(migrationsDirectionUp, false)
	if err != nil {
		return nil, errors.Wrap(err, "failed to apply database migrations")
	}

	store.isBinaryParam, err = store.computeBinaryParam()
	if err != nil {
		return nil, errors.Wrap(err, "failed to compute binary param")
	}

	store.pgDefaultTextSearchConfig, err = store.computeDefaultTextSearchConfig()
	if err != nil {
		return nil, errors.Wrap(err, "failed to compute default text search config")
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
	store.stores.outgoingOAuthConnection = newSqlOutgoingOAuthConnectionStore(store)
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
	store.stores.postPersistentNotification = newSqlPostPersistentNotificationStore(store)
	store.stores.desktopTokens = newSqlDesktopTokensStore(store, metrics)
	store.stores.channelBookmarks = newSqlChannelBookmarkStore(store)
	store.stores.scheduledPost = newScheduledPostStore(store)

	store.stores.preference.(*SqlPreferenceStore).deleteUnusedFeatures()

	return store, nil
}

func (ss *SqlStore) SetContext(context context.Context) {
	ss.context = context
}

func (ss *SqlStore) Context() context.Context {
	return ss.context
}

func (ss *SqlStore) Logger() mlog.LoggerIFace {
	return ss.logger
}

func noOpMapper(s string) string { return s }

func (ss *SqlStore) initConnection() error {
	dataSource := *ss.settings.DataSource
	if ss.DriverName() == model.DatabaseDriverMysql {
		// TODO: We ignore the readTimeout datasource parameter for MySQL since QueryTimeout
		// covers that already. Ideally we'd like to do this only for the upgrade
		// step. To be reviewed in MM-35789.
		var err error
		dataSource, err = sqlUtils.ResetReadTimeout(dataSource)
		if err != nil {
			return errors.Wrap(err, "failed to reset read timeout from datasource")
		}
	}

	handle, err := sqlUtils.SetupConnection(ss.Logger(), "master", dataSource, ss.settings, DBPingAttempts)
	if err != nil {
		return err
	}
	ss.masterX = newSqlxDBWrapper(sqlx.NewDb(handle, ss.DriverName()),
		time.Duration(*ss.settings.QueryTimeout)*time.Second,
		*ss.settings.Trace)
	if ss.DriverName() == model.DatabaseDriverMysql {
		ss.masterX.MapperFunc(noOpMapper)
	}
	if ss.metrics != nil {
		ss.metrics.RegisterDBCollector(ss.masterX.DB.DB, "master")
	}

	if len(ss.settings.DataSourceReplicas) > 0 {
		ss.ReplicaXs = make([]*atomic.Pointer[sqlxDBWrapper], len(ss.settings.DataSourceReplicas))
		for i, replica := range ss.settings.DataSourceReplicas {
			ss.ReplicaXs[i] = &atomic.Pointer[sqlxDBWrapper]{}
			handle, err = sqlUtils.SetupConnection(ss.Logger(), fmt.Sprintf("replica-%v", i), replica, ss.settings, DBReplicaPingAttempts)
			if err != nil {
				// Initializing to be offline
				ss.ReplicaXs[i].Store(&sqlxDBWrapper{isOnline: &atomic.Bool{}})
				mlog.Warn("Failed to setup connection. Skipping..", mlog.String("db", fmt.Sprintf("replica-%v", i)), mlog.Err(err))
				continue
			}
			ss.setDB(ss.ReplicaXs[i], handle, "replica-"+strconv.Itoa(i))
		}
	}

	if len(ss.settings.DataSourceSearchReplicas) > 0 {
		ss.searchReplicaXs = make([]*atomic.Pointer[sqlxDBWrapper], len(ss.settings.DataSourceSearchReplicas))
		for i, replica := range ss.settings.DataSourceSearchReplicas {
			ss.searchReplicaXs[i] = &atomic.Pointer[sqlxDBWrapper]{}
			handle, err = sqlUtils.SetupConnection(ss.Logger(), fmt.Sprintf("search-replica-%v", i), replica, ss.settings, DBReplicaPingAttempts)
			if err != nil {
				// Initializing to be offline
				ss.searchReplicaXs[i].Store(&sqlxDBWrapper{isOnline: &atomic.Bool{}})
				mlog.Warn("Failed to setup connection. Skipping..", mlog.String("db", fmt.Sprintf("search-replica-%v", i)), mlog.Err(err))
				continue
			}
			ss.setDB(ss.searchReplicaXs[i], handle, "searchreplica-"+strconv.Itoa(i))
		}
	}

	if len(ss.settings.ReplicaLagSettings) > 0 {
		ss.replicaLagHandles = make([]*dbsql.DB, len(ss.settings.ReplicaLagSettings))
		for i, src := range ss.settings.ReplicaLagSettings {
			if src.DataSource == nil {
				continue
			}
			ss.replicaLagHandles[i], err = sqlUtils.SetupConnection(ss.Logger(), fmt.Sprintf(replicaLagPrefix+"-%d", i), *src.DataSource, ss.settings, DBReplicaPingAttempts)
			if err != nil {
				mlog.Warn("Failed to setup replica lag handle. Skipping..", mlog.String("db", fmt.Sprintf(replicaLagPrefix+"-%d", i)), mlog.Err(err))
				continue
			}
		}
	}
	return nil
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

	for i := 0; i < len(ss.searchReplicaXs); i++ {
		rrNum := atomic.AddInt64(&ss.srCounter, 1) % int64(len(ss.searchReplicaXs))
		if ss.searchReplicaXs[rrNum].Load().Online() {
			return ss.searchReplicaXs[rrNum].Load()
		}
	}

	// If all search replicas are down, then go with replica.
	return ss.GetReplicaX()
}

func (ss *SqlStore) GetReplicaX() *sqlxDBWrapper {
	if len(ss.settings.DataSourceReplicas) == 0 || ss.lockedToMaster || !ss.hasLicense() {
		return ss.GetMasterX()
	}

	for i := 0; i < len(ss.ReplicaXs); i++ {
		rrNum := atomic.AddInt64(&ss.rrCounter, 1) % int64(len(ss.ReplicaXs))
		if ss.ReplicaXs[rrNum].Load().Online() {
			return ss.ReplicaXs[rrNum].Load()
		}
	}

	// If all replicas are down, then go with master.
	return ss.GetMasterX()
}

func (ss *SqlStore) monitorReplicas() {
	t := time.NewTicker(time.Duration(*ss.settings.ReplicaMonitorIntervalSeconds) * time.Second)
	defer func() {
		t.Stop()
		ss.wgMonitor.Done()
	}()
	for {
		select {
		case <-ss.quitMonitor:
			return
		case <-t.C:
			setupReplica := func(r *atomic.Pointer[sqlxDBWrapper], dsn, name string) {
				if r.Load().Online() {
					return
				}

				handle, err := sqlUtils.SetupConnection(ss.Logger(), name, dsn, ss.settings, 1)
				if err != nil {
					mlog.Warn("Failed to setup connection. Skipping..", mlog.String("db", name), mlog.Err(err))
					return
				}
				if ss.metrics != nil && r.Load() != nil && r.Load().DB != nil {
					ss.metrics.UnregisterDBCollector(r.Load().DB.DB, name)
				}
				ss.setDB(r, handle, name)
			}
			for i, replica := range ss.ReplicaXs {
				setupReplica(replica, ss.settings.DataSourceReplicas[i], "replica-"+strconv.Itoa(i))
			}

			for i, replica := range ss.searchReplicaXs {
				setupReplica(replica, ss.settings.DataSourceSearchReplicas[i], "search-replica-"+strconv.Itoa(i))
			}
		}
	}
}

func (ss *SqlStore) setDB(replica *atomic.Pointer[sqlxDBWrapper], handle *dbsql.DB, name string) {
	replica.Store(newSqlxDBWrapper(sqlx.NewDb(handle, ss.DriverName()),
		time.Duration(*ss.settings.QueryTimeout)*time.Second,
		*ss.settings.Trace))
	if ss.DriverName() == model.DatabaseDriverMysql {
		replica.Load().MapperFunc(noOpMapper)
	}
	if ss.metrics != nil {
		ss.metrics.RegisterDBCollector(replica.Load().DB.DB, name)
	}
}

func (ss *SqlStore) GetInternalReplicaDB() *sql.DB {
	if len(ss.settings.DataSourceReplicas) == 0 || ss.lockedToMaster || !ss.hasLicense() {
		return ss.GetMasterX().DB.DB
	}

	rrNum := atomic.AddInt64(&ss.rrCounter, 1) % int64(len(ss.ReplicaXs))
	return ss.ReplicaXs[rrNum].Load().DB.DB
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
		if !db.Load().Online() {
			continue
		}
		count = count + db.Load().Stats().OpenConnections
	}

	return count
}

func (ss *SqlStore) TotalSearchDbConnections() int {
	if len(ss.settings.DataSourceSearchReplicas) == 0 {
		return 0
	}

	count := 0
	for _, db := range ss.searchReplicaXs {
		if !db.Load().Online() {
			continue
		}
		count = count + db.Load().Stats().OpenConnections
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
	}
	mlog.Fatal("Failed to check if column exists because of missing driver")
	return false
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
	}
	mlog.Fatal("Failed to check if column exists because of missing driver")
	return false
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
	}
	mlog.Fatal("Failed to check if column exists because of missing driver")
	return false
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
	}
	mlog.Fatal("Failed to create column because of missing driver")
	return false
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
	all := make([]*sqlxDBWrapper, 0, len(ss.ReplicaXs)+1)
	for i := range ss.ReplicaXs {
		if !ss.ReplicaXs[i].Load().Online() {
			continue
		}
		all = append(all, ss.ReplicaXs[i].Load())
	}
	all = append(all, ss.masterX)
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
	// Closing monitor and waiting for it to be done.
	// This needs to be done before closing the replica handles.
	close(ss.quitMonitor)
	ss.wgMonitor.Wait()

	for _, replica := range ss.ReplicaXs {
		if replica.Load().Online() {
			replica.Load().Close()
		}
	}

	for _, replica := range ss.searchReplicaXs {
		if replica.Load().Online() {
			replica.Load().Close()
		}
	}

	for _, replica := range ss.replicaLagHandles {
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

func (ss *SqlStore) OutgoingOAuthConnection() store.OutgoingOAuthConnectionStore {
	return ss.stores.outgoingOAuthConnection
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

func (ss *SqlStore) PostPersistentNotification() store.PostPersistentNotificationStore {
	return ss.stores.postPersistentNotification
}

func (ss *SqlStore) DesktopTokens() store.DesktopTokensStore {
	return ss.stores.desktopTokens
}

func (ss *SqlStore) ChannelBookmark() store.ChannelBookmarkStore {
	return ss.stores.channelBookmarks
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
			return false, fmt.Errorf("Minimum MySQL version requirements not met. Found: %s, Wanted: %s", versionString(intVer, *ss.settings.DriverName), versionString(minimumRequiredMySQLVersion, *ss.settings.DriverName))
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

func (ss *SqlStore) GetLocalSchemaVersion() (int, error) {
	assets := db.Assets()

	assetsList, err := assets.ReadDir(path.Join("migrations", ss.DriverName()))
	if err != nil {
		return 0, err
	}

	maxVersion := 0
	for _, entry := range assetsList {
		// parse the version name from the file name
		m := models.Regex.FindStringSubmatch(entry.Name())
		if len(m) < 2 {
			return 0, fmt.Errorf("migration file name incorrectly formed: %s", entry.Name())
		}

		version, err := strconv.Atoi(m[1])
		if err != nil {
			return 0, err
		}
		// store the highest version
		if maxVersion < version {
			maxVersion = version
		}
	}
	return maxVersion, nil
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

func (ss *SqlStore) determineMaxColumnSize(tableName, columnName string) (int, error) {
	var columnSizeBytes int32
	ss.getQueryPlaceholder()

	if ss.DriverName() == model.DatabaseDriverPostgres {
		if err := ss.GetReplicaX().Get(&columnSizeBytes, `
			SELECT
				COALESCE(character_maximum_length, 0)
			FROM
				information_schema.columns
			WHERE
				lower(table_name) = lower($1)
			AND	lower(column_name) = lower($2)
		`, tableName, columnName); err != nil {
			mlog.Warn("Unable to determine the maximum supported column size for Postgres", mlog.Err(err))
			return 0, err
		}
	} else if ss.DriverName() == model.DatabaseDriverMysql {
		if err := ss.GetReplicaX().Get(&columnSizeBytes, `
			SELECT
				COALESCE(CHARACTER_MAXIMUM_LENGTH, 0)
			FROM
				INFORMATION_SCHEMA.COLUMNS
			WHERE
				table_schema = DATABASE()
			AND	lower(table_name) = lower(?)
			AND	lower(column_name) = lower(?)
			LIMIT 0, 1
		`, tableName, columnName); err != nil {
			mlog.Warn("Unable to determine the maximum supported column size for MySQL", mlog.Err(err))
			return 0, err
		}
	} else {
		mlog.Warn("No implementation found to determine the maximum supported column size")
	}

	// Assume a worst-case representation of four bytes per rune.
	maxColumnSize := int(columnSizeBytes) / 4

	mlog.Info("Column has size restrictions", mlog.String("table_name", tableName), mlog.String("column_name", columnName), mlog.Int("max_characters", maxColumnSize), mlog.Int("max_bytes", columnSizeBytes))

	return maxColumnSize, nil
}

func (ss *SqlStore) ScheduledPost() store.ScheduledPostStore {
	return ss.stores.scheduledPost
}
