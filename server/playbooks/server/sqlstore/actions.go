// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"

	sq "github.com/Masterminds/squirrel"
	"github.com/go-sql-driver/mysql"
	"github.com/lib/pq"
	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
	"github.com/pkg/errors"
)

// playbookStore is a sql store for playbooks. Use NewPlaybookStore to create it.
type channelActionStore struct {
	pluginAPI           PluginAPIClient
	store               *SQLStore
	queryBuilder        sq.StatementBuilderType
	channelActionSelect sq.SelectBuilder
}

// NewPlaybookStore creates a new store for playbook service.
func NewChannelActionStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) app.ChannelActionStore {
	channelActionSelect := sqlStore.builder.
		Select(
			"c.ID",
			"c.ChannelID",
			"c.Enabled",
			"c.DeleteAt",
			"c.ActionType",
			"c.TriggerType",
			"c.Payload",
		).
		From("IR_ChannelAction c")

	return &channelActionStore{
		pluginAPI:           pluginAPI,
		store:               sqlStore,
		queryBuilder:        sqlStore.builder,
		channelActionSelect: channelActionSelect,
	}
}

// Create creates a new playbook
func (c *channelActionStore) Create(action app.GenericChannelAction) (string, error) {
	if action.ID != "" {
		return "", errors.New("ID should be empty")
	}
	action.ID = model.NewId()

	payloadJSON, err := json.Marshal(action.Payload)
	if err != nil {
		return "", errors.Wrapf(err, "failed to marshal payload json for action id: %q", action.ID)
	}

	if len(payloadJSON) > maxJSONLength {
		return "", errors.Wrapf(errors.New("invalid data"), "payload json for action id '%s' is too long (max %d)", action.ID, maxJSONLength)
	}

	_, err = c.store.execBuilder(c.store.db, sq.
		Insert("IR_ChannelAction").
		SetMap(map[string]interface{}{
			"ID":          action.ID,
			"ChannelID":   action.ChannelID,
			"Enabled":     action.Enabled,
			"DeleteAt":    action.DeleteAt,
			"ActionType":  action.ActionType,
			"TriggerType": action.TriggerType,
			"Payload":     payloadJSON,
		}))
	if err != nil {
		return "", errors.Wrap(err, "failed to store new action")
	}

	return action.ID, nil
}

func (c *channelActionStore) Get(id string) (app.GenericChannelAction, error) {
	if !model.IsValidId(id) {
		return app.GenericChannelAction{}, errors.New("ID is not valid")
	}

	var action app.GenericChannelAction
	err := c.store.getBuilder(c.store.db, &action, c.channelActionSelect.Where(sq.Eq{"c.ID": id}))
	if err == sql.ErrNoRows {
		return app.GenericChannelAction{}, errors.Wrapf(app.ErrNotFound, "action does not exist for id %q", id)
	} else if err != nil {
		return app.GenericChannelAction{}, errors.Wrapf(err, "failed to get action by id %q", id)
	}

	return action, nil
}

type sqlGenericChannelAction struct {
	app.GenericChannelActionWithoutPayload
	Payload json.RawMessage
}

func (c *channelActionStore) GetChannelActions(channelID string, options app.GetChannelActionOptions) ([]app.GenericChannelAction, error) {
	if !model.IsValidId(channelID) {
		return nil, errors.New("ID is not valid")
	}

	query := c.channelActionSelect.Where(sq.Eq{"c.ChannelID": channelID})

	if options.TriggerType != "" {
		query = query.Where(sq.Eq{"c.TriggerType": options.TriggerType})
	}

	if options.ActionType != "" {
		query = query.Where(sq.Eq{"c.ActionType": options.ActionType})
	}

	sqlActions := []sqlGenericChannelAction{}
	err := c.store.selectBuilder(c.store.db, &sqlActions, query)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "no actions for channel id %q", channelID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get actions for channel id %q", channelID)
	}

	actions := make([]app.GenericChannelAction, 0, len(sqlActions))
	for _, sqlAction := range sqlActions {
		switch sqlAction.ActionType {
		case app.ActionTypeWelcomeMessage:
			var welcomePayload app.WelcomeMessagePayload
			if err := json.Unmarshal(sqlAction.Payload, &welcomePayload); err != nil {
				return nil, errors.Wrapf(err, fmt.Sprintf("unable to unmarshal payload for action with ID %q and type %q", sqlAction.ID, sqlAction.ActionType), channelID)
			}

			action := app.GenericChannelAction{
				GenericChannelActionWithoutPayload: sqlAction.GenericChannelActionWithoutPayload,
				Payload:                            welcomePayload,
			}

			actions = append(actions, action)
		case app.ActionTypePromptRunPlaybook:
			var promptRunPlaybookPayload app.PromptRunPlaybookFromKeywordsPayload
			if err := json.Unmarshal(sqlAction.Payload, &promptRunPlaybookPayload); err != nil {
				return nil, errors.Wrapf(err, fmt.Sprintf("unable to unmarshal payload for action with ID %q and type %q", sqlAction.ID, sqlAction.ActionType), channelID)
			}

			action := app.GenericChannelAction{
				GenericChannelActionWithoutPayload: sqlAction.GenericChannelActionWithoutPayload,
				Payload:                            promptRunPlaybookPayload,
			}

			actions = append(actions, action)
		case app.ActionTypeCategorizeChannel:
			var categorizeChannelPayload app.CategorizeChannelPayload
			if err := json.Unmarshal(sqlAction.Payload, &categorizeChannelPayload); err != nil {
				return nil, errors.Wrapf(err, fmt.Sprintf("unable to unmarshal payload for action with ID %q and type %q", sqlAction.ID, sqlAction.ActionType), channelID)
			}

			action := app.GenericChannelAction{
				GenericChannelActionWithoutPayload: sqlAction.GenericChannelActionWithoutPayload,
				Payload:                            categorizeChannelPayload,
			}

			actions = append(actions, action)
		}
	}

	return actions, nil
}

func (c *channelActionStore) Update(action app.GenericChannelAction) error {
	if action.ID == "" {
		return errors.New("id should not be empty")
	}

	payloadJSON, err := json.Marshal(action.Payload)
	if err != nil {
		return errors.Wrapf(err, "failed to marshal payload json for action id: %q", action.ID)
	}

	_, err = c.store.execBuilder(c.store.db, sq.
		Update("IR_ChannelAction").
		SetMap(map[string]interface{}{
			"ID":          action.ID,
			"ChannelID":   action.ChannelID,
			"Enabled":     action.Enabled,
			"DeleteAt":    action.DeleteAt,
			"ActionType":  action.ActionType,
			"TriggerType": action.TriggerType,
			"Payload":     payloadJSON,
		}).
		Where(sq.Eq{"ID": action.ID}))

	if err != nil {
		return errors.Wrapf(err, "failed to update action with id '%s'", action.ID)
	}

	return nil
}

// HasViewed returns true if userID has viewed channelID
func (c *channelActionStore) HasViewedChannel(userID, channelID string) bool {
	query := sq.Expr(
		`SELECT EXISTS(SELECT *
                         FROM IR_ViewedChannel as vc
                        WHERE vc.ChannelID = ?
                          AND vc.UserID = ?)
             `, channelID, userID)

	var exists bool
	err := c.store.getBuilder(c.store.db, &exists, query)
	if err != nil {
		return false
	}

	return exists
}

// SetViewed records that userID has viewed channelID.
func (c *channelActionStore) SetViewedChannel(userID, channelID string) error {
	if c.HasViewedChannel(userID, channelID) {
		return nil
	}

	_, err := c.store.execBuilder(c.store.db, sq.
		Insert("IR_ViewedChannel").
		SetMap(map[string]interface{}{
			"ChannelID": channelID,
			"UserID":    userID,
		}))

	if err != nil {
		if c.store.db.DriverName() == model.DatabaseDriverMysql {
			me, ok := err.(*mysql.MySQLError)
			if ok && me.Number == 1062 {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		} else {
			pe, ok := err.(*pq.Error)
			if ok && pe.Code == "23505" {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		}

		return errors.Wrapf(err, "failed to store userID and channelID")
	}

	return nil
}

func (c *channelActionStore) SetMultipleViewedChannel(userIDs []string, channelID string) error {
	tx, err := c.store.db.Beginx()
	if err != nil {
		return errors.Wrap(err, "could not begin transaction")
	}
	defer c.store.finalizeTransaction(tx)

	// Retrieve the users that have already viewed the channel
	var usersToSkip []string
	err = c.store.selectBuilder(tx, &usersToSkip, sq.
		Select("UserID").
		From("IR_ViewedChannel").
		Where(sq.Eq{
			"UserID":    userIDs,
			"ChannelID": channelID,
		}))
	if err != nil && err != sql.ErrNoRows {
		return errors.Wrap(err, "unable to retrieve users that have already viewed the channel")
	}

	// Build a map out of the previous users for fast lookup
	usersToSkipMap := make(map[string]bool)
	for _, user := range usersToSkip {
		usersToSkipMap[user] = true
	}

	// Filter out the users in the map from the original array
	usersToSet := []string{}
	for _, user := range userIDs {
		if !usersToSkipMap[user] {
			usersToSet = append(usersToSet, user)
		}
	}

	if len(usersToSet) == 0 {
		return nil
	}

	// Set the channelID as viewed for every user in usersToSet
	query := sq.
		Insert("IR_ViewedChannel").
		Columns("UserID", "ChannelID")
	for _, user := range usersToSet {
		query = query.Values(user, channelID)
	}

	_, err = c.store.execBuilder(c.store.db, query)
	if err != nil {
		// If there's an error, return a specific one if possible
		if c.store.db.DriverName() == model.DatabaseDriverMysql {
			me, ok := err.(*mysql.MySQLError)
			if ok && me.Number == 1062 {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		} else {
			pe, ok := err.(*pq.Error)
			if ok && pe.Code == "23505" {
				return errors.Wrap(app.ErrDuplicateEntry, err.Error())
			}
		}

		return errors.Wrapf(err, "failed to store userIDs and channelID")
	}

	if err = tx.Commit(); err != nil {
		return errors.Wrap(err, "could not commit transaction")
	}

	return nil
}
