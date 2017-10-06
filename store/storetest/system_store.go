// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestSystemStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testSystemStore(t, ss) })
	t.Run("SaveOrUpdate", func(t *testing.T) { testSystemStoreSaveOrUpdate(t, ss) })
}

func testSystemStore(t *testing.T, ss store.Store) {
	system := &model.System{Name: model.NewId(), Value: "value"}
	store.Must(ss.System().Save(system))

	result := <-ss.System().Get()
	systems := result.Data.(model.StringMap)

	if systems[system.Name] != system.Value {
		t.Fatal()
	}

	system.Value = "value2"
	store.Must(ss.System().Update(system))

	result2 := <-ss.System().Get()
	systems2 := result2.Data.(model.StringMap)

	if systems2[system.Name] != system.Value {
		t.Fatal()
	}

	result3 := <-ss.System().GetByName(system.Name)
	rsystem := result3.Data.(*model.System)
	if rsystem.Value != system.Value {
		t.Fatal()
	}
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
