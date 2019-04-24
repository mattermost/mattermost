// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClusterDiscoveryStore(t *testing.T, ss store.Store) {
	t.Run("", func(t *testing.T) { testClusterDiscoveryStore(t, ss) })
	t.Run("Delete", func(t *testing.T) { testClusterDiscoveryStoreDelete(t, ss) })
	t.Run("LastPing", func(t *testing.T) { testClusterDiscoveryStoreLastPing(t, ss) })
	t.Run("Exists", func(t *testing.T) { testClusterDiscoveryStoreExists(t, ss) })
	t.Run("ClusterDiscoveryGetStore", func(t *testing.T) { testClusterDiscoveryGetStore(t, ss) })
}

func testClusterDiscoveryStore(t *testing.T, ss store.Store) {
	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test",
	}

	if err := ss.ClusterDiscovery().Save(discovery); err != nil {
		t.Fatal(err)
	}

	if err := ss.ClusterDiscovery().Cleanup(); err != nil {
		t.Fatal(err)
	}
}

func testClusterDiscoveryStoreDelete(t *testing.T, ss store.Store) {
	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test",
	}

	if err := ss.ClusterDiscovery().Save(discovery); err != nil {
		t.Fatal(err)
	}

	if _, err := ss.ClusterDiscovery().Delete(discovery); err != nil {
		t.Fatal(err)
	}
}

func testClusterDiscoveryStoreLastPing(t *testing.T, ss store.Store) {
	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name_lastPing",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test_lastPing" + model.NewId(),
	}

	if err := ss.ClusterDiscovery().Save(discovery); err != nil {
		t.Fatal(err)
	}

	if err := ss.ClusterDiscovery().SetLastPingAt(discovery); err != nil {
		t.Fatal(err)
	}

	ttime := model.GetMillis()

	time.Sleep(1 * time.Second)

	if err := ss.ClusterDiscovery().SetLastPingAt(discovery); err != nil {
		t.Fatal(err)
	}

	list, err := ss.ClusterDiscovery().GetAll(discovery.Type, "cluster_name_lastPing")
	require.Nil(t, err)
	assert.Len(t, list, 1)

	if list[0].LastPingAt-ttime < 500 {
		t.Fatal("failed to set time")
	}

	discovery2 := &model.ClusterDiscovery{
		ClusterName: "cluster_name_missing",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test_missing",
	}

	if err := ss.ClusterDiscovery().SetLastPingAt(discovery2); err != nil {
		t.Fatal(err)
	}
}

func testClusterDiscoveryStoreExists(t *testing.T, ss store.Store) {
	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name_Exists",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test_Exists" + model.NewId(),
	}

	if err := ss.ClusterDiscovery().Save(discovery); err != nil {
		t.Fatal(err)
	}

	val, err := ss.ClusterDiscovery().Exists(discovery)
	require.Nil(t, err)
	assert.True(t, val)

	discovery.ClusterName = "cluster_name_Exists2"

	val, err = ss.ClusterDiscovery().Exists(discovery)
	require.Nil(t, err)
	assert.False(t, val)
}

func testClusterDiscoveryGetStore(t *testing.T, ss store.Store) {
	testType1 := model.NewId()

	discovery1 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname1",
		Type:        testType1,
	}
	require.Nil(t, ss.ClusterDiscovery().Save(discovery1))

	discovery2 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname2",
		Type:        testType1,
	}
	require.Nil(t, ss.ClusterDiscovery().Save(discovery2))

	discovery3 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname3",
		Type:        testType1,
		CreateAt:    1,
		LastPingAt:  1,
	}
	require.Nil(t, ss.ClusterDiscovery().Save(discovery3))

	testType2 := model.NewId()

	discovery4 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname1",
		Type:        testType2,
	}
	require.Nil(t, ss.ClusterDiscovery().Save(discovery4))

	list, err := ss.ClusterDiscovery().GetAll(testType1, "cluster_name")
	require.Nil(t, err)
	assert.Len(t, list, 2)

	list, err = ss.ClusterDiscovery().GetAll(testType2, "cluster_name")
	require.Nil(t, err)
	assert.Len(t, list, 1)

	list, err = ss.ClusterDiscovery().GetAll(model.NewId(), "cluster_name")
	require.Nil(t, err)
	assert.Len(t, list, 0)
}
