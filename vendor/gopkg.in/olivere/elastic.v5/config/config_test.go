// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package config

import "testing"

func TestParse(t *testing.T) {
	urls := "http://user:pwd@elastic:19220/store-blobs?shards=5&replicas=2&sniff=true&errorlog=elastic.error.log&infolog=elastic.info.log&tracelog=elastic.trace.log"
	cfg, err := Parse(urls)
	if err != nil {
		t.Fatal(err)
	}
	if want, got := "http://elastic:19220", cfg.URL; want != got {
		t.Fatalf("expected URL = %q, got %q", want, got)
	}
	if want, got := "store-blobs", cfg.Index; want != got {
		t.Fatalf("expected Index = %q, got %q", want, got)
	}
	if want, got := "user", cfg.Username; want != got {
		t.Fatalf("expected Username = %q, got %q", want, got)
	}
	if want, got := "pwd", cfg.Password; want != got {
		t.Fatalf("expected Password = %q, got %q", want, got)
	}
	if want, got := 5, cfg.Shards; want != got {
		t.Fatalf("expected Shards = %v, got %v", want, got)
	}
	if want, got := 2, cfg.Replicas; want != got {
		t.Fatalf("expected Replicas = %v, got %v", want, got)
	}
	if want, got := true, *cfg.Sniff; want != got {
		t.Fatalf("expected Sniff = %v, got %v", want, got)
	}
	if want, got := "elastic.error.log", cfg.Errorlog; want != got {
		t.Fatalf("expected Errorlog = %q, got %q", want, got)
	}
	if want, got := "elastic.info.log", cfg.Infolog; want != got {
		t.Fatalf("expected Infolog = %q, got %q", want, got)
	}
	if want, got := "elastic.trace.log", cfg.Tracelog; want != got {
		t.Fatalf("expected Tracelog = %q, got %q", want, got)
	}
}
