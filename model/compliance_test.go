// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestCompliance(t *testing.T) {
	o := Compliance{Desc: "test", CreateAt: GetMillis()}
	json := o.ToJson()
	result := ComplianceFromJson(strings.NewReader(json))

	if o.Desc != result.Desc {
		t.Fatal("JobName do not match")
	}
}
