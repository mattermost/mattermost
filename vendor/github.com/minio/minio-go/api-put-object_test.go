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
package minio

import (
	"testing"
)

func TestPutObjectOptionsValidate(t *testing.T) {
	testCases := []struct {
		name, value string
		shouldPass  bool
	}{
		// Invalid cases.
		{"X-Amz-Matdesc", "blah", false},
		{"x-amz-meta-X-Amz-Iv", "blah", false},
		{"x-amz-meta-X-Amz-Key", "blah", false},
		{"x-amz-meta-X-Amz-Matdesc", "blah", false},
		{"It has spaces", "v", false},
		{"It,has@illegal=characters", "v", false},
		{"X-Amz-Iv", "blah", false},
		{"X-Amz-Key", "blah", false},
		{"X-Amz-Key-prefixed-header", "blah", false},
		{"Content-Type", "custom/content-type", false},
		{"content-type", "custom/content-type", false},
		{"Content-Encoding", "gzip", false},
		{"Cache-Control", "blah", false},
		{"Content-Disposition", "something", false},

		// Valid metadata names.
		{"my-custom-header", "blah", true},
		{"custom-X-Amz-Key-middle", "blah", true},
		{"my-custom-header-X-Amz-Key", "blah", true},
		{"blah-X-Amz-Matdesc", "blah", true},
		{"X-Amz-MatDesc-suffix", "blah", true},
		{"It-Is-Fine", "v", true},
		{"Numbers-098987987-Should-Work", "v", true},
		{"Crazy-!#$%&'*+-.^_`|~-Should-193832-Be-Fine", "v", true},
	}
	for i, testCase := range testCases {
		err := PutObjectOptions{UserMetadata: map[string]string{
			testCase.name: testCase.value,
		}}.validate()
		if testCase.shouldPass && err != nil {
			t.Errorf("Test %d - output did not match with reference results, %s", i+1, err)
		}
	}
}
