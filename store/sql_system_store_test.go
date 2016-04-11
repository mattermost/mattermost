// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestSqlSystemStore(t *testing.T) {
	Setup()

	system := &model.System{Name: model.NewId(), Value: "value"}
	Must(store.System().Save(system))

	result := <-store.System().Get()
	systems := result.Data.(model.StringMap)

	if systems[system.Name] != system.Value {
		t.Fatal()
	}

	system.Value = "value2"
	Must(store.System().Update(system))

	result2 := <-store.System().Get()
	systems2 := result2.Data.(model.StringMap)

	if systems2[system.Name] != system.Value {
		t.Fatal()
	}

	result3 := <-store.System().GetByName(system.Name)
	rsystem := result3.Data.(*model.System)
	if rsystem.Value != system.Value {
		t.Fatal()
	}
}

func TestSqlSystemStoreSaveOrUpdate(t *testing.T) {
	Setup()

	system := &model.System{Name: model.NewId(), Value: "value"}

	if err := (<-store.System().SaveOrUpdate(system)).Err; err != nil {
		t.Fatal(err)
	}

	system.Value = "value2"

	if r := <-store.System().SaveOrUpdate(system); r.Err != nil {
		t.Fatal(r.Err)
	}
}
