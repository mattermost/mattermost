// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestGetLicenceConfig(t *testing.T) {
	Setup()

	if result, err := Client.GetClientLicenceConfig(); err != nil {
		t.Fatal(err)
	} else {
		cfg := result.Data.(map[string]string)

		if _, ok := cfg["IsLicensed"]; !ok {
			t.Fatal(cfg)
		}
	}
}
