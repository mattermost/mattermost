// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/utils"
)

func TestGetLicenceConfig(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	if result, err := Client.GetClientLicenceConfig(""); err != nil {
		t.Fatal(err)
	} else {
		cfg := result.Data.(map[string]string)

		if _, ok := cfg["IsLicensed"]; !ok {
			t.Fatal(cfg)
		}

		// test etag caching
		if cache_result, err := Client.GetClientLicenceConfig(result.Etag); err != nil {
			t.Fatal(err)
		} else if len(cache_result.Data.(map[string]string)) != 0 {
			t.Log(cache_result.Data)
			t.Fatal("cache should be empty")
		}

		utils.SetClientLicense(map[string]string{"IsLicensed": "true"})

		if cache_result, err := Client.GetClientLicenceConfig(result.Etag); err != nil {
			t.Fatal(err)
		} else if len(cache_result.Data.(map[string]string)) == 0 {
			t.Fatal("result should not be empty")
		}

		utils.SetClientLicense(map[string]string{"SomeFeature": "true", "IsLicensed": "true"})

		if cache_result, err := Client.GetClientLicenceConfig(result.Etag); err != nil {
			t.Fatal(err)
		} else if len(cache_result.Data.(map[string]string)) == 0 {
			t.Fatal("result should not be empty")
		}

		utils.SetClientLicense(map[string]string{"IsLicensed": "false"})
	}
}
