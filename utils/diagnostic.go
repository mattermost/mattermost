// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"

	l4g "code.google.com/p/log4go"

	"github.com/mattermost/platform/model"
)

const (
	PROP_DIAGNOSTIC_ID              = "id"
	PROP_DIAGNOSTIC_CATEGORY        = "c"
	VAL_DIAGNOSTIC_CATEGORY_DEFALUT = "d"
	PROP_DIAGNOSTIC_BUILD           = "b"
	PROP_DIAGNOSTIC_DATABASE        = "db"
	PROP_DIAGNOSTIC_OS              = "os"
	PROP_DIAGNOSTIC_USER_COUNT      = "uc"
)

func SendDiagnostic(data model.StringMap) *model.AppError {
	if Cfg.PrivacySettings.EnableDiagnostic && model.BuildNumber != "_BUILD_NUMBER_" {

		query := "?"
		for name, value := range data {
			if len(query) > 1 {
				query += "&"
			}

			query += name + "=" + UrlEncode(value)
		}

		res, err := http.Get("http://d7zmvsa9e04kk.cloudfront.net/i" + query)
		if err != nil {
			l4g.Error("Failed to send diagnostics %v", err.Error())
		}

		res.Body.Close()
	}

	return nil
}
