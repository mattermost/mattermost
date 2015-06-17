// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	//"os"
	"testing"
)

func TestConfig(t *testing.T) {
	LoadConfig("config.json")
}

/*
func TestEnvOverride(t *testing.T) {
	os.Setenv("MATTERMOST_DOMAIN", "testdomain.com")

	LoadConfig("config_docker.json")
	if Cfg.ServiceSettings.Domain != "testdomain.com" {
		t.Fail()
	}

	LoadConfig("config.json")
	if Cfg.ServiceSettings.Domain == "testdomain.com" {
		t.Fail()
	}
}
*/
