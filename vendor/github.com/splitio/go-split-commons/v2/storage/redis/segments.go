package redis

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/splitio/go-toolkit/v3/datastructures/set"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/redis"
)

// SegmentStorage is a redis implementation of a storage for segments
type SegmentStorage struct {
	client redis.PrefixedRedisClient
	logger logging.LoggerInterface
	mutext *sync.RWMutex
}

// NewSegmentStorage creates a new RedisSegmentStorage and returns a reference to it
func NewSegmentStorage(redisClient *redis.PrefixedRedisClient, logger logging.LoggerInterface) *SegmentStorage {
	return &SegmentStorage{
		client: *redisClient,
		logger: logger,
		mutext: &sync.RWMutex{},
	}
}

// ChangeNumber returns the changeNumber for a particular segment
func (r *SegmentStorage) ChangeNumber(segmentName string) (int64, error) {
	segmentKey := strings.Replace(redisSegmentTill, "{segment}", segmentName, 1)
	tillStr, err := r.client.Get(segmentKey)
	if err != nil {
		return -1, err
	}

	asInt, err := strconv.ParseInt(tillStr, 10, 64)
	if err != nil {
		r.logger.Error("Error retrieving till. Returning -1: ", err.Error())
		return -1, err
	}
	return asInt, nil
}

// Keys returns segments keys for segment if it's present
func (r *SegmentStorage) Keys(segmentName string) *set.ThreadUnsafeSet {
	keyToFetch := strings.Replace(redisSegment, "{segment}", segmentName, 1)
	segmentKeys, err := r.client.SMembers(keyToFetch)
	if len(segmentKeys) <= 0 {
		r.logger.Debug(fmt.Sprintf("Nonexsitent segment requested: %s", segmentName))
		return nil
	}
	if err != nil {
		r.logger.Error(fmt.Sprintf("Error retrieving members from set %s", segmentName))
		return nil
	}
	segment := set.NewSet()
	for _, member := range segmentKeys {
		segment.Add(member)
	}
	return segment
}

// SetChangeNumber sets the till value belong to segmentName
func (r *SegmentStorage) SetChangeNumber(segmentName string, changeNumber int64) error {
	segmentKey := strings.Replace(redisSegmentTill, "{segment}", segmentName, 1)
	return r.client.Set(segmentKey, changeNumber, 0)
}

// Update adds a new segment
func (r *SegmentStorage) Update(name string, toAdd *set.ThreadUnsafeSet, toRemove *set.ThreadUnsafeSet, till int64) error {
	r.mutext.Lock()
	defer r.mutext.Unlock()
	segmentKey := strings.Replace(redisSegment, "{segment}", name, 1)
	if !toRemove.IsEmpty() {
		_, err := r.client.SRem(segmentKey, toRemove.List()...)
		if err != nil {
			r.logger.Error(fmt.Sprintf("Error removing keys in redis: %s", err.Error()))
		}
	}
	if !toAdd.IsEmpty() {
		_, err := r.client.SAdd(segmentKey, toAdd.List()...)
		if err != nil {
			r.logger.Error(fmt.Sprintf("Error removing keys in redis: %s", err.Error()))
		}
	}
	r.SetChangeNumber(name, till)
	return nil
}

// SegmentContainsKey returns true if the segment contains a specific key
func (r *SegmentStorage) SegmentContainsKey(segmentName string, key string) (bool, error) {
	segmentKey := strings.Replace(redisSegment, "{segment}", segmentName, 1)
	exists := r.client.SIsMember(segmentKey, key)
	return exists, nil
}

// CountRemovedKeys method
func (r *SegmentStorage) CountRemovedKeys(segmentName string) int64 { return 0 }
