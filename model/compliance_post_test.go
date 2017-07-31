// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
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
	o := CompliancePost{TeamName: "test", PostFileIds: "files", PostCreateAt: GetMillis()}
	r := o.Row()

	if r[0] != "test" {
		t.Fatal()
	}

	if r[len(r)-1] != "files" {
		t.Fatal()
	}
}

var cleanTests = []struct {
	in       string
	expected string
}{
	{"hello", "hello"},
	{"=hello", "'=hello"},
	{"+hello", "'+hello"},
	{"-hello", "'-hello"},
	{"  =hello", "'  =hello"},
	{"  +hello", "'  +hello"},
	{"  -hello", "'  -hello"},
	{"\t  -hello", "'\t  -hello"},
}

func TestCleanComplianceStrings(t *testing.T) {
	for _, tt := range cleanTests {
		actual := cleanComplianceStrings(tt.in)
		if actual != tt.expected {
			t.Errorf("cleanComplianceStrings(%v): expected %v, actual %v", tt.in, tt.expected, actual)
		}
	}
}
