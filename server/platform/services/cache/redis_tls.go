// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cache

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"

	"github.com/mattermost/mattermost/server/public/model"
)

// NewRedisTLSConfig builds the TLS configuration for connecting to Redis from the given settings.
// It returns nil when TLS is disabled.
func NewRedisTLSConfig(settings *model.CacheSettings) (*tls.Config, error) {
	if !*settings.RedisEnableTLS {
		return nil, nil
	}

	tlsConfig := &tls.Config{
		MinVersion:         tls.VersionTLS12,
		InsecureSkipVerify: *settings.RedisTLSSkipVerify,
	}

	if *settings.RedisTLSCA != "" {
		caPEM, err := os.ReadFile(*settings.RedisTLSCA)
		if err != nil {
			return nil, fmt.Errorf("failed to read Redis CA file: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(caPEM) {
			return nil, errors.New("failed to parse Redis CA file: no PEM certificates found")
		}
		tlsConfig.RootCAs = pool
	}

	if *settings.RedisTLSClientCert != "" || *settings.RedisTLSClientKey != "" {
		cert, err := tls.LoadX509KeyPair(*settings.RedisTLSClientCert, *settings.RedisTLSClientKey)
		if err != nil {
			return nil, fmt.Errorf("failed to load Redis client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	return tlsConfig, nil
}
