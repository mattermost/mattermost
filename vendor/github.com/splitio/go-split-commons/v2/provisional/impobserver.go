package provisional

import (
	"fmt"
	"sync"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-toolkit/v3/provisional/int64cache"
)

// ImpressionObserver is used to check wether an impression has been previously seen
type ImpressionObserver interface {
	TestAndSet(featureName string, impression *dtos.Impression) (int64, error)
}

// ImpressionObserverImpl is an implementation of the ImpressionObserver interface
type ImpressionObserverImpl struct {
	cache  int64cache.Int64Cache
	hasher ImpressionHasher
	mutex  sync.Mutex
}

// Atomically fetch cache data and update it
func (o *ImpressionObserverImpl) testAndSet(key int64, newValue int64) (int64, error) {
	o.mutex.Lock()
	defer o.mutex.Unlock()
	old, err := o.cache.Get(key)
	o.cache.Set(key, newValue)
	return old, err
}

// TestAndSet hashes the impression, updates the cache and returns the previous value
func (o *ImpressionObserverImpl) TestAndSet(featureName string, impression *dtos.Impression) (int64, error) {
	hash, err := o.hasher.Process(featureName, impression)
	if err != nil {
		return 0, fmt.Errorf("error hashing impression: %s", err.Error())
	}

	return o.testAndSet(hash, impression.Time)
}

// NewImpressionObserver constructs a new ImpressionObserver
func NewImpressionObserver(size int) (*ImpressionObserverImpl, error) {
	cache, err := int64cache.NewInt64Cache(size)
	if err != nil {
		return nil, fmt.Errorf("error building cache: %s", err.Error())
	}
	return &ImpressionObserverImpl{
		cache:  cache,
		hasher: &ImpressionHasherImpl{},
		mutex:  sync.Mutex{},
	}, nil
}

// ImpressionObserverNoOp is an implementation of the ImpressionObserver interface
type ImpressionObserverNoOp struct{}

// TestAndSet that does nothing
func (o *ImpressionObserverNoOp) TestAndSet(featureName string, impression *dtos.Impression) (int64, error) {
	return 0, nil
}
