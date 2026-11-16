// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
)

func TestWriteMarker(t *testing.T) {
	id := model.NewId()

	t.Run("no marker is a standard write", func(t *testing.T) {
		m := WriteMarkerFromContext(request.TestContext(t))
		assert.Equal(t, WriteMarker{}, m)
		assert.Equal(t, WriteStandard, m.Kind)
	})

	t.Run("a marker round-trips for every kind", func(t *testing.T) {
		for _, kind := range []WriteKind{WriteStandard, WriteCreate, WriteFillMissing} {
			want := WriteMarker{Kind: kind, ObjectID: id}
			got := WriteMarkerFromContext(WithWriteMarker(request.TestContext(t), want))
			assert.Equal(t, want, got)
		}
	})

	t.Run("marking leaves the original context unmarked", func(t *testing.T) {
		rctx := request.TestContext(t)
		WithWriteMarker(rctx, WriteMarker{Kind: WriteCreate, ObjectID: id})
		assert.Equal(t, WriteMarker{}, WriteMarkerFromContext(rctx))
	})

	t.Run("re-marking returns the new marker and leaves the first alone", func(t *testing.T) {
		first := WriteMarker{Kind: WriteCreate, ObjectID: id}
		second := WriteMarker{Kind: WriteFillMissing, ObjectID: model.NewId()}

		a := WithWriteMarker(request.TestContext(t), first)
		b := WithWriteMarker(a, second)

		assert.Equal(t, first, WriteMarkerFromContext(a))
		assert.Equal(t, second, WriteMarkerFromContext(b))
	})

	t.Run("a nil context has no marker", func(t *testing.T) {
		assert.NotPanics(t, func() {
			assert.Equal(t, WriteMarker{}, WriteMarkerFromContext(nil))
		})
	})
}
