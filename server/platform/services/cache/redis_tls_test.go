// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

type testCert struct {
	cert     *x509.Certificate
	key      *ecdsa.PrivateKey
	certPath string
	keyPath  string
}

func newTestCert(t *testing.T, dir, name string, template *x509.Certificate, parent *testCert) *testCert {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	template.SerialNumber = big.NewInt(time.Now().UnixNano())
	template.Subject = pkix.Name{CommonName: name}
	template.NotBefore = time.Now().Add(-time.Hour)
	template.NotAfter = time.Now().Add(time.Hour)

	parentCert, parentKey := template, key
	if parent != nil {
		parentCert, parentKey = parent.cert, parent.key
	}

	der, err := x509.CreateCertificate(rand.Reader, template, parentCert, &key.PublicKey, parentKey)
	require.NoError(t, err)
	cert, err := x509.ParseCertificate(der)
	require.NoError(t, err)

	keyDER, err := x509.MarshalECPrivateKey(key)
	require.NoError(t, err)

	tc := &testCert{
		cert:     cert,
		key:      key,
		certPath: filepath.Join(dir, name+".crt"),
		keyPath:  filepath.Join(dir, name+".key"),
	}
	require.NoError(t, os.WriteFile(tc.certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600))
	require.NoError(t, os.WriteFile(tc.keyPath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0600))

	return tc
}

func newTestCA(t *testing.T, dir, name string) *testCert {
	return newTestCert(t, dir, name, &x509.Certificate{
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}, nil)
}

func newRedisTLSSettings(enable bool) *model.CacheSettings {
	settings := &model.CacheSettings{
		CacheType:      model.NewPointer(model.CacheTypeRedis),
		RedisAddress:   model.NewPointer("localhost:6379"),
		RedisEnableTLS: model.NewPointer(enable),
	}
	settings.SetDefaults()
	return settings
}

// handshake performs a TLS handshake against a server that requires a client
// certificate signed by clientCA.
func handshake(t *testing.T, server *testCert, clientCA *testCert, clientConfig *tls.Config) error {
	t.Helper()

	serverCert, err := tls.LoadX509KeyPair(server.certPath, server.keyPath)
	require.NoError(t, err)
	clientCAs := x509.NewCertPool()
	clientCAs.AddCert(clientCA.cert)

	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		ClientCAs:    clientCAs,
		ClientAuth:   tls.RequireAndVerifyClientCert,
	})
	require.NoError(t, err)
	defer ln.Close()

	go func() {
		conn, acceptErr := ln.Accept()
		if acceptErr != nil {
			return
		}
		defer conn.Close()
		_ = conn.(*tls.Conn).Handshake()
		_, _ = conn.Read(make([]byte, 1))
	}()

	_, port, err := net.SplitHostPort(ln.Addr().String())
	require.NoError(t, err)

	dialer := tls.Dialer{Config: clientConfig}
	conn, err := dialer.Dial("tcp", net.JoinHostPort("localhost", port))
	if err != nil {
		return err
	}
	defer conn.Close()

	// With TLS 1.3 the server rejects a client certificate after the client
	// considers the handshake complete, so read to surface that error.
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(time.Second)))
	_, err = conn.Read(make([]byte, 1))
	if ne, ok := err.(net.Error); ok && ne.Timeout() {
		return nil
	}
	return err
}

func TestNewRedisTLSConfig(t *testing.T) {
	dir := t.TempDir()
	ca := newTestCA(t, dir, "ca")
	otherCA := newTestCA(t, dir, "other-ca")
	server := newTestCert(t, dir, "server", &x509.Certificate{
		DNSNames:    []string{"localhost"},
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}, ca)
	client := newTestCert(t, dir, "client", &x509.Certificate{
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}, ca)

	t.Run("disabled", func(t *testing.T) {
		settings := newRedisTLSSettings(false)
		settings.RedisTLSCA = model.NewPointer(ca.certPath)

		tlsConfig, err := NewRedisTLSConfig(settings)
		require.NoError(t, err)
		assert.Nil(t, tlsConfig)
	})

	t.Run("enabled with system roots", func(t *testing.T) {
		tlsConfig, err := NewRedisTLSConfig(newRedisTLSSettings(true))
		require.NoError(t, err)
		require.NotNil(t, tlsConfig)
		assert.Nil(t, tlsConfig.RootCAs)
		assert.Empty(t, tlsConfig.Certificates)
		assert.False(t, tlsConfig.InsecureSkipVerify)
		assert.Equal(t, uint16(tls.VersionTLS12), tlsConfig.MinVersion)
	})

	t.Run("skip verify", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSSkipVerify = model.NewPointer(true)

		tlsConfig, err := NewRedisTLSConfig(settings)
		require.NoError(t, err)
		assert.True(t, tlsConfig.InsecureSkipVerify)
	})

	t.Run("mutual TLS handshake succeeds", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSCA = model.NewPointer(ca.certPath)
		settings.RedisTLSClientCert = model.NewPointer(client.certPath)
		settings.RedisTLSClientKey = model.NewPointer(client.keyPath)

		tlsConfig, err := NewRedisTLSConfig(settings)
		require.NoError(t, err)
		assert.NoError(t, handshake(t, server, ca, tlsConfig))
	})

	t.Run("handshake fails with untrusted server CA", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSCA = model.NewPointer(otherCA.certPath)
		settings.RedisTLSClientCert = model.NewPointer(client.certPath)
		settings.RedisTLSClientKey = model.NewPointer(client.keyPath)

		tlsConfig, err := NewRedisTLSConfig(settings)
		require.NoError(t, err)
		var verifyErr *tls.CertificateVerificationError
		assert.ErrorAs(t, handshake(t, server, ca, tlsConfig), &verifyErr)
	})

	t.Run("handshake fails without client certificate", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSCA = model.NewPointer(ca.certPath)

		tlsConfig, err := NewRedisTLSConfig(settings)
		require.NoError(t, err)
		assert.Error(t, handshake(t, server, ca, tlsConfig))
	})

	t.Run("missing CA file", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSCA = model.NewPointer(filepath.Join(dir, "missing.crt"))

		_, err := NewRedisTLSConfig(settings)
		assert.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("CA file without certificates", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSCA = model.NewPointer(client.keyPath)

		_, err := NewRedisTLSConfig(settings)
		assert.ErrorContains(t, err, "no PEM certificates found")
	})

	t.Run("mismatched client certificate and key", func(t *testing.T) {
		settings := newRedisTLSSettings(true)
		settings.RedisTLSClientCert = model.NewPointer(client.certPath)
		settings.RedisTLSClientKey = model.NewPointer(server.keyPath)

		_, err := NewRedisTLSConfig(settings)
		assert.ErrorContains(t, err, "failed to load Redis client certificate")
	})
}
