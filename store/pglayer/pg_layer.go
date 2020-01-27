package pglayer

import (
	"os"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/lib/pq"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgLayer struct {
	sqlstore.SqlSupplier
	channelMemberHistoryStore PgChannelMemberHistoryStore
	channelStore              PgChannelStore
	commandStore              PgCommandStore
	fileInfoStore             PgFileInfoStore
	groupStore                PgGroupStore
	linkMetadataStore         PgLinkMetadataStore
	oAuthStore                PgOAuthStore
	pluginStore               PgPluginStore
	sessionStore              PgSessionStore
	reactionStore             PgReactionStore
	preferenceStore           PgPreferenceStore
	userAccessTokenStore      PgUserAccessTokenStore
	postStore                 PgPostStore
	teamStore                 PgTeamStore
	userStore                 PgUserStore
}

func NewPgLayer(baseStore sqlstore.SqlSupplier) *PgLayer {
	pgLayer := &PgLayer{SqlSupplier: baseStore}

	pgLayer.channelMemberHistoryStore = PgChannelMemberHistoryStore{SqlChannelMemberHistoryStore: *baseStore.ChannelMemberHistory().(*sqlstore.SqlChannelMemberHistoryStore)}
	pgLayer.channelStore = PgChannelStore{SqlChannelStore: *baseStore.Channel().(*sqlstore.SqlChannelStore), rootStore: pgLayer}
	pgLayer.commandStore = PgCommandStore{SqlCommandStore: *baseStore.Command().(*sqlstore.SqlCommandStore)}
	pgLayer.fileInfoStore = PgFileInfoStore{SqlFileInfoStore: *baseStore.FileInfo().(*sqlstore.SqlFileInfoStore)}
	pgLayer.groupStore = PgGroupStore{SqlGroupStore: baseStore.Group().(*sqlstore.SqlGroupStore), rootStore: pgLayer}
	pgLayer.linkMetadataStore = PgLinkMetadataStore{SqlLinkMetadataStore: *baseStore.LinkMetadata().(*sqlstore.SqlLinkMetadataStore)}
	pgLayer.oAuthStore = PgOAuthStore{SqlOAuthStore: *baseStore.OAuth().(*sqlstore.SqlOAuthStore)}
	pgLayer.pluginStore = PgPluginStore{SqlPluginStore: *baseStore.Plugin().(*sqlstore.SqlPluginStore)}
	pgLayer.sessionStore = PgSessionStore{SqlSessionStore: *baseStore.Session().(*sqlstore.SqlSessionStore)}
	pgLayer.reactionStore = PgReactionStore{SqlReactionStore: *baseStore.Reaction().(*sqlstore.SqlReactionStore)}
	pgLayer.preferenceStore = PgPreferenceStore{SqlPreferenceStore: *baseStore.Preference().(*sqlstore.SqlPreferenceStore)}
	pgLayer.userAccessTokenStore = PgUserAccessTokenStore{SqlUserAccessTokenStore: *baseStore.UserAccessToken().(*sqlstore.SqlUserAccessTokenStore)}
	pgLayer.postStore = PgPostStore{SqlPostStore: *baseStore.Post().(*sqlstore.SqlPostStore)}
	pgLayer.teamStore = PgTeamStore{SqlTeamStore: *baseStore.Team().(*sqlstore.SqlTeamStore)}
	pgLayer.userStore = PgUserStore{SqlUserStore: *baseStore.User().(*sqlstore.SqlUserStore), rootStore: pgLayer}
	return pgLayer
}

func (ss *PgLayer) DoesTableExist(tableName string) bool {
	count, err := ss.GetMaster().SelectInt(
		`SELECT count(relname) FROM pg_class WHERE relname=$1`,
		strings.ToLower(tableName),
	)

	if err != nil {
		mlog.Critical("Failed to check if table exists", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_TABLE_EXISTS)
	}

	return count > 0
}

func (ss *PgLayer) DoesColumnExist(tableName string, columnName string) bool {
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

		mlog.Critical("Failed to check if column exists", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_DOES_COLUMN_EXISTS_POSTGRES)
	}

	return count > 0
}

func (ss *PgLayer) DoesTriggerExist(triggerName string) bool {
	count, err := ss.GetMaster().SelectInt(`
		SELECT
			COUNT(0)
		FROM
			pg_trigger
		WHERE
			tgname = $1
	`, triggerName)

	if err != nil {
		mlog.Critical("Failed to check if trigger exists", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_GENERIC_FAILURE)
	}

	return count > 0
}

func (ss *PgLayer) CreateColumnIfNotExists(tableName string, columnName string, mySqlColType string, postgresColType string, defaultValue string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType + " DEFAULT '" + defaultValue + "'")
	if err != nil {
		mlog.Critical("Failed to create column", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_CREATE_COLUMN_POSTGRES)
	}

	return true
}

func (ss *PgLayer) CreateColumnIfNotExistsNoDefault(tableName string, columnName string, mySqlColType string, postgresColType string) bool {

	if ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	_, err := ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ADD " + columnName + " " + postgresColType)
	if err != nil {
		mlog.Critical("Failed to create column", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_CREATE_COLUMN_POSTGRES)
	}

	return true
}

func (ss *PgLayer) RenameColumnIfExists(tableName string, oldColumnName string, newColumnName string, colType string) bool {
	if !ss.DoesColumnExist(tableName, oldColumnName) {
		return false
	}

	var err error
	_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " RENAME COLUMN " + oldColumnName + " TO " + newColumnName)

	if err != nil {
		mlog.Critical("Failed to rename column", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_RENAME_COLUMN)
	}

	return true
}

func (ss *PgLayer) GetMaxLengthOfColumnIfExists(tableName string, columnName string) string {
	if !ss.DoesColumnExist(tableName, columnName) {
		return ""
	}

	var result string
	var err error
	result, err = ss.GetMaster().SelectStr("SELECT character_maximum_length FROM information_schema.columns WHERE table_name = '" + strings.ToLower(tableName) + "' AND column_name = '" + strings.ToLower(columnName) + "'")

	if err != nil {
		mlog.Critical("Failed to get max length of column", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_MAX_COLUMN)
	}

	return result
}

func (ss *PgLayer) AlterColumnTypeIfExists(tableName string, columnName string, mySqlColType string, postgresColType string) bool {
	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	var err error
	_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + strings.ToLower(tableName) + " ALTER COLUMN " + strings.ToLower(columnName) + " TYPE " + postgresColType)

	if err != nil {
		mlog.Critical("Failed to alter column type", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_ALTER_COLUMN)
	}

	return true
}

func (ss *PgLayer) AlterColumnDefaultIfExists(tableName string, columnName string, mySqlColDefault *string, postgresColDefault *string) bool {
	if !ss.DoesColumnExist(tableName, columnName) {
		return false
	}

	var defaultValue string
	// Postgres doesn't have the same limitation, but preserve the interface.
	if postgresColDefault == nil {
		return true
	}

	tableName = strings.ToLower(tableName)
	columnName = strings.ToLower(columnName)
	defaultValue = *postgresColDefault

	var err error
	if defaultValue == "" {
		_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ALTER COLUMN " + columnName + " DROP DEFAULT")
	} else {
		_, err = ss.GetMaster().ExecNoTimeout("ALTER TABLE " + tableName + " ALTER COLUMN " + columnName + " SET DEFAULT " + defaultValue)
	}

	if err != nil {
		mlog.Critical("Failed to alter column", mlog.String("table", tableName), mlog.String("column", columnName), mlog.String("default value", defaultValue), mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_GENERIC_FAILURE)
		return false
	}

	return true
}

func (ss *PgLayer) CreateUniqueIndexIfNotExists(indexName string, tableName string, columnName string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, []string{columnName}, sqlstore.INDEX_TYPE_DEFAULT, true)
}

func (ss *PgLayer) CreateIndexIfNotExists(indexName string, tableName string, columnName string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, []string{columnName}, sqlstore.INDEX_TYPE_DEFAULT, false)
}

func (ss *PgLayer) CreateCompositeIndexIfNotExists(indexName string, tableName string, columnNames []string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, columnNames, sqlstore.INDEX_TYPE_DEFAULT, false)
}

func (ss *PgLayer) CreateFullTextIndexIfNotExists(indexName string, tableName string, columnName string) bool {
	return ss.createIndexIfNotExists(indexName, tableName, []string{columnName}, sqlstore.INDEX_TYPE_FULL_TEXT, false)
}

func (ss *PgLayer) createIndexIfNotExists(indexName string, tableName string, columnNames []string, indexType string, unique bool) bool {

	uniqueStr := ""
	if unique {
		uniqueStr = "UNIQUE "
	}

	_, errExists := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
	// It should fail if the index does not exist
	if errExists == nil {
		return false
	}

	query := ""
	if indexType == sqlstore.INDEX_TYPE_FULL_TEXT {
		if len(columnNames) != 1 {
			mlog.Critical("Unable to create multi column full text index")
			os.Exit(sqlstore.EXIT_CREATE_INDEX_POSTGRES)
		}
		columnName := columnNames[0]
		postgresColumnNames := convertMySQLFullTextColumnsToPostgres(columnName)
		query = "CREATE INDEX " + indexName + " ON " + tableName + " USING gin(to_tsvector('english', " + postgresColumnNames + "))"
	} else {
		query = "CREATE " + uniqueStr + "INDEX " + indexName + " ON " + tableName + " (" + strings.Join(columnNames, ", ") + ")"
	}

	_, err := ss.GetMaster().ExecNoTimeout(query)
	if err != nil {
		mlog.Critical("Failed to create index", mlog.Err(errExists), mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_CREATE_INDEX_POSTGRES)
	}
	return true
}

func (ss *PgLayer) RemoveIndexIfExists(indexName string, tableName string) bool {
	_, err := ss.GetMaster().SelectStr("SELECT $1::regclass", indexName)
	// It should fail if the index does not exist
	if err != nil {
		return false
	}

	_, err = ss.GetMaster().ExecNoTimeout("DROP INDEX " + indexName)
	if err != nil {
		mlog.Critical("Failed to remove index", mlog.Err(err))
		time.Sleep(time.Second)
		os.Exit(sqlstore.EXIT_REMOVE_INDEX_POSTGRES)
	}

	return true
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

func (ss *PgLayer) ChannelMemberHistory() store.ChannelMemberHistoryStore {
	return ss.channelMemberHistoryStore
}

func (ss *PgLayer) Channel() store.ChannelStore {
	return ss.channelStore
}

func (ss *PgLayer) Command() store.CommandStore {
	return ss.commandStore
}

func (ss *PgLayer) FileInfo() store.FileInfoStore {
	return ss.fileInfoStore
}

func (ss *PgLayer) Group() store.GroupStore {
	return ss.groupStore
}

func (ss *PgLayer) LinkMetadata() store.LinkMetadataStore {
	return ss.linkMetadataStore
}

func (ss *PgLayer) OAuth() store.OAuthStore {
	return ss.oAuthStore
}

func (ss *PgLayer) Plugin() store.PluginStore {
	return ss.pluginStore
}

func (ss *PgLayer) Session() store.SessionStore {
	return ss.sessionStore
}

func (ss *PgLayer) Reaction() store.ReactionStore {
	return &ss.reactionStore
}

func (ss *PgLayer) Preference() store.PreferenceStore {
	return &ss.preferenceStore
}

func (ss *PgLayer) UserAccessToken() store.UserAccessTokenStore {
	return &ss.userAccessTokenStore
}

func (ss *PgLayer) Post() store.PostStore {
	return &ss.postStore
}

func (ss *PgLayer) Team() store.TeamStore {
	return &ss.teamStore
}

func (ss *PgLayer) User() store.UserStore {
	return &ss.userStore
}

func (ss *PgLayer) getQueryBuilder() sq.StatementBuilderType {
	builder := sq.StatementBuilder.PlaceholderFormat(sq.Question)
	builder = builder.PlaceholderFormat(sq.Dollar)
	return builder
}

func IsUniqueConstraintError(err error, indexName []string) bool {
	unique := false
	if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
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
