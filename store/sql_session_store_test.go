// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestSessionStoreSave(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()

	if err := (<-store.Session().Save(&s1)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestSessionGet(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1))

	s2 := model.Session{}
	s2.UserId = s1.UserId
	s2.TeamId = s1.TeamId
	Must(store.Session().Save(&s2))

	s3 := model.Session{}
	s3.UserId = s1.UserId
	s3.TeamId = s1.TeamId
	s3.ExpiresAt = 1
	Must(store.Session().Save(&s3))

	if rs1 := (<-store.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	if rs2 := (<-store.Session().GetSessions(s1.UserId)); rs2.Err != nil {
		t.Fatal(rs2.Err)
	} else {
		if len(rs2.Data.([]*model.Session)) != 2 {
			t.Fatal("should match len")
		}
	}

}

func TestSessionRemove(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1))

	if rs1 := (<-store.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().Remove(s1.Id))

	if rs2 := (<-store.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func TestSessionRemoveAll(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1))

	if rs1 := (<-store.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().RemoveAllSessionsForTeam(s1.TeamId))

	if rs2 := (<-store.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func TestSessionRemoveToken(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1))

	if rs1 := (<-store.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().Remove(s1.Token))

	if rs2 := (<-store.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}

	if rs3 := (<-store.Session().GetSessions(s1.UserId)); rs3.Err != nil {
		t.Fatal(rs3.Err)
	} else {
		if len(rs3.Data.([]*model.Session)) != 0 {
			t.Fatal("should match len")
		}
	}
}

func TestSessionStoreUpdateLastActivityAt(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1))

	if err := (<-store.Session().UpdateLastActivityAt(s1.Id, 1234567890)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Session().Get(s1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Session).LastActivityAt != 1234567890 {
			t.Fatal("LastActivityAt not updated correctly")
		}
	}

}
