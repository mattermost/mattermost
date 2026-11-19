// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

// SampledCodes are the rules whose value and details come from what a node measures when its
// diagnostics are collected, so two collections of the same server can disagree on them. Tests
// comparing a live check with a Support Packet of the same server ignore them.
var SampledCodes = []string{
	"DB_POOL_SATURATED",
	"FILESTORE_DISK_FULL",
	"FILESTORE_DISK_LOW",
	"NODE_CONTAINER_MEMORY_PRESSURE",
	"NODE_CPU_THROTTLED",
	"NODE_FD_EXHAUSTION",
	"NODE_HOST_LOAD_HIGH",
	"NODE_HOST_MEMORY_LOW",
}
