// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"net/http"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/stretchr/testify/assert"
)

func TestPluginStore(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("SaveOrUpdate", func(t *testing.T) { testPluginSaveOrUpdate(t, ss, s) })
	t.Run("CompareAndSet", func(t *testing.T) { testPluginCompareAndSet(t, ss, s) })
	t.Run("CompareAndDelete", func(t *testing.T) { testPluginCompareAndDelete(t, ss, s) })
	t.Run("SetWithOptions", func(t *testing.T) { testPluginSetWithOptions(t, ss, s) })
	t.Run("Get", func(t *testing.T) { testPluginGet(t, ss) })
	t.Run("Delete", func(t *testing.T) { testPluginDelete(t, ss) })
	t.Run("DeleteAllForPlugin", func(t *testing.T) { testPluginDeleteAllForPlugin(t, ss) })
	t.Run("DeleteAllExpired", func(t *testing.T) { testPluginDeleteAllExpired(t, ss) })
	t.Run("List", func(t *testing.T) { testPluginList(t, ss) })
}

func setupKVs(t *testing.T, ss store.Store) (string, func()) {
	pluginId := model.NewId()
	otherPluginId := model.NewId()

	// otherKV is another key value for the current plugin, and used to verify other keys
	// aren't modified unintentionally.
	otherKV := &model.PluginKeyValue{
		PluginId: pluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	}
	_, err := ss.Plugin().SaveOrUpdate(otherKV)
	require.Nil(t, err)

	// otherPluginKV is a key value for another plugin, and used to verify other plugins' keys
	// aren't modified unintentionally.
	otherPluginKV := &model.PluginKeyValue{
		PluginId: otherPluginId,
		Key:      model.NewId(),
		Value:    []byte(model.NewId()),
		ExpireAt: 0,
	}
	_, err = ss.Plugin().SaveOrUpdate(otherPluginKV)
	require.Nil(t, err)

	return pluginId, func() {
		actualOtherKV, err := ss.Plugin().Get(otherKV.PluginId, otherKV.Key)
		require.Nil(t, err, "failed to find other key value for same plugin")
		assert.Equal(t, otherKV, actualOtherKV)

		actualOtherPluginKV, err := ss.Plugin().Get(otherPluginKV.PluginId, otherPluginKV.Key)
		require.Nil(t, err, "failed to find other key value from different plugin")
		assert.Equal(t, otherPluginKV, actualOtherPluginKV)
	}
}

func doTestPluginSaveOrUpdate(t *testing.T, ss store.Store, s SqlSupplier, doer func(kv *model.PluginKeyValue) (*model.PluginKeyValue, *model.AppError)) {
	t.Run("invalid kv", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		kv := &model.PluginKeyValue{
			PluginId: "",
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}

		kv, err := doer(kv)
		require.NotNil(t, err)
		require.Equal(t, "model.plugin_key_value.is_valid.plugin_id.app_error", err.Id)
		assert.Nil(t, kv)
	})

	t.Run("new key", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		retKV, err := doer(kv)
		require.Nil(t, err)
		assert.Equal(t, kv, retKV)
		// SaveOrUpdate returns the kv passed in, so test each field individually for
		// completeness. It should probably be changed to not bother doing that.
		assert.Equal(t, pluginId, kv.PluginId)
		assert.Equal(t, key, kv.Key)
		assert.Equal(t, []byte(value), kv.Value)
		assert.Equal(t, expireAt, kv.ExpireAt)

		actualKV, err := ss.Plugin().Get(pluginId, key)
		require.Nil(t, err)
		assert.Equal(t, kv, actualKV)
	})

	t.Run("nil value for new key", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		var value []byte
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    value,
			ExpireAt: expireAt,
		}

		retKV, err := doer(kv)
		require.Nil(t, err)
		assert.Equal(t, kv, retKV)
		// SaveOrUpdate returns the kv passed in, so test each field individually for
		// completeness. It should probably be changed to not bother doing that.
		assert.Equal(t, pluginId, kv.PluginId)
		assert.Equal(t, key, kv.Key)
		assert.Nil(t, kv.Value)
		assert.Equal(t, expireAt, kv.ExpireAt)

		actualKV, err := ss.Plugin().Get(pluginId, key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, actualKV)
	})

	t.Run("existing key", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := doer(kv)
		require.Nil(t, err)

		newValue := model.NewId()
		kv.Value = []byte(newValue)

		retKV, err := doer(kv)
		require.Nil(t, err)
		assert.Equal(t, kv, retKV)
		// SaveOrUpdate returns the kv passed in, so test each field individually for
		// completeness. It should probably be changed to not bother doing that.
		assert.Equal(t, pluginId, kv.PluginId)
		assert.Equal(t, key, kv.Key)
		assert.Equal(t, []byte(newValue), kv.Value)
		assert.Equal(t, expireAt, kv.ExpireAt)

		actualKV, err := ss.Plugin().Get(pluginId, key)
		require.Nil(t, err)
		assert.Equal(t, kv, actualKV)
	})

	t.Run("nil value for existing key", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := doer(kv)
		require.Nil(t, err)

		kv.Value = nil
		retKV, err := doer(kv)

		require.Nil(t, err)
		assert.Equal(t, kv, retKV)
		// SaveOrUpdate returns the kv passed in, so test each field individually for
		// completeness. It should probably be changed to not bother doing that.
		assert.Equal(t, pluginId, kv.PluginId)
		assert.Equal(t, key, kv.Key)
		assert.Nil(t, kv.Value)
		assert.Equal(t, expireAt, kv.ExpireAt)

		actualKV, err := ss.Plugin().Get(pluginId, key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, actualKV)
	})
}

func testPluginSaveOrUpdate(t *testing.T, ss store.Store, s SqlSupplier) {
	doTestPluginSaveOrUpdate(t, ss, s, func(kv *model.PluginKeyValue) (*model.PluginKeyValue, *model.AppError) {
		return ss.Plugin().SaveOrUpdate(kv)
	})
}

// doTestPluginCompareAndSet exercises the CompareAndSet functionality, but abstracts the actual
// call to same to allow reuse with SetWithOptions
func doTestPluginCompareAndSet(t *testing.T, ss store.Store, s SqlSupplier, compareAndSet func(kv *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError)) {
	t.Run("invalid kv", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		kv := &model.PluginKeyValue{
			PluginId: "",
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}

		ok, err := compareAndSet(kv, nil)
		require.NotNil(t, err)
		assert.Equal(t, "model.plugin_key_value.is_valid.plugin_id.app_error", err.Id)
		assert.False(t, ok)
	})

	// assertChanged verifies that CompareAndSet successfully changes to the given value.
	assertChanged := func(t *testing.T, kv *model.PluginKeyValue, oldValue []byte) {
		t.Helper()

		ok, err := compareAndSet(kv, oldValue)
		require.Nil(t, err)
		require.True(t, ok, "should have succeeded to CompareAndSet")

		actualKV, err := ss.Plugin().Get(kv.PluginId, kv.Key)
		require.Nil(t, err)

		// When tested with KVSetWithOptions, a strict comparison can fail because that
		// function accepts a relative time and makes its own call to model.GetMillis(),
		// leading to off-by-one issues. All these tests are written with 15+ second
		// differences, so allow for an off-by-1000ms in either direction.
		require.NotNil(t, actualKV)

		expiryDelta := actualKV.ExpireAt - kv.ExpireAt
		if expiryDelta > -1000 && expiryDelta < 1000 {
			actualKV.ExpireAt = kv.ExpireAt
		}

		assert.Equal(t, kv, actualKV)
	}

	// assertUnchanged verifies that CompareAndSet fails, leaving the existing value.
	assertUnchanged := func(t *testing.T, kv, existingKV *model.PluginKeyValue, oldValue []byte) {
		t.Helper()

		ok, err := compareAndSet(kv, oldValue)
		require.Nil(t, err)
		require.False(t, ok, "should have failed to CompareAndSet")

		actualKV, err := ss.Plugin().Get(kv.PluginId, kv.Key)
		if existingKV == nil {
			require.NotNil(t, err)
			assert.Equal(t, err.StatusCode, http.StatusNotFound)
			assert.Nil(t, actualKV)
		} else {
			require.Nil(t, err)
			assert.Equal(t, existingKV, actualKV)
		}
	}

	// assertRemoved verifies that CompareAndSet successfully removes the given value.
	assertRemoved := func(t *testing.T, kv *model.PluginKeyValue, oldValue []byte) {
		t.Helper()

		ok, err := compareAndSet(kv, oldValue)
		require.Nil(t, err)
		require.True(t, ok, "should have succeeded to CompareAndSet")

		actualKV, err := ss.Plugin().Get(kv.PluginId, kv.Key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, actualKV)
	}

	// Non-existent keys and expired keys should behave identically.
	for description, setup := range map[string]func(t *testing.T) (*model.PluginKeyValue, func()){
		"non-existent key": func(t *testing.T) (*model.PluginKeyValue, func()) {
			pluginId, tearDown := setupKVs(t, ss)

			kv := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      model.NewId(),
				Value:    []byte(model.NewId()),
				ExpireAt: 0,
			}

			return kv, tearDown
		},
		"expired key": func(t *testing.T) (*model.PluginKeyValue, func()) {
			pluginId, tearDown := setupKVs(t, ss)

			expiredKV := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      model.NewId(),
				Value:    []byte(model.NewId()),
				ExpireAt: 1,
			}
			_, err := ss.Plugin().SaveOrUpdate(expiredKV)
			require.Nil(t, err)

			return expiredKV, tearDown
		},
	} {
		t.Run(description, func(t *testing.T) {
			t.Run("setting a nil value should fail", func(t *testing.T) {
				testCases := map[string][]byte{
					"given nil old value":     nil,
					"given non-nil old value": []byte(model.NewId()),
				}

				for description, oldValue := range testCases {
					t.Run(description, func(t *testing.T) {
						kv, tearDown := setup(t)
						defer tearDown()

						kv.Value = nil
						assertUnchanged(t, kv, nil, oldValue)
					})
				}
			})

			t.Run("setting a non-nil value", func(t *testing.T) {
				t.Run("should succeed given non-expiring, nil old value", func(t *testing.T) {
					kv, tearDown := setup(t)
					defer tearDown()

					kv.ExpireAt = 0
					assertChanged(t, kv, []byte(nil))
				})

				t.Run("should succeed given not-yet-expired, nil old value", func(t *testing.T) {
					kv, tearDown := setup(t)
					defer tearDown()

					kv.ExpireAt = model.GetMillis() + 15*1000
					assertChanged(t, kv, []byte(nil))
				})

				t.Run("should fail given expired, nil old value", func(t *testing.T) {
					kv, tearDown := setup(t)
					defer tearDown()

					kv.ExpireAt = 1
					assertRemoved(t, kv, []byte(nil))
				})

				t.Run("should fail given 'different' old value", func(t *testing.T) {
					kv, tearDown := setup(t)
					defer tearDown()

					assertUnchanged(t, kv, nil, []byte(model.NewId()))
				})

				t.Run("should fail given 'same' old value", func(t *testing.T) {
					kv, tearDown := setup(t)
					defer tearDown()

					assertUnchanged(t, kv, nil, kv.Value)
				})
			})
		})
	}

	t.Run("existing key", func(t *testing.T) {
		setup := func(t *testing.T) (*model.PluginKeyValue, func()) {
			pluginId, tearDown := setupKVs(t, ss)

			existingKV := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      model.NewId(),
				Value:    []byte(model.NewId()),
				ExpireAt: 0,
			}
			_, err := ss.Plugin().SaveOrUpdate(existingKV)
			require.Nil(t, err)

			return existingKV, tearDown
		}

		testCases := map[string]bool{
			// CompareAndSet should succeed even if the value isn't changing.
			"setting the same value":    true,
			"setting a different value": false,
		}

		for description, setToSameValue := range testCases {
			makeKV := func(t *testing.T, existingKV *model.PluginKeyValue) *model.PluginKeyValue {
				kv := &model.PluginKeyValue{
					PluginId: existingKV.PluginId,
					Key:      existingKV.Key,
					ExpireAt: existingKV.ExpireAt,
				}
				if setToSameValue {
					kv.Value = existingKV.Value
				} else {
					kv.Value = []byte(model.NewId())
				}

				return kv
			}

			t.Run(description, func(t *testing.T) {
				t.Run("should fail", func(t *testing.T) {
					testCases := map[string][]byte{
						"given nil old value":       nil,
						"given different old value": []byte(model.NewId()),
					}

					for description, oldValue := range testCases {
						t.Run(description, func(t *testing.T) {
							existingKV, tearDown := setup(t)
							defer tearDown()

							kv := makeKV(t, existingKV)
							assertUnchanged(t, kv, existingKV, oldValue)
						})
					}
				})

				t.Run("should succeed given same old value", func(t *testing.T) {
					existingKV, tearDown := setup(t)
					defer tearDown()

					kv := makeKV(t, existingKV)

					assertChanged(t, kv, existingKV.Value)
				})

				t.Run("and future expiry should succeed given same old value", func(t *testing.T) {
					existingKV, tearDown := setup(t)
					defer tearDown()

					kv := makeKV(t, existingKV)
					kv.ExpireAt = model.GetMillis() + 15*1000

					assertChanged(t, kv, existingKV.Value)
				})

				t.Run("and past expiry should succeed given same old value", func(t *testing.T) {
					existingKV, tearDown := setup(t)
					defer tearDown()

					kv := makeKV(t, existingKV)
					kv.ExpireAt = model.GetMillis() - 15*1000

					assertRemoved(t, kv, existingKV.Value)
				})
			})
		}

		t.Run("setting a nil value", func(t *testing.T) {
			makeKV := func(t *testing.T, existingKV *model.PluginKeyValue) *model.PluginKeyValue {
				kv := &model.PluginKeyValue{
					PluginId: existingKV.PluginId,
					Key:      existingKV.Key,
					Value:    existingKV.Value,
					ExpireAt: existingKV.ExpireAt,
				}
				kv.Value = nil

				return kv
			}

			t.Run("should fail", func(t *testing.T) {
				testCases := map[string][]byte{
					"given nil old value":       nil,
					"given different old value": []byte(model.NewId()),
				}

				for description, oldValue := range testCases {
					t.Run(description, func(t *testing.T) {
						existingKV, tearDown := setup(t)
						defer tearDown()

						kv := makeKV(t, existingKV)
						assertUnchanged(t, kv, existingKV, oldValue)
					})
				}
			})

			t.Run("should succeed, deleting, given same old value", func(t *testing.T) {
				existingKV, tearDown := setup(t)
				defer tearDown()

				kv := makeKV(t, existingKV)
				assertRemoved(t, kv, existingKV.Value)
			})
		})
	})
}

func testPluginCompareAndSet(t *testing.T, ss store.Store, s SqlSupplier) {
	doTestPluginCompareAndSet(t, ss, s, func(kv *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError) {
		return ss.Plugin().CompareAndSet(kv, oldValue)
	})
}

func testPluginCompareAndDelete(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("invalid kv", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		kv := &model.PluginKeyValue{
			PluginId: "",
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}

		ok, err := ss.Plugin().CompareAndDelete(kv, nil)
		require.NotNil(t, err)
		assert.Equal(t, "model.plugin_key_value.is_valid.plugin_id.app_error", err.Id)
		assert.False(t, ok)
	})

	t.Run("non-existent key should fail", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		testCases := map[string][]byte{
			"given nil old value":     nil,
			"given non-nil old value": []byte(model.NewId()),
		}

		for description, oldValue := range testCases {
			t.Run(description, func(t *testing.T) {
				ok, err := ss.Plugin().CompareAndDelete(kv, oldValue)
				require.Nil(t, err)
				assert.False(t, ok)
			})
		}
	})

	t.Run("expired key should fail", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(1)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}
		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		testCases := map[string][]byte{
			"given nil old value":       nil,
			"given different old value": []byte(model.NewId()),
			"given same old value":      []byte(value),
		}

		for description, oldValue := range testCases {
			t.Run(description, func(t *testing.T) {
				ok, err := ss.Plugin().CompareAndDelete(kv, oldValue)
				require.Nil(t, err)
				assert.False(t, ok)
			})
		}
	})

	t.Run("existing key should fail given different old value", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}
		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		oldValue := []byte(model.NewId())

		ok, err := ss.Plugin().CompareAndDelete(kv, oldValue)
		require.Nil(t, err)
		assert.False(t, ok)
	})

	t.Run("existing key should succeed given same old value", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}
		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		oldValue := []byte(value)

		ok, err := ss.Plugin().CompareAndDelete(kv, oldValue)
		require.Nil(t, err)
		assert.True(t, ok)
	})
}

func testPluginSetWithOptions(t *testing.T, ss store.Store, s SqlSupplier) {
	t.Run("invalid options", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		pluginId := ""
		key := model.NewId()
		value := model.NewId()
		options := model.PluginKVSetOptions{
			Atomic:   false,
			OldValue: []byte("not-nil"),
		}

		ok, err := ss.Plugin().SetWithOptions(pluginId, key, []byte(value), options)
		require.NotNil(t, err)
		require.Equal(t, "model.plugin_kvset_options.is_valid.old_value.app_error", err.Id)
		assert.False(t, ok)
	})

	t.Run("invalid kv", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		pluginId := ""
		key := model.NewId()
		value := model.NewId()
		options := model.PluginKVSetOptions{}

		ok, err := ss.Plugin().SetWithOptions(pluginId, key, []byte(value), options)
		require.NotNil(t, err)
		require.Equal(t, "model.plugin_key_value.is_valid.plugin_id.app_error", err.Id)
		assert.False(t, ok)
	})

	t.Run("atomic", func(t *testing.T) {
		doTestPluginCompareAndSet(t, ss, s, func(kv *model.PluginKeyValue, oldValue []byte) (bool, *model.AppError) {
			now := model.GetMillis()
			options := model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: oldValue,
			}

			if kv.ExpireAt != 0 {
				options.ExpireInSeconds = (kv.ExpireAt - now) / 1000
			}

			return ss.Plugin().SetWithOptions(kv.PluginId, kv.Key, kv.Value, options)
		})
	})

	t.Run("non-atomic", func(t *testing.T) {
		doTestPluginSaveOrUpdate(t, ss, s, func(kv *model.PluginKeyValue) (*model.PluginKeyValue, *model.AppError) {
			now := model.GetMillis()
			options := model.PluginKVSetOptions{
				Atomic: false,
			}

			if kv.ExpireAt != 0 {
				options.ExpireInSeconds = (kv.ExpireAt - now) / 1000
			}

			ok, appErr := ss.Plugin().SetWithOptions(kv.PluginId, kv.Key, kv.Value, options)
			if !ok {
				return nil, appErr
			} else {
				return kv, appErr
			}
		})
	})
}

func testPluginGet(t *testing.T, ss store.Store) {
	t.Run("no matching key value", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()

		kv, err := ss.Plugin().Get(pluginId, key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, kv)
	})

	t.Run("no-matching key value for plugin id", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		kv, err = ss.Plugin().Get(model.NewId(), key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, kv)
	})

	t.Run("no-matching key value for key", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		kv, err = ss.Plugin().Get(pluginId, model.NewId())
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, kv)
	})

	t.Run("old expired key value", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()
		value := model.NewId()
		expireAt := int64(1)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		kv, err = ss.Plugin().Get(pluginId, model.NewId())
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, kv)
	})

	t.Run("recently expired key value", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()
		value := model.NewId()
		expireAt := model.GetMillis() - 15*1000

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		kv, err = ss.Plugin().Get(pluginId, model.NewId())
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, kv)
	})

	t.Run("matching key value, non-expiring", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()
		value := model.NewId()
		expireAt := int64(0)

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		actualKV, err := ss.Plugin().Get(pluginId, key)
		require.Nil(t, err)
		require.Equal(t, kv, actualKV)
	})

	t.Run("matching key value, not yet expired", func(t *testing.T) {
		pluginId := model.NewId()
		key := model.NewId()
		value := model.NewId()
		expireAt := model.GetMillis() + 15*1000

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      key,
			Value:    []byte(value),
			ExpireAt: expireAt,
		}

		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		actualKV, err := ss.Plugin().Get(pluginId, key)
		require.Nil(t, err)
		require.Equal(t, kv, actualKV)
	})
}

func testPluginDelete(t *testing.T, ss store.Store) {
	t.Run("no matching key value", func(t *testing.T) {
		pluginId, tearDown := setupKVs(t, ss)
		defer tearDown()

		key := model.NewId()

		err := ss.Plugin().Delete(pluginId, key)
		require.Nil(t, err)

		kv, err := ss.Plugin().Get(pluginId, key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, kv)
	})

	testCases := []struct {
		description string
		expireAt    int64
	}{
		{
			"expired key value",
			model.GetMillis() - 15*1000,
		},
		{
			"never expiring value",
			0,
		},
		{
			"not yet expired value",
			model.GetMillis() + 15*1000,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.description, func(t *testing.T) {
			pluginId, tearDown := setupKVs(t, ss)
			defer tearDown()

			key := model.NewId()
			value := model.NewId()
			expireAt := testCase.expireAt

			kv := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      key,
				Value:    []byte(value),
				ExpireAt: expireAt,
			}

			_, err := ss.Plugin().SaveOrUpdate(kv)
			require.Nil(t, err)

			err = ss.Plugin().Delete(pluginId, key)
			require.Nil(t, err)

			kv, err = ss.Plugin().Get(pluginId, key)
			require.NotNil(t, err)
			assert.Equal(t, err.StatusCode, http.StatusNotFound)
			assert.Nil(t, kv)
		})
	}
}

func testPluginDeleteAllForPlugin(t *testing.T, ss store.Store) {
	setupKVsForDeleteAll := func(t *testing.T) (string, func()) {
		pluginId := model.NewId()
		otherPluginId := model.NewId()

		// otherPluginKV is another key value for another plugin, and used to verify other
		// keys aren't modified unintentionally.
		otherPluginKV := &model.PluginKeyValue{
			PluginId: otherPluginId,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err := ss.Plugin().SaveOrUpdate(otherPluginKV)
		require.Nil(t, err)

		return pluginId, func() {
			actualOtherPluginKV, err := ss.Plugin().Get(otherPluginKV.PluginId, otherPluginKV.Key)
			require.Nil(t, err, "failed to find other key value from different plugin")
			assert.Equal(t, otherPluginKV, actualOtherPluginKV)
		}
	}

	t.Run("no keys to delete", func(t *testing.T) {
		pluginId, tearDown := setupKVsForDeleteAll(t)
		defer tearDown()

		err := ss.Plugin().DeleteAllForPlugin(pluginId)
		require.Nil(t, err)
	})

	t.Run("multiple keys to delete", func(t *testing.T) {
		pluginId, tearDown := setupKVsForDeleteAll(t)
		defer tearDown()

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		kv2 := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err = ss.Plugin().SaveOrUpdate(kv2)
		require.Nil(t, err)

		err = ss.Plugin().DeleteAllForPlugin(pluginId)
		require.Nil(t, err)

		_, err = ss.Plugin().Get(kv.PluginId, kv.Key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)

		_, err = ss.Plugin().Get(kv.PluginId, kv2.Key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
	})
}

func testPluginDeleteAllExpired(t *testing.T, ss store.Store) {
	t.Run("no keys", func(t *testing.T) {
		err := ss.Plugin().DeleteAllExpired()
		require.Nil(t, err)
	})

	t.Run("no expiring keys to delete", func(t *testing.T) {
		pluginIdA := model.NewId()
		pluginIdB := model.NewId()

		kvA1 := &model.PluginKeyValue{
			PluginId: pluginIdA,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err := ss.Plugin().SaveOrUpdate(kvA1)
		require.Nil(t, err)

		kvA2 := &model.PluginKeyValue{
			PluginId: pluginIdA,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvA2)
		require.Nil(t, err)

		kvB1 := &model.PluginKeyValue{
			PluginId: pluginIdB,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvB1)
		require.Nil(t, err)

		kvB2 := &model.PluginKeyValue{
			PluginId: pluginIdB,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvB2)
		require.Nil(t, err)

		err = ss.Plugin().DeleteAllExpired()
		require.Nil(t, err)

		actualKVA1, err := ss.Plugin().Get(pluginIdA, kvA1.Key)
		require.Nil(t, err)
		assert.Equal(t, kvA1, actualKVA1)

		actualKVA2, err := ss.Plugin().Get(pluginIdA, kvA2.Key)
		require.Nil(t, err)
		assert.Equal(t, kvA2, actualKVA2)

		actualKVB1, err := ss.Plugin().Get(pluginIdB, kvB1.Key)
		require.Nil(t, err)
		assert.Equal(t, kvB1, actualKVB1)

		actualKVB2, err := ss.Plugin().Get(pluginIdB, kvB2.Key)
		require.Nil(t, err)
		assert.Equal(t, kvB2, actualKVB2)
	})

	t.Run("no expired keys to delete", func(t *testing.T) {
		pluginIdA := model.NewId()
		pluginIdB := model.NewId()

		kvA1 := &model.PluginKeyValue{
			PluginId: pluginIdA,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() + 15*1000,
		}
		_, err := ss.Plugin().SaveOrUpdate(kvA1)
		require.Nil(t, err)

		kvA2 := &model.PluginKeyValue{
			PluginId: pluginIdA,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() + 15*1000,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvA2)
		require.Nil(t, err)

		kvB1 := &model.PluginKeyValue{
			PluginId: pluginIdB,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() + 15*1000,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvB1)
		require.Nil(t, err)

		kvB2 := &model.PluginKeyValue{
			PluginId: pluginIdB,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() + 15*1000,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvB2)
		require.Nil(t, err)

		err = ss.Plugin().DeleteAllExpired()
		require.Nil(t, err)

		actualKVA1, err := ss.Plugin().Get(pluginIdA, kvA1.Key)
		require.Nil(t, err)
		assert.Equal(t, kvA1, actualKVA1)

		actualKVA2, err := ss.Plugin().Get(pluginIdA, kvA2.Key)
		require.Nil(t, err)
		assert.Equal(t, kvA2, actualKVA2)

		actualKVB1, err := ss.Plugin().Get(pluginIdB, kvB1.Key)
		require.Nil(t, err)
		assert.Equal(t, kvB1, actualKVB1)

		actualKVB2, err := ss.Plugin().Get(pluginIdB, kvB2.Key)
		require.Nil(t, err)
		assert.Equal(t, kvB2, actualKVB2)
	})

	t.Run("some expired keys to delete", func(t *testing.T) {
		pluginIdA := model.NewId()
		pluginIdB := model.NewId()

		kvA1 := &model.PluginKeyValue{
			PluginId: pluginIdA,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() + 15*1000,
		}
		_, err := ss.Plugin().SaveOrUpdate(kvA1)
		require.Nil(t, err)

		expiredKVA2 := &model.PluginKeyValue{
			PluginId: pluginIdA,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() - 15*1000,
		}
		_, err = ss.Plugin().SaveOrUpdate(expiredKVA2)
		require.Nil(t, err)

		kvB1 := &model.PluginKeyValue{
			PluginId: pluginIdB,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() + 15*1000,
		}
		_, err = ss.Plugin().SaveOrUpdate(kvB1)
		require.Nil(t, err)

		expiredKVB2 := &model.PluginKeyValue{
			PluginId: pluginIdB,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: model.GetMillis() - 15*1000,
		}
		_, err = ss.Plugin().SaveOrUpdate(expiredKVB2)
		require.Nil(t, err)

		err = ss.Plugin().DeleteAllExpired()
		require.Nil(t, err)

		actualKVA1, err := ss.Plugin().Get(pluginIdA, kvA1.Key)
		require.Nil(t, err)
		assert.Equal(t, kvA1, actualKVA1)

		actualKVA2, err := ss.Plugin().Get(pluginIdA, expiredKVA2.Key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, actualKVA2)

		actualKVB1, err := ss.Plugin().Get(pluginIdB, kvB1.Key)
		require.Nil(t, err)
		assert.Equal(t, kvB1, actualKVB1)

		actualKVB2, err := ss.Plugin().Get(pluginIdB, expiredKVB2.Key)
		require.NotNil(t, err)
		assert.Equal(t, err.StatusCode, http.StatusNotFound)
		assert.Nil(t, actualKVB2)
	})
}

func testPluginList(t *testing.T, ss store.Store) {
	t.Run("no key values", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		// Ignore the pluginId setup by setupKVs
		pluginId := model.NewId()
		keys, err := ss.Plugin().List(pluginId, 0, 100)
		require.Nil(t, err)
		assert.Empty(t, keys)
	})

	t.Run("single key", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		// Ignore the pluginId setup by setupKVs
		pluginId := model.NewId()

		kv := &model.PluginKeyValue{
			PluginId: pluginId,
			Key:      model.NewId(),
			Value:    []byte(model.NewId()),
			ExpireAt: 0,
		}
		_, err := ss.Plugin().SaveOrUpdate(kv)
		require.Nil(t, err)

		keys, err := ss.Plugin().List(pluginId, 0, 100)
		require.Nil(t, err)
		require.Len(t, keys, 1)
		assert.Equal(t, kv.Key, keys[0])
	})

	t.Run("multiple keys", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		// Ignore the pluginId setup by setupKVs
		pluginId := model.NewId()

		var keys []string
		for i := 0; i < 150; i++ {
			key := model.NewId()
			kv := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      key,
				Value:    []byte(model.NewId()),
				ExpireAt: 0,
			}
			_, err := ss.Plugin().SaveOrUpdate(kv)
			require.Nil(t, err)

			keys = append(keys, key)
		}
		sort.Strings(keys)

		keys1, err := ss.Plugin().List(pluginId, 0, 100)
		require.Nil(t, err)
		require.Len(t, keys1, 100)

		keys2, err := ss.Plugin().List(pluginId, 100, 100)
		require.Nil(t, err)
		require.Len(t, keys2, 50)

		actualKeys := append(keys1, keys2...)
		sort.Strings(actualKeys)

		assert.Equal(t, keys, actualKeys)
	})

	t.Run("multiple keys, some expiring", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		// Ignore the pluginId setup by setupKVs
		pluginId := model.NewId()

		var keys []string
		var expiredKeys []string
		now := model.GetMillis()
		for i := 0; i < 150; i++ {
			key := model.NewId()
			var expireAt int64

			if i%10 == 0 {
				// Expire keys 0, 10, 20, ...
				expireAt = 1

			} else if (i+5)%10 == 0 {
				// Mark for future expiry keys 5, 15, 25, ...
				expireAt = now + 5*60*1000
			}

			kv := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      key,
				Value:    []byte(model.NewId()),
				ExpireAt: expireAt,
			}
			_, err := ss.Plugin().SaveOrUpdate(kv)
			require.Nil(t, err)

			if expireAt == 0 || expireAt > now {
				keys = append(keys, key)
			} else {
				expiredKeys = append(expiredKeys, key)
			}
		}
		sort.Strings(keys)

		keys1, err := ss.Plugin().List(pluginId, 0, 100)
		require.Nil(t, err)
		require.Len(t, keys1, 100)

		keys2, err := ss.Plugin().List(pluginId, 100, 100)
		require.Nil(t, err)
		require.Len(t, keys2, 35)

		actualKeys := append(keys1, keys2...)
		sort.Strings(actualKeys)

		assert.Equal(t, keys, actualKeys)
	})

	t.Run("offsets and limits", func(t *testing.T) {
		_, tearDown := setupKVs(t, ss)
		defer tearDown()

		// Ignore the pluginId setup by setupKVs
		pluginId := model.NewId()

		var keys []string
		for i := 0; i < 150; i++ {
			key := model.NewId()
			kv := &model.PluginKeyValue{
				PluginId: pluginId,
				Key:      key,
				Value:    []byte(model.NewId()),
				ExpireAt: 0,
			}
			_, err := ss.Plugin().SaveOrUpdate(kv)
			require.Nil(t, err)

			keys = append(keys, key)
		}
		sort.Strings(keys)

		t.Run("default limit", func(t *testing.T) {
			keys1, err := ss.Plugin().List(pluginId, 0, 0)
			require.Nil(t, err)
			require.Len(t, keys1, 10)
		})

		t.Run("offset 0, limit 1", func(t *testing.T) {
			keys2, err := ss.Plugin().List(pluginId, 0, 1)
			require.Nil(t, err)
			require.Len(t, keys2, 1)
		})

		t.Run("offset 1, limit 1", func(t *testing.T) {
			keys2, err := ss.Plugin().List(pluginId, 1, 1)
			require.Nil(t, err)
			require.Len(t, keys2, 1)
		})
	})
}
