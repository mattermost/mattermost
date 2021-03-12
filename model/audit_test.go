// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAuditJson(t *testing.T) {
	audit := Audit{Id: NewId(), UserId: NewId(), CreateAt: GetMillis()}
	json := audit.ToJson()
	result := AuditFromJson(strings.NewReader(json))
	require.Equal(t, audit.Id, result.Id, "Ids do not match")
}
