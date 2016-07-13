// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestSqlStatusStore(t *testing.T) {
	Setup()

	status := &model.Status{model.NewId(), model.STATUS_ONLINE, 0}

	if err := (<-store.Status().SaveOrUpdate(status)).Err; err != nil {
		t.Fatal(err)
	}

	status.LastActivityAt = 10

	if err := (<-store.Status().SaveOrUpdate(status)).Err; err != nil {
		t.Fatal(err)
	}

	if err := (<-store.Status().Get(status.UserId)).Err; err != nil {
		t.Fatal(err)
	}

	status2 := &model.Status{model.NewId(), model.STATUS_AWAY, 0}
	if err := (<-store.Status().SaveOrUpdate(status2)).Err; err != nil {
		t.Fatal(err)
	}

	status3 := &model.Status{model.NewId(), model.STATUS_OFFLINE, 0}
	if err := (<-store.Status().SaveOrUpdate(status3)).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-store.Status().GetOnlineAway(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		statuses := result.Data.([]*model.Status)
		for _, status := range statuses {
			if status.Status == model.STATUS_OFFLINE {
				t.Fatal("should not have returned offline statuses")
			}
		}
	}

	if err := (<-store.Status().ResetAll()).Err; err != nil {
		t.Fatal(err)
	}

	if result := <-store.Status().Get(status.UserId); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		status := result.Data.(*model.Status)
		if status.Status != model.STATUS_OFFLINE {
			t.Fatal("should be offline")
		}
	}
}

func TestActiveUserCount(t *testing.T) {
	Setup()

	status := &model.Status{model.NewId(), model.STATUS_ONLINE, model.GetMillis()}
	Must(store.Status().SaveOrUpdate(status))

	if result := <-store.Status().GetTotalActiveUsersCount(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		count := result.Data.(int64)
		if count <= 0 {
			t.Fatal()
		}
	}
}
