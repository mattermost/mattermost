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
	dm1, err := p.API.GetDirectChannel("{{.BasicUser.Id}}", "{{.BasicUser2.Id}}")
	if err != nil {
		return nil, err.Error()
	}
	if isEmpty(dm1) {
		return nil, "dm1 is empty"
	}

	dm2, err := p.API.GetDirectChannel("{{.BasicUser.Id}}", "{{.BasicUser.Id}}")
	if err != nil {
		return nil, err.Error()
	}
	if isEmpty(dm2) {
		return nil, "dm2 is empty"
	}

	dm3, err := p.API.GetDirectChannel("{{.BasicUser.Id}}", model.NewId())
	if err == nil {
		return nil, "Expected to get error while fetching incorrect channel"
	}
	if !isEmpty(dm3) {
		return nil, "dm3 is NOT empty"
	}
	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
