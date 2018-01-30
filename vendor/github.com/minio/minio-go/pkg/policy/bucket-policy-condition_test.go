/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2015-2017 Minio, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package policy

import (
	"encoding/json"
	"testing"

	"github.com/minio/minio-go/pkg/set"
)

// ConditionKeyMap.Add() is called and the result is validated.
func TestConditionKeyMapAdd(t *testing.T) {
	condKeyMap := make(ConditionKeyMap)
	testCases := []struct {
		key            string
		value          set.StringSet
		expectedResult string
	}{
		// Add new key and value.
		{"s3:prefix", set.CreateStringSet("hello"), `{"s3:prefix":["hello"]}`},
		// Add existing key and value.
		{"s3:prefix", set.CreateStringSet("hello"), `{"s3:prefix":["hello"]}`},
		// Add existing key and not value.
		{"s3:prefix", set.CreateStringSet("world"), `{"s3:prefix":["hello","world"]}`},
	}

	for _, testCase := range testCases {
		condKeyMap.Add(testCase.key, testCase.value)
		if data, err := json.Marshal(condKeyMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// ConditionKeyMap.Remove() is called and the result is validated.
func TestConditionKeyMapRemove(t *testing.T) {
	condKeyMap := make(ConditionKeyMap)
	condKeyMap.Add("s3:prefix", set.CreateStringSet("hello", "world"))

	testCases := []struct {
		key            string
		value          set.StringSet
		expectedResult string
	}{
		// Remove non-existent key and value.
		{"s3:myprefix", set.CreateStringSet("hello"), `{"s3:prefix":["hello","world"]}`},
		// Remove existing key and value.
		{"s3:prefix", set.CreateStringSet("hello"), `{"s3:prefix":["world"]}`},
		// Remove existing key to make the key also removed.
		{"s3:prefix", set.CreateStringSet("world"), `{}`},
	}

	for _, testCase := range testCases {
		condKeyMap.Remove(testCase.key, testCase.value)
		if data, err := json.Marshal(condKeyMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// ConditionKeyMap.RemoveKey() is called and the result is validated.
func TestConditionKeyMapRemoveKey(t *testing.T) {
	condKeyMap := make(ConditionKeyMap)
	condKeyMap.Add("s3:prefix", set.CreateStringSet("hello", "world"))

	testCases := []struct {
		key            string
		expectedResult string
	}{
		// Remove non-existent key.
		{"s3:myprefix", `{"s3:prefix":["hello","world"]}`},
		// Remove existing key.
		{"s3:prefix", `{}`},
	}

	for _, testCase := range testCases {
		condKeyMap.RemoveKey(testCase.key)
		if data, err := json.Marshal(condKeyMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// CopyConditionKeyMap() is called and the result is validated.
func TestCopyConditionKeyMap(t *testing.T) {
	emptyCondKeyMap := make(ConditionKeyMap)
	nonEmptyCondKeyMap := make(ConditionKeyMap)
	nonEmptyCondKeyMap.Add("s3:prefix", set.CreateStringSet("hello", "world"))

	testCases := []struct {
		condKeyMap     ConditionKeyMap
		expectedResult string
	}{
		// To test empty ConditionKeyMap.
		{emptyCondKeyMap, `{}`},
		// To test non-empty ConditionKeyMap.
		{nonEmptyCondKeyMap, `{"s3:prefix":["hello","world"]}`},
	}

	for _, testCase := range testCases {
		condKeyMap := CopyConditionKeyMap(testCase.condKeyMap)
		if data, err := json.Marshal(condKeyMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// mergeConditionKeyMap() is called and the result is validated.
func TestMergeConditionKeyMap(t *testing.T) {
	condKeyMap1 := make(ConditionKeyMap)
	condKeyMap1.Add("s3:prefix", set.CreateStringSet("hello"))

	condKeyMap2 := make(ConditionKeyMap)
	condKeyMap2.Add("s3:prefix", set.CreateStringSet("world"))

	condKeyMap3 := make(ConditionKeyMap)
	condKeyMap3.Add("s3:myprefix", set.CreateStringSet("world"))

	testCases := []struct {
		condKeyMap1    ConditionKeyMap
		condKeyMap2    ConditionKeyMap
		expectedResult string
	}{
		// Both arguments are empty.
		{make(ConditionKeyMap), make(ConditionKeyMap), `{}`},
		// First argument is empty.
		{make(ConditionKeyMap), condKeyMap1, `{"s3:prefix":["hello"]}`},
		// Second argument is empty.
		{condKeyMap1, make(ConditionKeyMap), `{"s3:prefix":["hello"]}`},
		// Both arguments are same value.
		{condKeyMap1, condKeyMap1, `{"s3:prefix":["hello"]}`},
		// Value of second argument will be merged.
		{condKeyMap1, condKeyMap2, `{"s3:prefix":["hello","world"]}`},
		// second argument will be added.
		{condKeyMap1, condKeyMap3, `{"s3:myprefix":["world"],"s3:prefix":["hello"]}`},
	}

	for _, testCase := range testCases {
		condKeyMap := mergeConditionKeyMap(testCase.condKeyMap1, testCase.condKeyMap2)
		if data, err := json.Marshal(condKeyMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// ConditionMap.Add() is called and the result is validated.
func TestConditionMapAdd(t *testing.T) {
	condMap := make(ConditionMap)

	condKeyMap1 := make(ConditionKeyMap)
	condKeyMap1.Add("s3:prefix", set.CreateStringSet("hello"))

	condKeyMap2 := make(ConditionKeyMap)
	condKeyMap2.Add("s3:prefix", set.CreateStringSet("hello", "world"))

	testCases := []struct {
		key            string
		value          ConditionKeyMap
		expectedResult string
	}{
		// Add new key and value.
		{"StringEquals", condKeyMap1, `{"StringEquals":{"s3:prefix":["hello"]}}`},
		// Add existing key and value.
		{"StringEquals", condKeyMap1, `{"StringEquals":{"s3:prefix":["hello"]}}`},
		// Add existing key and not value.
		{"StringEquals", condKeyMap2, `{"StringEquals":{"s3:prefix":["hello","world"]}}`},
	}

	for _, testCase := range testCases {
		condMap.Add(testCase.key, testCase.value)
		if data, err := json.Marshal(condMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// ConditionMap.Remove() is called and the result is validated.
func TestConditionMapRemove(t *testing.T) {
	condMap := make(ConditionMap)
	condKeyMap := make(ConditionKeyMap)
	condKeyMap.Add("s3:prefix", set.CreateStringSet("hello", "world"))
	condMap.Add("StringEquals", condKeyMap)

	testCases := []struct {
		key            string
		expectedResult string
	}{
		// Remove non-existent key.
		{"StringNotEquals", `{"StringEquals":{"s3:prefix":["hello","world"]}}`},
		// Remove existing key.
		{"StringEquals", `{}`},
	}

	for _, testCase := range testCases {
		condMap.Remove(testCase.key)
		if data, err := json.Marshal(condMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}

// mergeConditionMap() is called and the result is validated.
func TestMergeConditionMap(t *testing.T) {
	condKeyMap1 := make(ConditionKeyMap)
	condKeyMap1.Add("s3:prefix", set.CreateStringSet("hello"))
	condMap1 := make(ConditionMap)
	condMap1.Add("StringEquals", condKeyMap1)

	condKeyMap2 := make(ConditionKeyMap)
	condKeyMap2.Add("s3:prefix", set.CreateStringSet("world"))
	condMap2 := make(ConditionMap)
	condMap2.Add("StringEquals", condKeyMap2)

	condMap3 := make(ConditionMap)
	condMap3.Add("StringNotEquals", condKeyMap2)

	testCases := []struct {
		condMap1       ConditionMap
		condMap2       ConditionMap
		expectedResult string
	}{
		// Both arguments are empty.
		{make(ConditionMap), make(ConditionMap), `{}`},
		// First argument is empty.
		{make(ConditionMap), condMap1, `{"StringEquals":{"s3:prefix":["hello"]}}`},
		// Second argument is empty.
		{condMap1, make(ConditionMap), `{"StringEquals":{"s3:prefix":["hello"]}}`},
		// Both arguments are same value.
		{condMap1, condMap1, `{"StringEquals":{"s3:prefix":["hello"]}}`},
		// Value of second argument will be merged.
		{condMap1, condMap2, `{"StringEquals":{"s3:prefix":["hello","world"]}}`},
		// second argument will be added.
		{condMap1, condMap3, `{"StringEquals":{"s3:prefix":["hello"]},"StringNotEquals":{"s3:prefix":["world"]}}`},
	}

	for _, testCase := range testCases {
		condMap := mergeConditionMap(testCase.condMap1, testCase.condMap2)
		if data, err := json.Marshal(condMap); err != nil {
			t.Fatalf("Unable to marshal ConditionKeyMap to JSON, %s", err)
		} else {
			if string(data) != testCase.expectedResult {
				t.Fatalf("case: %+v: expected: %s, got: %s", testCase, testCase.expectedResult, string(data))
			}
		}
	}
}
