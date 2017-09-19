// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestSqlAuditStore(t *testing.T) {
	Setup()

	audit := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	Must(store.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	Must(store.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	Must(store.Audit().Save(audit))
	time.Sleep(100 * time.Millisecond)
	audit.ExtraInfo = "extra"
	time.Sleep(100 * time.Millisecond)
	Must(store.Audit().Save(audit))

	time.Sleep(100 * time.Millisecond)

	c := store.Audit().Get(audit.UserId, 0, 100)
	result := <-c
	audits := result.Data.(model.Audits)

	if len(audits) != 4 {
		t.Fatal("Failed to save and retrieve 4 audit logs")
	}

	if audits[0].ExtraInfo != "extra" {
		t.Fatal("Failed to save property for extra info")
	}

	c = store.Audit().Get("missing", 0, 100)
	result = <-c
	audits = result.Data.(model.Audits)

	if len(audits) != 0 {
		t.Fatal("Should have returned empty because user_id is missing")
	}

	c = store.Audit().Get("", 0, 100)
	result = <-c
	audits = result.Data.(model.Audits)

	if len(audits) < 4 {
		t.Fatal("Failed to save and retrieve 4 audit logs")
	}

	if r2 := <-store.Audit().PermanentDeleteByUser(audit.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}

func TestAuditStorePermanentDeleteBatch(t *testing.T) {
	Setup()

	a1 := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	Must(store.Audit().Save(a1))
	time.Sleep(10 * time.Millisecond)
	a2 := &model.Audit{UserId: a1.UserId, IpAddress: "ipaddress", Action: "Action"}
	Must(store.Audit().Save(a2))
	time.Sleep(10 * time.Millisecond)
	cutoff := model.GetMillis()
	time.Sleep(10 * time.Millisecond)
	a3 := &model.Audit{UserId: a1.UserId, IpAddress: "ipaddress", Action: "Action"}
	Must(store.Audit().Save(a3))

	if r := <-store.Audit().Get(a1.UserId, 0, 100); len(r.Data.(model.Audits)) != 3 {
		t.Fatal("Expected 3 audits. Got ", len(r.Data.(model.Audits)))
	}

	Must(store.Audit().PermanentDeleteBatch(cutoff, 1000000))

	if r := <-store.Audit().Get(a1.UserId, 0, 100); len(r.Data.(model.Audits)) != 1 {
		t.Fatal("Expected 1 audit. Got ", len(r.Data.(model.Audits)))
	}

	if r2 := <-store.Audit().PermanentDeleteByUser(a1.UserId); r2.Err != nil {
		t.Fatal(r2.Err)
	}
}
