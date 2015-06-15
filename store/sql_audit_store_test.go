// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestSqlAuditStore(t *testing.T) {
	Setup()

	audit := &model.Audit{UserId: model.NewId(), IpAddress: "ipaddress", Action: "Action"}
	<-store.Audit().Save(audit)
	<-store.Audit().Save(audit)
	<-store.Audit().Save(audit)
	audit.ExtraInfo = "extra"
	<-store.Audit().Save(audit)

	c := store.Audit().Get(audit.UserId, 100)
	result := <-c
	audits := result.Data.(model.Audits)

	if len(audits) != 4 {
		t.Fatal("Failed to save and retrieve 4 audit logs")
	}

	if audits[0].ExtraInfo != "extra" {
		t.Fatal("Failed to save property for extra info")
	}

	c = store.Audit().Get("missing", 100)
	result = <-c
	audits = result.Data.(model.Audits)

	if len(audits) != 0 {
		t.Fatal("Should have returned empty because user_id is missing")
	}
}
