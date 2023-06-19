package pluginapi_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/plugin/pluginapi"
)

func newAppError() *model.AppError {
	return model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError)
}

func TestKVSet(t *testing.T) {
	tests := []struct {
		name            string
		key             string
		value           interface{}
		options         []pluginapi.KVSetOption
		expectedValue   []byte
		expectedOptions model.PluginKVSetOptions
		upserted        bool
		err             error
	}{
		{
			"[]byte value",
			"1",
			2,
			[]pluginapi.KVSetOption{},
			[]byte(`2`),
			model.PluginKVSetOptions{},
			true,
			nil,
		}, {
			"string value",
			"1",
			"2",
			[]pluginapi.KVSetOption{},
			[]byte(`"2"`),
			model.PluginKVSetOptions{},
			true,
			nil,
		}, {
			"struct value",
			"1",
			struct{ A string }{"2"},
			[]pluginapi.KVSetOption{},
			[]byte(`{"A":"2"}`),
			model.PluginKVSetOptions{},
			true,
			nil,
		}, {
			"compare and set []byte value",
			"1",
			[]byte{2},
			[]pluginapi.KVSetOption{
				pluginapi.SetAtomic([]byte{3}),
			},
			[]byte{2},
			model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: []byte{3},
			},
			true,
			nil,
		}, {
			"compare and set string value",
			"1",
			"2",
			[]pluginapi.KVSetOption{
				pluginapi.SetAtomic("3"),
			},
			[]byte(`"2"`),
			model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: []byte(`"3"`),
			}, true,
			nil,
		}, {
			"value is nil",
			"1",
			nil,
			[]pluginapi.KVSetOption{},
			nil,
			model.PluginKVSetOptions{},
			true,
			nil,
		}, {
			"current value is nil",
			"1",
			"2",
			[]pluginapi.KVSetOption{
				pluginapi.SetAtomic(nil),
			},
			[]byte(`"2"`),
			model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: nil,
			},
			true,
			nil,
		}, {
			"value is nil, current value is []byte",
			"1",
			nil,
			[]pluginapi.KVSetOption{
				pluginapi.SetAtomic([]byte{3}),
			},
			nil,
			model.PluginKVSetOptions{
				Atomic:   true,
				OldValue: []byte{3},
			},
			true,
			nil,
		}, {
			"error",
			"1",
			[]byte{2},
			[]pluginapi.KVSetOption{},
			[]byte{2},
			model.PluginKVSetOptions{},
			false,
			newAppError(),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			api := &plugintest.API{}
			client := pluginapi.NewClient(api, &plugintest.Driver{})

			api.On("KVSetWithOptions", test.key, test.expectedValue, test.expectedOptions).Return(test.upserted, test.err)

			upserted, err := client.KV.Set(test.key, test.value, test.options...)
			if test.err != nil {
				require.Error(t, err, test.name)
				require.False(t, upserted, test.name)
			} else {
				require.NoError(t, err, test.name)
				assert.True(t, upserted, test.name)
			}
			api.AssertExpectations(t)
		})
	}
}

func TestSetWithExpiry(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVSetWithOptions", "1", []byte(`2`), model.PluginKVSetOptions{
		ExpireInSeconds: 60,
	}).Return(true, nil)

	err := client.KV.SetWithExpiry("1", 2, time.Minute)
	require.NoError(t, err)
}

func TestCompareAndSet(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVSetWithOptions", "1", []byte("2"), model.PluginKVSetOptions{
		Atomic:   true,
		OldValue: []byte("3"),
	}).Return(true, nil)

	upserted, err := client.KV.CompareAndSet("1", 3, 2)
	require.NoError(t, err)
	assert.True(t, upserted)
}

func TestCompareAndDelete(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVSetWithOptions", "1", []byte(nil), model.PluginKVSetOptions{
		Atomic:   true,
		OldValue: []byte("2"),
	}).Return(true, nil)

	deleted, err := client.KV.CompareAndDelete("1", 2)
	require.NoError(t, err)
	assert.True(t, deleted)
}

func TestSetAtomicWithRetries(t *testing.T) {
	tests := []struct {
		name              string
		key               string
		valueFunc         func(t *testing.T) func(old []byte) (interface{}, error)
		setupAPI          func(api *plugintest.API)
		wantErr           bool
		expectedErrPrefix string
	}{
		{
			name: "Test SetAtomicWithRetries success after first attempt",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return 2, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				newJSONBytes, _ := json.Marshal(2)
				api.On("KVGet", "testNum").Return(oldJSONBytes, nil)
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(true, nil)
			},
		},
		{
			name: "Test success after first attempt, old is struct and as expected",
			key:  "testNum2",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					type toStore struct {
						Value int
					}
					var fromDB toStore
					if err := json.Unmarshal(old, &fromDB); err != nil {
						return nil, err
					}
					require.Equal(t, 1, fromDB.Value, "old not as expected")
					return toStore{2}, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				type toStore struct {
					Value int
				}
				oldJSONBytes, _ := json.Marshal(toStore{1})
				newJSONBytes, _ := json.Marshal(toStore{2})
				api.On("KVGet", "testNum2").Return(oldJSONBytes, nil)
				api.On("KVSetWithOptions", "testNum2", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(true, nil)
			},
		},
		{
			name: "Test success after first attempt, old is an int value and as expected",
			key:  "testNum2",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					fromDB, err := strconv.Atoi(string(old))
					if err != nil {
						return nil, err
					}
					require.Equal(t, 1, fromDB, "old not as expected")
					return 2, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				newJSONBytes, _ := json.Marshal(2)
				api.On("KVGet", "testNum2").Return(oldJSONBytes, nil)
				api.On("KVSetWithOptions", "testNum2", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(true, nil)
			},
		},
		{
			name: "Test SetAtomicWithRetries success on fourth attempt",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return 2, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				newJSONBytes, _ := json.Marshal(2)
				api.On("KVGet", "testNum").Return(oldJSONBytes, nil).Times(4)
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(false, nil).Times(3)
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(true, nil).Once()
			},
		},
		{
			name: "Test SetAtomicWithRetries success on fourth attempt because value was changed between calls to KVGet",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return 2, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				newJSONBytes, _ := json.Marshal(2)
				api.On("KVGet", "testNum").Return(oldJSONBytes, nil).Times(4)
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(false, nil).Times(3)
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(true, nil).Once()
			},
		},
		{
			name: "Test SetAtomicWithRetries failure on get",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return nil, errors.New("should not have got here")
				}
			},
			setupAPI: func(api *plugintest.API) {
				api.On("KVGet", "testNum").Return(nil, newAppError()).Once()
			},
			wantErr:           true,
			expectedErrPrefix: "failed to get value for key testNum",
		},
		{
			name: "Test SetAtomicWithRetries failure on valueFunc",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return nil, errors.New("some user provided error")
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				api.On("KVGet", "testNum").Return(oldJSONBytes, nil).Once()
			},
			wantErr:           true,
			expectedErrPrefix: "valueFunc failed: some user provided error",
		},
		{
			name: "Test SetAtomicWithRetries DB failure on set",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return 2, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				newJSONBytes, _ := json.Marshal(2)
				api.On("KVGet", "testNum").Return(oldJSONBytes, nil).Once()
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(false, newAppError()).Once()
			},
			wantErr:           true,
			expectedErrPrefix: "DB failed to set value for key testNum",
		},
		{
			name: "Test SetAtomicWithRetries failure on five set attempts -- depends on numRetries constant being = 5",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					return 2, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				oldJSONBytes, _ := json.Marshal(1)
				newJSONBytes, _ := json.Marshal(2)
				api.On("KVGet", "testNum").Return(oldJSONBytes, nil).Times(5)
				api.On("KVSetWithOptions", "testNum", newJSONBytes, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: oldJSONBytes,
				}).Return(false, nil).Times(5)
			},
			wantErr:           true,
			expectedErrPrefix: "failed to set value after 5 retries",
		},
		{
			name: "Test SetAtomicWithRetries success after five set attempts -- depends on numRetries constant being = 5",
			key:  "testNum",
			valueFunc: func(t *testing.T) func(old []byte) (interface{}, error) {
				return func(old []byte) (interface{}, error) {
					fromDB, err := strconv.Atoi(string(old))
					if err != nil {
						return nil, err
					}
					return fromDB + 1, nil
				}
			},
			setupAPI: func(api *plugintest.API) {
				i1, _ := json.Marshal(1)
				i2, _ := json.Marshal(2)
				i3, _ := json.Marshal(3)
				i4, _ := json.Marshal(4)
				i5, _ := json.Marshal(5)
				i6, _ := json.Marshal(6)
				api.On("KVGet", "testNum").Return(i1, nil).Once()
				api.On("KVSetWithOptions", "testNum", i2, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: i1,
				}).Return(false, nil).Once()
				api.On("KVGet", "testNum").Return(i2, nil).Once()
				api.On("KVSetWithOptions", "testNum", i3, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: i2,
				}).Return(false, nil).Once()
				api.On("KVGet", "testNum").Return(i3, nil).Once()
				api.On("KVSetWithOptions", "testNum", i4, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: i3,
				}).Return(false, nil).Once()
				api.On("KVGet", "testNum").Return(i4, nil).Once()
				api.On("KVSetWithOptions", "testNum", i5, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: i4,
				}).Return(false, nil).Once()
				api.On("KVGet", "testNum").Return(i5, nil).Once()
				api.On("KVSetWithOptions", "testNum", i6, model.PluginKVSetOptions{
					Atomic:   true,
					OldValue: i5,
				}).Return(true, nil).Once()
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			api := &plugintest.API{}
			defer api.AssertExpectations(t)
			client := pluginapi.NewClient(api, &plugintest.Driver{})

			tt.setupAPI(api)

			err := client.KV.SetAtomicWithRetries(tt.key, tt.valueFunc(t))
			if tt.wantErr {
				if err == nil {
					t.Errorf("SetAtomicWithRetries() error = %v, wantErr %v", err, tt.wantErr)
				}
				if !strings.HasPrefix(err.Error(), tt.expectedErrPrefix) {
					t.Errorf("SetAtomicWithRetries() error = %s, expected prefix = %s", err, tt.expectedErrPrefix)
				}
			}
		})
	}
}

func TestGet(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	aStringJSON, _ := json.Marshal("2")

	api.On("KVGet", "1").Return(aStringJSON, nil)

	var out string
	err := client.KV.Get("1", &out)
	require.NoError(t, err)
	assert.Equal(t, "2", out)
}

func TestGetNilKey(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVGet", "1").Return(nil, nil)

	var out string
	err := client.KV.Get("1", &out)
	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestGetInBytes(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVGet", "1").Return([]byte{2}, nil)

	var out []byte
	err := client.KV.Get("1", &out)
	require.NoError(t, err)
	assert.Equal(t, []byte{2}, out)
	api.AssertExpectations(t)
}

func TestDelete(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVSetWithOptions", "1", []byte(nil), model.PluginKVSetOptions{}).Return(true, nil)

	err := client.KV.Delete("1")
	require.NoError(t, err)
}

func TestDeleteAll(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("KVDeleteAll").Return(nil)

	err := client.KV.DeleteAll()
	require.NoError(t, err)
}

func TestListKeys(t *testing.T) {
	t.Run("No keys", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(nil, nil)

		keys, err := client.KV.ListKeys(0, 100)

		assert.Empty(t, keys)
		assert.NoError(t, err)
	})

	t.Run("Basic Success, one page", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 1, 2).Return(getKeys(2), nil)

		keys, err := client.KV.ListKeys(1, 2)
		require.NoError(t, err)
		require.Equal(t, getKeys(2), keys)
	})

	t.Run("success, two page, filter prefix, one", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(getKeys(100), nil)

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithPrefix("key99"))
		assert.ElementsMatch(t, keys, []string{"key99"})
		assert.NoError(t, err)
	})

	t.Run("success, two page, filter prefix, all", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(getKeys(100), nil)

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithPrefix("notkey"))
		assert.Empty(t, keys)
		assert.NoError(t, err)
	})

	t.Run("success, two page, filter prefix, none", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(getKeys(100), nil)

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithPrefix("key"))
		assert.ElementsMatch(t, keys, getKeys(100))
		assert.NoError(t, err)
	})

	t.Run("success, two page, checker func, one", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(getKeys(100), nil)

		check := func(key string) (bool, error) {
			if key == "key1" {
				return true, nil
			}
			return false, nil
		}

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithChecker(check))
		assert.ElementsMatch(t, keys, []string{"key1"})
		assert.NoError(t, err)
	})

	t.Run("success, two page, checker func, all", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(getKeys(100), nil)

		check := func(key string) (bool, error) {
			return false, nil
		}

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithChecker(check))
		assert.Empty(t, keys)
		assert.NoError(t, err)
	})

	t.Run("success, two page, checker func, none", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return(getKeys(100), nil)

		check := func(key string) (bool, error) {
			return true, nil
		}

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithChecker(check))
		assert.ElementsMatch(t, keys, getKeys(100))
		assert.NoError(t, err)
	})

	t.Run("error, checker func", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return([]string{"key1"}, nil)

		check := func(key string) (bool, error) {
			return true, &model.AppError{}
		}

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithChecker(check))
		assert.Empty(t, keys)
		assert.Error(t, err)
	})

	t.Run("success, filter and checker func, partial on both", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		api.On("KVList", 0, 100).Return([]string{"key1", "key2", "notkey3", "key4", "key5"}, nil)

		check := func(key string) (bool, error) {
			if key == "key1" || key == "key5" {
				return false, nil
			}
			return true, nil
		}

		keys, err := client.KV.ListKeys(0, 100, pluginapi.WithPrefix("key"), pluginapi.WithChecker(check))
		assert.ElementsMatch(t, keys, []string{"key2", "key4"})
		assert.NoError(t, err)
	})
}

func getKeys(count int) []string {
	ret := make([]string, count)
	for i := 0; i < count; i++ {
		ret[i] = "key" + strconv.Itoa(i)
	}
	return ret
}
