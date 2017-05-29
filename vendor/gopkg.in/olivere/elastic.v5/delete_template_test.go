// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestDeleteTemplateValidate(t *testing.T) {
	client := setupTestClient(t)

	// No template id -> fail with error
	res, err := NewDeleteTemplateService(client).Do(context.TODO())
	if err == nil {
		t.Fatalf("expected Delete to fail without index name")
	}
	if res != nil {
		t.Fatalf("expected result to be == nil; got: %v", res)
	}
}
