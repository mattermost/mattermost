// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	USER_PASSWORD           = "passwd"
	CHANNEL_TYPE            = model.CHANNEL_OPEN
	BTEST_TEAM_DISPLAY_NAME = "TestTeam"
	BTEST_TEAM_NAME         = "z-z-testdomaina"
	BTEST_TEAM_EMAIL        = "test@nowhere.com"
	BTEST_TEAM_TYPE         = model.TEAM_OPEN
	BTEST_USER_NAME         = "Mr. Testing Tester"
	BTEST_USER_EMAIL        = "success+ttester@simulator.amazonses.com"
	BTEST_USER_PASSWORD     = "passwd"
)

var (
	TEAM_NAME_LEN            = utils.Range{Begin: 10, End: 20}
	TEAM_DOMAIN_NAME_LEN     = utils.Range{Begin: 10, End: 20}
	TEAM_EMAIL_LEN           = utils.Range{Begin: 15, End: 30}
	USER_NAME_LEN            = utils.Range{Begin: 5, End: 20}
	USER_EMAIL_LEN           = utils.Range{Begin: 15, End: 30}
	CHANNEL_DISPLAY_NAME_LEN = utils.Range{Begin: 10, End: 20}
	CHANNEL_NAME_LEN         = utils.Range{Begin: 5, End: 20}
	TEST_IMAGE_FILENAMES     = []string{"test.png", "testjpg.jpg", "testgif.gif"}
)
