// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPluginKeyIsValid(t *testing.T) {
	kv := PluginKeyValue{PluginId: "someid", Key: "somekey", Value: []byte("somevalue")}
	assert.Nil(t, kv.IsValid())

	kv.PluginId = ""
	assert.NotNil(t, kv.IsValid())

	kv.PluginId = "someid"
	kv.Key = ""
	assert.NotNil(t, kv.IsValid())

	kv.Key = "this is an extremely long, long, long, long, long, long, long, long, long, long, long, long, long key and should be invalid and this is being verified in this test"
	assert.NotNil(t, kv.IsValid())
}
