// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
)

func TestCompliancePostHeader(t *testing.T) {
	if CompliancePostHeader()[0] != "TeamName" {
		t.Fatal()
	}
}

func TestCompliancePost(t *testing.T) {
	o := CompliancePost{TeamName: "test", PostFilenames: "files", PostCreateAt: GetMillis()}
	r := o.Row()

	if r[0] != "test" {
		t.Fatal()
	}

	if r[len(r)-1] != "files" {
		t.Fatal()
	}
}
