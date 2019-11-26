package pluginapi

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

// KVService exposes methods to read and write key-value pairs for the active plugin.
//
// This service cannot be used to read or write key-value pairs for other plugins.
type KVService struct {
	api plugin.API
}

// KVSetOption is an option passed to Set() operation.
type KVSetOption func(*model.PluginKVSetOptions)

// SetAtomic guarantees the write will occur only when the current value of matches the given old
// value. A client is expected to read the old value first, then pass it back to ensure the value
// has not since been modified.
func SetAtomic(oldValue interface{}) KVSetOption {
	return func(o *model.PluginKVSetOptions) {
		o.Atomic = true
		o.OldValue = oldValue
	}
}

// SetExpiry configures a key value to expire after the given duration relative to now.
func SetExpiry(ttl time.Duration) KVSetOption {
	return func(o *model.PluginKVSetOptions) {
		o.ExpireInSeconds = int64(ttl / time.Second)
	}
}

// Set stores a key-value pair for the active plugin.
//
// Keys prefixed with `mmi_` are reserved for use by this package and will fail to be set.
//
// Minimum server version: 5.18
func (k *KVService) Set(key string, value interface{}, options ...KVSetOption) (written bool, err error) {
	if strings.HasPrefix(key, "mmi_") {
		return false, errors.New("'mmi_' prefix is not allowed for keys")
	}

	// Assume JSON encoding, unless explicitly given a byte slice.
	opts := model.PluginKVSetOptions{
		EncodeJSON: true,
	}
	for _, o := range options {
		o(&opts)
	}

	_, isValueInBytes := value.([]byte)
	_, isOldValueInBytes := opts.OldValue.([]byte)
	if isValueInBytes || isOldValueInBytes {
		opts.EncodeJSON = false
	}

	// TODO: We should apply EncodeJSON here, since we can't rely on KVSetWithOptions to
	// serialize an arbitrary interface using gob.

	written, appErr := k.api.KVSetWithOptions(key, value, opts)
	return written, normalizeAppErr(appErr)
}

// SetWithExpiry sets a key-value pair with the given expiration duration relative to now.
//
// This method is deprecated in favor of calling Set with the appropriate options, but exists
// to streamline adoption of this package for existing plugins.
//
// Minimum server version: 5.18
func (k *KVService) SetWithExpiry(key string, value interface{}, ttl time.Duration) error {
	_, err := k.Set(key, value, SetExpiry(ttl))
	return err
}

// CompareAndSet writes a key-value pair if the current value matches the given old value.
//
// This method is deprecated in favor of calling Set with the appropriate options, but exists
// to streamline adoption of this package for existing plugins.
//
// Minimum server version: 5.18
func (k *KVService) CompareAndSet(key string, oldValue, value interface{}) (upserted bool, err error) {
	return k.Set(key, value, SetAtomic(oldValue))
}

// CompareAndDelete deletes a key-value pair if the current value matches the given old value.
//
// This method is deprecated in favor of calling Set with the appropriate options, but exists
// to streamline adoption of this package for existing plugins.
//
// Minimum server version: 5.18
func (k *KVService) CompareAndDelete(key string, oldValue interface{}) (deleted bool, err error) {
	return k.Set(key, nil, SetAtomic(oldValue))
}

// Get gets the value for the given key into the given interface.
//
// An error is returned only if the value cannot be fetched. A non-existent key will return no
// error, with nothing written to the given interface.
//
// Minimum server version: 5.2
func (k *KVService) Get(key string, o interface{}) error {
	data, appErr := k.api.KVGet(key)
	if appErr != nil {
		return normalizeAppErr(appErr)
	}

	if bytesOut, ok := o.(*[]byte); ok {
		*bytesOut = data
		return nil
	}

	if err := json.Unmarshal(data, o); err != nil {
		return errors.Wrapf(err, "failed to unmarshal value for key %s", key)
	}

	return nil
}

// Delete deletes the given key-value pair.
//
// An error is returned only if the value failed to be deleted. A non-existent key will return
// no error.
//
// Minimum server version: 5.18
func (k *KVService) Delete(key string) error {
	_, err := k.Set(key, nil)
	return err
}

// DeleteAll removes all key-value pairs.
//
// Minimum server version: 5.6
func (k *KVService) DeleteAll() error {
	return normalizeAppErr(k.api.KVDeleteAll())
}

// ListKeysOption used to configure a ListKeys() operation.
// TODO: Do we have plans for this?
type ListKeysOption func(*listKeysOptions)

// listKeysOptions holds configurations of a ListKeys() operation.
type listKeysOptions struct {
}

// ListKeys lists all keys for the plugin.
//
// Minimum server version: 5.6
func (k *KVService) ListKeys(page, count int, options ...ListKeysOption) (keys []string, err error) {
	keys, appErr := k.api.KVList(page, count)
	return keys, normalizeAppErr(appErr)
}
