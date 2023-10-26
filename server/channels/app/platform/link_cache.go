// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

type LinkMetadataCache struct {
	OpenGraph *opengraph.OpenGraph
	PostImage *model.PostImage
	Permalink *model.Permalink
}

const LinkCacheSize = 10000
const LinkCacheDuration = 1 * time.Hour

var linkCache = cache.NewLRU[LinkMetadataCache](cache.LRUOptions{
	Size: LinkCacheSize,
})

func PurgeLinkCache() {
	linkCache.Purge()
}

func LinkCache() cache.Cache[LinkMetadataCache] {
	return linkCache
}
