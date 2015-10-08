// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"testing"
)

var ipAddressTests = []struct {
	address  string
	expected bool
}{
	{"126.255.255.255", false},
	{"127.0.0.1", true},
	{"127.0.0.4", false},
	{"9.255.255.255", false},
	{"10.0.0.1", true},
	{"11.0.0.1", false},
	{"176.15.155.255", false},
	{"176.16.0.1", true},
	{"176.31.0.1", false},
	{"192.167.255.255", false},
	{"192.168.0.1", true},
	{"192.169.0.1", false},
}

func TestIpAddress(t *testing.T) {
	for _, v := range ipAddressTests {
		if IsPrivateIpAddress(v.address) != v.expected {
			t.Errorf("expect %v as %v", v.address, v.expected)
		}
	}
}

func TestContext(t *testing.T) {
	context := Context{}

	context.IpAddress = "127.0.0.1"
	context.Session.UserId = "5"

	if !context.HasPermissionsToUser("5", "") {
		t.Fatal("should have permissions")
	}

	if context.HasPermissionsToUser("6", "") {
		t.Fatal("shouldn't have permissions")
	}

	context.Session.Roles = model.ROLE_SYSTEM_ADMIN
	if !context.HasPermissionsToUser("6", "") {
		t.Fatal("should have permissions")
	}

	// context.IpAddress = "125.0.0.1"
	// if context.HasPermissionsToUser("6", "") {
	// 	t.Fatal("shouldn't have permissions")
	// }
}
