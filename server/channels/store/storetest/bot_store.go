// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func makeBotWithUser(t *testing.T, rctx request.CTX, ss store.Store, bot *model.Bot) (*model.Bot, *model.User) {
	user, err := ss.User().Save(rctx, model.UserFromBot(bot))
	require.NoError(t, err)

	bot.UserId = user.Id
	bot, nErr := ss.Bot().Save(bot)
	require.NoError(t, nErr)

	return bot, user
}

func TestBotStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Get", func(t *testing.T) { testBotStoreGet(t, rctx, ss, s) })
	t.Run("GetByUsername", func(t *testing.T) { testBotStoreGetByUsername(t, rctx, ss) })
	t.Run("GetAll", func(t *testing.T) { testBotStoreGetAll(t, rctx, ss, s) })
	t.Run("GetAllAfter", func(t *testing.T) { testBotStoreGetAllAfter(t, rctx, ss) })
	t.Run("Save", func(t *testing.T) { testBotStoreSave(t, rctx, ss) })
	t.Run("Update", func(t *testing.T) { testBotStoreUpdate(t, rctx, ss) })
	t.Run("PermanentDelete", func(t *testing.T) { testBotStorePermanentDelete(t, rctx, ss) })
}

func testBotStoreGet(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	deletedBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "deleted_bot",
		Description:    "A deleted bot",
		OwnerId:        model.NewId(),
		LastIconUpdate: model.GetMillis(),
	})
	deletedBot.DeleteAt = 1
	deletedBot, err := ss.Bot().Update(deletedBot)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(deletedBot.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, deletedBot.UserId)) }()

	permanentlyDeletedBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "permanently_deleted_bot",
		Description:    "A permanently deleted bot",
		OwnerId:        model.NewId(),
		LastIconUpdate: model.GetMillis(),
		DeleteAt:       0,
	})
	require.NoError(t, ss.Bot().PermanentDelete(permanentlyDeletedBot.UserId))
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, permanentlyDeletedBot.UserId)) }()

	b1, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "b1",
		Description:    "The first bot",
		OwnerId:        model.NewId(),
		LastIconUpdate: model.GetMillis(),
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b1.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b1.UserId)) }()

	b2, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "b2",
		Description:    "The second bot",
		OwnerId:        model.NewId(),
		LastIconUpdate: 0,
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b2.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b2.UserId)) }()

	// Artificially set b2.LastIconUpdate to NULL to verify handling of same.
	_, sqlErr := s.GetMaster().Exec("UPDATE Bots SET LastIconUpdate = NULL WHERE UserId = '" + b2.UserId + "'")
	require.NoError(t, sqlErr)

	t.Run("get non-existent bot", func(t *testing.T) {
		_, err := ss.Bot().Get("unknown", false)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})

	t.Run("get deleted bot", func(t *testing.T) {
		_, err := ss.Bot().Get(deletedBot.UserId, false)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})

	t.Run("get deleted bot, include deleted", func(t *testing.T) {
		bot, err := ss.Bot().Get(deletedBot.UserId, true)
		require.NoError(t, err)
		require.Equal(t, deletedBot, bot)
	})

	t.Run("get permanently deleted bot", func(t *testing.T) {
		_, err := ss.Bot().Get(permanentlyDeletedBot.UserId, false)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})

	t.Run("get bot 1", func(t *testing.T) {
		bot, err := ss.Bot().Get(b1.UserId, false)
		require.NoError(t, err)
		require.Equal(t, b1, bot)
	})

	t.Run("get bot 2", func(t *testing.T) {
		bot, err := ss.Bot().Get(b2.UserId, false)
		require.NoError(t, err)
		require.Equal(t, b2, bot)
	})
}

func testBotStoreGetAll(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	OwnerID1 := model.NewId()
	OwnerID2 := model.NewId()

	deletedBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "deleted_bot",
		Description:    "A deleted bot",
		OwnerId:        OwnerID1,
		LastIconUpdate: model.GetMillis(),
	})
	deletedBot.DeleteAt = 1
	deletedBot, err := ss.Bot().Update(deletedBot)
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(deletedBot.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, deletedBot.UserId)) }()

	permanentlyDeletedBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "permanently_deleted_bot",
		Description:    "A permanently deleted bot",
		OwnerId:        OwnerID1,
		LastIconUpdate: model.GetMillis(),
		DeleteAt:       0,
	})
	require.NoError(t, ss.Bot().PermanentDelete(permanentlyDeletedBot.UserId))
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, permanentlyDeletedBot.UserId)) }()

	b1, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "b1",
		Description:    "The first bot",
		OwnerId:        OwnerID1,
		LastIconUpdate: model.GetMillis(),
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b1.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b1.UserId)) }()

	b2, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:       "b2",
		Description:    "The second bot",
		OwnerId:        OwnerID1,
		LastIconUpdate: 0,
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b2.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b2.UserId)) }()

	// Artificially set b2.LastIconUpdate to NULL to verify handling of same.
	_, sqlErr := s.GetMaster().Exec("UPDATE Bots SET LastIconUpdate = NULL WHERE UserId = '" + b2.UserId + "'")
	require.NoError(t, sqlErr)

	t.Run("get original bots", func(t *testing.T) {
		bot, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b1,
			b2,
		}, bot)
	})

	b3, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:    "b3",
		Description: "The third bot",
		OwnerId:     OwnerID1,
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b3.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b3.UserId)) }()

	b4, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:    "b4",
		Description: "The fourth bot",
		OwnerId:     OwnerID2,
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b4.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b4.UserId)) }()

	deletedUser := model.User{
		Email:    MakeEmail(),
		Username: model.NewUsername(),
	}
	_, err1 := ss.User().Save(rctx, &deletedUser)
	require.NoError(t, err1, "couldn't save user")

	deletedUser.DeleteAt = model.GetMillis()
	_, err2 := ss.User().Update(rctx, &deletedUser, true)
	require.NoError(t, err2, "couldn't delete user")

	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, deletedUser.Id)) }()
	ob5, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username:    "ob5",
		Description: "Orphaned bot 5",
		OwnerId:     deletedUser.Id,
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(ob5.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, ob5.UserId)) }()

	t.Run("get newly created bot stoo", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b1,
			b2,
			b3,
			b4,
			ob5,
		}, bots)
	})

	t.Run("get orphaned", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10, OnlyOrphaned: true})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			ob5,
		}, bots)
	})

	t.Run("get page=0, per_page=2", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 2})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b1,
			b2,
		}, bots)
	})

	t.Run("get page=1, limit=2", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 1, PerPage: 2})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b3,
			b4,
		}, bots)
	})

	t.Run("get page=5, perpage=1000", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 5, PerPage: 1000})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{}, bots)
	})

	t.Run("get offset=0, limit=2, include deleted", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 2, IncludeDeleted: true})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			deletedBot,
			b1,
		}, bots)
	})

	t.Run("get offset=2, limit=2, include deleted", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 1, PerPage: 2, IncludeDeleted: true})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b2,
			b3,
		}, bots)
	})

	t.Run("get offset=0, limit=10, creator id 1", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10, OwnerId: OwnerID1})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b1,
			b2,
			b3,
		}, bots)
	})

	t.Run("get offset=0, limit=10, creator id 2", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10, OwnerId: OwnerID2})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b4,
		}, bots)
	})

	t.Run("get offset=0, limit=10, include deleted, creator id 1", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10, IncludeDeleted: true, OwnerId: OwnerID1})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			deletedBot,
			b1,
			b2,
			b3,
		}, bots)
	})

	t.Run("get offset=0, limit=10, include deleted, creator id 2", func(t *testing.T) {
		bots, err := ss.Bot().GetAll(&model.BotGetOptions{Page: 0, PerPage: 10, IncludeDeleted: true, OwnerId: OwnerID2})
		require.NoError(t, err)
		require.Equal(t, []*model.Bot{
			b4,
		}, bots)
	})
}

func testBotStoreSave(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("invalid bot", func(t *testing.T) {
		bot := &model.Bot{
			UserId:      model.NewId(),
			Username:    "invalid bot",
			Description: "description",
		}

		_, err := ss.Bot().Save(bot)
		require.Error(t, err)
		var appErr *model.AppError
		require.True(t, errors.As(err, &appErr))
		// require.Equal(t, "model.bot.is_valid.username.app_error", err.Id)
	})

	t.Run("normal bot", func(t *testing.T) {
		bot := &model.Bot{
			Username:    "normal_bot",
			Description: "description",
			OwnerId:     model.NewId(),
		}

		user, err := ss.User().Save(rctx, model.UserFromBot(bot))
		require.NoError(t, err)
		defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, user.Id)) }()
		bot.UserId = user.Id

		returnedNewBot, nErr := ss.Bot().Save(bot)
		require.NoError(t, nErr)
		defer func() { require.NoError(t, ss.Bot().PermanentDelete(bot.UserId)) }()

		// Verify the returned bot matches the saved bot, modulo expected changes
		require.NotEqual(t, 0, returnedNewBot.CreateAt)
		require.NotEqual(t, 0, returnedNewBot.UpdateAt)
		require.Equal(t, returnedNewBot.CreateAt, returnedNewBot.UpdateAt)
		bot.UserId = returnedNewBot.UserId
		bot.CreateAt = returnedNewBot.CreateAt
		bot.UpdateAt = returnedNewBot.UpdateAt
		bot.DeleteAt = 0
		require.Equal(t, bot, returnedNewBot)

		// Verify the actual bot in the database matches the saved bot.
		actualNewBot, nErr := ss.Bot().Get(bot.UserId, false)
		require.NoError(t, nErr)
		require.Equal(t, bot, actualNewBot)
	})
}

func testBotStoreUpdate(t *testing.T, rctx request.CTX, ss store.Store) {
	t.Run("invalid bot should fail to update", func(t *testing.T) {
		existingBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
			Username: "existing_bot",
			OwnerId:  model.NewId(),
		})
		defer func() { require.NoError(t, ss.Bot().PermanentDelete(existingBot.UserId)) }()
		defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, existingBot.UserId)) }()

		bot := existingBot.Clone()
		bot.Username = "invalid username"
		_, err := ss.Bot().Update(bot)
		require.Error(t, err)
		var appErr *model.AppError
		require.True(t, errors.As(err, &appErr))
		require.Equal(t, "model.bot.is_valid.username.app_error", appErr.Id)
	})

	t.Run("existing bot should update", func(t *testing.T) {
		existingBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
			Username: "existing_bot",
			OwnerId:  model.NewId(),
		})
		defer func() { require.NoError(t, ss.Bot().PermanentDelete(existingBot.UserId)) }()
		defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, existingBot.UserId)) }()

		bot := existingBot.Clone()
		bot.OwnerId = model.NewId()
		bot.Description = "updated description"
		bot.CreateAt = 999999       // Ignored
		bot.UpdateAt = 999999       // Ignored
		bot.LastIconUpdate = 100000 // Allowed
		bot.DeleteAt = 100000       // Allowed

		returnedBot, err := ss.Bot().Update(bot)
		require.NoError(t, err)

		// Verify the returned bot matches the updated bot, modulo expected timestamp changes
		require.Equal(t, existingBot.CreateAt, returnedBot.CreateAt)
		require.NotEqual(t, bot.UpdateAt, returnedBot.UpdateAt, "update should have advanced UpdateAt")
		require.True(t, returnedBot.UpdateAt > bot.UpdateAt, "update should have advanced UpdateAt")
		require.NotEqual(t, 99999, returnedBot.UpdateAt, "should have ignored user-provided UpdateAt")
		require.Equal(t, bot.LastIconUpdate, returnedBot.LastIconUpdate, "should have marked icon as updated")
		require.Equal(t, bot.DeleteAt, returnedBot.DeleteAt, "should have marked bot as deleted")
		bot.CreateAt = returnedBot.CreateAt
		bot.UpdateAt = returnedBot.UpdateAt

		// Verify the actual (now deleted) bot in the database
		actualBot, err := ss.Bot().Get(bot.UserId, true)
		require.NoError(t, err)
		require.Equal(t, bot, actualBot)
	})

	t.Run("deleted bot should update, restoring", func(t *testing.T) {
		existingBot, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
			Username: "existing_bot",
			OwnerId:  model.NewId(),
		})
		defer func() { require.NoError(t, ss.Bot().PermanentDelete(existingBot.UserId)) }()
		defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, existingBot.UserId)) }()

		existingBot.DeleteAt = 100000
		existingBot, err := ss.Bot().Update(existingBot)
		require.NoError(t, err)

		bot := existingBot.Clone()
		bot.DeleteAt = 0

		returnedBot, err := ss.Bot().Update(bot)
		require.NoError(t, err)

		// Verify the returned bot matches the updated bot, modulo expected timestamp changes
		require.EqualValues(t, 0, returnedBot.DeleteAt)
		bot.UpdateAt = returnedBot.UpdateAt

		// Verify the actual bot in the database
		actualBot, err := ss.Bot().Get(bot.UserId, false)
		require.NoError(t, err)
		require.Equal(t, bot, actualBot)
	})
}

func testBotStorePermanentDelete(t *testing.T, rctx request.CTX, ss store.Store) {
	b1, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username: "b1",
		OwnerId:  model.NewId(),
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b1.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b1.UserId)) }()

	b2, _ := makeBotWithUser(t, rctx, ss, &model.Bot{
		Username: "b2",
		OwnerId:  model.NewId(),
	})
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(b2.UserId)) }()
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, b2.UserId)) }()

	t.Run("permanently delete a non-existent bot", func(t *testing.T) {
		err := ss.Bot().PermanentDelete("unknown")
		require.NoError(t, err)
	})

	t.Run("permanently delete bot", func(t *testing.T) {
		err := ss.Bot().PermanentDelete(b1.UserId)
		require.NoError(t, err)

		_, err = ss.Bot().Get(b1.UserId, false)
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})
}

func testBotStoreGetAllAfter(t *testing.T, rctx request.CTX, ss store.Store) {
	bot1 := &model.Bot{
		Username:    "bot_1",
		Description: "description",
		OwnerId:     model.NewId(),
	}

	user1, err := ss.User().Save(rctx, model.UserFromBot(bot1))
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, user1.Id)) }()
	bot1.UserId = user1.Id

	returnedNewBot1, nErr := ss.Bot().Save(bot1)
	require.NoError(t, nErr)
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(bot1.UserId)) }()

	bot2 := &model.Bot{
		Username:    "bot_2",
		Description: "description",
		OwnerId:     model.NewId(),
	}

	user2, err := ss.User().Save(rctx, model.UserFromBot(bot2))
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, user2.Id)) }()
	bot2.UserId = user2.Id

	returnedNewBot2, nErr := ss.Bot().Save(bot2)
	require.NoError(t, nErr)
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(bot2.UserId)) }()

	expected := []*model.Bot{returnedNewBot1, returnedNewBot2}
	if strings.Compare(returnedNewBot2.UserId, returnedNewBot1.UserId) < 0 {
		expected = []*model.Bot{returnedNewBot2, returnedNewBot1}
	}

	t.Run("get after lowest possible id", func(t *testing.T) {
		actual, err := ss.Bot().GetAllAfter(10000, strings.Repeat("0", 26))
		require.NoError(t, err)

		assert.Equal(t, expected, actual)
	})

	t.Run("get after first user", func(t *testing.T) {
		actual, err := ss.Bot().GetAllAfter(10000, expected[0].UserId)
		require.NoError(t, err)

		assert.Equal(t, []*model.Bot{expected[1]}, actual)
	})

	t.Run("get after second user", func(t *testing.T) {
		actual, err := ss.Bot().GetAllAfter(10000, expected[1].UserId)
		require.NoError(t, err)

		assert.Equal(t, []*model.Bot{}, actual)
	})
}

func testBotStoreGetByUsername(t *testing.T, rctx request.CTX, ss store.Store) {
	bot1 := &model.Bot{
		Username:    "bot_1",
		Description: "description",
		OwnerId:     model.NewId(),
	}

	user1, err := ss.User().Save(rctx, model.UserFromBot(bot1))
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, user1.Id)) }()
	bot1.UserId = user1.Id

	returnedNewBot1, nErr := ss.Bot().Save(bot1)
	require.NoError(t, nErr)
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(bot1.UserId)) }()

	bot2 := &model.Bot{
		Username:    "bot_2",
		Description: "description",
		OwnerId:     model.NewId(),
	}

	user2, err := ss.User().Save(rctx, model.UserFromBot(bot2))
	require.NoError(t, err)
	defer func() { require.NoError(t, ss.User().PermanentDelete(rctx, user2.Id)) }()
	bot2.UserId = user2.Id

	returnedNewBot2, nErr := ss.Bot().Save(bot2)
	require.NoError(t, nErr)
	defer func() { require.NoError(t, ss.Bot().PermanentDelete(bot2.UserId)) }()

	t.Run("get bot1 by username", func(t *testing.T) {
		result, err := ss.Bot().GetByUsername(returnedNewBot1.Username)
		require.NoError(t, err)
		assert.Equal(t, returnedNewBot1, result)
	})

	t.Run("get bot2 by username", func(t *testing.T) {
		result, err := ss.Bot().GetByUsername(returnedNewBot2.Username)
		require.NoError(t, err)
		assert.Equal(t, returnedNewBot2, result)
	})

	t.Run("get by empty username", func(t *testing.T) {
		_, err := ss.Bot().GetByUsername("")
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})

	t.Run("get by unknown", func(t *testing.T) {
		_, err := ss.Bot().GetByUsername("unknown")
		require.Error(t, err)
		var nfErr *store.ErrNotFound
		require.True(t, errors.As(err, &nfErr))
	})
}
