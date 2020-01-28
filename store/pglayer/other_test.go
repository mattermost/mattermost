// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pglayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/store/storetest"
)

func TestAuditStore(t *testing.T) {
	StoreTest(t, storetest.TestAuditStore)
}

func TestBotStore(t *testing.T) {
	StoreTestWithSqlSupplier(t, storetest.TestBotStore)
}

func TestClusterDiscoveryStore(t *testing.T) {
	StoreTest(t, storetest.TestClusterDiscoveryStore)
}

func TestCommandWebhookStore(t *testing.T) {
	StoreTest(t, storetest.TestCommandWebhookStore)
}

func TestComplianceStore(t *testing.T) {
	StoreTest(t, storetest.TestComplianceStore)
}

func TestEmojiStore(t *testing.T) {
	StoreTest(t, storetest.TestEmojiStore)
}

func TestJobStore(t *testing.T) {
	StoreTest(t, storetest.TestJobStore)
}

func TestLicenseStore(t *testing.T) {
	StoreTest(t, storetest.TestLicenseStore)
}

func TestRoleStore(t *testing.T) {
	StoreTest(t, storetest.TestRoleStore)
}

func TestSchemeStore(t *testing.T) {
	StoreTest(t, storetest.TestSchemeStore)
}

func TestStatusStore(t *testing.T) {
	StoreTest(t, storetest.TestStatusStore)
}

func TestSystemStore(t *testing.T) {
	StoreTest(t, storetest.TestSystemStore)
}

func TestTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestTermsOfServiceStore)
}

func TestUserTermsOfServiceStore(t *testing.T) {
	StoreTest(t, storetest.TestUserTermsOfServiceStore)
}

func TestWebhookStore(t *testing.T) {
	StoreTest(t, storetest.TestWebhookStore)
}
