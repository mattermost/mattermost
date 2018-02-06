/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2017 Minio, Inc.
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
	"fmt"
	"testing"
)

func TestSetHeader(t *testing.T) {
	testCases := []struct {
		start    int64
		end      int64
		errVal   error
		expected string
	}{
		{0, 10, nil, "bytes=0-10"},
		{1, 10, nil, "bytes=1-10"},
		{5, 0, nil, "bytes=5-"},
		{0, -5, nil, "bytes=-5"},
		{0, 0, nil, "bytes=0-0"},
		{11, 10, fmt.Errorf("Invalid range specified: start=11 end=10"),
			""},
		{-1, 10, fmt.Errorf("Invalid range specified: start=-1 end=10"), ""},
		{-1, 0, fmt.Errorf("Invalid range specified: start=-1 end=0"), ""},
		{1, -5, fmt.Errorf("Invalid range specified: start=1 end=-5"), ""},
	}
	for i, testCase := range testCases {
		opts := GetObjectOptions{}
		err := opts.SetRange(testCase.start, testCase.end)
		if err == nil && testCase.errVal != nil {
			t.Errorf("Test %d: Expected to fail with '%v' but it passed",
				i+1, testCase.errVal)
		} else if err != nil && testCase.errVal.Error() != err.Error() {
			t.Errorf("Test %d: Expected error '%v' but got error '%v'",
				i+1, testCase.errVal, err)
		} else if err == nil && opts.headers["Range"] != testCase.expected {
			t.Errorf("Test %d: Expected range header '%s', but got '%s'",
				i+1, testCase.expected, opts.headers["Range"])
		}
	}
}
