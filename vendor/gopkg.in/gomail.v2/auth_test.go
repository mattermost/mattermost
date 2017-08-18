package gomail

import (
	"net/smtp"
	"testing"
)

const (
	testUser = "user"
	testPwd  = "pwd"
	testHost = "smtp.example.com"
)

var testAuth = &plainAuth{
	username: testUser,
	password: testPwd,
	host:     testHost,
}

type plainAuthTest struct {
	auths      []string
	challenges []string
	tls        bool
	wantProto  string
	wantData   []string
	wantError  bool
}

func TestNoAdvertisement(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{},
		challenges: []string{"Username:", "Password:"},
		tls:        false,
		wantProto:  "PLAIN",
		wantError:  true,
	})
}

func TestNoAdvertisementTLS(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{},
		challenges: []string{"Username:", "Password:"},
		tls:        true,
		wantProto:  "PLAIN",
		wantData:   []string{"\x00" + testUser + "\x00" + testPwd},
	})
}

func TestPlain(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{"PLAIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        false,
		wantProto:  "PLAIN",
		wantData:   []string{"\x00" + testUser + "\x00" + testPwd},
	})
}

func TestPlainTLS(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{"PLAIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        true,
		wantProto:  "PLAIN",
		wantData:   []string{"\x00" + testUser + "\x00" + testPwd},
	})
}

func TestPlainAndLogin(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{"PLAIN", "LOGIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        false,
		wantProto:  "PLAIN",
		wantData:   []string{"\x00" + testUser + "\x00" + testPwd},
	})
}

func TestPlainAndLoginTLS(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{"PLAIN", "LOGIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        true,
		wantProto:  "PLAIN",
		wantData:   []string{"\x00" + testUser + "\x00" + testPwd},
	})
}

func TestLogin(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{"LOGIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        false,
		wantProto:  "LOGIN",
		wantData:   []string{"", testUser, testPwd},
	})
}

func TestLoginTLS(t *testing.T) {
	testPlainAuth(t, &plainAuthTest{
		auths:      []string{"LOGIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        true,
		wantProto:  "LOGIN",
		wantData:   []string{"", testUser, testPwd},
	})
}

func testPlainAuth(t *testing.T, test *plainAuthTest) {
	auth := &plainAuth{
		username: testUser,
		password: testPwd,
		host:     testHost,
	}
	server := &smtp.ServerInfo{
		Name: testHost,
		TLS:  test.tls,
		Auth: test.auths,
	}
	proto, toServer, err := auth.Start(server)
	if err != nil && !test.wantError {
		t.Fatalf("plainAuth.Start(): %v", err)
	}
	if err != nil && test.wantError {
		return
	}
	if proto != test.wantProto {
		t.Errorf("invalid protocol, got %q, want %q", proto, test.wantProto)
	}

	i := 0
	got := string(toServer)
	if got != test.wantData[i] {
		t.Errorf("Invalid response, got %q, want %q", got, test.wantData[i])
	}

	if proto == "PLAIN" {
		return
	}

	for _, challenge := range test.challenges {
		i++
		if i >= len(test.wantData) {
			t.Fatalf("unexpected challenge: %q", challenge)
		}

		toServer, err = auth.Next([]byte(challenge), true)
		if err != nil {
			t.Fatalf("plainAuth.Auth(): %v", err)
		}
		got = string(toServer)
		if got != test.wantData[i] {
			t.Errorf("Invalid response, got %q, want %q", got, test.wantData[i])
		}
	}
}
