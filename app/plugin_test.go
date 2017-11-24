// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestPluginKeyValueStore(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	pluginId := "testpluginid"

	assert.Nil(t, th.App.SetPluginKey(pluginId, "stringkey", "test"))
	assert.Nil(t, th.App.SetPluginKey(pluginId, "intkey", 123))
	assert.Nil(t, th.App.SetPluginKey(pluginId, "postkey", th.BasicPost))

	ret, err := th.App.GetPluginKey(pluginId, "stringkey")
	require.Nil(t, err)
	retStr, _ := ret.String()
	assert.Equal(t, retStr, "test")

	ret, err = th.App.GetPluginKey(pluginId, "intkey")
	require.Nil(t, err)
	retInt, _ := ret.Int64()
	assert.Equal(t, retInt, int64(123))

	ret, err = th.App.GetPluginKey(pluginId, "postkey")
	require.Nil(t, err)
	var retPost *model.Post
	ret.Scan(&retPost)
	assert.Equal(t, retPost.Id, th.BasicPost.Id)

	// Test inserting over existing entries
	assert.Nil(t, th.App.SetPluginKey(pluginId, "stringkey", "test2"))
	assert.Nil(t, th.App.SetPluginKey(pluginId, "intkey", 1234))
	assert.Nil(t, th.App.SetPluginKey(pluginId, "postkey", th.BasicPost))

	assert.Nil(t, th.App.DeletePluginKey(pluginId, "stringkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "intkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "postkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "notrealkey"))
}
