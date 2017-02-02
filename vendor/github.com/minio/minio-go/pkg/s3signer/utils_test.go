/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2015 Minio, Inc.
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
	"fmt"
	"net/url"
	"testing"
)

// Tests url encoding.
func TestEncodeURL2Path(t *testing.T) {
	type urlStrings struct {
		objName        string
		encodedObjName string
	}

	bucketName := "bucketName"
	want := []urlStrings{
		{
			objName:        "本語",
			encodedObjName: "%E6%9C%AC%E8%AA%9E",
		},
		{
			objName:        "本語.1",
			encodedObjName: "%E6%9C%AC%E8%AA%9E.1",
		},
		{
			objName:        ">123>3123123",
			encodedObjName: "%3E123%3E3123123",
		},
		{
			objName:        "test 1 2.txt",
			encodedObjName: "test%201%202.txt",
		},
		{
			objName:        "test++ 1.txt",
			encodedObjName: "test%2B%2B%201.txt",
		},
	}

	for _, o := range want {
		u, err := url.Parse(fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucketName, o.objName))
		if err != nil {
			t.Fatal("Error:", err)
		}
		urlPath := "/" + bucketName + "/" + o.encodedObjName
		if urlPath != encodeURL2Path(u) {
			t.Fatal("Error")
		}
	}
}
