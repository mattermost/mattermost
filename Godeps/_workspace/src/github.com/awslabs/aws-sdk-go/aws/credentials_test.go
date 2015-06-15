package aws

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestEnvCreds(t *testing.T) {
	os.Clearenv()
	os.Setenv("AWS_ACCESS_KEY_ID", "access")
	os.Setenv("AWS_SECRET_ACCESS_KEY", "secret")
	os.Setenv("AWS_SESSION_TOKEN", "token")

	prov, err := EnvCreds()
	if err != nil {
		t.Fatal(err)
	}

	creds, err := prov.Credentials()
	if err != nil {
		t.Fatal(err)
	}

	if v, want := creds.AccessKeyID, "access"; v != want {
		t.Errorf("Access key ID was %v, expected %v", v, want)
	}

	if v, want := creds.SecretAccessKey, "secret"; v != want {
		t.Errorf("Secret access key was %v, expected %v", v, want)
	}

	if v, want := creds.SessionToken, "token"; v != want {
		t.Errorf("Security token was %v, expected %v", v, want)
	}
}

func TestEnvCredsNoAccessKeyID(t *testing.T) {
	os.Clearenv()
	os.Setenv("AWS_SECRET_ACCESS_KEY", "secret")

	prov, err := EnvCreds()
	if err != ErrAccessKeyIDNotFound {
		t.Fatalf("ErrAccessKeyIDNotFound expected, but was %#v/%#v", prov, err)
	}
}

func TestEnvCredsNoSecretAccessKey(t *testing.T) {
	os.Clearenv()
	os.Setenv("AWS_ACCESS_KEY_ID", "access")

	prov, err := EnvCreds()
	if err != ErrSecretAccessKeyNotFound {
		t.Fatalf("ErrSecretAccessKeyNotFound expected, but was %#v/%#v", prov, err)
	}
}

func TestEnvCredsAlternateNames(t *testing.T) {
	os.Clearenv()
	os.Setenv("AWS_ACCESS_KEY", "access")
	os.Setenv("AWS_SECRET_KEY", "secret")

	prov, err := EnvCreds()
	if err != nil {
		t.Fatal(err)
	}

	creds, err := prov.Credentials()
	if err != nil {
		t.Fatal(err)
	}

	if v, want := creds.AccessKeyID, "access"; v != want {
		t.Errorf("Access key ID was %v, expected %v", v, want)
	}

	if v, want := creds.SecretAccessKey, "secret"; v != want {
		t.Errorf("Secret access key was %v, expected %v", v, want)
	}
}

func TestIAMCreds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.RequestURI == "/" {
			fmt.Fprintln(w, "/creds")
		} else {
			fmt.Fprintln(w, `{
  "AccessKeyId" : "accessKey",
  "SecretAccessKey" : "secret",
  "Token" : "token",
  "Expiration" : "2014-12-16T01:51:37Z"
}`)
		}
	}))
	defer server.Close()

	defer func(s string) {
		metadataCredentialsEndpoint = s
	}(metadataCredentialsEndpoint)
	metadataCredentialsEndpoint = server.URL

	defer func() {
		currentTime = time.Now
	}()
	currentTime = func() time.Time {
		return time.Date(2014, 12, 15, 21, 26, 0, 0, time.UTC)
	}

	prov := IAMCreds()
	creds, err := prov.Credentials()
	if err != nil {
		t.Fatal(err)
	}

	if v, want := creds.AccessKeyID, "accessKey"; v != want {
		t.Errorf("AcccessKeyID was %v, but expected %v", v, want)
	}

	if v, want := creds.SecretAccessKey, "secret"; v != want {
		t.Errorf("SecretAccessKey was %v, but expected %v", v, want)
	}

	if v, want := creds.SessionToken, "token"; v != want {
		t.Errorf("SessionToken was %v, but expected %v", v, want)
	}
}

func TestProfileCreds(t *testing.T) {
	prov, err := ProfileCreds("example.ini", "", 10*time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	creds, err := prov.Credentials()
	if err != nil {
		t.Fatal(err)
	}

	if v, want := creds.AccessKeyID, "accessKey"; v != want {
		t.Errorf("AcccessKeyID was %v, but expected %v", v, want)
	}

	if v, want := creds.SecretAccessKey, "secret"; v != want {
		t.Errorf("SecretAccessKey was %v, but expected %v", v, want)
	}

	if v, want := creds.SessionToken, "token"; v != want {
		t.Errorf("SessionToken was %v, but expected %v", v, want)
	}
}

func TestProfileCredsWithoutToken(t *testing.T) {
	prov, err := ProfileCreds("example.ini", "no_token", 10*time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	creds, err := prov.Credentials()
	if err != nil {
		t.Fatal(err)
	}

	if v, want := creds.AccessKeyID, "accessKey"; v != want {
		t.Errorf("AcccessKeyID was %v, but expected %v", v, want)
	}

	if v, want := creds.SecretAccessKey, "secret"; v != want {
		t.Errorf("SecretAccessKey was %v, but expected %v", v, want)
	}

	if v, want := creds.SessionToken, ""; v != want {
		t.Errorf("SessionToken was %v, but expected %v", v, want)
	}
}

func BenchmarkProfileCreds(b *testing.B) {
	prov, err := ProfileCreds("example.ini", "", 10*time.Minute)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := prov.Credentials()
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}

func BenchmarkIAMCreds(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.RequestURI == "/" {
			fmt.Fprintln(w, "/creds")
		} else {
			fmt.Fprintln(w, `{
  "AccessKeyId" : "accessKey",
  "SecretAccessKey" : "secret",
  "Token" : "token",
  "Expiration" : "2014-12-16T01:51:37Z"
}`)
		}
	}))
	defer server.Close()

	defer func(s string) {
		metadataCredentialsEndpoint = s
	}(metadataCredentialsEndpoint)
	metadataCredentialsEndpoint = server.URL

	defer func() {
		currentTime = time.Now
	}()
	currentTime = func() time.Time {
		return time.Date(2014, 12, 15, 21, 26, 0, 0, time.UTC)
	}

	b.ResetTimer()

	prov := IAMCreds()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_, err := prov.Credentials()
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}
