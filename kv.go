package pluginapi

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	perrors "github.com/pkg/errors"
)

// KVService provides features to set, update and retrive key-value pairs.
type KVService struct {
	api plugin.API
}

// SetOption used to configure a Set() operation.
type SetOption func(*model.PluginKVSetOptions)

// SetCompareCurrentValueOption returns an option to conditionally update a key's
// value by comparing given value to match with the currently set one.
// this is an atomic operation.
func SetCompareCurrentValueOption(value interface{}) SetOption {
	return func(o *model.PluginKVSetOptions) {
		o.Atomic = true
		o.OldValue = value
	}
}

// SetExpiryOption returns an option to set an expiration time for key's persistence.
func SetExpiryOption(ttl time.Duration) SetOption {
	return func(o *model.PluginKVSetOptions) {
		o.ExpireInSeconds = int64(ttl / time.Second)
	}
}

// Set stores a key-value pair with options, unique per plugin.
// upserted will be true if value is set for the first time or updated its current value.
//
// do not use `mmi_` prefix for the keys, its reserved.
//
// minimum server version: 5.18
func (k *KVService) Set(key string, value interface{}, options ...SetOption) (upserted bool, err error) {
	if strings.HasPrefix(key, "mmi_") {
		return false, errors.New("'mmi_' prefix is not allowed for keys")
	}
	opts := model.PluginKVSetOptions{
		EncodeJSON: true,
	}
	for _, o := range options {
		o(&opts)
	}
	_, isValueInBytes := value.([]byte)
	_, isCurrentValueInBytes := opts.OldValue.([]byte)
	if isValueInBytes || isCurrentValueInBytes {
		opts.EncodeJSON = false
	}
	updated, aerr := k.api.KVSetWithOptions(key, value, opts)
	return updated, normalizeAppErr(aerr)
}

// SetWithExpiry stores a key-value pair with an expiry time, unique per plugin.
//
// do not use `mmi_` prefix for the keys, its reserved.
//
// minimum server version: 5.18
func (k *KVService) SetWithExpiry(key string, value interface{}, ttl time.Duration) error {
	_, err := k.Set(key, value, SetExpiryOption(ttl))
	return err
}

// CompareAndSet creates or updates a key-value pair but only if the current value matches
// with the currentValue, unique per plugin.
// upserted will be true if value is set for the first time or updated its current value.
//
// do not use `mmi_` prefix for the keys, its reserved.
//
// minimum server version: 5.18
func (k *KVService) CompareAndSet(key string, currentValue, value interface{}) (upserted bool, err error) {
	return k.Set(key, value, SetCompareCurrentValueOption(currentValue))
}

// CompareAndDelete deletes a key-value pair but only if the current value matches with
// the currentValue, unique per plugin.
//
// minimum server version: 5.18
func (k *KVService) CompareAndDelete(key string, currentValue interface{}) (deleted bool, err error) {
	return k.Set(key, nil, SetCompareCurrentValueOption(currentValue))
}

// Get retrieves a value based on the key, unique per plugin.
// if there is no existent value for the key, error still will be nil as well as o.
//
// @tag KeyValueStore minimum server version: 5.2
func (k *KVService) Get(key string, o interface{}) error {
	data, aerr := k.api.KVGet(key)
	if aerr != nil {
		return normalizeAppErr(aerr)
	}
	bytesOut, ok := o.(*[]byte)
	if !ok {
		if err := json.Unmarshal(data, o); err != nil {
			return perrors.Wrap(err, "cannot unmarshal key's value")
		}
		return nil
	}
	*bytesOut = data
	return nil
}

// Delete removes a key-value pair, unique per plugin.
// if there is no existent value for the key, error still will be nil.
//
// minimum server version: 5.18
func (k *KVService) Delete(key string) error {
	_, err := k.Set(key, nil)
	return err
}

// DeleteAll removes all key-value pairs for a plugin.
//
// @tag KeyValueStore minimum server version: 5.6
func (k *KVService) DeleteAll() error {
	err := k.api.KVDeleteAll()
	return normalizeAppErr(err)
}

// ListKeysOption used to configure a ListKeys() operation.
type ListKeysOption func(*listKeysOptions)

// listKeysOptions holds configurations of a ListKeys() operation.
type listKeysOptions struct {
}

// ListKeys lists all keys for the plugin.
//
// @tag KeyValueStore minimum server version: 5.6
func (k *KVService) ListKeys(page, count int, options ...ListKeysOption) (keys []string, err error) {
	keys, aerr := k.api.KVList(page, count)
	return keys, normalizeAppErr(aerr)
}
