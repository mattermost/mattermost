// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPluginKeyIsValid(t *testing.T) {
	kv := PluginKeyValue{PluginId: "someid", Key: "somekey", Value: "somevalue"}
	assert.Nil(t, kv.IsValid())

	kv.PluginId = ""
	assert.NotNil(t, kv.IsValid())

	kv.PluginId = "someid"
	kv.Key = ""
	assert.NotNil(t, kv.IsValid())
}

func TestPluginStoreValue(t *testing.T) {
	p := NewPluginStoreValue("string")
	assert.Equal(t, p.Value, "\"string\"")

	res1, err := p.String()
	assert.Nil(t, err)
	assert.Equal(t, res1, "string")

	p = &PluginStoreValue{"123"}
	res2, err := p.Int64()
	assert.Nil(t, err)
	assert.Equal(t, res2, int64(123))
	res3, err := p.Uint64()
	assert.Nil(t, err)
	assert.Equal(t, res3, uint64(123))
	res4, err := p.Float64()
	assert.Nil(t, err)
	assert.Equal(t, res4, float64(123))

	p = &PluginStoreValue{"notanumber"}
	_, err = p.Int64()
	assert.NotNil(t, err)
	_, err = p.Uint64()
	assert.NotNil(t, err)
	_, err = p.Float64()
	assert.NotNil(t, err)

	p = &PluginStoreValue{"true"}
	res5, err := p.Bool()
	assert.Nil(t, err)
	assert.True(t, res5)
	p = &PluginStoreValue{"notabool"}
	_, err = p.Bool()
	assert.NotNil(t, err)

	p = &PluginStoreValue{"somebytes"}
	res6, err := p.Bytes()
	assert.Nil(t, err)
	assert.Equal(t, res6, []byte("somebytes"))

	post := &Post{Id: NewId(), UserId: NewId(), Message: "somemessage"}
	var rpost *Post
	p = &PluginStoreValue{post.ToJson()}
	err = p.Scan(&rpost)
	assert.Nil(t, err)
	assert.NotNil(t, rpost)
	assert.Equal(t, post.Id, rpost.Id)
}
