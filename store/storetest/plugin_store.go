// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
)

func TestPluginStore(t *testing.T, ss store.Store) {
	t.Run("PluginSaveGet", func(t *testing.T) { testPluginSaveGet(t, ss) })
	t.Run("PluginDelete", func(t *testing.T) { testPluginDelete(t, ss) })
	t.Run("PluginGetPluginStatuses", func(t *testing.T) { testGetPluginStatuses(t, ss) })
	t.Run("PluginUpdatePluginStatusState", func(t *testing.T) { testUpdatePluginStatusState(t, ss) })
	t.Run("PluginDeletePluginStatus", func(t *testing.T) { testDeletePluginStatus(t, ss) })
	t.Run("PluginPrunePluginStatuses", func(t *testing.T) { testPrunePluginStatuses(t, ss) })
}

func testPluginSaveGet(t *testing.T, ss store.Store) {
	kv := &model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	}

	if result := <-ss.Plugin().SaveOrUpdate(kv); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().Delete(kv.PluginId, kv.Key)
	}()

	if result := <-ss.Plugin().Get(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.PluginKeyValue)
		assert.Equal(t, kv.PluginId, received.PluginId)
		assert.Equal(t, kv.Key, received.Key)
		assert.Equal(t, kv.Value, received.Value)
	}

	// Try inserting when already exists
	kv.Value = []byte(model.NewId())
	if result := <-ss.Plugin().SaveOrUpdate(kv); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.Plugin().Get(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.(*model.PluginKeyValue)
		assert.Equal(t, kv.PluginId, received.PluginId)
		assert.Equal(t, kv.Key, received.Key)
		assert.Equal(t, kv.Value, received.Value)
	}
}

func testPluginDelete(t *testing.T, ss store.Store) {
	kv := store.Must(ss.Plugin().SaveOrUpdate(&model.PluginKeyValue{
		PluginId: model.NewId(),
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
	})).(*model.PluginKeyValue)

	if result := <-ss.Plugin().Delete(kv.PluginId, kv.Key); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func assertPluginStatuses(t *testing.T, ss store.Store, expectedPluginStatuses []*model.PluginStatus) {
	if result := <-ss.Plugin().GetPluginStatuses(); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		received := result.Data.([]*model.PluginStatus)
		assert.Equal(t, expectedPluginStatuses, received)
	}
}

func testGetPluginStatuses(t *testing.T, ss store.Store) {
	pluginStatus1 := &model.PluginStatus{
		PluginId:           "plugin_1",
		ClusterDiscoveryId: "cluster_discovery_id_00001",
		PluginPath:         "plugins/plugin_1",
		State:              model.PluginStateNotRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 1",
		Description:        "A mysterious first plugin.",
		Version:            "0.0.1",
	}
	expectedPluginStatuses := []*model.PluginStatus{pluginStatus1}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus1); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus1)
	}()

	assertPluginStatuses(t, ss, expectedPluginStatuses)

	pluginStatus2 := &model.PluginStatus{
		PluginId:           "plugin_2",
		ClusterDiscoveryId: "cluster_discovery_id_00002",
		PluginPath:         "plugins/plugin_2",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 2",
		Description:        "A surprising second plugin.",
		Version:            "0.0.2",
	}
	expectedPluginStatuses = append(expectedPluginStatuses, pluginStatus2)

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus2); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus2)
	}()

	assertPluginStatuses(t, ss, expectedPluginStatuses)
}

func testUpdatePluginStatusState(t *testing.T, ss store.Store) {
	pluginStatus1 := &model.PluginStatus{
		PluginId:           "plugin_1",
		ClusterDiscoveryId: "cluster_discovery_id_00001",
		PluginPath:         "plugins/plugin_1",
		State:              model.PluginStateNotRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 1",
		Description:        "A mysterious first plugin.",
		Version:            "0.0.1",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus1); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus1)
	}()

	pluginStatus2 := &model.PluginStatus{
		PluginId:           "plugin_2",
		ClusterDiscoveryId: "cluster_discovery_id_00002",
		PluginPath:         "plugins/plugin_2",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 2",
		Description:        "A surprising second plugin.",
		Version:            "0.0.2",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus2); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus2)
	}()

	pluginStatus2.State = model.PluginStateFailedToStart
	if result := <-ss.Plugin().UpdatePluginStatusState(pluginStatus2); result.Err != nil {
		t.Fatal(result.Err)
	}

	expectedPluginStatuses := []*model.PluginStatus{pluginStatus1, pluginStatus2}

	assertPluginStatuses(t, ss, expectedPluginStatuses)
}

func testDeletePluginStatus(t *testing.T, ss store.Store) {
	pluginStatus1 := &model.PluginStatus{
		PluginId:           "plugin_1",
		ClusterDiscoveryId: "cluster_discovery_id_00001",
		PluginPath:         "plugins/plugin_1",
		State:              model.PluginStateNotRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 1",
		Description:        "A mysterious first plugin.",
		Version:            "0.0.1",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus1); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus1)
	}()

	pluginStatus2 := &model.PluginStatus{
		PluginId:           "plugin_2",
		ClusterDiscoveryId: "cluster_discovery_id_00002",
		PluginPath:         "plugins/plugin_2",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 2",
		Description:        "A surprising second plugin.",
		Version:            "0.0.2",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus2); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus2)
	}()

	pluginStatus3 := &model.PluginStatus{
		PluginId:           "plugin_3",
		ClusterDiscoveryId: "cluster_discovery_id_00003",
		PluginPath:         "plugins/plugin_3",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 3",
		Description:        "Yet another plugin.",
		Version:            "0.0.3",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus3); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus3)
	}()

	if result := <-ss.Plugin().DeletePluginStatus(pluginStatus1); result.Err != nil {
		t.Fatal(result.Err)
	}

	assertPluginStatuses(t, ss, []*model.PluginStatus{pluginStatus2, pluginStatus3})

	if result := <-ss.Plugin().DeletePluginStatus(pluginStatus3); result.Err != nil {
		t.Fatal(result.Err)
	}

	assertPluginStatuses(t, ss, []*model.PluginStatus{pluginStatus2})
}

func testPrunePluginStatuses(t *testing.T, ss store.Store) {
	pluginStatus1 := &model.PluginStatus{
		PluginId:           "plugin_1",
		ClusterDiscoveryId: "cluster_discovery_id_00001",
		PluginPath:         "plugins/plugin_1",
		State:              model.PluginStateNotRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 1",
		Description:        "A mysterious first plugin.",
		Version:            "0.0.1",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus1); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus1)
	}()

	pluginStatus2 := &model.PluginStatus{
		PluginId:           "plugin_2",
		ClusterDiscoveryId: "cluster_discovery_id_00001",
		PluginPath:         "plugins/plugin_2",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 2",
		Description:        "A surprising second plugin.",
		Version:            "0.0.2",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus2); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus2)
	}()

	pluginStatus3 := &model.PluginStatus{
		PluginId:           "plugin_3",
		ClusterDiscoveryId: "cluster_discovery_id_00002",
		PluginPath:         "plugins/plugin_3",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 3",
		Description:        "Yet another plugin.",
		Version:            "0.0.3",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus3); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus2)
	}()

	pluginStatus4 := &model.PluginStatus{
		PluginId:           "plugin_4",
		ClusterDiscoveryId: "cluster_discovery_id_00003",
		PluginPath:         "plugins/plugin_4",
		State:              model.PluginStateRunning,
		IsSandboxed:        true,
		IsPrepackaged:      false,
		Name:               "Plugin 4",
		Description:        "Yikes. Another plugin!?",
		Version:            "0.0.4",
	}

	if result := <-ss.Plugin().CreatePluginStatus(pluginStatus4); result.Err != nil {
		t.Fatal(result.Err)
	}

	defer func() {
		<-ss.Plugin().DeletePluginStatus(pluginStatus2)
	}()

	clusterDiscoveries := []*model.ClusterDiscovery{
		{
			Id:          "cluster_discovery_id_00002",
			Type:        model.CDS_TYPE_APP,
			ClusterName: "cluster_name",
			Hostname:    "host_1",
			GossipPort:  10000,
			Port:        8065,
		},
	}

	for _, clusterDiscovery := range clusterDiscoveries {
		clusterDiscovery := clusterDiscovery
		if result := <-ss.ClusterDiscovery().Save(clusterDiscovery); result.Err != nil {
			t.Fatal(result.Err)
		}
		defer func() {
			<-ss.ClusterDiscovery().Delete(clusterDiscovery)
		}()
	}

	if result := <-ss.Plugin().PrunePluginStatuses("cluster_discovery_id_00003"); result.Err != nil {
		t.Fatal(result.Err)
	}

	assertPluginStatuses(t, ss, []*model.PluginStatus{pluginStatus3, pluginStatus4})

	if result := <-ss.Plugin().PrunePluginStatuses(""); result.Err != nil {
		t.Fatal(result.Err)
	}

	assertPluginStatuses(t, ss, []*model.PluginStatus{pluginStatus3})
}
