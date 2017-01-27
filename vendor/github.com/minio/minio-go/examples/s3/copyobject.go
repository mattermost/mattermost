// +build ignore

/*
 * Minio Go Library for Amazon S3 Compatible Cloud Storage (C) 2016 Minio, Inc.
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

package main

import (
	"log"
	"time"

	"github.com/minio/minio-go"
)

func main() {
	// Note: YOUR-ACCESSKEYID, YOUR-SECRETACCESSKEY, my-testfile, my-bucketname and
	// my-objectname are dummy values, please replace them with original values.

	// Requests are always secure (HTTPS) by default. Set secure=false to enable insecure (HTTP) access.
	// This boolean value is the last argument for New().

	// New returns an Amazon S3 compatible client object. API compatibility (v2 or v4) is automatically
	// determined based on the Endpoint value.
	s3Client, err := minio.New("s3.amazonaws.com", "YOUR-ACCESSKEYID", "YOUR-SECRETACCESSKEY", true)
	if err != nil {
		log.Fatalln(err)
	}

	// Enable trace.
	// s3Client.TraceOn(os.Stderr)

	// All following conditions are allowed and can be combined together.

	// Set copy conditions.
	var copyConds = minio.NewCopyConditions()
	// Set modified condition, copy object modified since 2014 April.
	copyConds.SetModified(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))

	// Set unmodified condition, copy object unmodified since 2014 April.
	// copyConds.SetUnmodified(time.Date(2014, time.April, 0, 0, 0, 0, 0, time.UTC))

	// Set matching ETag condition, copy object which matches the following ETag.
	// copyConds.SetMatchETag("31624deb84149d2f8ef9c385918b653a")

	// Set matching ETag except condition, copy object which does not match the following ETag.
	// copyConds.SetMatchETagExcept("31624deb84149d2f8ef9c385918b653a")

	// Initiate copy object.
	err = s3Client.CopyObject("my-bucketname", "my-objectname", "/my-sourcebucketname/my-sourceobjectname", copyConds)
	if err != nil {
		log.Fatalln(err)
	}
	log.Println("Copied source object /my-sourcebucketname/my-sourceobjectname to destination /my-bucketname/my-objectname Successfully.")
}
