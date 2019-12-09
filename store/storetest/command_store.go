// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func TestCommandStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testCommandStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testCommandStoreGet(t, ss) })
	t.Run("GetByTeam", func(t *testing.T) { testCommandStoreGetByTeam(t, ss) })
	t.Run("GetByTrigger", func(t *testing.T) { testCommandStoreGetByTrigger(t, ss) })
	t.Run("Delete", func(t *testing.T) { testCommandStoreDelete(t, ss) })
	t.Run("DeleteByTeam", func(t *testing.T) { testCommandStoreDeleteByTeam(t, ss) })
	t.Run("DeleteByUser", func(t *testing.T) { testCommandStoreDeleteByUser(t, ss) })
	t.Run("Update", func(t *testing.T) { testCommandStoreUpdate(t, ss) })
	t.Run("CommandCount", func(t *testing.T) { testCommandCount(t, ss) })
}

func testCommandStoreSave(t *testing.T, ss store.Store) {
	o1 := model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	_, err := ss.Command().Save(&o1)
	require.Nil(t, err, "couldn't save item")

	_, err = ss.Command().Save(&o1)
	require.NotNil(t, err, "shouldn't be able to update from save")
}

func testCommandStoreGet(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Command().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.CreateAt, o1.CreateAt, "invalid returned command")

	_, err = ss.Command().Get("123")
	require.NotNil(t, err, "Mising id should have failed")
}

func testCommandStoreGetByTeam(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Command().GetByTeam(o1.TeamId)
	require.Nil(t, err)
	require.NotEmpty(t, r1, "no command returned")
	require.Equal(t, r1[0].CreateAt, o1.CreateAt, "invalid returned command")

	result, err := ss.Command().GetByTeam("123")
	require.Nil(t, err)
	require.Empty(t, result, "no commands should have returned")
}

func testCommandStoreGetByTrigger(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger1"

	o2 := &model.Command{}
	o2.CreatorId = model.NewId()
	o2.Method = model.COMMAND_METHOD_POST
	o2.TeamId = model.NewId()
	o2.URL = "http://nowhere.com/"
	o2.Trigger = "trigger1"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	_, err = ss.Command().Save(o2)
	require.Nil(t, err)

	var r1 *model.Command
	r1, err = ss.Command().GetByTrigger(o1.TeamId, o1.Trigger)
	require.Nil(t, err)
	require.Equal(t, r1.Id, o1.Id, "invalid returned command")

	err = ss.Command().Delete(o1.Id, model.GetMillis())
	require.Nil(t, err)

	_, err = ss.Command().GetByTrigger(o1.TeamId, o1.Trigger)
	require.NotNil(t, err, "no commands should have returned")
}

func testCommandStoreDelete(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Command().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.CreateAt, o1.CreateAt, "invalid returned command")

	err = ss.Command().Delete(o1.Id, model.GetMillis())
	require.Nil(t, err)

	_, err = ss.Command().Get(o1.Id)
	require.NotNil(t, err, "Missing id should have failed")
}

func testCommandStoreDeleteByTeam(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Command().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.CreateAt, o1.CreateAt, "invalid returned command")

	err = ss.Command().PermanentDeleteByTeam(o1.TeamId)
	require.Nil(t, err)

	_, err = ss.Command().Get(o1.Id)
	require.NotNil(t, err, "Missing id should have failed")
}

func testCommandStoreDeleteByUser(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Command().Get(o1.Id)
	require.Nil(t, err)
	require.Equal(t, r1.CreateAt, o1.CreateAt, "invalid returned command")

	err = ss.Command().PermanentDeleteByUser(o1.CreatorId)
	require.Nil(t, err)

	_, err = ss.Command().Get(o1.Id)
	require.NotNil(t, err, "Missing id should have failed")
}

func testCommandStoreUpdate(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	o1.Token = model.NewId()

	_, err = ss.Command().Update(o1)
	require.Nil(t, err)

	o1.URL = "junk"

	_, err = ss.Command().Update(o1)
	require.NotNil(t, err, "should have failed - bad URL")
}

func testCommandCount(t *testing.T, ss store.Store) {
	o1 := &model.Command{}
	o1.CreatorId = model.NewId()
	o1.Method = model.COMMAND_METHOD_POST
	o1.TeamId = model.NewId()
	o1.URL = "http://nowhere.com/"
	o1.Trigger = "trigger"

	o1, err := ss.Command().Save(o1)
	require.Nil(t, err)

	r1, err := ss.Command().AnalyticsCommandCount("")
	require.Nil(t, err)
	require.NotZero(t, r1, "should be at least 1 command")

	r2, err := ss.Command().AnalyticsCommandCount(o1.TeamId)
	require.Nil(t, err)
	require.Equal(t, r2, int64(1), "should be 1 command")
}
