// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDraftIsValid(t *testing.T) {
	o := Draft{}
	maxDraftSize := 10000

	err := o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.CreateAt = GetMillis()
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.UpdateAt = GetMillis()
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.UserId = NewId()
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.ChannelId = NewId()
	o.RootId = "123"
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.RootId = ""

	o.Message = strings.Repeat("0", maxDraftSize+1)
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)

	o.Message = strings.Repeat("0", maxDraftSize)
	err = o.IsValid(maxDraftSize)
	assert.Nil(t, err)

	o.Message = "test"
	err = o.IsValid(maxDraftSize)
	assert.Nil(t, err)

	o.FileIds = StringArray{strings.Repeat("0", maxDraftSize+1)}
	err = o.IsValid(maxDraftSize)
	assert.NotNil(t, err)
}

func TestDraftPreSave(t *testing.T) {
	o := Draft{Message: "test"}
	o.PreSave()

	assert.NotEqual(t, 0, o.CreateAt)

	past := GetMillis() - 1
	o = Draft{Message: "test", CreateAt: past}
	o.PreSave()

	assert.LessOrEqual(t, o.CreateAt, past)
}

func TestDraftPreUpdate(t *testing.T) {
	o := Draft{Message: "test"}
	o.PreUpdate()

	assert.NotEqual(t, 0, o.UpdateAt)

	past := GetMillis() - 1
	o = Draft{Message: "test", UpdateAt: past}
	o.PreSave()

	assert.GreaterOrEqual(t, o.UpdateAt, past)
}
