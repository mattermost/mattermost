// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInitialLoadJson(t *testing.T) {
	u := &User{Id: NewId()}
	o := InitialLoad{User: u}
	json := o.ToJson()
	ro := InitialLoadFromJson(strings.NewReader(json))

	require.Equal(t, o.User.Id, ro.User.Id, "Ids do not match")
}
