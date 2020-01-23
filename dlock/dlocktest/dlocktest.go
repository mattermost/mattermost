// Package dlocktest is a testing helper for you to unit test your own packages that are using dlock.
// with the help of this pkg, dlock.Store can be faked by an in-memory implementation created by New()
// where it prevents actual network calls to Mattermost server but behaves exactly the same.
// TODO(ilgooz): add unit tests.
package dlocktest

import (
	"reflect"
	"sync"
	"time"

	pluginapi "github.com/lieut-data/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v5/model"
)

// API implements dlock.API.
type API struct {
	m    sync.Mutex
	data map[string]Value
}

type Value struct {
	data      interface{}
	ttl       time.Duration
	createdAt time.Time
}

// New creates an implementation of dlock.API with an in-memory, fake pluginapi KV Store
// and a pluginapi logger.
func New() *API {
	return &API{
		data: make(map[string]Value),
	}
}

// Set implements a fake in-memory dlock.API.Set().
func (s *API) Set(key string, value interface{}, options ...pluginapi.KVSetOption) (bool, error) {
	s.m.Lock()
	defer s.m.Unlock()

	opts := model.PluginKVSetOptions{}
	for _, o := range options {
		o(&opts)
	}

	if value == nil {
		delete(s.data, key)
		return true, nil
	}

	v, ok := s.data[key]
	if ok && time.Since(v.createdAt) > v.ttl {
		v.data = nil
	}

	if opts.Atomic && !reflect.DeepEqual(v.data, opts.OldValue) {
		return false, nil
	}

	s.data[key] = Value{
		data:      value,
		ttl:       time.Duration(opts.ExpireInSeconds) * time.Second,
		createdAt: time.Now(),
	}

	return true, nil
}

// Error fakes dlock.API.Error().
// TODO(ilgooz): improve API to simulate error cases.
func (a *API) Error(message string, keyValuePairs ...interface{}) {}
