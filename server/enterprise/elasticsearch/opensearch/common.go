// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"crypto/tls"
	"net/http"
	"time"

	"github.com/opensearch-project/opensearch-go/v4"
	"github.com/opensearch-project/opensearch-go/v4/opensearchapi"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch/common"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

func createClient(logger mlog.LoggerIFace, cfg *model.Config, fileBackend filestore.FileBackend, debugLogging bool) (*opensearchapi.Client, *model.AppError) {
	esCfg, appErr := createClientConfig(logger, cfg, fileBackend, debugLogging)
	if appErr != nil {
		return nil, appErr
	}

	client, err := opensearchapi.NewClient(*esCfg)
	if err != nil {
		return nil, model.NewAppError("Opensearch.createClient", "ent.elasticsearch.create_client.connect_failed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	return client, nil
}

func createClientConfig(logger mlog.LoggerIFace, cfg *model.Config, fileBackend filestore.FileBackend, debugLogging bool) (*opensearchapi.Config, *model.AppError) {
	tp := http.DefaultTransport.(*http.Transport).Clone()
	tp.TLSClientConfig = &tls.Config{
		InsecureSkipVerify: *cfg.ElasticsearchSettings.SkipTLSVerification,
	}

	osCfg := &opensearchapi.Config{
		Client: opensearch.Config{
			Addresses:            []string{*cfg.ElasticsearchSettings.ConnectionURL},
			RetryBackoff:         func(i int) time.Duration { return time.Duration(i) * 100 * time.Millisecond }, // A minimal backoff function
			RetryOnStatus:        []int{502, 503, 504, 429},                                                      // Retry on 429 TooManyRequests statuses
			MaxRetries:           3,
			DiscoverNodesOnStart: *cfg.ElasticsearchSettings.Sniff,
		},
	}

	if osCfg.Client.DiscoverNodesOnStart {
		osCfg.Client.DiscoverNodesInterval = 30 * time.Second
	}

	if *cfg.ElasticsearchSettings.ClientCert != "" {
		appErr := configureClientCertificate(tp.TLSClientConfig, cfg, fileBackend)
		if appErr != nil {
			return nil, appErr
		}
	}

	// custom CA
	if *cfg.ElasticsearchSettings.CA != "" {
		appErr := configureCA(&osCfg.Client, cfg, fileBackend)
		if appErr != nil {
			return nil, appErr
		}
	}

	osCfg.Client.Transport = tp

	if *cfg.ElasticsearchSettings.Username != "" {
		osCfg.Client.Username = *cfg.ElasticsearchSettings.Username
		osCfg.Client.Password = *cfg.ElasticsearchSettings.Password
	}

	// This is a compatibility mode from previous config settings.
	// We have to conditionally enable debug logging due to
	// https://github.com/elastic/elastic-transport-go/issues/22
	// Although, this is opensearch, the issue is the same.
	if *cfg.ElasticsearchSettings.Trace == "all" && debugLogging {
		osCfg.Client.EnableDebugLogger = true
	}

	osCfg.Client.Logger = common.NewLogger("Opensearch", logger, *cfg.ElasticsearchSettings.Trace == "all")

	return osCfg, nil
}

func configureCA(esCfg *opensearch.Config, cfg *model.Config, fb filestore.FileBackend) *model.AppError {
	// read the certificate authority (CA) file
	clientCA, err := common.ReadFileSafely(fb, *cfg.ElasticsearchSettings.CA)
	if err != nil {
		return model.NewAppError("Opensearch.createClient", "ent.elasticsearch.create_client.ca_cert_missing", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	esCfg.CACert = clientCA

	return nil
}

func configureClientCertificate(tlsConfig *tls.Config, cfg *model.Config, fb filestore.FileBackend) *model.AppError {
	// read the client certificate file
	clientCert, err := common.ReadFileSafely(fb, *cfg.ElasticsearchSettings.ClientCert)
	if err != nil {
		return model.NewAppError("Opensearch.createClient", "ent.elasticsearch.create_client.client_cert_missing", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// read the client key file
	clientKey, err := common.ReadFileSafely(fb, *cfg.ElasticsearchSettings.ClientKey)
	if err != nil {
		return model.NewAppError("Opensearch.createClient", "ent.elasticsearch.create_client.client_key_missing", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// load the client key and certificate
	certificate, err := tls.X509KeyPair(clientCert, clientKey)
	if err != nil {
		return model.NewAppError("Opensearch.createClient", "ent.elasticsearch.create_client.client_cert_malformed", map[string]any{"Backend": model.ElasticsearchSettingsOSBackend}, "", http.StatusInternalServerError).Wrap(err)
	}

	// update the TLS config
	tlsConfig.Certificates = []tls.Certificate{certificate}

	return nil
}
