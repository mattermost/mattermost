package redis

import (
	"errors"
	"strings"

	"github.com/splitio/go-toolkit/v3/logging"
	"github.com/splitio/go-toolkit/v3/redis"
)

// ErrorHashNotPresent constant
const ErrorHashNotPresent = "hash-not-present"

const clearAllSCriptTemplate = `
	local toDelete = redis.call('KEYS', '{KEY_NAMESPACE}*')
	local count = 0
	for _, key in ipairs(toDelete) do
	    redis.call('DEL', key)
	    count = count + 1
	end
	return count
`

// MiscStorage provides methods to handle the synchronizer's initialization procedure
type MiscStorage struct {
	client *redis.PrefixedRedisClient
	logger logging.LoggerInterface
}

// GetApikeyHash gets hashed apikey from redis
func (m *MiscStorage) GetApikeyHash() (string, error) {
	res, err := m.client.Get(redisHash)
	if err != nil && err.Error() == "redis: nil" {
		return "", errors.New(ErrorHashNotPresent)
	}
	return res, err
}

// SetApikeyHash sets hashed apikey in redis
func (m *MiscStorage) SetApikeyHash(newApikeyHash string) error {
	return m.client.Set(redisHash, newApikeyHash, 0)
}

// ClearAll cleans previous used data
func (m *MiscStorage) ClearAll() error {
	luaCMD := strings.Replace(clearAllSCriptTemplate, "{KEY_NAMESPACE}", m.client.Prefix, 1)
	return m.client.Eval(luaCMD, []string{}, nil)
}

// NewMiscStorage creates a new MiscStorageAdapter and returns a reference to it
func NewMiscStorage(client *redis.PrefixedRedisClient, logger logging.LoggerInterface) *MiscStorage {
	return &MiscStorage{
		client: client,
		logger: logger,
	}
}
