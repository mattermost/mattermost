// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"github.com/mattermost/platform/model"
)

func TestSqlStatusStore(t *testing.T) {
	Setup()

	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}

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

	status2 := &model.Status{UserId: model.NewId(), Status: model.STATUS_AWAY, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
	if err := (<-store.Status().SaveOrUpdate(status2)).Err; err != nil {
		t.Fatal(err)
	}

	status3 := &model.Status{UserId: model.NewId(), Status: model.STATUS_OFFLINE, Manual: false, LastActivityAt: 0, ActiveChannel: ""}
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

	if result := <-store.Status().GetOnline(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		statuses := result.Data.([]*model.Status)
		for _, status := range statuses {
			if status.Status != model.STATUS_ONLINE {
				t.Fatal("should not have returned offline statuses")
			}
		}
	}

	if result := <-store.Status().GetByIds([]string{status.UserId, "junk"}); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		statuses := result.Data.([]*model.Status)
		if len(statuses) != 1 {
			t.Fatal("should only have 1 status")
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

	if result := <-store.Status().UpdateLastActivityAt(status.UserId, 10); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func TestActiveUserCount(t *testing.T) {
	Setup()

	status := &model.Status{UserId: model.NewId(), Status: model.STATUS_ONLINE, Manual: false, LastActivityAt: model.GetMillis(), ActiveChannel: ""}
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
