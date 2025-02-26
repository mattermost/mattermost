// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	sq "github.com/mattermost/squirrel"
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
	*SqlStore
	metrics einterfaces.MetricsInterface

	// botsQuery is a starting point for all queries that return one or more Bots.
	botsQuery sq.SelectBuilder
}

// newSqlBotStore creates an instance of SqlBotStore, registering the table schema in question.
func newSqlBotStore(sqlStore *SqlStore, metrics einterfaces.MetricsInterface) store.BotStore {
	bs := &SqlBotStore{
		SqlStore: sqlStore,
		metrics:  metrics,
	}

	// note: we are providing field names explicitly here to maintain order of columns (needed when using raw queries)
	bs.botsQuery = bs.getQueryBuilder().
		Select("b.UserId", "u.Username", "u.FirstName AS DisplayName", "b.Description", "b.OwnerId", "COALESCE(b.LastIconUpdate, 0) AS LastIconUpdate", "b.CreateAt", "b.UpdateAt", "b.DeleteAt").
		From("Bots b").
		Join("Users u ON ( u.Id = b.UserId )")

	return bs
}

// Get fetches the given bot in the database.
func (us SqlBotStore) Get(botUserId string, includeDeleted bool) (*model.Bot, error) {
	var excludeDeletedSql = "AND b.DeleteAt = 0"
	if includeDeleted {
		excludeDeletedSql = ""
	}

	query := `
		SELECT
			b.UserId,
			u.Username,
			u.FirstName AS DisplayName,
			b.Description,
			b.OwnerId,
			COALESCE(b.LastIconUpdate, 0) AS LastIconUpdate,
			b.CreateAt,
			b.UpdateAt,
			b.DeleteAt
		FROM
			Bots b
		JOIN
			Users u ON (u.Id = b.UserId)
		WHERE
			b.UserId = ?
			` + excludeDeletedSql + `
	`

	var bot model.Bot
	if err := us.GetReplica().Get(&bot, query, botUserId); err == sql.ErrNoRows {
		return nil, store.NewErrNotFound("Bot", botUserId)
	} else if err != nil {
		return nil, errors.Wrapf(err, "selectone: user_id=%s", botUserId)
	}

	return &bot, nil
}

// GetAll fetches from all bots in the database.
func (us SqlBotStore) GetAll(options *model.BotGetOptions) ([]*model.Bot, error) {
	var conditions []string
	var conditionsSql string
	var additionalJoin string
	var args []any

	if !options.IncludeDeleted {
		conditions = append(conditions, "b.DeleteAt = 0")
	}
	if options.OwnerId != "" {
		conditions = append(conditions, "b.OwnerId = ?")
		args = append(args, options.OwnerId)
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
			    COALESCE(b.LastIconUpdate, 0) AS LastIconUpdate,
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
			    ?
			OFFSET
			    ?
		`
	// append limit, offset
	args = append(args, options.PerPage, options.Page*options.PerPage)

	bots := []*model.Bot{}
	if err := us.GetReplica().Select(&bots, sql, args...); err != nil {
		return nil, errors.Wrap(err, "error selecting all bots")
	}

	return bots, nil
}

// Save persists a new bot to the database.
// It assumes the corresponding user was saved via the user store.
func (us SqlBotStore) Save(bot *model.Bot) (*model.Bot, error) {
	bot = bot.Clone()
	bot.PreSave()

	if err := bot.IsValid(); err != nil { // TODO: change to return error in v6.
		return nil, err
	}

	if _, err := us.GetMaster().NamedExec(`INSERT INTO Bots
		(UserId, Description, OwnerId, LastIconUpdate, CreateAt, UpdateAt, DeleteAt)
		VALUES
		(:UserId, :Description, :OwnerId, :LastIconUpdate, :CreateAt, :UpdateAt, :DeleteAt)`, botFromModel(bot)); err != nil {
		return nil, errors.Wrapf(err, "insert: user_id=%s", bot.UserId)
	}

	return bot, nil
}

// Update persists an updated bot to the database.
// It assumes the corresponding user was updated via the user store.
func (us SqlBotStore) Update(bot *model.Bot) (*model.Bot, error) {
	bot = bot.Clone()

	bot.PreUpdate()
	if err := bot.IsValid(); err != nil { // TODO: needs to return error in v6
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

	res, err := us.GetMaster().NamedExec(`UPDATE Bots
		SET Description=:Description, OwnerId=:OwnerId, LastIconUpdate=:LastIconUpdate,
			UpdateAt=:UpdateAt, DeleteAt=:DeleteAt
		WHERE UserId=:UserId`, botFromModel(bot))
	if err != nil {
		return nil, errors.Wrapf(err, "update: user_id=%s", bot.UserId)
	}
	count, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "error while getting rows_affected")
	}
	if count > 1 {
		return nil, fmt.Errorf("unexpected count while updating bot: count=%d, userId=%s", count, bot.UserId)
	}

	return bot, nil
}

// PermanentDelete removes the bot from the database altogether.
// If the corresponding user is to be deleted, it must be done via the user store.
func (us SqlBotStore) PermanentDelete(botUserId string) error {
	query := "DELETE FROM Bots WHERE UserId = ?"
	if _, err := us.GetMaster().Exec(query, botUserId); err != nil {
		return store.NewErrInvalidInput("Bot", "UserId", botUserId).Wrap(err)
	}
	return nil
}

func (us SqlBotStore) GetAllAfter(limit int, afterId string) ([]*model.Bot, error) {
	query := us.botsQuery.Where("b.UserId > ?", afterId).OrderBy("b.UserId ASC").Limit(uint64(limit))

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_all_after_tosql")
	}

	bots := []*model.Bot{}
	if err := us.GetReplica().Select(&bots, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to find Bots")
	}

	return bots, nil
}

// Get fetches the given bot in the database.
func (us SqlBotStore) GetByUsername(username string) (*model.Bot, error) {
	query := us.botsQuery.Where("u.Username = lower(?)", username)

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "get_by_username_tosql")
	}

	bot := model.Bot{}
	if err := us.GetReplica().Get(&bot, queryString, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.Wrap(store.NewErrNotFound("Bot", fmt.Sprintf("username=%s", username)), "failed to find Bot")
		}

		return nil, errors.Wrapf(err, "failed to find Bot with username=%s", username)
	}

	return &bot, nil
}
