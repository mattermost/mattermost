// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"
	"time"

	"github.com/mattermost/platform/model"
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
