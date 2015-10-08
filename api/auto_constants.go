// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	USER_PASSWORD              = "passwd"
	CHANNEL_TYPE               = model.CHANNEL_OPEN
	FUZZ_USER_EMAIL_PREFIX_LEN = 10
	BTEST_TEAM_DISPLAY_NAME    = "TestTeam"
	BTEST_TEAM_NAME            = "z-z-testdomaina"
	BTEST_TEAM_EMAIL           = "test@nowhere.com"
	BTEST_TEAM_TYPE            = model.TEAM_OPEN
	BTEST_USER_NAME            = "Mr. Testing Tester"
	BTEST_USER_EMAIL           = "success+ttester@simulator.amazonses.com"
	BTEST_USER_PASSWORD        = "passwd"
)

var (
	TEAM_NAME_LEN            = utils.Range{10, 20}
	TEAM_DOMAIN_NAME_LEN     = utils.Range{10, 20}
	TEAM_EMAIL_LEN           = utils.Range{15, 30}
	USER_NAME_LEN            = utils.Range{5, 20}
	USER_EMAIL_LEN           = utils.Range{15, 30}
	CHANNEL_DISPLAY_NAME_LEN = utils.Range{10, 20}
	CHANNEL_NAME_LEN         = utils.Range{5, 20}
	POST_MESSAGE_LEN         = utils.Range{100, 400}
	POST_HASHTAGS_NUM        = utils.Range{5, 10}
	POST_MENTIONS_NUM        = utils.Range{0, 3}
	TEST_IMAGE_FILENAMES     = []string{"test.png", "testjpg.jpg", "testgif.gif"}
)
