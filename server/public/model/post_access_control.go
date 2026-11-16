// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"strings"
)

// PostAccessControlResource is the parsed form of props.access_control_resource:
// the plugin-owned policy the post is governed by and the action a reader
// must be allowed. PolicyType is the full "<pluginID>:<resourceType>" key the
// policy was saved under.
type PostAccessControlResource struct {
	PluginID     string
	ResourceType string
	PolicyType   string
	ResourceID   string
	Action       string
}

// String renders the prop value back.
func (r PostAccessControlResource) String() string {
	return r.PolicyType + PluginAccessControlPolicyTypeSeparator + r.ResourceID + PluginAccessControlPolicyTypeSeparator + r.Action
}

// NewPostAccessControlResource builds the prop value for a plugin-owned
// resource. It does not validate; see ParsePostAccessControlResource.
func NewPostAccessControlResource(pluginID, resourceType, resourceID, action string) string {
	return pluginID + PluginAccessControlPolicyTypeSeparator + resourceType + PluginAccessControlPolicyTypeSeparator + resourceID + PluginAccessControlPolicyTypeSeparator + action
}

// ParsePostAccessControlResource parses "<pluginID>:<resourceType>:<resourceID>:<action>".
// Plugin IDs cannot contain the separator, resource types and actions are
// single identifiers, and the resource ID is a Mattermost ID, so the split is
// unambiguous.
func ParsePostAccessControlResource(value string) (*PostAccessControlResource, error) {
	parts := strings.Split(value, PluginAccessControlPolicyTypeSeparator)
	if len(parts) != 4 {
		return nil, errors.New("access_control_resource must be <pluginID>:<resourceType>:<resourceID>:<action>")
	}
	policyType := parts[0] + PluginAccessControlPolicyTypeSeparator + parts[1]
	pluginID, resourceType, ok := SplitPluginAccessControlPolicyType(policyType)
	if !ok {
		return nil, errors.New("access_control_resource has an invalid plugin resource type")
	}
	if !IsValidId(parts[2]) {
		return nil, errors.New("access_control_resource has an invalid resource ID")
	}
	if !IsValidPolicyAction(parts[3]) {
		return nil, errors.New("access_control_resource has an invalid action")
	}
	return &PostAccessControlResource{
		PluginID:     pluginID,
		ResourceType: resourceType,
		PolicyType:   policyType,
		ResourceID:   parts[2],
		Action:       parts[3],
	}, nil
}

// GetAccessControlResource returns props.access_control_resource, or "" when
// the post carries none or the value is not a string.
func (o *Post) GetAccessControlResource() string {
	if o == nil {
		return ""
	}
	value, _ := o.GetProp(PostPropsAccessControlResource).(string)
	return value
}
