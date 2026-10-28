// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestSameSearchEngineConnection(t *testing.T) {
	saved := model.ElasticsearchSettings{}
	saved.SetDefaults()
	saved.Password = new("secret")

	tests := map[string]struct {
		change func(s *model.ElasticsearchSettings)
		want   bool
	}{
		"identical":         {change: func(s *model.ElasticsearchSettings) {}, want: true},
		"unrelated setting": {change: func(s *model.ElasticsearchSettings) { s.EnableSearching = new(true) }, want: true},
		"backend": {change: func(s *model.ElasticsearchSettings) {
			s.Backend = new(model.ElasticsearchSettingsOSBackend)
		}},
		"connection URL": {change: func(s *model.ElasticsearchSettings) { s.ConnectionURL = new("http://other:9200") }},
		"username":       {change: func(s *model.ElasticsearchSettings) { s.Username = new("other") }},
		"password":       {change: func(s *model.ElasticsearchSettings) { s.Password = new("other") }},
		"sniff":          {change: func(s *model.ElasticsearchSettings) { s.Sniff = new(!*s.Sniff) }},
		"skip TLS verification": {change: func(s *model.ElasticsearchSettings) {
			s.SkipTLSVerification = new(!*s.SkipTLSVerification)
		}},
		"CA":                 {change: func(s *model.ElasticsearchSettings) { s.CA = new("ca.pem") }},
		"client certificate": {change: func(s *model.ElasticsearchSettings) { s.ClientCert = new("cert.pem") }},
		"client key":         {change: func(s *model.ElasticsearchSettings) { s.ClientKey = new("key.pem") }},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			candidate := saved
			tc.change(&candidate)
			assert.Equal(t, tc.want, sameSearchEngineConnection(candidate, saved))
		})
	}
}
