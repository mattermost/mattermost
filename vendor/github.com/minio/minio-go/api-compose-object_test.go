/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2017 Minio, Inc.
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
package minio

import (
	"reflect"
	"testing"
)

const (
	gb1    = 1024 * 1024 * 1024
	gb5    = 5 * gb1
	gb5p1  = gb5 + 1
	gb10p1 = 2*gb5 + 1
	gb10p2 = 2*gb5 + 2
)

func TestPartsRequired(t *testing.T) {
	testCases := []struct {
		size, ref int64
	}{
		{0, 0},
		{1, 1},
		{gb5, 1},
		{2 * gb5, 2},
		{gb10p1, 3},
		{gb10p2, 3},
	}

	for i, testCase := range testCases {
		res := partsRequired(testCase.size)
		if res != testCase.ref {
			t.Errorf("Test %d - output did not match with reference results", i+1)
		}
	}
}

func TestCalculateEvenSplits(t *testing.T) {

	testCases := []struct {
		// input size and source object
		size int64
		src  SourceInfo

		// output part-indexes
		starts, ends []int64
	}{
		{0, SourceInfo{start: -1}, nil, nil},
		{1, SourceInfo{start: -1}, []int64{0}, []int64{0}},
		{1, SourceInfo{start: 0}, []int64{0}, []int64{0}},

		{gb1, SourceInfo{start: -1}, []int64{0}, []int64{gb1 - 1}},
		{gb5, SourceInfo{start: -1}, []int64{0}, []int64{gb5 - 1}},

		// 2 part splits
		{gb5p1, SourceInfo{start: -1}, []int64{0, gb5/2 + 1}, []int64{gb5 / 2, gb5}},
		{gb5p1, SourceInfo{start: -1}, []int64{0, gb5/2 + 1}, []int64{gb5 / 2, gb5}},

		// 3 part splits
		{gb10p1, SourceInfo{start: -1},
			[]int64{0, gb10p1/3 + 1, 2*gb10p1/3 + 1},
			[]int64{gb10p1 / 3, 2 * gb10p1 / 3, gb10p1 - 1}},

		{gb10p2, SourceInfo{start: -1},
			[]int64{0, gb10p2 / 3, 2 * gb10p2 / 3},
			[]int64{gb10p2/3 - 1, 2*gb10p2/3 - 1, gb10p2 - 1}},
	}

	for i, testCase := range testCases {
		resStart, resEnd := calculateEvenSplits(testCase.size, testCase.src)
		if !reflect.DeepEqual(testCase.starts, resStart) || !reflect.DeepEqual(testCase.ends, resEnd) {
			t.Errorf("Test %d - output did not match with reference results", i+1)
		}
	}
}
