// Copyright (c) 2016 NAVER Corp. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestGcmJson(t *testing.T) {
	gcm := WebpushEndpoint{
		Id:       NewId(),
		CreateAt: GetMillis(),
		UserId:   NewId(),
		Endpoint: "http://example.org/endpoint"}
	json := gcm.ToJson()
	rgcm := WebpushEndpointFromJson(strings.NewReader(json))

	if gcm.Id != rgcm.Id {
		t.Fatal("Ids do not match")
	}
}
