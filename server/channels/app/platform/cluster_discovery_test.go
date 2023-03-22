// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"os"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestClusterDiscoveryService(t *testing.T) {
	// TODO: this needs to be refactored so the env variable doesn't
	// need to be set here
	os.Setenv("MM_SQLSETTINGS_DATASOURCE", *mainHelper.Settings.DataSource)

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

	os.Unsetenv("MM_SQLSETTINGS_DATASOURCE")
}
