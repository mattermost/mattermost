// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"net/http"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

// bot is a subset of the model.Bot type, omitting the model.User fields.
type bot struct {
	UserId         string `json:"user_id"`
	Description    string `json:"description"`
	OwnerId        string `json:"owner_id"`
	LastIconUpdate int64  `json:"last_icon_update"`
	CreateAt       int64  `json:"create_at"`
	UpdateAt       int64  `json:"update_at"`
	DeleteAt       int64  `json:"delete_at"`
}

func botFromModel(b *model.Bot) *bot {
	return &bot{
		UserId:         b.UserId,
		Description:    b.Description,
		OwnerId:        b.OwnerId,
		LastIconUpdate: b.LastIconUpdate,
		CreateAt:       b.CreateAt,
		UpdateAt:       b.UpdateAt,
		DeleteAt:       b.DeleteAt,
	}
}

// SqlBotStore is a store for managing bots in the database.
// Bots are otherwise normal users with extra metadata record in the Bots table. The primary key
// for a bot matches the primary key value for corresponding User record.
type SqlBotStore struct {
	SqlStore
	metrics einterfaces.MetricsInterface
}

// newSqlBotStore creates an instance of SqlBotStore, registering the table schema in question.
func newSqlBotStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.BotStore {
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

func (us SqlBotStore) createIndexesIfNotExists() {
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
func (us SqlBotStore) Get(botUserId string, includeDeleted bool) (*model.Bot, *model.AppError) {
	query := us.getQueryBuilder().
		Select("b.UserId", "u.Username", "u.FirstName AS DisplayName", "b.Description", "b.OwnerId", "COALESCE(b.LastIconUpdate, 0) AS LastIconUpdate", "b.CreateAt", "b.UpdateAt", "b.DeleteAt").
		From("Bots b").
		Join("Users u ON (u.Id = b.UserId)").
		Where(sq.Eq{"b.UserId": botUserId})

	if !includeDeleted {
		query = query.Where(sq.Eq{"b.DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlBotStore.Get", "store.sql_bot.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var bot *model.Bot
	if err := us.GetReplica().SelectOne(&bot, queryString, args...); err == sql.ErrNoRows {
		return nil, model.MakeBotNotFoundError(botUserId)
	} else if err != nil {
		return nil, model.NewAppError("SqlBotStore.Get", "store.sql_bot.get.app_error", map[string]interface{}{"user_id": botUserId}, err.Error(), http.StatusInternalServerError)
	}

	return bot, nil
}

// GetAll fetches from all bots in the database.
func (us SqlBotStore) GetAll(options *model.BotGetOptions) ([]*model.Bot, *model.AppError) {
	query := us.getQueryBuilder().
		Select("b.UserId", "u.Username", "u.FirstName AS DisplayName", "b.Description", "b.OwnerId", "COALESCE(b.LastIconUpdate, 0) AS LastIconUpdate", "b.CreateAt", "b.UpdateAt", "b.DeleteAt").
		From("Bots b").
		Join("Users u ON (u.Id = b.UserId)").
		OrderBy("b.CreateAt ASC", "u.Username ASC").
		Limit(uint64(options.PerPage)).
		Offset(uint64(options.Page * options.PerPage))

	if !options.IncludeDeleted {
		query = query.Where(sq.Eq{"b.DeleteAt": 0})
	}

	if options.OwnerId != "" {
		query = query.Where(sq.Eq{"b.OwnerId": options.OwnerId})
	}

	if options.OnlyOrphaned {
		query = query.
			Join("Users o ON (o.Id = b.OwnerId)").
			Where(sq.NotEq{"o.DeleteAt": 0})
	}

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, model.NewAppError("SqlBotStore.GetAll", "store.sql_bot.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var bots []*model.Bot
	if _, err := us.GetReplica().Select(&bots, queryString, args...); err != nil {
		return nil, model.NewAppError("SqlBotStore.GetAll", "store.sql_bot.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return bots, nil
}

// Save persists a new bot to the database.
// It assumes the corresponding user was saved via the user store.
func (us SqlBotStore) Save(bot *model.Bot) (*model.Bot, *model.AppError) {
	bot = bot.Clone()
	bot.PreSave()

	if err := bot.IsValid(); err != nil {
		return nil, err
	}

	if err := us.GetMaster().Insert(botFromModel(bot)); err != nil {
		return nil, model.NewAppError("SqlBotStore.Save", "store.sql_bot.save.app_error", bot.Trace(), err.Error(), http.StatusInternalServerError)
	}

	return bot, nil
}

// Update persists an updated bot to the database.
// It assumes the corresponding user was updated via the user store.
func (us SqlBotStore) Update(bot *model.Bot) (*model.Bot, *model.AppError) {
	bot = bot.Clone()

	bot.PreUpdate()
	if err := bot.IsValid(); err != nil {
		return nil, err
	}

	oldBot, err := us.Get(bot.UserId, true)
	if err != nil {
		return nil, err
	}

	oldBot.Description = bot.Description
	oldBot.OwnerId = bot.OwnerId
	oldBot.LastIconUpdate = bot.LastIconUpdate
	oldBot.UpdateAt = bot.UpdateAt
	oldBot.DeleteAt = bot.DeleteAt
	bot = oldBot

	if count, err := us.GetMaster().Update(botFromModel(bot)); err != nil {
		return nil, model.NewAppError("SqlBotStore.Update", "store.sql_bot.update.updating.app_error", bot.Trace(), err.Error(), http.StatusInternalServerError)
	} else if count != 1 {
		return nil, model.NewAppError("SqlBotStore.Update", "store.sql_bot.update.app_error", traceBot(bot, map[string]interface{}{"count": count}), "", http.StatusInternalServerError)
	}

	return bot, nil
}

// PermanentDelete removes the bot from the database altogether.
// If the corresponding user is to be deleted, it must be done via the user store.
func (us SqlBotStore) PermanentDelete(botUserId string) *model.AppError {
	query := "DELETE FROM Bots WHERE UserId = :user_id"
	if _, err := us.GetMaster().Exec(query, map[string]interface{}{"user_id": botUserId}); err != nil {
		return model.NewAppError("SqlBotStore.Update", "store.sql_bot.delete.app_error", map[string]interface{}{"user_id": botUserId}, err.Error(), http.StatusBadRequest)
	}
	return nil
}
