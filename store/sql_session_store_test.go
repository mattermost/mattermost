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

	if err := (<-store.Session().Save(&s1, T)).Err; err != nil {
		t.Fatal(err)
	}
}

func TestSessionGet(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1, T))

	s2 := model.Session{}
	s2.UserId = s1.UserId
	s2.TeamId = s1.TeamId
	Must(store.Session().Save(&s2, T))

	s3 := model.Session{}
	s3.UserId = s1.UserId
	s3.TeamId = s1.TeamId
	s3.ExpiresAt = 1
	Must(store.Session().Save(&s3, T))

	if rs1 := (<-store.Session().Get(s1.Id, T)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	if rs2 := (<-store.Session().GetSessions(s1.UserId, T)); rs2.Err != nil {
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
	Must(store.Session().Save(&s1, T))

	if rs1 := (<-store.Session().Get(s1.Id, T)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().Remove(s1.Id, T))

	if rs2 := (<-store.Session().Get(s1.Id, T)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func TestSessionRemoveAll(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1, T))

	if rs1 := (<-store.Session().Get(s1.Id, T)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().RemoveAllSessionsForTeam(s1.TeamId, T))

	if rs2 := (<-store.Session().Get(s1.Id, T)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func TestSessionRemoveByUser(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1, T))

	if rs1 := (<-store.Session().Get(s1.Id, T)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().PermanentDeleteSessionsByUser(s1.UserId, T))

	if rs2 := (<-store.Session().Get(s1.Id, T)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func TestSessionRemoveToken(t *testing.T) {
	Setup()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.TeamId = model.NewId()
	Must(store.Session().Save(&s1, T))

	if rs1 := (<-store.Session().Get(s1.Id, T)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	Must(store.Session().Remove(s1.Token, T))

	if rs2 := (<-store.Session().Get(s1.Id, T)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}

	if rs3 := (<-store.Session().GetSessions(s1.UserId, T)); rs3.Err != nil {
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
	Must(store.Session().Save(&s1, T))

	if err := (<-store.Session().UpdateLastActivityAt(s1.Id, 1234567890, T)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-store.Session().Get(s1.Id, T); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Session).LastActivityAt != 1234567890 {
			t.Fatal("LastActivityAt not updated correctly")
		}
	}

}
