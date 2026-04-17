// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestSendIPFiltersChangedEmailNilLicense(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	defer th.TearDown()

	t.Run("nil license does not panic", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)

		rctx := request.TestContext(t)
		// SendIPFiltersChangedEmail checks License().IsCloud() — must not panic when nil.
		// It may return an error (e.g., no SMTP configured), but must not panic.
		_ = th.App.SendIPFiltersChangedEmail(rctx, model.NewId())
	})
}
