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

import (
	"os"
	"reflect"
	"testing"
)

func TestEnvAWSRetrieve(t *testing.T) {
	os.Clearenv()
	os.Setenv("AWS_ACCESS_KEY_ID", "access")
	os.Setenv("AWS_SECRET_ACCESS_KEY", "secret")
	os.Setenv("AWS_SESSION_TOKEN", "token")

	e := EnvAWS{}
	if !e.IsExpired() {
		t.Error("Expect creds to be expired before retrieve.")
	}

	creds, err := e.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	expectedCreds := Value{
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		SessionToken:    "token",
		SignerType:      SignatureV4,
	}
	if !reflect.DeepEqual(creds, expectedCreds) {
		t.Errorf("Expected %v, got %v", expectedCreds, creds)
	}

	if e.IsExpired() {
		t.Error("Expect creds to not be expired after retrieve.")
	}

	os.Clearenv()
	os.Setenv("AWS_ACCESS_KEY", "access")
	os.Setenv("AWS_SECRET_KEY", "secret")

	expectedCreds = Value{
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		SignerType:      SignatureV4,
	}

	creds, err = e.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(creds, expectedCreds) {
		t.Errorf("Expected %v, got %v", expectedCreds, creds)
	}

}

func TestEnvMinioRetrieve(t *testing.T) {
	os.Clearenv()

	os.Setenv("MINIO_ACCESS_KEY", "access")
	os.Setenv("MINIO_SECRET_KEY", "secret")

	e := EnvMinio{}
	if !e.IsExpired() {
		t.Error("Expect creds to be expired before retrieve.")
	}

	creds, err := e.Retrieve()
	if err != nil {
		t.Fatal(err)
	}

	expectedCreds := Value{
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		SignerType:      SignatureV4,
	}
	if !reflect.DeepEqual(creds, expectedCreds) {
		t.Errorf("Expected %v, got %v", expectedCreds, creds)
	}

	if e.IsExpired() {
		t.Error("Expect creds to not be expired after retrieve.")
	}
}
