// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"errors"
	"net/http"
	"sync/atomic"
	"testing"
	"time"
)

type testRetrier struct {
	Retrier
	N   int64
	Err error
}

func (r *testRetrier) Retry(ctx context.Context, retry int, req *http.Request, resp *http.Response, err error) (time.Duration, bool, error) {
	atomic.AddInt64(&r.N, 1)
	if r.Err != nil {
		return 0, false, r.Err
	}
	return r.Retrier.Retry(ctx, retry, req, resp, err)
}

func TestStopRetrier(t *testing.T) {
	r := NewStopRetrier()
	wait, ok, err := r.Retry(context.TODO(), 1, nil, nil, nil)
	if want, got := 0*time.Second, wait; want != got {
		t.Fatalf("expected %v, got %v", want, got)
	}
	if want, got := false, ok; want != got {
		t.Fatalf("expected %v, got %v", want, got)
	}
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestRetrier(t *testing.T) {
	var numFailedReqs int
	fail := func(r *http.Request) (*http.Response, error) {
		numFailedReqs += 1
		//return &http.Response{Request: r, StatusCode: 400}, nil
		return nil, errors.New("request failed")
	}

	tr := &failingTransport{path: "/fail", fail: fail}
	httpClient := &http.Client{Transport: tr}

	retrier := &testRetrier{
		Retrier: NewBackoffRetrier(NewSimpleBackoff(100, 100, 100, 100, 100)),
	}

	client, err := NewClient(
		SetHttpClient(httpClient),
		SetMaxRetries(5),
		SetHealthcheck(false),
		SetRetrier(retrier))
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.PerformRequest(context.TODO(), PerformRequestOptions{
		Method: "GET",
		Path:   "/fail",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if res != nil {
		t.Fatal("expected no response")
	}
	// Connection should be marked as dead after it failed
	if numFailedReqs != 5 {
		t.Errorf("expected %d failed requests; got: %d", 5, numFailedReqs)
	}
	if retrier.N != 5 {
		t.Errorf("expected %d Retrier calls; got: %d", 5, retrier.N)
	}
}

func TestRetrierWithError(t *testing.T) {
	var numFailedReqs int
	fail := func(r *http.Request) (*http.Response, error) {
		numFailedReqs += 1
		//return &http.Response{Request: r, StatusCode: 400}, nil
		return nil, errors.New("request failed")
	}

	tr := &failingTransport{path: "/fail", fail: fail}
	httpClient := &http.Client{Transport: tr}

	kaboom := errors.New("kaboom")
	retrier := &testRetrier{
		Err:     kaboom,
		Retrier: NewBackoffRetrier(NewSimpleBackoff(100, 100, 100, 100, 100)),
	}

	client, err := NewClient(
		SetHttpClient(httpClient),
		SetMaxRetries(5),
		SetHealthcheck(false),
		SetRetrier(retrier))
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.PerformRequest(context.TODO(), PerformRequestOptions{
		Method: "GET",
		Path:   "/fail",
	})
	if err != kaboom {
		t.Fatalf("expected %v, got %v", kaboom, err)
	}
	if res != nil {
		t.Fatal("expected no response")
	}
	if numFailedReqs != 1 {
		t.Errorf("expected %d failed requests; got: %d", 1, numFailedReqs)
	}
	if retrier.N != 1 {
		t.Errorf("expected %d Retrier calls; got: %d", 1, retrier.N)
	}
}

func TestRetrierOnPerformRequest(t *testing.T) {
	var numFailedReqs int
	fail := func(r *http.Request) (*http.Response, error) {
		numFailedReqs += 1
		//return &http.Response{Request: r, StatusCode: 400}, nil
		return nil, errors.New("request failed")
	}

	tr := &failingTransport{path: "/fail", fail: fail}
	httpClient := &http.Client{Transport: tr}

	defaultRetrier := &testRetrier{
		Retrier: NewStopRetrier(),
	}
	requestRetrier := &testRetrier{
		Retrier: NewStopRetrier(),
	}

	client, err := NewClient(
		SetHttpClient(httpClient),
		SetHealthcheck(false),
		SetRetrier(defaultRetrier))
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.PerformRequest(context.TODO(), PerformRequestOptions{
		Method:  "GET",
		Path:    "/fail",
		Retrier: requestRetrier,
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if res != nil {
		t.Fatal("expected no response")
	}
	if want, have := int64(0), defaultRetrier.N; want != have {
		t.Errorf("defaultRetrier: expected %d calls; got: %d", want, have)
	}
	if want, have := int64(1), requestRetrier.N; want != have {
		t.Errorf("requestRetrier: expected %d calls; got: %d", want, have)
	}
}
