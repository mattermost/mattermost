// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

// bot is a subset of the model.Bot type, omitting the model.User fields.
type bot struct {
	UserId      string `json:"user_id"`
	Description string `json:"description"`
	OwnerId     string `json:"owner_id"`
	CreateAt    int64  `json:"create_at"`
	UpdateAt    int64  `json:"update_at"`
	DeleteAt    int64  `json:"delete_at"`
}

func botFromModel(b *model.Bot) *bot {
	return &bot{
		UserId:      b.UserId,
		Description: b.Description,
		OwnerId:     b.OwnerId,
		CreateAt:    b.CreateAt,
		UpdateAt:    b.UpdateAt,
		DeleteAt:    b.DeleteAt,
	}
}

// SqlBotStore is a store for managing bots in the database.
// Bots are otherwise normal users with extra metadata record in the Bots table. The primary key
// for a bot matches the primary key value for corresponding User record.
type SqlBotStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

// NewSqlBotStore creates an instance of SqlBotStore, registering the table schema in question.
func NewSqlBotStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.BotStore {
	us := &SqlBotStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(bot{}, "Bots").SetKeys(false, "UserId")
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("Description").SetMaxSize(1024)
		table.ColMap("OwnerId").SetMaxSize(model.BOT_CREATOR_ID_MAX_RUNES)
	}

	return us
}

func (us SqlBotStore) CreateIndexesIfNotExists() {
}

// traceBot is a helper function for adding to a bot trace when logging.
func traceBot(bot *model.Bot, extra map[string]interface{}) map[string]interface{} {
	trace := make(map[string]interface{})
	for key, value := range bot.Trace() {
		trace[key] = value
	}
	for key, value := range extra {
		trace[key] = value
	}

	return trace
}

// Get fetches the given bot in the database.
func (us SqlBotStore) Get(botUserId string, includeDeleted bool) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		var excludeDeletedSql = "AND b.DeleteAt = 0"
		if includeDeleted {
			excludeDeletedSql = ""
		}

		var bot *model.Bot
		if err := us.GetReplica().SelectOne(&bot, `
			SELECT
			    b.UserId,
			    u.Username,
			    u.FirstName AS DisplayName,
			    b.Description,
			    b.OwnerId,
			    b.CreateAt,
			    b.UpdateAt,
			    b.DeleteAt
			FROM
			    Bots b
			JOIN
			    Users u ON (u.Id = b.UserId)
			WHERE
			    b.UserId = :user_id
			    `+excludeDeletedSql+`
		`, map[string]interface{}{
			"user_id": botUserId,
		}); err == sql.ErrNoRows {
			result.Err = model.MakeBotNotFoundError(botUserId)
		} else if err != nil {
			result.Err = model.NewAppError("SqlBotStore.Get", "store.sql_bot.get.app_error", map[string]interface{}{"user_id": botUserId}, err.Error(), http.StatusInternalServerError)
		} else {
			result.Data = bot
		}
	})
}

// GetAll fetches from all bots in the database.
func (us SqlBotStore) GetAll(options *model.BotGetOptions) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		params := map[string]interface{}{
			"offset": options.Page * options.PerPage,
			"limit":  options.PerPage,
		}

		var conditions []string
		var conditionsSql string
		var additionalJoin string

		if !options.IncludeDeleted {
			conditions = append(conditions, "b.DeleteAt = 0")
		}
		if options.OwnerId != "" {
			conditions = append(conditions, "b.OwnerId = :creator_id")
			params["creator_id"] = options.OwnerId
		}
		if options.OnlyOrphaned {
			additionalJoin = "JOIN Users o ON (o.Id = b.OwnerId)"
			conditions = append(conditions, "o.DeleteAt != 0")
		}

		if len(conditions) > 0 {
			conditionsSql = "WHERE " + strings.Join(conditions, " AND ")
		}

		sql := `
			SELECT
			    b.UserId,
			    u.Username,
			    u.FirstName AS DisplayName,
			    b.Description,
			    b.OwnerId,
			    b.CreateAt,
			    b.UpdateAt,
			    b.DeleteAt
			FROM
			    Bots b
			JOIN
			    Users u ON (u.Id = b.UserId)
			` + additionalJoin + `
			` + conditionsSql + `
			ORDER BY
			    b.CreateAt ASC,
			    u.Username ASC
			LIMIT
			    :limit
			OFFSET
			    :offset
		`

		var data []*model.Bot
		if _, err := us.GetReplica().Select(&data, sql, params); err != nil {
			result.Err = model.NewAppError("SqlBotStore.GetAll", "store.sql_bot.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		result.Data = data
	})
}

// Save persists a new bot to the database.
// It assumes the corresponding user was saved via the user store.
func (us SqlBotStore) Save(bot *model.Bot) store.StoreChannel {
	bot = bot.Clone()

	return store.Do(func(result *store.StoreResult) {
		bot.PreSave()
		if result.Err = bot.IsValid(); result.Err != nil {
			return
		}

		if err := us.GetMaster().Insert(botFromModel(bot)); err != nil {
			result.Err = model.NewAppError("SqlBotStore.Save", "store.sql_bot.save.app_error", bot.Trace(), err.Error(), http.StatusInternalServerError)
			return
		}

		result.Data = bot
	})
}

// Update persists an updated bot to the database.
// It assumes the corresponding user was updated via the user store.
func (us SqlBotStore) Update(bot *model.Bot) store.StoreChannel {
	bot = bot.Clone()

	return store.Do(func(result *store.StoreResult) {
		bot.PreUpdate()
		if result.Err = bot.IsValid(); result.Err != nil {
			return
		}

		oldBotResult := <-us.Get(bot.UserId, true)
		if oldBotResult.Err != nil {
			result.Err = oldBotResult.Err
			return
		}
		oldBot := oldBotResult.Data.(*model.Bot)

		oldBot.Description = bot.Description
		oldBot.OwnerId = bot.OwnerId
		oldBot.UpdateAt = bot.UpdateAt
		oldBot.DeleteAt = bot.DeleteAt
		bot = oldBot

		if count, err := us.GetMaster().Update(botFromModel(bot)); err != nil {
			result.Err = model.NewAppError("SqlBotStore.Update", "store.sql_bot.update.updating.app_error", bot.Trace(), err.Error(), http.StatusInternalServerError)
		} else if count != 1 {
			result.Err = model.NewAppError("SqlBotStore.Update", "store.sql_bot.update.app_error", traceBot(bot, map[string]interface{}{"count": count}), "", http.StatusInternalServerError)
		}

		result.Data = bot
	})
}

// PermanentDelete removes the bot from the database altogether.
// If the corresponding user is to be deleted, it must be done via the user store.
func (us SqlBotStore) PermanentDelete(botUserId string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		userResult := <-us.User().PermanentDelete(botUserId)
		if userResult.Err != nil {
			result.Err = userResult.Err
			return
		}

		if _, err := us.GetMaster().Exec(`
			DELETE FROM
			    Bots
			WHERE
			    UserId = :user_id
		`, map[string]interface{}{
			"user_id": botUserId,
		}); err != nil {
			result.Err = model.NewAppError("SqlBotStore.Update", "store.sql_bot.delete.app_error", map[string]interface{}{"user_id": botUserId}, err.Error(), http.StatusBadRequest)
		}
	})
}
