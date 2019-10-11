// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSystemJson(t *testing.T) {
	system := System{Name: "test", Value: NewId()}
	json := system.ToJson()
	result := SystemFromJson(strings.NewReader(json))

	require.Equal(t, "test", result.Name, "ids do not match")
}
