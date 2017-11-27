// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPluginKeyValueStore(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	pluginId := "testpluginid"

	assert.Nil(t, th.App.SetPluginKey(pluginId, "key", []byte("test")))
	ret, err := th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test inserting over existing entries
	assert.Nil(t, th.App.SetPluginKey(pluginId, "key", []byte("test2")))

	// Test getting non-existent key
	ret, err = th.App.GetPluginKey(pluginId, "notakey")
	assert.Nil(t, err)
	assert.Nil(t, ret)

	assert.Nil(t, th.App.DeletePluginKey(pluginId, "stringkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "intkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "postkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "notrealkey"))
}
