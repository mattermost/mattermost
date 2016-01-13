// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
)

func TestLicenseExpired(t *testing.T) {
	l1 := License{}
	l1.ExpiresAt = GetMillis() - 1000
	if !l1.IsExpired() {
		t.Fatal("license should be expired")
	}

	l1.ExpiresAt = GetMillis() + 10000
	if l1.IsExpired() {
		t.Fatal("license should not be expired")
	}
}

func TestLicenseStarted(t *testing.T) {
	l1 := License{}
	l1.StartsAt = GetMillis() - 1000
	if !l1.IsStarted() {
		t.Fatal("license should be started")
	}

	l1.StartsAt = GetMillis() + 10000
	if l1.IsStarted() {
		t.Fatal("license should not be started")
	}
}
