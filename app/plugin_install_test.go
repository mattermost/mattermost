// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io/ioutil"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/testlib"
)

func TestNotifyClusterPluginEvent(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	testCluster := &testlib.FakeClusterInterface{}
	th.App.Cluster = testCluster

	path, _ := fileutils.FindDir("tests")
	tarData, err := ioutil.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	if err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
	})

	// Install plugin
	testCluster.ClearMessages()
	manifest, err := th.App.InstallPlugin(bytes.NewReader(tarData), false)
	require.Nil(t, err)
	require.NotNil(t, manifest)

	// TODO: Fix this
	d, e := th.App.GetPluginStatuses()
	require.Nil(t, d) // This should not be empty
	require.Nil(t, e)

	sentMessages := testCluster.GetMessages()
	expectedPath := filepath.Join("./plugins", manifest.Id) + ".tar.gz"
	expectedPluginData := model.PluginEventData{
		PluginId:            manifest.Id,
		PluginFileStorePath: expectedPath,
	}
	expectedInstallMessage := &model.ClusterMessage{
		Event:            model.CLUSTER_EVENT_INSTALL_PLUGIN,
		SendType:         model.CLUSTER_SEND_RELIABLE,
		WaitForAllToSend: true,
		Data:             expectedPluginData.ToJson(),
	}

	require.Len(t, sentMessages, 2)
	require.Equal(t, expectedInstallMessage, sentMessages[0])

	// Remove plugin
	testCluster.ClearMessages()

	err = th.App.RemovePlugin(manifest.Id)
	require.Nil(t, err)

	sentMessages = testCluster.GetMessages()
	expectedRemoveMessage := &model.ClusterMessage{
		Event:            model.CLUSTER_EVENT_REMOVE_PLUGIN,
		SendType:         model.CLUSTER_SEND_RELIABLE,
		WaitForAllToSend: true,
		Data:             expectedPluginData.ToJson(),
	}

	require.Len(t, sentMessages, 2)
	require.Equal(t, expectedRemoveMessage, sentMessages[0])
}
