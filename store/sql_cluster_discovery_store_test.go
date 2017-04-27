// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"testing"

	"time"

	"github.com/mattermost/platform/model"
)

func TestSqlClusterDiscoveryStore(t *testing.T) {
	Setup()

	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test",
	}

	if result := <-store.ClusterDiscovery().Save(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.ClusterDiscovery().Cleanup(); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func TestSqlClusterDiscoveryStoreDelete(t *testing.T) {
	Setup()

	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test",
	}

	if result := <-store.ClusterDiscovery().Save(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.ClusterDiscovery().Delete(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func TestSqlClusterDiscoveryStoreLastPing(t *testing.T) {
	Setup()

	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name_lastPing",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test_lastPing" + model.NewId(),
	}

	if result := <-store.ClusterDiscovery().Save(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.ClusterDiscovery().SetLastPingAt(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}

	ttime := model.GetMillis()

	time.Sleep(1 * time.Second)

	if result := <-store.ClusterDiscovery().SetLastPingAt(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.ClusterDiscovery().GetAll(discovery.Type, "cluster_name_lastPing"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		list := result.Data.([]*model.ClusterDiscovery)

		if len(list) != 1 {
			t.Fatal("should only be 1 items")
			return
		}

		if list[0].LastPingAt-ttime < 500 {
			t.Fatal("failed to set time")
		}
	}

	discovery2 := &model.ClusterDiscovery{
		ClusterName: "cluster_name_missing",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test_missing",
	}

	if result := <-store.ClusterDiscovery().SetLastPingAt(discovery2); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func TestSqlClusterDiscoveryStoreExists(t *testing.T) {
	Setup()

	discovery := &model.ClusterDiscovery{
		ClusterName: "cluster_name_Exists",
		Hostname:    "hostname" + model.NewId(),
		Type:        "test_test_Exists" + model.NewId(),
	}

	if result := <-store.ClusterDiscovery().Save(discovery); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.ClusterDiscovery().Exists(discovery); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		val := result.Data.(bool)
		if !val {
			t.Fatal("should be true")
		}
	}

	discovery.ClusterName = "cluster_name_Exists2"

	if result := <-store.ClusterDiscovery().Exists(discovery); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		val := result.Data.(bool)
		if val {
			t.Fatal("should be true")
		}
	}
}

func TestSqlClusterDiscoveryGetStore(t *testing.T) {
	Setup()

	testType1 := model.NewId()

	discovery1 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname1",
		Type:        testType1,
	}
	Must(store.ClusterDiscovery().Save(discovery1))

	discovery2 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname2",
		Type:        testType1,
	}
	Must(store.ClusterDiscovery().Save(discovery2))

	discovery3 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname3",
		Type:        testType1,
		CreateAt:    1,
		LastPingAt:  1,
	}
	Must(store.ClusterDiscovery().Save(discovery3))

	testType2 := model.NewId()

	discovery4 := &model.ClusterDiscovery{
		ClusterName: "cluster_name",
		Hostname:    "hostname1",
		Type:        testType2,
	}
	Must(store.ClusterDiscovery().Save(discovery4))

	if result := <-store.ClusterDiscovery().GetAll(testType1, "cluster_name"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		list := result.Data.([]*model.ClusterDiscovery)

		if len(list) != 2 {
			t.Fatal("Should only have returned 2")
		}
	}

	if result := <-store.ClusterDiscovery().GetAll(testType2, "cluster_name"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		list := result.Data.([]*model.ClusterDiscovery)

		if len(list) != 1 {
			t.Fatal("Should only have returned 1")
		}
	}

	if result := <-store.ClusterDiscovery().GetAll(model.NewId(), "cluster_name"); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		list := result.Data.([]*model.ClusterDiscovery)

		if len(list) != 0 {
			t.Fatal("shouldn't be any")
		}
	}
}
