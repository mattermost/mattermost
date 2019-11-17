package localcachelayer

import "github.com/mattermost/mattermost-server/store"

type LocalCacheChannelGuestNumberStore struct {
	store.ChannelStore
	rootStore *LocalCacheStore
}





func (s LocalCacheChannelGuestNumberStore) InvalidateGuestCount(channelId string, deleted bool) {
	cacheKey := channelId
	if deleted {
		cacheKey += "_deleted"
	}
	s.rootStore.doInvalidateCacheCluster(s.rootStore.fileInfoCache, cacheKey)
	if s.rootStore.metrics != nil {
		s.rootStore.metrics.IncrementMemCacheInvalidationCounter("File Info Cache - Remove by channelId")

}

