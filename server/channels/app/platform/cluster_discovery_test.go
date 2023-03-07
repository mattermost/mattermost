// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/server/v7/model"
)

func TestClusterDiscoveryService(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	ds := th.Service.NewClusterDiscoveryService()
	ds.Type = model.CDSTypeApp
	ds.ClusterName = "ClusterA"
	ds.AutoFillHostname()

	ds.Start()
	time.Sleep(2 * time.Second)

	ds.Stop()
	time.Sleep(2 * time.Second)
}
