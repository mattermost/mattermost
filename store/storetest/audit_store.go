// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestAuditStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testAuditStore(t, ss) })
	t.Run("PermanentDeleteBatch", func(t *testing.T) { testAuditStorePermanentDeleteBatch(t, ss) })
}

func testAuditStore(t *testing.T, ss store.Store) {
	audit := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	store.Must(ss.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	store.Must(ss.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	store.Must(ss.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	audit.ExtraInfo = "extra"
	time.Sleep(100 * time.Millisecond)
	store.Must(ss.Audit().Save(audit))

	time.Sleep(100 * time.Millisecond)

	c := ss.Audit().Get(audit.UserId, 0, 100)
	result := <-c
	audits := result.Data.(model.Audits)

	if len(audits) != 4 {
		t.Fatal("Failed to save and retrieve 4 audit logs")
	}

	if audits[0].ExtraInfo != "extra" {
		t.Fatal("Failed to save property for extra info")
	}

	c = ss.Audit().Get("missing", 0, 100)
	result = <-c
	audits = result.Data.(model.Audits)

	if len(audits) != 0 {
		t.Fatal("Should have returned empty because user_id is missing")
	}

	c = ss.Audit().Get("", 0, 100)
	result = <-c
	audits = result.Data.(model.Audits)

	if len(audits) < 4 {
		t.Fatal("Failed to save and retrieve 4 audit logs")
	}

	if r2 := <-ss.Audit().PermanentDeleteByUser(audit.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}

func testAuditStorePermanentDeleteBatch(t *testing.T, ss store.Store) {
	a1 := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	store.Must(ss.Audit().Save(a1))
	time.Sleep(10 * time.Millisecond)
	a2 := &model.Audit{UserId: a1.UserId, IpAddress: "ipaddress", Action: "Action"}
	store.Must(ss.Audit().Save(a2))
	time.Sleep(10 * time.Millisecond)
	cutoff := model.GetMillis()
	time.Sleep(10 * time.Millisecond)
	a3 := &model.Audit{UserId: a1.UserId, IpAddress: "ipaddress", Action: "Action"}
	store.Must(ss.Audit().Save(a3))

	if r := <-ss.Audit().Get(a1.UserId, 0, 100); len(r.Data.(model.Audits)) != 3 {
		t.Fatal("Expected 3 audits. Got ", len(r.Data.(model.Audits)))
	}

	store.Must(ss.Audit().PermanentDeleteBatch(cutoff, 1000000))

	if r := <-ss.Audit().Get(a1.UserId, 0, 100); len(r.Data.(model.Audits)) != 1 {
		t.Fatal("Expected 1 audit. Got ", len(r.Data.(model.Audits)))
	}

	if r2 := <-ss.Audit().PermanentDeleteByUser(a1.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}
