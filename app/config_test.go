// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/model"
)

func TestConfigListener(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	originalSiteName := th.App.Config().TeamSettings.SiteName
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.TeamSettings.SiteName = "test123"
	})

	listenerCalled := false
	listener := func(oldConfig *model.Config, newConfig *model.Config) {
		if listenerCalled {
			t.Fatal("listener called twice")
		}

		if oldConfig.TeamSettings.SiteName != "test123" {
			t.Fatal("old config contains incorrect site name")
		} else if newConfig.TeamSettings.SiteName != originalSiteName {
			t.Fatal("new config contains incorrect site name")
		}

		listenerCalled = true
	}
	listenerId := th.App.AddConfigListener(listener)
	defer th.App.RemoveConfigListener(listenerId)

	listener2Called := false
	listener2 := func(oldConfig *model.Config, newConfig *model.Config) {
		if listener2Called {
			t.Fatal("listener2 called twice")
		}

		listener2Called = true
	}
	listener2Id := th.App.AddConfigListener(listener2)
	defer th.App.RemoveConfigListener(listener2Id)

	th.App.ReloadConfig()

	if !listenerCalled {
		t.Fatal("listener should've been called")
	} else if !listener2Called {
		t.Fatal("listener 2 should've been called")
	}
}

func TestAsymmetricSigningKey(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	assert.NotNil(t, th.App.AsymmetricSigningKey())
	assert.NotEmpty(t, th.App.ClientConfig()["AsymmetricSigningPublicKey"])
}

func TestClientConfigWithComputed(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	config := th.App.ClientConfigWithComputed()
	if _, ok := config["NoAccounts"]; !ok {
		t.Fatal("expected NoAccounts in returned config")
	}
	if _, ok := config["MaxPostSize"]; !ok {
		t.Fatal("expected MaxPostSize in returned config")
	}
}
