package pluginapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
)

// numRetries is the number of times the setAtomicWithRetries will retry before returning an error.
const numRetries = 5

// KVService exposes methods to read and write key-value pairs for the active plugin.
//
// This service cannot be used to read or write key-value pairs for other plugins.
type KVService struct {
	api plugin.API
}

// TODO: Should this be un exported?
type KVSetOptions struct {
	model.PluginKVSetOptions
	oldValue interface{}
}

// KVSetOption is an option passed to Set() operation.
type KVSetOption func(*KVSetOptions)

// SetAtomic guarantees the write will occur only when the current value of matches the given old
// value. A client is expected to read the old value first, then pass it back to ensure the value
// has not since been modified.
func SetAtomic(oldValue interface{}) KVSetOption {
	return func(o *KVSetOptions) {
		o.Atomic = true
		o.oldValue = oldValue
	}
}

// SetExpiry configures a key value to expire after the given duration relative to now.
func SetExpiry(ttl time.Duration) KVSetOption {
	return func(o *KVSetOptions) {
		o.ExpireInSeconds = int64(ttl / time.Second)
	}
}

// Set stores a key-value pair, unique per plugin.
// Keys prefixed with `mmi_` are reserved for use by this package and will fail to be set.
//
// Returns (false, err) if DB error occurred
// Returns (false, nil) if the value was not set
// Returns (true, nil) if the value was set
//
// Minimum server version: 5.18
func (k *KVService) Set(key string, value interface{}, options ...KVSetOption) (bool, error) {
	if strings.HasPrefix(key, "mmi_") {
		return false, errors.New("'mmi_' prefix is not allowed for keys")
	}

	opts := KVSetOptions{}
	for _, o := range options {
		o(&opts)
	}

	var valueBytes []byte
	if value != nil {
		// Assume JSON encoding, unless explicitly given a byte slice.
		var isValueInBytes bool
		valueBytes, isValueInBytes = value.([]byte)
		if !isValueInBytes {
			var err error
			valueBytes, err = json.Marshal(value)
			if err != nil {
				return false, errors.Wrapf(err, "failed to marshal value %v", value)
			}
		}
	}

	downstreamOpts := model.PluginKVSetOptions{
		Atomic:          opts.Atomic,
		ExpireInSeconds: opts.ExpireInSeconds,
	}

	if opts.oldValue != nil {
		oldValueBytes, isOldValueInBytes := opts.oldValue.([]byte)
		if isOldValueInBytes {
			downstreamOpts.OldValue = oldValueBytes
		} else {
			data, err := json.Marshal(opts.oldValue)
			if err != nil {
				return false, errors.Wrapf(err, "failed to marshal value %v", opts.oldValue)
			}

			downstreamOpts.OldValue = data
		}
	}

	written, appErr := k.api.KVSetWithOptions(key, valueBytes, downstreamOpts)
	return written, normalizeAppErr(appErr)
}

// SetWithExpiry sets a key-value pair with the given expiration duration relative to now.
//
// Deprecated: SetWithExpiry exists to streamline adoption of this package for existing plugins.
// Use Set with the appropriate options instead.
//
// Minimum server version: 5.18
func (k *KVService) SetWithExpiry(key string, value interface{}, ttl time.Duration) error {
	_, err := k.Set(key, value, SetExpiry(ttl))

	return err
}

// CompareAndSet writes a key-value pair if the current value matches the given old value.
//
// Returns (false, err) if DB error occurred
// Returns (false, nil) if the value was not set
// Returns (true, nil) if the value was set
//
// Deprecated: CompareAndSet exists to streamline adoption of this package for existing plugins.
// Use Set with the appropriate options instead.
//
// Minimum server version: 5.18
func (k *KVService) CompareAndSet(key string, oldValue, value interface{}) (bool, error) {
	return k.Set(key, value, SetAtomic(oldValue))
}

// CompareAndDelete deletes a key-value pair if the current value matches the given old value.
//
// Returns (false, err) if DB error occurred
// Returns (false, nil) if current value != oldValue or key does not exist when deleting
// Returns (true, nil) if current value == oldValue and the key was deleted
//
// Deprecated: CompareAndDelete exists to streamline adoption of this package for existing plugins.
// Use Set with the appropriate options instead.
//
// Minimum server version: 5.18
func (k *KVService) CompareAndDelete(key string, oldValue interface{}) (bool, error) {
	return k.Set(key, nil, SetAtomic(oldValue))
}

// SetAtomicWithRetries will set a key-value pair atomically using compare and set semantics:
// it will read key's value (to get oldValue), perform valueFunc (to get newValue),
// and compare and set (comparing oldValue and setting newValue).
//
// Parameters:
//
//	`key`              is the key to get and set.
//	`valueFunc`        is a user-provided function that will take the old value as a []byte and
//	                   return the new value or an error. If valueFunc needs to operate on
//	                   oldValue, it will need to use the oldValue as a []byte, or convert
//	                   oldValue into the expected type (e.g., by parsing it, or marshaling it
//	                   into the expected struct). It should then return the newValue as the type
//	                   expected to be stored.
//
// Returns:
//
//	Returns err if the key could not be retrieved (DB error), valueFunc returned an error,
//	if the key could not be set (DB error), or if the key could not be set (after retries).
//	Returns nil if the value was set.
//
// Minimum server version: 5.18
func (k *KVService) SetAtomicWithRetries(key string, valueFunc func(oldValue []byte) (newValue interface{}, err error)) error {
	for i := 0; i < numRetries; i++ {
		var oldVal []byte
		if err := k.Get(key, &oldVal); err != nil {
			return errors.Wrapf(err, "failed to get value for key %s", key)
		}

		newVal, err := valueFunc(oldVal)
		if err != nil {
			return errors.Wrap(err, "valueFunc failed")
		}

		if saved, err := k.Set(key, newVal, SetAtomic(oldVal)); err != nil {
			return errors.Wrapf(err, "DB failed to set value for key %s", key)
		} else if saved {
			return nil
		}

		// small delay to allow cooperative scheduling to do its thing
		time.Sleep(10 * time.Millisecond)
	}
	return fmt.Errorf("failed to set value after %d retries", numRetries)
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

	if len(data) == 0 {
		return nil
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
type ListKeysOption func(*listKeysOptions)

// listKeysOptions holds configurations of a ListKeys() operation.
type listKeysOptions struct {
	checkers []func(key string) (keep bool, err error)
}

func (o *listKeysOptions) checkAll(key string) (keep bool, err error) {
	for _, check := range o.checkers {
		keep, err := check(key)
		if err != nil {
			return false, err
		}
		if !keep {
			return false, nil
		}
	}

	// key made it through all checkers
	return true, nil
}

// WithPrefix only return keys that start with the given string.
func WithPrefix(prefix string) ListKeysOption {
	return WithChecker(func(key string) (keep bool, err error) {
		return strings.HasPrefix(key, prefix), nil
	})
}

// WithChecker allows for a custom filter function to determine which keys to return.
// Returning true will keep the key and false will filter it out. Returning an error
// will halt KVListWithOptions immediately and pass the error up (with no other results).
func WithChecker(f func(key string) (keep bool, err error)) ListKeysOption {
	return func(args *listKeysOptions) {
		args.checkers = append(args.checkers, f)
	}
}

// ListKeys lists all keys that match the given options. If no options are provided then all keys are returned.
//
// Minimum server version: 5.6
func (k *KVService) ListKeys(page, count int, options ...ListKeysOption) ([]string, error) {
	// convert functional options into args struct
	args := &listKeysOptions{
		checkers: nil,
	}
	for _, opt := range options {
		opt(args)
	}

	// get our keys a batch at a time, filter out the ones we don't want based on our args
	// any errors will hault the whole process and return the error raw

	keys, appErr := k.api.KVList(page, count)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}

	if len(args.checkers) == 0 {
		// no checkers, just return the keys
		return keys, nil
	}

	ret := make([]string, 0)
	// we have a filter, so check each key, all checkers must say key
	// for us to keep a key
	for _, key := range keys {
		keep, err := args.checkAll(key)
		if err != nil {
			return nil, err
		}

		if !keep {
			continue
		}

		// didn't get filtered out, add to our return
		ret = append(ret, key)
	}

	return ret, nil
}
