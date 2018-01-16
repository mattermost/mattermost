// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"

	"github.com/stretchr/testify/assert"
)

func TestSessionStore(t *testing.T, ss store.Store) {
	// Run serially to prevent interfering with other tests
	testSessionCleanup(t, ss)

	t.Run("Save", func(t *testing.T) { testSessionStoreSave(t, ss) })
	t.Run("SessionGet", func(t *testing.T) { testSessionGet(t, ss) })
	t.Run("SessionGetWithDeviceId", func(t *testing.T) { testSessionGetWithDeviceId(t, ss) })
	t.Run("SessionRemove", func(t *testing.T) { testSessionRemove(t, ss) })
	t.Run("SessionRemoveAll", func(t *testing.T) { testSessionRemoveAll(t, ss) })
	t.Run("SessionRemoveByUser", func(t *testing.T) { testSessionRemoveByUser(t, ss) })
	t.Run("SessionRemoveToken", func(t *testing.T) { testSessionRemoveToken(t, ss) })
	t.Run("SessionUpdateDeviceId", func(t *testing.T) { testSessionUpdateDeviceId(t, ss) })
	t.Run("SessionUpdateDeviceId2", func(t *testing.T) { testSessionUpdateDeviceId2(t, ss) })
	t.Run("UpdateLastActivityAt", func(t *testing.T) { testSessionStoreUpdateLastActivityAt(t, ss) })
	t.Run("SessionCount", func(t *testing.T) { testSessionCount(t, ss) })
}

func testSessionStoreSave(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()

	if err := (<-ss.Session().Save(&s1)).Err; err != nil {
		t.Fatal(err)
	}
}

func testSessionGet(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	s2 := model.Session{}
	s2.UserId = s1.UserId
	store.Must(ss.Session().Save(&s2))

	s3 := model.Session{}
	s3.UserId = s1.UserId
	s3.ExpiresAt = 1
	store.Must(ss.Session().Save(&s3))

	if rs1 := (<-ss.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	if rs2 := (<-ss.Session().GetSessions(s1.UserId)); rs2.Err != nil {
		t.Fatal(rs2.Err)
	} else {
		if len(rs2.Data.([]*model.Session)) != 3 {
			t.Fatal("should match len")
		}
	}
}

func testSessionGetWithDeviceId(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.ExpiresAt = model.GetMillis() + 10000
	store.Must(ss.Session().Save(&s1))

	s2 := model.Session{}
	s2.UserId = s1.UserId
	s2.DeviceId = model.NewId()
	s2.ExpiresAt = model.GetMillis() + 10000
	store.Must(ss.Session().Save(&s2))

	s3 := model.Session{}
	s3.UserId = s1.UserId
	s3.ExpiresAt = 1
	s3.DeviceId = model.NewId()
	store.Must(ss.Session().Save(&s3))

	if rs1 := (<-ss.Session().GetSessionsWithActiveDeviceIds(s1.UserId)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if len(rs1.Data.([]*model.Session)) != 1 {
			t.Fatal("should match len")
		}
	}
}

func testSessionRemove(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if rs1 := (<-ss.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	store.Must(ss.Session().Remove(s1.Id))

	if rs2 := (<-ss.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func testSessionRemoveAll(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if rs1 := (<-ss.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	store.Must(ss.Session().RemoveAllSessions())

	if rs2 := (<-ss.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func testSessionRemoveByUser(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if rs1 := (<-ss.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	store.Must(ss.Session().PermanentDeleteSessionsByUser(s1.UserId))

	if rs2 := (<-ss.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}
}

func testSessionRemoveToken(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if rs1 := (<-ss.Session().Get(s1.Id)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	} else {
		if rs1.Data.(*model.Session).Id != s1.Id {
			t.Fatal("should match")
		}
	}

	store.Must(ss.Session().Remove(s1.Token))

	if rs2 := (<-ss.Session().Get(s1.Id)); rs2.Err == nil {
		t.Fatal("should have been removed")
	}

	if rs3 := (<-ss.Session().GetSessions(s1.UserId)); rs3.Err != nil {
		t.Fatal(rs3.Err)
	} else {
		if len(rs3.Data.([]*model.Session)) != 0 {
			t.Fatal("should match len")
		}
	}
}

func testSessionUpdateDeviceId(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if rs1 := (<-ss.Session().UpdateDeviceId(s1.Id, model.PUSH_NOTIFY_APPLE+":1234567890", s1.ExpiresAt)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	}

	s2 := model.Session{}
	s2.UserId = model.NewId()
	store.Must(ss.Session().Save(&s2))

	if rs2 := (<-ss.Session().UpdateDeviceId(s2.Id, model.PUSH_NOTIFY_APPLE+":1234567890", s1.ExpiresAt)); rs2.Err != nil {
		t.Fatal(rs2.Err)
	}
}

func testSessionUpdateDeviceId2(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if rs1 := (<-ss.Session().UpdateDeviceId(s1.Id, model.PUSH_NOTIFY_APPLE_REACT_NATIVE+":1234567890", s1.ExpiresAt)); rs1.Err != nil {
		t.Fatal(rs1.Err)
	}

	s2 := model.Session{}
	s2.UserId = model.NewId()
	store.Must(ss.Session().Save(&s2))

	if rs2 := (<-ss.Session().UpdateDeviceId(s2.Id, model.PUSH_NOTIFY_APPLE_REACT_NATIVE+":1234567890", s1.ExpiresAt)); rs2.Err != nil {
		t.Fatal(rs2.Err)
	}
}

func testSessionStoreUpdateLastActivityAt(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	store.Must(ss.Session().Save(&s1))

	if err := (<-ss.Session().UpdateLastActivityAt(s1.Id, 1234567890)).Err; err != nil {
		t.Fatal(err)
	}

	if r1 := <-ss.Session().Get(s1.Id); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(*model.Session).LastActivityAt != 1234567890 {
			t.Fatal("LastActivityAt not updated correctly")
		}
	}

}

func testSessionCount(t *testing.T, ss store.Store) {
	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.ExpiresAt = model.GetMillis() + 100000
	store.Must(ss.Session().Save(&s1))

	if r1 := <-ss.Session().AnalyticsSessionCount(); r1.Err != nil {
		t.Fatal(r1.Err)
	} else {
		if r1.Data.(int64) == 0 {
			t.Fatal("should have at least 1 session")
		}
	}
}

func testSessionCleanup(t *testing.T, ss store.Store) {
	now := model.GetMillis()

	s1 := model.Session{}
	s1.UserId = model.NewId()
	s1.ExpiresAt = 0 // never expires
	store.Must(ss.Session().Save(&s1))

	s2 := model.Session{}
	s2.UserId = s1.UserId
	s2.ExpiresAt = now + 1000000 // expires in the future
	store.Must(ss.Session().Save(&s2))

	s3 := model.Session{}
	s3.UserId = model.NewId()
	s3.ExpiresAt = 1 // expired
	store.Must(ss.Session().Save(&s3))

	s4 := model.Session{}
	s4.UserId = model.NewId()
	s4.ExpiresAt = 2 // expired
	store.Must(ss.Session().Save(&s4))

	ss.Session().Cleanup(now, 1)

	err := (<-ss.Session().Get(s1.Id)).Err
	assert.Nil(t, err)

	err = (<-ss.Session().Get(s2.Id)).Err
	assert.Nil(t, err)

	err = (<-ss.Session().Get(s3.Id)).Err
	assert.NotNil(t, err)

	err = (<-ss.Session().Get(s4.Id)).Err
	assert.NotNil(t, err)

	store.Must(ss.Session().Remove(s1.Id))
	store.Must(ss.Session().Remove(s2.Id))
}
