// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"time"

	"github.com/mattermost/platform/model"
)

func TestClusterDiscoveryService(t *testing.T) {
	Setup()

	ds := NewClusterDiscoveryService(model.CDS_TYPE_APP, "clusterA")
	ds.Start()
	time.Sleep(2 * time.Second)

	ds.Stop()
	time.Sleep(2 * time.Second)
}
