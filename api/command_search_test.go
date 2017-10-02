// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"
)

func TestSearchCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.BasicClient.Must(th.BasicClient.Command(th.BasicChannel.Id, "/search"))
}
