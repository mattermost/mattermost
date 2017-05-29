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

type authTest struct {
	auths      []string
	challenges []string
	tls        bool
	wantData   []string
	wantError  bool
}

func TestNoAdvertisement(t *testing.T) {
	testLoginAuth(t, &authTest{
		auths:     []string{},
		tls:       false,
		wantError: true,
	})
}

func TestNoAdvertisementTLS(t *testing.T) {
	testLoginAuth(t, &authTest{
		auths:      []string{},
		challenges: []string{"Username:", "Password:"},
		tls:        true,
		wantData:   []string{"", testUser, testPwd},
	})
}

func TestLogin(t *testing.T) {
	testLoginAuth(t, &authTest{
		auths:      []string{"PLAIN", "LOGIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        false,
		wantData:   []string{"", testUser, testPwd},
	})
}

func TestLoginTLS(t *testing.T) {
	testLoginAuth(t, &authTest{
		auths:      []string{"LOGIN"},
		challenges: []string{"Username:", "Password:"},
		tls:        true,
		wantData:   []string{"", testUser, testPwd},
	})
}

func testLoginAuth(t *testing.T, test *authTest) {
	auth := &loginAuth{
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
		t.Fatalf("loginAuth.Start(): %v", err)
	}
	if err != nil && test.wantError {
		return
	}
	if proto != "LOGIN" {
		t.Errorf("invalid protocol, got %q, want LOGIN", proto)
	}

	i := 0
	got := string(toServer)
	if got != test.wantData[i] {
		t.Errorf("Invalid response, got %q, want %q", got, test.wantData[i])
	}

	for _, challenge := range test.challenges {
		i++
		if i >= len(test.wantData) {
			t.Fatalf("unexpected challenge: %q", challenge)
		}

		toServer, err = auth.Next([]byte(challenge), true)
		if err != nil {
			t.Fatalf("loginAuth.Auth(): %v", err)
		}
		got = string(toServer)
		if got != test.wantData[i] {
			t.Errorf("Invalid response, got %q, want %q", got, test.wantData[i])
		}
	}
}
