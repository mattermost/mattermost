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

package s3signer

import (
	"sort"
	"testing"
)

// Tests for 'func TestResourceListSorting(t *testing.T)'.
func TestResourceListSorting(t *testing.T) {
	sortedResourceList := make([]string, len(resourceList))
	copy(sortedResourceList, resourceList)
	sort.Strings(sortedResourceList)
	for i := 0; i < len(resourceList); i++ {
		if resourceList[i] != sortedResourceList[i] {
			t.Errorf("Expected resourceList[%d] = \"%s\", resourceList is not correctly sorted.", i, sortedResourceList[i])
			break
		}
	}
}
