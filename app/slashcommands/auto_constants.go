// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/utils"
)

const (
	UserPassword         = "Usr@MMTest123"
	ChannelType          = model.ChannelTypeOpen
	BTestTeamDisplayName = "TestTeam"
	BTestTeamName        = "z-z-testdomaina"
	BTestTeamEmail       = "test@nowhere.com"
	BTestTeamType        = model.TeamOpen
	BTestUserName        = "Mr. Testing Tester"
	BTestUserEmail       = "success+ttester@simulator.amazonses.com"
	BTestUserPassword    = "passwd"
)

var (
	TeamNameLen           = utils.Range{Begin: 10, End: 20}
	TeamDomainNameLen     = utils.Range{Begin: 10, End: 20}
	TeamEmailLen          = utils.Range{Begin: 15, End: 30}
	UserNameLen           = utils.Range{Begin: 5, End: 20}
	UserEmailLen          = utils.Range{Begin: 15, End: 30}
	ChannelDisplayNameLen = utils.Range{Begin: 10, End: 20}
	ChannelNameLen        = utils.Range{Begin: 5, End: 20}
	TestImageFileNames    = []string{"test.png", "testjpg.jpg", "testgif.gif"}
)
