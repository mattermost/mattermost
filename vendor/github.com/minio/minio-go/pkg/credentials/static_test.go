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

package credentials

import "testing"

func TestStaticGet(t *testing.T) {
	creds := NewStatic("UXHW", "SECRET", "", SignatureV4)
	credValues, err := creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if "UXHW" != credValues.AccessKeyID {
		t.Errorf("Expected access key ID to match \"UXHW\", got %s", credValues.AccessKeyID)
	}
	if "SECRET" != credValues.SecretAccessKey {
		t.Errorf("Expected secret access key to match \"SECRET\", got %s", credValues.SecretAccessKey)
	}

	if credValues.SessionToken != "" {
		t.Error("Expected session token to match")
	}

	if credValues.SignerType != SignatureV4 {
		t.Errorf("Expected 'S3v4', got %s", credValues.SignerType)
	}

	if creds.IsExpired() {
		t.Error("Static credentials should never expire")
	}

	creds = NewStatic("", "", "", SignatureDefault)
	credValues, err = creds.Get()
	if err != nil {
		t.Fatal(err)
	}

	if "" != credValues.AccessKeyID {
		t.Errorf("Expected access key ID to match empty string, got %s", credValues.AccessKeyID)
	}
	if "" != credValues.SecretAccessKey {
		t.Errorf("Expected secret access key to match empty string, got %s", credValues.SecretAccessKey)
	}

	if !credValues.SignerType.IsAnonymous() {
		t.Errorf("Expected 'Anonymous', got %s", credValues.SignerType)
	}

	if creds.IsExpired() {
		t.Error("Static credentials should never expire")
	}
}
