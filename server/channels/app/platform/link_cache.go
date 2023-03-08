// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"time"

	"github.com/mattermost/mattermost-server/v6/server/platform/services/cache"
)

const LinkCacheSize = 10000
const LinkCacheDuration = 1 * time.Hour

var linkCache = cache.NewLRU(cache.LRUOptions{
	Size: LinkCacheSize,
})

func PurgeLinkCache() {
	linkCache.Purge()
}

func LinkCache() cache.Cache {
	return linkCache
}
