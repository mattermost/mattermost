// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package nosqlstoretest

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/store/nosqlstore"
)

func TestDriver(t *testing.T, driver nosqlstore.Driver) {
	t.Run("ObjectStoreBasics", func(t *testing.T) { testObjectStoreBasics(t, driver) })
	t.Run("ObjectStoreIndexes", func(t *testing.T) { testObjectStoreIndexes(t, driver) })
}

type testObject struct {
	Id  string
	Foo string
	N   int
}

func testObjectStoreBasics(t *testing.T, driver nosqlstore.Driver) {
	store := driver.ObjectStore("testObjectStoreBasics", json.Marshal, func(b []byte) (interface{}, error) {
		var obj testObject
		return &obj, json.Unmarshal(b, &obj)
	})
	require.NotNil(t, store)

	var obj testObject
	assert.Equal(t, nosqlstore.ErrNotFound, store.Get("foo", &obj))

	assert.NoError(t, store.Upsert("theid", &testObject{
		Id:  "theid",
		Foo: "foo",
	}))

	assert.NoError(t, store.Get("theid", &obj))
	assert.Equal(t, "theid", obj.Id)
	assert.Equal(t, "foo", obj.Foo)

	obj.Foo = "bar"

	assert.NoError(t, store.Upsert(obj.Id, &obj))
	assert.NoError(t, store.Get("theid", &obj))
	assert.Equal(t, "theid", obj.Id)
	assert.Equal(t, "bar", obj.Foo)

	assert.NoError(t, store.Delete(obj.Id))
	assert.Equal(t, nosqlstore.ErrNotFound, store.Get("theid", &obj))
}

func testObjectStoreIndexes(t *testing.T, driver nosqlstore.Driver) {
	store := driver.ObjectStore("testObjectStoreIndexes", json.Marshal, func(b []byte) (interface{}, error) {
		var obj testObject
		return &obj, json.Unmarshal(b, &obj)
	})
	require.NotNil(t, store)

	require.NoError(t, store.AddIndex("foo", func(obj interface{}) ([]byte, []byte) {
		return []byte(obj.(*testObject).Foo), nosqlstore.Encode(obj.(*testObject).N)
	}))

	var testData []*testObject
	for i := -5; i <= 5; i++ {
		id := string('a' + 5 - i)
		testData = append(testData, &testObject{
			Id:  id,
			Foo: "foo",
			N:   i,
		})
	}

	for _, obj := range testData {
		assert.NoError(t, store.Upsert(obj.Id, obj))
	}

	var objs []*testObject
	require.NoError(t, store.Lookup("foo", []byte("x"), nil, &objs))
	assert.Equal(t, 0, len(objs))

	require.NoError(t, store.Lookup("foo", []byte("x"), nil, &objs))
	count, err := store.Count("foo", []byte("x"), nil)
	assert.NoError(t, err)
	assert.Equal(t, 0, count)
	assert.Equal(t, 0, len(objs))

	for name, tc := range map[string]struct {
		Range    *nosqlstore.RangeKey
		Expected []*testObject
	}{
		"NilRange":    {nil, testData},
		"SubsetRange": {nosqlstore.RangeSubset(3, 5), testData[3:8]},
		"EqualRange":  {nosqlstore.RangeEqualTo(nosqlstore.Encode(-1)), testData[4:5]},
	} {
		t.Run(name, func(t *testing.T) {
			count, err = store.Count("foo", []byte("foo"), tc.Range)
			assert.NoError(t, err)
			assert.Equal(t, len(tc.Expected), count)
			require.NoError(t, store.Lookup("foo", []byte("foo"), tc.Range, &objs))
			assert.Equal(t, len(tc.Expected), len(objs))
			assert.Equal(t, tc.Expected, objs)
		})
	}
}
