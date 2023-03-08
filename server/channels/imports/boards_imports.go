// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	// Needed to ensure the init() method in the FocalBoard product is run.
	_ "github.com/mattermost/mattermost-server/v6/server/boards/product"
)
