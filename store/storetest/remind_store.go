package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/model"
	"time"
)

func TestRemindStore(t *testing.T, ss store.Store) {
	createDefaultRoles(t, ss)

	t.Run("SaveReminder", func(t *testing.T) { testSaveReminder(t, ss) })
	t.Run("SaveOccurrence", func(t *testing.T) { testSaveOccurrence(t, ss) })
	t.Run("GetByUser", func(t *testing.T) { testGetByUser(t, ss) })
	t.Run("GetByTime", func(t *testing.T) { testGetByTime(t, ss) })
	t.Run("GetReminder", func(t *testing.T) { testGetReminder(t, ss) })
	t.Run("GetByReminder", func(t *testing.T) { testGetByReminder(t, ss) })
	t.Run("DeleteForUser", func(t *testing.T) { testDeleteForUser(t, ss) })
	t.Run("DeleteByReminder", func(t *testing.T) { testDeleteByReminder(t, ss) })
	t.Run("DeleteForReminder", func(t *testing.T) { testDeleteForReminder(t, ss) })

}

func testSaveReminder(t *testing.T, ss store.Store) {
	r := model.Reminder{}
	r.Id = model.NewId()
	r.TeamId = "TEST"
	r.UserId = "USER"
	r.Completed = time.Time{}.AddDate(0,0,1).Format(time.RFC3339)


	schan := ss.Remind().SaveReminder(&r)
	if result := <-schan; result.Err != nil {
		t.Fatal("SaveReminder failed")
	}

}

func testSaveOccurrence(t *testing.T, ss store.Store) {

	o := &model.Occurrence{
		model.NewId(),
		"USER",
		"REMINDER",
		"REPEAT",
		time.Now().Format(time.RFC3339),
		time.Time{}.AddDate(0,0,1).Format(time.RFC3339),
	}

	schan := ss.Remind().SaveOccurrence(o)
	if result := <-schan; result.Err != nil {
		t.Fatal("SaveOccurrence failed")
	}
}

func testGetByUser(t *testing.T, ss store.Store) {

	schan := ss.Remind().GetByUser("USER")
	if result := <-schan; result.Err != nil {
		t.Fatal("GetByUser failed")
	}

}

func testGetByTime(t *testing.T, ss store.Store) {

	tt := time.Now().Round(time.Second).Format(time.RFC3339)
	schan := ss.Remind().GetByTime(tt)
	if result := <-schan; result.Err != nil {
		t.Fatal(result.Err.Message)
	}
}

func testGetReminder(t *testing.T, ss store.Store) {

	schan := ss.Remind().GetReminder("1")
	if result := <-schan; result.Err != nil {
		t.Fatal(result.Err.Message)
	}
}

func testGetByReminder(t *testing.T, ss store.Store) {

	schan := ss.Remind().GetByReminder("1")
	if result := <-schan; result.Err != nil {
		t.Fatal(result.Err.Message)
	}

}

func testDeleteForUser(t *testing.T, ss store.Store) {

	schan := ss.Remind().DeleteForUser("1")
	if result := <-schan; result.Err != nil {
		t.Fatal(result.Err.Message)
	}
}

func testDeleteByReminder(t *testing.T, ss store.Store) {

	schan := ss.Remind().DeleteByReminder("1")
	if result := <-schan; result.Err != nil {
		t.Fatal(result.Err.Message)
	}
}

func testDeleteForReminder(t *testing.T, ss store.Store) {

	schan := ss.Remind().DeleteForReminder("1")
	if result := <-schan; result.Err != nil {
		t.Fatal(result.Err.Message)
	}
}
