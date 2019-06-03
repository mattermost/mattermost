// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"reflect"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func isEmpty(object interface{}) bool {

	// get nil case out of the way
	if object == nil {
		return true
	}

	objValue := reflect.ValueOf(object)

	switch objValue.Kind() {
	// collection types are empty when they have no element
	case reflect.Array, reflect.Chan, reflect.Map, reflect.Slice:
		return objValue.Len() == 0
	// pointers are empty if nil or if the value they point to is empty
	case reflect.Ptr:
		if objValue.IsNil() {
			return true
		}
		deref := objValue.Elem().Interface()
		return isEmpty(deref)
	// for all other types, compare against the zero value
	default:
		zero := reflect.Zero(objValue.Type())
		return reflect.DeepEqual(object, zero.Interface())
	}
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {

	// check existing user first
	data, err := p.API.GetProfileImage("{{.BasicUser.Id}}")
	if err != nil {
		return nil, err.Error()
	}
	if isEmpty(data) {
		return nil, "GetProfileImage return empty"
	}

	// then unknown user
	data, err = p.API.GetProfileImage(model.NewId())
	if err == nil || data != nil {
		return nil, "GetProfileImage should've returned an error"
	}
	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
