// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package valid

type API interface {
	// ValidMethod is a fake method for testing the
	// plugin comment checker with a valid comment.
	//
	// Minimum server version: 1.2.3
	ValidMethod()
}
