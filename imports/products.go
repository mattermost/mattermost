// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See ENTERPRISE-LICENSE.txt and SOURCE-CODE-LICENSE.txt for license information.

package imports

import (
	// Needed to ensure the init() method in the FocalBoard product is run
	_ "github.com/mattermost/focalboard/mattermost-plugin/product"
)
