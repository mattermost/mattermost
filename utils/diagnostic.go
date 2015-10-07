// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"

	"github.com/mattermost/platform/model"
)

const (
	DIAGNOSTIC_URL = "https://d7zmvsa9e04kk.cloudfront.net"

	PROP_DIAGNOSTIC_ID              = "id"
	PROP_DIAGNOSTIC_CATEGORY        = "c"
	VAL_DIAGNOSTIC_CATEGORY_DEFAULT = "d"
	PROP_DIAGNOSTIC_BUILD           = "b"
	PROP_DIAGNOSTIC_DATABASE        = "db"
	PROP_DIAGNOSTIC_OS              = "os"
	PROP_DIAGNOSTIC_USER_COUNT      = "uc"
)

func SendDiagnostic(data model.StringMap) {
	if Cfg.PrivacySettings.EnableSecurityFixAlert && model.IsOfficalBuild() {

		query := "?"
		for name, value := range data {
			if len(query) > 1 {
				query += "&"
			}

			query += name + "=" + UrlEncode(value)
		}

		res, err := http.Get(DIAGNOSTIC_URL + "/i" + query)
		if err != nil {
			return
		}

		res.Body.Close()
	}
}
