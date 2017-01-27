// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestAuditsJson(t *testing.T) {
	audit := Audit{Id: NewId(), UserId: NewId(), CreateAt: GetMillis()}
	json := audit.ToJson()
	result := AuditFromJson(strings.NewReader(json))

	if audit.Id != result.Id {
		t.Fatal("Ids do not match")
	}

	var audits Audits = make([]Audit, 1)
	audits[0] = audit

	ljson := audits.ToJson()
	results := AuditsFromJson(strings.NewReader(ljson))

	if audits[0].Id != results[0].Id {
		t.Fatal("Ids do not match")
	}
}
