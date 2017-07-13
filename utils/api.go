// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"net/http"
	"strings"
)

type OriginCheckerProc func(*http.Request) bool

func OriginChecker(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if *Cfg.ServiceSettings.AllowCorsFrom == "*" {
		return true
	}
	for _, allowed := range strings.Split(*Cfg.ServiceSettings.AllowCorsFrom, " ") {
		if allowed == origin {
			return true
		}
	}
	return false
}

func GetOriginChecker(r *http.Request) OriginCheckerProc {
	if len(*Cfg.ServiceSettings.AllowCorsFrom) > 0 {
		return OriginChecker
	}

	return nil
}
