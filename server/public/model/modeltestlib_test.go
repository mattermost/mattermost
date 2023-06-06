// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func CheckInt(t *testing.T, got int, expected int) {
	assert.Equal(t, got, expected)
}

func CheckString(t *testing.T, got string, expected string) {
	assert.Equal(t, got, expected)
}

func CheckTrue(t *testing.T, test bool) {
	assert.True(t, test)
}

func CheckFalse(t *testing.T, test bool) {
	assert.False(t, test)
}
