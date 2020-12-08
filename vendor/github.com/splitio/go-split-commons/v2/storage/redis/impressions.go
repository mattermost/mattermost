package redis

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/redis"
)

const impressionsTTLRefresh = time.Duration(3600) * time.Second

// ImpressionStorage is a redis-based implementation of split storage
type ImpressionStorage struct {
	client         *redis.PrefixedRedisClient
	mutex          *sync.Mutex
	logger         logging.LoggerInterface
	redisKey       string
	impressionsTTL time.Duration
	metadata       dtos.Metadata
}

// NewImpressionStorage creates a new RedisSplitStorage and returns a reference to it
func NewImpressionStorage(client *redis.PrefixedRedisClient, metadata dtos.Metadata, logger logging.LoggerInterface) *ImpressionStorage {
	return &ImpressionStorage{
		client:         client,
		mutex:          &sync.Mutex{},
		logger:         logger,
		redisKey:       redisImpressionsQueue,
		impressionsTTL: redisImpressionsTTL,
		metadata:       metadata,
	}
}

// Count returns the size of the impressions queue
func (r *ImpressionStorage) Count() int64 {
	val, err := r.client.LLen(r.redisKey)
	if err != nil {
		return 0
	}
	return val
}

// Drop drops impressions from queue
func (r *ImpressionStorage) Drop(size *int64) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	if size == nil {
		_, err := r.client.Del(r.redisKey)
		return err
	}
	return r.client.LTrim(r.redisKey, *size, -1)
}

// Empty returns true if redis list is zero length
func (r *ImpressionStorage) Empty() bool {
	return r.Count() == 0
}

// push stores impressions in redis
func (r *ImpressionStorage) push(impressions []dtos.ImpressionQueueObject) error {
	var impressionsJSON []interface{}
	for _, impression := range impressions {
		iJSON, err := json.Marshal(impression)
		if err != nil {
			r.logger.Error("Error encoding impression in json")
			r.logger.Error(err)
		} else {
			impressionsJSON = append(impressionsJSON, iJSON)
		}
	}

	r.logger.Debug("Pushing impressions to: ", r.redisKey, len(impressionsJSON))

	inserted, errPush := r.client.RPush(r.redisKey, impressionsJSON...)
	if errPush != nil {
		r.logger.Error("Something were wrong pushing impressions to redis", errPush)
		return errPush
	}

	// Checks if expiration needs to be set
	if inserted == int64(len(impressionsJSON)) {
		r.logger.Debug("Proceeding to set expiration for: ", r.redisKey)
		result := r.client.Expire(r.redisKey, time.Duration(r.impressionsTTL)*time.Minute)
		if result == false {
			r.logger.Error("Something were wrong setting expiration", errPush)
		}
	}
	return nil
}

// LogImpressions stores impressions in redis as Queue
func (r *ImpressionStorage) LogImpressions(impressions []dtos.Impression) error {
	var impressionsToStore []dtos.ImpressionQueueObject
	for _, i := range impressions {
		var impression = dtos.ImpressionQueueObject{Metadata: r.metadata, Impression: i}
		impressionsToStore = append(impressionsToStore, impression)
	}

	if len(impressionsToStore) > 0 {
		return r.push(impressionsToStore)
	}
	return nil
}

// PopN return N elements from 0 to N
func (r *ImpressionStorage) PopN(n int64) ([]dtos.Impression, error) {
	panic("Not implemented for redis")
}

// PopNWithMetadata pop N elements from queue
func (r *ImpressionStorage) PopNWithMetadata(n int64) ([]dtos.ImpressionQueueObject, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	toReturn := make([]dtos.ImpressionQueueObject, 0, n)
	lrange, err := r.client.LRange(r.redisKey, 0, n-1)
	if err != nil {
		r.logger.Error("Error fetching impressions")
		return toReturn, err
	}

	fetchedCount := int64(len(lrange))
	err = r.client.LTrim(r.redisKey, fetchedCount, int64(-1))
	if err != nil {
		r.logger.Error("Error trimming impressions")
		return toReturn, err
	}

	// This operation will simply do nothing if the key no longer exists (queue is empty)
	// It's only done in the "successful" exit path so that the TTL is not overriden if impressons weren't
	// popped correctly. This will result in impressions getting lost but will prevent the queue from taking
	// a huge amount of memory.
	r.client.Expire(r.redisKey, impressionsTTLRefresh)

	for _, asStr := range lrange {
		storedImpressionDTO := dtos.ImpressionQueueObject{}
		err = json.Unmarshal([]byte(asStr), &storedImpressionDTO)
		if err != nil {
			r.logger.Error("Error decoding event JSON", err.Error())
			continue
		}
		toReturn = append(toReturn, storedImpressionDTO)
	}

	return toReturn, nil
}
