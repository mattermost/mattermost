// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
)

func TestLdapTest(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	_, resp := th.Client.TestLdap()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.TestLdap()
	CheckNotImplementedStatus(t, resp)
}

func TestLdapSync(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	_, resp := th.SystemAdminClient.SyncLdap()
	CheckNoError(t, resp)

	_, resp = th.Client.SyncLdap()
	CheckForbiddenStatus(t, resp)
}
