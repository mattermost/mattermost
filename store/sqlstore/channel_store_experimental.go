// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

// publicChannel is a subset of the metadata corresponding to public channels only.
type publicChannel struct {
	Id          string `json:"id"`
	DeleteAt    int64  `json:"delete_at"`
	TeamId      string `json:"team_id"`
	DisplayName string `json:"display_name"`
	Name        string `json:"name"`
	Header      string `json:"header"`
	Purpose     string `json:"purpose"`
}

type SqlChannelStoreExperimental struct {
	SqlChannelStore
	experimentalPublicChannelsMaterializationDisabled *uint32
}

func NewSqlChannelStoreExperimental(sqlStore SqlStore, metrics einterfaces.MetricsInterface, enabled bool) store.ChannelStore {
	s := &SqlChannelStoreExperimental{
		SqlChannelStore:                                   *NewSqlChannelStore(sqlStore, metrics).(*SqlChannelStore),
		experimentalPublicChannelsMaterializationDisabled: new(uint32),
	}

	if enabled {
		// Forcibly log, since the default state is enabled and we want this on startup.
		mlog.Info("Enabling experimental public channels materialization")
		s.EnableExperimentalPublicChannelsMaterialization()
	} else {
		s.DisableExperimentalPublicChannelsMaterialization()
	}

	if s.IsExperimentalPublicChannelsMaterializationEnabled() {
		for _, db := range sqlStore.GetAllConns() {
			tablePublicChannels := db.AddTableWithName(publicChannel{}, "PublicChannels").SetKeys(false, "Id")
			tablePublicChannels.ColMap("Id").SetMaxSize(26)
			tablePublicChannels.ColMap("TeamId").SetMaxSize(26)
			tablePublicChannels.ColMap("DisplayName").SetMaxSize(64)
			tablePublicChannels.ColMap("Name").SetMaxSize(64)
			tablePublicChannels.SetUniqueTogether("Name", "TeamId")
			tablePublicChannels.ColMap("Header").SetMaxSize(1024)
			tablePublicChannels.ColMap("Purpose").SetMaxSize(250)
		}
	}

	return s
}

// migratePublicChannels initializes the PublicChannels table with data created before the triggers
// took over keeping it up-to-date.
func (s SqlChannelStoreExperimental) MigratePublicChannels() error {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.MigratePublicChannels()
	}

	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return err
	}

	if _, err := transaction.Exec(`
		INSERT INTO PublicChannels
		    (Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
		SELECT
		    c.Id, c.DeleteAt, c.TeamId, c.DisplayName, c.Name, c.Header, c.Purpose
		FROM
		    Channels c
		LEFT JOIN
		    PublicChannels pc ON (pc.Id = c.Id)
		WHERE
		    c.Type = 'O'
		AND pc.Id IS NULL
	`); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return err
	}

	return nil
}

// DropPublicChannels removes the public channels table and all associated triggers.
func (s SqlChannelStoreExperimental) DropPublicChannels() error {
	// Only PostgreSQL will honour the transaction when executing the DDL changes below.
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return err
	}

	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels ON Channels
		`); err != nil {
			return err
		}
		if _, err := transaction.Exec(`
			DROP FUNCTION IF EXISTS channels_copy_to_public_channels
		`); err != nil {
			return err
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_insert
		`); err != nil {
			return err
		}
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_update
		`); err != nil {
			return err
		}
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_delete
		`); err != nil {
			return err
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_SQLITE {
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_insert
		`); err != nil {
			return err
		}
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_update_delete
		`); err != nil {
			return err
		}
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_update
		`); err != nil {
			return err
		}
		if _, err := transaction.Exec(`
			DROP TRIGGER IF EXISTS trigger_channels_delete
		`); err != nil {
			return err
		}
	} else {
		return errors.New("failed to create trigger because of missing driver")
	}

	if _, err := transaction.Exec(`
		DROP TABLE IF EXISTS PublicChannels
	`); err != nil {
		return err
	}

	if err := transaction.Commit(); err != nil {
		return err
	}

	return nil
}

func (s SqlChannelStoreExperimental) CreateIndexesIfNotExists() {
	s.SqlChannelStore.CreateIndexesIfNotExists()

	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return
	}

	s.CreateIndexIfNotExists("idx_publicchannels_team_id", "PublicChannels", "TeamId")
	s.CreateIndexIfNotExists("idx_publicchannels_name", "PublicChannels", "Name")
	s.CreateIndexIfNotExists("idx_publicchannels_delete_at", "PublicChannels", "DeleteAt")
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		s.CreateIndexIfNotExists("idx_publicchannels_name_lower", "PublicChannels", "lower(Name)")
		s.CreateIndexIfNotExists("idx_publicchannels_displayname_lower", "PublicChannels", "lower(DisplayName)")
	}
	s.CreateFullTextIndexIfNotExists("idx_publicchannels_search_txt", "PublicChannels", "Name, DisplayName, Purpose")
}

func (s SqlChannelStoreExperimental) CreateTriggersIfNotExists() error {
	s.SqlChannelStore.CreateTriggersIfNotExists()

	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return nil
	}

	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		if !s.DoesTriggerExist("trigger_channels") {
			transaction, err := s.GetMaster().Begin()
			if err != nil {
				return errors.Wrap(err, "failed to create trigger function")
			}

			if _, err := transaction.ExecNoTimeout(`
				CREATE OR REPLACE FUNCTION channels_copy_to_public_channels() RETURNS TRIGGER
				    SECURITY DEFINER
				    LANGUAGE plpgsql
				AS $$
				    DECLARE
				    	counter int := 0;
				    BEGIN
				    	IF (TG_OP = 'DELETE' AND OLD.Type = 'O') OR (TG_OP = 'UPDATE' AND NEW.Type != 'O') THEN
					    DELETE FROM
				    		PublicChannels
				    	    WHERE
				    		Id = OLD.Id;
				    	ELSEIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.Type = 'O' THEN
				    	    UPDATE
				    		PublicChannels
					    SET
				    	        DeleteAt = NEW.DeleteAt,
				    		TeamId = NEW.TeamId,
				    		DisplayName = NEW.DisplayName,
				    		Name = NEW.Name,
				    		Header = NEW.Header,
				    		Purpose = NEW.Purpose
				    	    WHERE
				    	        Id = NEW.Id;

				    	    -- There's a race condition here where the INSERT might fail, though this should only occur
					    -- if PublicChannels had been modified outside of the triggers. We could improve this with 
					    -- the UPSERT functionality in Postgres 9.5+ once we support same.
				    	    IF NOT FOUND THEN
				    	        INSERT INTO
				    		    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
				    		VALUES
				    		    (NEW.Id, NEW.DeleteAt, NEW.TeamId, NEW.DisplayName, NEW.Name, NEW.Header, NEW.Purpose);
				    	    END IF;
				    	END IF;

				    	RETURN NULL;
				    END
				$$;
			`); err != nil {
				return errors.Wrap(err, "failed to create trigger function")
			}

			if _, err := transaction.ExecNoTimeout(`
				CREATE TRIGGER
				    trigger_channels
				AFTER INSERT OR UPDATE OR DELETE ON
				    Channels
				FOR EACH ROW EXECUTE PROCEDURE
				    channels_copy_to_public_channels();
			`); err != nil {
				return errors.Wrap(err, "failed to create trigger")
			}

			if err := transaction.Commit(); err != nil {
				return errors.Wrap(err, "failed to create trigger function")
			}
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		// Note that DDL statements in MySQL (CREATE TABLE, CREATE TRIGGER, etc.) cannot
		// be rolled back inside a transaction (unlike PostgreSQL), so there's no point in
		// wrapping what follows inside a transaction.

		if !s.DoesTriggerExist("trigger_channels_insert") {
			if _, err := s.GetMaster().ExecNoTimeout(`
				CREATE TRIGGER
				    trigger_channels_insert
				AFTER INSERT ON
				    Channels
				FOR EACH ROW
				BEGIN
				    IF NEW.Type = 'O' THEN
				        INSERT INTO
					    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
					VALUES
					    (NEW.Id, NEW.DeleteAt, NEW.TeamId, NEW.DisplayName, NEW.Name, NEW.Header, NEW.Purpose)
					ON DUPLICATE KEY UPDATE
					    DeleteAt = NEW.DeleteAt,
					    TeamId = NEW.TeamId,
					    DisplayName = NEW.DisplayName,
					    Name = NEW.Name,
					    Header = NEW.Header,
					    Purpose = NEW.Purpose;
				    END IF;
				END;
			`); err != nil {
				return errors.Wrap(err, "failed to create trigger_channels_insert trigger")
			}
		}

		if !s.DoesTriggerExist("trigger_channels_update") {
			if _, err := s.GetMaster().ExecNoTimeout(`
				CREATE TRIGGER
			  	    trigger_channels_update
				AFTER UPDATE ON
				    Channels
				FOR EACH ROW
				BEGIN
				    IF OLD.Type = 'O' AND NEW.Type != 'O' THEN
				        DELETE FROM
					    PublicChannels
					WHERE
					    Id = NEW.Id;
				    ELSEIF NEW.Type = 'O' THEN
					INSERT INTO
					    PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
					VALUES
					    (NEW.Id, NEW.DeleteAt, NEW.TeamId, NEW.DisplayName, NEW.Name, NEW.Header, NEW.Purpose)
					ON DUPLICATE KEY UPDATE
					    DeleteAt = NEW.DeleteAt,
					    TeamId = NEW.TeamId,
					    DisplayName = NEW.DisplayName,
					    Name = NEW.Name,
					    Header = NEW.Header,
					    Purpose = NEW.Purpose;
				    END IF;
				END;
			`); err != nil {
				return errors.Wrap(err, "failed to create trigger_channels_update trigger")
			}
		}

		if !s.DoesTriggerExist("trigger_channels_delete") {
			if _, err := s.GetMaster().ExecNoTimeout(`
				CREATE TRIGGER
				    trigger_channels_delete
				AFTER DELETE ON
				    Channels
				FOR EACH ROW
				BEGIN
				    IF OLD.Type = 'O' THEN
				        DELETE FROM
					    PublicChannels
					WHERE
					    Id = OLD.Id;
				    END IF;
				END;
			`); err != nil {
				return errors.Wrap(err, "failed to create trigger_channels_delete trigger")
			}
		}
	} else if s.DriverName() == model.DATABASE_DRIVER_SQLITE {
		if _, err := s.GetMaster().ExecNoTimeout(`
			CREATE TRIGGER IF NOT EXISTS
			    trigger_channels_insert
			AFTER INSERT ON
			    Channels
			FOR EACH ROW
			WHEN NEW.Type = 'O'
			BEGIN
			    -- Ideally, we'd leverage ON CONFLICT DO UPDATE below and make this INSERT resilient to pre-existing
			    -- data. However, the version of Sqlite we're compiling against doesn't support this. This isn't
		    	    -- critical, though, since we don't support Sqlite in production.
			    INSERT INTO
			        PublicChannels(Id, DeleteAt, TeamId, DisplayName, Name, Header, Purpose)
			    VALUES
			        (NEW.Id, NEW.DeleteAt, NEW.TeamId, NEW.DisplayName, NEW.Name, NEW.Header, NEW.Purpose);
			END;
		`); err != nil {
			return errors.Wrap(err, "failed to create trigger_channels_insert trigger")
		}

		if _, err := s.GetMaster().ExecNoTimeout(`
			CREATE TRIGGER IF NOT EXISTS
			    trigger_channels_update_delete
			AFTER UPDATE ON
			    Channels
			FOR EACH ROW
			WHEN
			    OLD.Type = 'O'
			AND NEW.Type != 'O'
			BEGIN
			    DELETE FROM
			        PublicChannels
			    WHERE
			        Id = NEW.Id;
			END;
		`); err != nil {
			return errors.Wrap(err, "failed to create trigger_channels_update_delete trigger")
		}

		if _, err := s.GetMaster().ExecNoTimeout(`
			CREATE TRIGGER IF NOT EXISTS
			    trigger_channels_update
			AFTER UPDATE ON
			    Channels
			FOR EACH ROW
			WHEN
			    OLD.Type != 'O'
			AND NEW.Type = 'O'
			BEGIN
			    -- See comments re: ON CONFLICT DO UPDATE above that would apply here as well.
			    UPDATE
			        PublicChannels
			    SET
			        DeleteAt = NEW.DeleteAt,
			        TeamId = NEW.TeamId,
			        DisplayName = NEW.DisplayName,
			        Name = NEW.Name,
			        Header = NEW.Header,
			        Purpose = NEW.Purpose
			    WHERE
			        Id = NEW.Id;
			END;
		`); err != nil {
			return errors.Wrap(err, "failed to create trigger_channels_update trigger")
		}

		if _, err := s.GetMaster().ExecNoTimeout(`
			CREATE TRIGGER IF NOT EXISTS
			    trigger_channels_delete
			AFTER UPDATE ON
			    Channels
			FOR EACH ROW
			WHEN
			    OLD.Type = 'O'
			BEGIN
			    DELETE FROM
			        PublicChannels
			    WHERE
				Id = OLD.Id;
			END;
		`); err != nil {
			return errors.Wrap(err, "failed to create trigger_channels_delete trigger")
		}
	} else {
		return errors.New("failed to create trigger because of missing driver")
	}

	return nil
}

func (s SqlChannelStoreExperimental) GetMoreChannels(teamId string, userId string, offset int, limit int) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.GetMoreChannels(teamId, userId, offset, limit)
	}

	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, `
			SELECT
			    Channels.*
			FROM
			    Channels
			JOIN
			    PublicChannels c ON (c.Id = Channels.Id)
			WHERE
			    c.TeamId = :TeamId
			AND c.DeleteAt = 0
			AND c.Id NOT IN (
			    SELECT
			        c.Id
			    FROM
			        PublicChannels c
			    JOIN
			        ChannelMembers cm ON (cm.ChannelId = c.Id)
			    WHERE
			        c.TeamId = :TeamId
			    AND cm.UserId = :UserId
			    AND c.DeleteAt = 0
			)
			ORDER BY
				c.DisplayName
			LIMIT :Limit
			OFFSET :Offset
		`, map[string]interface{}{
			"TeamId": teamId,
			"UserId": userId,
			"Limit":  limit,
			"Offset": offset,
		})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetMoreChannels", "store.sql_channel.get_more_channels.get.app_error", nil, "teamId="+teamId+", userId="+userId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = data
	})
}

func (s SqlChannelStoreExperimental) GetPublicChannelsForTeam(teamId string, offset int, limit int) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.GetPublicChannelsForTeam(teamId, offset, limit)
	}

	return store.Do(func(result *store.StoreResult) {
		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, `
			SELECT
			    Channels.*
			FROM
			    Channels
			JOIN
			    PublicChannels pc ON (pc.Id = Channels.Id)
			WHERE
			    pc.TeamId = :TeamId
			AND pc.DeleteAt = 0
			ORDER BY pc.DisplayName
			LIMIT :Limit
			OFFSET :Offset
		`, map[string]interface{}{
			"TeamId": teamId,
			"Limit":  limit,
			"Offset": offset,
		})

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsForTeam", "store.sql_channel.get_public_channels.get.app_error", nil, "teamId="+teamId+", err="+err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = data
	})
}

func (s SqlChannelStoreExperimental) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.GetPublicChannelsByIdsForTeam(teamId, channelIds)
	}

	return store.Do(func(result *store.StoreResult) {
		props := make(map[string]interface{})
		props["teamId"] = teamId

		idQuery := ""

		for index, channelId := range channelIds {
			if len(idQuery) > 0 {
				idQuery += ", "
			}

			props["channelId"+strconv.Itoa(index)] = channelId
			idQuery += ":channelId" + strconv.Itoa(index)
		}

		data := &model.ChannelList{}
		_, err := s.GetReplica().Select(data, `
			SELECT
			    Channels.*
			FROM
			    Channels
			JOIN
			    PublicChannels pc ON (pc.Id = Channels.Id)
			WHERE
			    pc.TeamId = :teamId
			AND pc.DeleteAt = 0
			AND pc.Id IN (`+idQuery+`)
			ORDER BY pc.DisplayName
		`, props)

		if err != nil {
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.get.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if len(*data) == 0 {
			result.Err = model.NewAppError("SqlChannelStore.GetPublicChannelsByIdsForTeam", "store.sql_channel.get_channels_by_ids.not_found.app_error", nil, "", http.StatusNotFound)
		}

		result.Data = data
	})
}

func (s SqlChannelStoreExperimental) AutocompleteInTeam(teamId string, term string, includeDeleted bool) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.AutocompleteInTeam(teamId, term, includeDeleted)
	}

	return store.Do(func(result *store.StoreResult) {
		deleteFilter := "AND c.DeleteAt = 0"
		if includeDeleted {
			deleteFilter = ""
		}

		queryFormat := `
			SELECT
			    Channels.*
			FROM
			    Channels
			JOIN
			    PublicChannels c ON (c.Id = Channels.Id)
			WHERE
			    c.TeamId = :TeamId
			    ` + deleteFilter + `
			    %v
			LIMIT 50
		`

		var channels model.ChannelList

		if likeClause, likeTerm := s.buildLIKEClause(term); likeClause == "" {
			if _, err := s.GetReplica().Select(&channels, fmt.Sprintf(queryFormat, ""), map[string]interface{}{"TeamId": teamId}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		} else {
			// Using a UNION results in index_merge and fulltext queries and is much faster than the ref
			// query you would get using an OR of the LIKE and full-text clauses.
			fulltextClause, fulltextTerm := s.buildFulltextClause(term)
			likeQuery := fmt.Sprintf(queryFormat, "AND "+likeClause)
			fulltextQuery := fmt.Sprintf(queryFormat, "AND "+fulltextClause)
			query := fmt.Sprintf("(%v) UNION (%v) LIMIT 50", likeQuery, fulltextQuery)

			if _, err := s.GetReplica().Select(&channels, query, map[string]interface{}{"TeamId": teamId, "LikeTerm": likeTerm, "FulltextTerm": fulltextTerm}); err != nil {
				result.Err = model.NewAppError("SqlChannelStore.AutocompleteInTeam", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
			}
		}

		sort.Slice(channels, func(a, b int) bool {
			return strings.ToLower(channels[a].DisplayName) < strings.ToLower(channels[b].DisplayName)
		})
		result.Data = &channels
	})
}

func (s SqlChannelStoreExperimental) SearchInTeam(teamId string, term string, includeDeleted bool) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.SearchInTeam(teamId, term, includeDeleted)
	}

	return store.Do(func(result *store.StoreResult) {
		deleteFilter := "AND c.DeleteAt = 0"
		if includeDeleted {
			deleteFilter = ""
		}

		*result = s.performSearch(`
			SELECT
			    Channels.*
			FROM
			    Channels
			JOIN
			    PublicChannels c ON (c.Id = Channels.Id)
			WHERE
			    c.TeamId = :TeamId
			    `+deleteFilter+`
			    SEARCH_CLAUSE
			ORDER BY c.DisplayName
			LIMIT 100
		`, term, map[string]interface{}{
			"TeamId": teamId,
		})
	})
}

func (s SqlChannelStoreExperimental) SearchMore(userId string, teamId string, term string) store.StoreChannel {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.SearchMore(userId, teamId, term)
	}

	return store.Do(func(result *store.StoreResult) {
		*result = s.performSearch(`
			SELECT
			    Channels.*
			FROM
			    Channels
			JOIN
			    PublicChannels c ON (c.Id = Channels.Id)
			WHERE
			    c.TeamId = :TeamId
			AND c.DeleteAt = 0
			AND c.Id NOT IN (
			    SELECT
			        c.Id
			    FROM
			        PublicChannels c
			    JOIN
			        ChannelMembers cm ON (cm.ChannelId = c.Id)
			    WHERE
			        c.TeamId = :TeamId
			    AND cm.UserId = :UserId
			    AND c.DeleteAt = 0
		        )
			SEARCH_CLAUSE
			ORDER BY c.DisplayName
			LIMIT 100
		`, term, map[string]interface{}{
			"TeamId": teamId,
			"UserId": userId,
		})
	})
}

func (s SqlChannelStoreExperimental) buildLIKEClause(term string) (likeClause, likeTerm string) {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.buildLIKEClause(term)
	}

	likeTerm = term
	searchColumns := "c.Name, c.DisplayName, c.Purpose"

	// These chars must be removed from the like query.
	for _, c := range ignoreLikeSearchChar {
		likeTerm = strings.Replace(likeTerm, c, "", -1)
	}

	// These chars must be escaped in the like query.
	for _, c := range escapeLikeSearchChar {
		likeTerm = strings.Replace(likeTerm, c, "*"+c, -1)
	}

	if likeTerm == "" {
		return
	}

	// Prepare the LIKE portion of the query.
	var searchFields []string
	for _, field := range strings.Split(searchColumns, ", ") {
		if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
			searchFields = append(searchFields, fmt.Sprintf("lower(%s) LIKE lower(%s) escape '*'", field, ":LikeTerm"))
		} else {
			searchFields = append(searchFields, fmt.Sprintf("%s LIKE %s escape '*'", field, ":LikeTerm"))
		}
	}

	likeClause = fmt.Sprintf("(%s)", strings.Join(searchFields, " OR "))
	likeTerm += "%"
	return
}

func (s SqlChannelStoreExperimental) buildFulltextClause(term string) (fulltextClause, fulltextTerm string) {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.buildFulltextClause(term)
	}

	// Copy the terms as we will need to prepare them differently for each search type.
	fulltextTerm = term

	searchColumns := "c.Name, c.DisplayName, c.Purpose"

	// These chars must be treated as spaces in the fulltext query.
	for _, c := range spaceFulltextSearchChar {
		fulltextTerm = strings.Replace(fulltextTerm, c, " ", -1)
	}

	// Prepare the FULLTEXT portion of the query.
	if s.DriverName() == model.DATABASE_DRIVER_POSTGRES {
		fulltextTerm = strings.Replace(fulltextTerm, "|", "", -1)

		splitTerm := strings.Fields(fulltextTerm)
		for i, t := range strings.Fields(fulltextTerm) {
			if i == len(splitTerm)-1 {
				splitTerm[i] = t + ":*"
			} else {
				splitTerm[i] = t + ":* &"
			}
		}

		fulltextTerm = strings.Join(splitTerm, " ")

		fulltextClause = fmt.Sprintf("((%s) @@ to_tsquery(:FulltextTerm))", convertMySQLFullTextColumnsToPostgres(searchColumns))
	} else if s.DriverName() == model.DATABASE_DRIVER_MYSQL {
		splitTerm := strings.Fields(fulltextTerm)
		for i, t := range strings.Fields(fulltextTerm) {
			splitTerm[i] = "+" + t + "*"
		}

		fulltextTerm = strings.Join(splitTerm, " ")

		fulltextClause = fmt.Sprintf("MATCH(%s) AGAINST (:FulltextTerm IN BOOLEAN MODE)", searchColumns)
	}

	return
}

func (s SqlChannelStoreExperimental) performSearch(searchQuery string, term string, parameters map[string]interface{}) store.StoreResult {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		return s.SqlChannelStore.performSearch(searchQuery, term, parameters)
	}

	result := store.StoreResult{}

	likeClause, likeTerm := s.buildLIKEClause(term)
	if likeTerm == "" {
		// If the likeTerm is empty after preparing, then don't bother searching.
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "", 1)
	} else {
		parameters["LikeTerm"] = likeTerm
		fulltextClause, fulltextTerm := s.buildFulltextClause(term)
		parameters["FulltextTerm"] = fulltextTerm
		searchQuery = strings.Replace(searchQuery, "SEARCH_CLAUSE", "AND ("+likeClause+" OR "+fulltextClause+")", 1)
	}

	var channels model.ChannelList

	if _, err := s.GetReplica().Select(&channels, searchQuery, parameters); err != nil {
		result.Err = model.NewAppError("SqlChannelStore.Search", "store.sql_channel.search.app_error", nil, "term="+term+", "+", "+err.Error(), http.StatusInternalServerError)
		return result
	}

	result.Data = &channels
	return result
}

func (s SqlChannelStoreExperimental) EnableExperimentalPublicChannelsMaterialization() {
	if !s.IsExperimentalPublicChannelsMaterializationEnabled() {
		mlog.Info("Enabling experimental public channels materialization")
	}

	atomic.StoreUint32(s.experimentalPublicChannelsMaterializationDisabled, 0)
}

func (s SqlChannelStoreExperimental) DisableExperimentalPublicChannelsMaterialization() {
	if s.IsExperimentalPublicChannelsMaterializationEnabled() {
		mlog.Info("Disabling experimental public channels materialization")
	}

	atomic.StoreUint32(s.experimentalPublicChannelsMaterializationDisabled, 1)
}

func (s SqlChannelStoreExperimental) IsExperimentalPublicChannelsMaterializationEnabled() bool {
	return atomic.LoadUint32(s.experimentalPublicChannelsMaterializationDisabled) == 0
}
