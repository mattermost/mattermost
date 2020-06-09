// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompliance(t *testing.T) {
	o := Compliance{Desc: "test", CreateAt: GetMillis()}
	json := o.ToJson()
	result := ComplianceFromJson(strings.NewReader(json))

	require.Equal(t, o.Desc, result.Desc, "JobName do not match")
}
