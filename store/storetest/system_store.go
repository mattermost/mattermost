// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestSystemStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testSystemStore(t, ss) })
	t.Run("SaveOrUpdate", func(t *testing.T) { testSystemStoreSaveOrUpdate(t, ss) })
	t.Run("PermanentDeleteByName", func(t *testing.T) { testSystemStorePermanentDeleteByName(t, ss) })
}

func testSystemStore(t *testing.T, ss store.Store) {
	system := &model.System{Name: model.NewId(), Value: "value"}
	store.Must(ss.System().Save(system))

	result := <-ss.System().Get()
	systems := result.Data.(model.StringMap)

	require.Equal(t, system.Value, systems[system.Name])

	system.Value = "value2"
	store.Must(ss.System().Update(system))

	result2 := <-ss.System().Get()
	systems2 := result2.Data.(model.StringMap)

	require.Equal(t, system.Value, systems2[system.Name])

	result3 := <-ss.System().GetByName(system.Name)
	rsystem := result3.Data.(*model.System)
	require.Equal(t, system.Value, rsystem.Value)
}

func testSystemStoreSaveOrUpdate(t *testing.T, ss store.Store) {
	system := &model.System{Name: model.NewId(), Value: "value"}

	if err := (<-ss.System().SaveOrUpdate(system)).Err; err != nil {
		t.Fatal(err)
	}

	system.Value = "value2"

	if r := <-ss.System().SaveOrUpdate(system); r.Err != nil {
		t.Fatal(r.Err)
	}
}

func testSystemStorePermanentDeleteByName(t *testing.T, ss store.Store) {
	s1 := &model.System{Name: model.NewId(), Value: "value"}
	s2 := &model.System{Name: model.NewId(), Value: "value"}

	store.Must(ss.System().Save(s1))
	store.Must(ss.System().Save(s2))

	res1 := <-ss.System().GetByName(s1.Name)
	assert.Nil(t, res1.Err)

	res2 := <-ss.System().GetByName(s2.Name)
	assert.Nil(t, res2.Err)

	res3 := <-ss.System().PermanentDeleteByName(s1.Name)
	assert.Nil(t, res3.Err)

	res4 := <-ss.System().GetByName(s1.Name)
	assert.NotNil(t, res4.Err)

	res5 := <-ss.System().GetByName(s2.Name)
	assert.Nil(t, res5.Err)

	res6 := <-ss.System().PermanentDeleteByName(s2.Name)
	assert.Nil(t, res6.Err)

	res7 := <-ss.System().GetByName(s1.Name)
	assert.NotNil(t, res7.Err)

	res8 := <-ss.System().GetByName(s2.Name)
	assert.NotNil(t, res8.Err)

}
