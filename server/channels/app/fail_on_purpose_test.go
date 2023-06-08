// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFailOnPurposeAssertion(t *testing.T) {
	assert.True(t, false)
}

func TestFailOnPurposePanic(t *testing.T) {
	panic("panic on purpose")
}
