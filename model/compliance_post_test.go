// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompliancePostHeader(t *testing.T) {
	require.Equal(t, "TeamName", CompliancePostHeader()[0])
}

func TestCompliancePost(t *testing.T) {
	o := CompliancePost{TeamName: "test", PostFileIds: "files", PostCreateAt: GetMillis()}
	r := o.Row()

	require.Equal(t, "test", r[0])
	require.Equal(t, "files", r[len(r)-1])
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
