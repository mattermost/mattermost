package gomail

import (
	"bytes"
	"errors"
	"fmt"
	"net/smtp"
)

// plainAuth is an smtp.Auth that implements the PLAIN authentication mechanism.
// It fallbacks to the LOGIN mechanism if it is the only mechanism advertised
// by the server.
type plainAuth struct {
	username string
	password string
	host     string
	login    bool
}

func (a *plainAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	if server.Name != a.host {
		return "", nil, errors.New("gomail: wrong host name")
	}

	var plain, login bool
	for _, a := range server.Auth {
		switch a {
		case "PLAIN":
			plain = true
		case "LOGIN":
			login = true
		}
	}

	if !server.TLS && !plain && !login {
		return "", nil, errors.New("gomail: unencrypted connection")
	}

	if !plain && login {
		a.login = true
		return "LOGIN", nil, nil
	}

	return "PLAIN", []byte("\x00" + a.username + "\x00" + a.password), nil
}

func (a *plainAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !a.login {
		if more {
			return nil, errors.New("gomail: unexpected server challenge")
		}
		return nil, nil
	}

	if !more {
		return nil, nil
	}

	switch {
	case bytes.Equal(fromServer, []byte("Username:")):
		return []byte(a.username), nil
	case bytes.Equal(fromServer, []byte("Password:")):
		return []byte(a.password), nil
	default:
		return nil, fmt.Errorf("gomail: unexpected server challenge: %s", fromServer)
	}
}
