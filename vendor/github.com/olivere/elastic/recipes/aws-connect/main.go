// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

// Connect simply connects to Elasticsearch Service on AWS.
//
// Example
//
//     aws-connect -url=https://search-xxxxx-yyyyy.eu-central-1.es.amazonaws.com
//
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/olivere/env"
	"github.com/smartystreets/go-aws-auth"

	"github.com/olivere/elastic"
)

type AWSSigningTransport struct {
	HTTPClient  *http.Client
	Credentials awsauth.Credentials
}

// RoundTrip implementation
func (a AWSSigningTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return a.HTTPClient.Do(awsauth.Sign4(req, a.Credentials))
}

func main() {
	var (
		accessKey = flag.String("access-key", env.String("", "AWS_ACCESS_KEY"), "Access Key ID")
		secretKey = flag.String("secret-key", env.String("", "AWS_SECRET_KEY"), "Secret access key")
		url       = flag.String("url", "http://localhost:9200", "Elasticsearch URL")
		sniff     = flag.Bool("sniff", false, "Enable or disable sniffing")
	)
	flag.Parse()
	log.SetFlags(0)

	if *url == "" {
		*url = "http://127.0.0.1:9200"
	}
	if *accessKey == "" {
		log.Fatal("missing -access-key or AWS_ACCESS_KEY environment variable")
	}
	if *secretKey == "" {
		log.Fatal("missing -secret-key or AWS_SECRET_KEY environment variable")
	}

	signingTransport := AWSSigningTransport{
		Credentials: awsauth.Credentials{
			AccessKeyID:     *accessKey,
			SecretAccessKey: *secretKey,
		},
		HTTPClient: http.DefaultClient,
	}
	signingClient := &http.Client{Transport: http.RoundTripper(signingTransport)}

	// Create an Elasticsearch client
	client, err := elastic.NewClient(
		elastic.SetURL(*url),
		elastic.SetSniff(*sniff),
		elastic.SetHttpClient(signingClient),
	)
	if err != nil {
		log.Fatal(err)
	}
	_ = client

	// Just a status message
	fmt.Println("Connection succeeded")
}
