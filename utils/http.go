// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

// RequestIsAjax returns true if the RequestedWith header equals RequestedWithXML
func RequestIsAjax(r *http.Request) bool {
	return r.Header.Get(model.HeaderRequestedWith) == model.HeaderRequestedWithXML
}
