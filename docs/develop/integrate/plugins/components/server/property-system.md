---
title: "Store custom data with the property system"
sidebar_position: 20
---

The property system lets a plugin attach typed data to Mattermost objects without managing its own database tables. A plugin can define a "status" for posts, a "region" for channels, or any other attribute, and store a value for each object. Mattermost uses the same system for user attributes, channel attributes and the other attributes that [attribute-based access control](/administration-guide/manage/admin/attribute-based-access-control) policies read.

This page explains the concepts and walks through the server plugin API. For the method reference, see the [server plugin SDK reference](/developers/integrate/reference/server#API.CreatePropertyField).

## Concepts

### Groups

A **group** is a namespace for fields. Every field and value belongs to exactly one group, and most plugin API methods take the group's ID.

New attributes should use one of Mattermost's built-in groups, such as `access_control`. Get a built-in group with `GetPropertyGroup`.

The built-in `access_control` group (`model.AccessControlPropertyGroupName`) holds user attributes, Global Attribute templates and channel attributes, and it's the only group that access control policies read. A field that access control decisions depend on, such as an attribute used in an [attribute-based access control](/administration-guide/manage/admin/attribute-based-access-control) policy, must be in the `access_control` group. Working with it needs a Mattermost Entry, Enterprise or Enterprise Advanced license. The old name `custom_profile_attributes` is refused by both `RegisterPropertyGroup` and `GetPropertyGroup`.

#### Custom groups (deprecated)

Custom groups are deprecated. They're part of version 1 of the property system, so don't create one for new fields. Existing custom groups keep working.

A plugin creates a custom group with `RegisterPropertyGroup`. Calling it again with the same name returns the existing group. Group names may contain only lowercase letters, digits and underscores, and must start with a letter or digit.

Custom groups are version 1 groups, which limits what they can do:

- **No REST access.** The REST API's `/api/v4/properties/groups/...` routes serve only version 2 groups. A plugin's web app reads and writes its data through the plugin's own HTTP endpoints (`ServeHTTP`), not through the core REST API.
- **No object type.** Fields in a version 1 group must leave `ObjectType` empty. A field with an `ObjectType` is refused.
- **Options live on the field.** A field's options are read and written as part of the field, in `Attrs["options"]`. The option methods, such as `GetPropertyFieldOptions`, refuse fields in a version 1 group.
- **No field events.** Changes to fields in a version 1 group don't send the property field websocket events. See [React to changes](#react-to-changes).
- **Values aren't checked against the field.** Mattermost stores any JSON value. The plugin decides what a valid value is.
- **No access control.** Policies can't use fields in a custom group.

### Fields

A **field** defines an attribute: its name, its type, and for some types the options a value can choose from. `Name` and `Type` are required. The types are:

| Type | Constant | Holds |
|---|---|---|
| `text` | `model.PropertyFieldTypeText` | Free text |
| `select` | `model.PropertyFieldTypeSelect` | One option |
| `multiselect` | `model.PropertyFieldTypeMultiselect` | Several options |
| `date` | `model.PropertyFieldTypeDate` | A date |
| `user` | `model.PropertyFieldTypeUser` | One user |
| `multiuser` | `model.PropertyFieldTypeMultiuser` | Several users |
| `rank` | `model.PropertyFieldTypeRank` | One option, where the options have an order |
| `graph` | `model.PropertyFieldTypeGraph` | Several options, where the options form a hierarchy |

Field names in a version 1 group are unique within the group and target ID, so `GetPropertyFieldByName` finds a field your plugin created earlier. Deleting a field is a soft delete.

### Values

A **value** is one object's data for one field. A `model.PropertyValue` names the field (`FieldID`), the group (`GroupID`), and the object the value belongs to (`TargetType` and `TargetID`). An object holds at most one value per field, which is why `UpsertPropertyValue` can create or replace it.

`Value` is raw JSON. Mattermost's own convention, which it enforces in the `access_control` group, is:

| Field type | Value |
|---|---|
| `text` | A string |
| `select`, `rank` | An option ID |
| `multiselect`, `graph` | An array of option IDs |
| `user` | A user ID |
| `multiuser` | An array of user IDs |

Following the same convention in your own group keeps your data easy to read for anyone who knows the property system.

### Object type and target type

In a version 2 group such as `access_control`, a field has two separate settings:

- **`ObjectType`** says what kind of object the field's values belong to, such as `user` or `channel`. The special object type `template` marks a template (see the next section).
- **`TargetType`** and **`TargetID`** say where the field is defined: `system` (with an empty `TargetID`), or a specific `team` or `channel` (with its ID as `TargetID`).

So a system-wide user attribute has `ObjectType: "user"` and `TargetType: "system"`, and each user's value has `TargetType: "user"` and the user's ID as `TargetID`.

In your own version 1 group there's no object type. A field's `TargetType` and `TargetID` are free for your plugin to use; leave them empty for a field that applies everywhere. A value's `TargetType` is required, and its `TargetID` must be a Mattermost ID.

### Templates and linked fields

In the `access_control` group, a template is a field with object type `template` that owns a type and a list of options. A user attribute or channel attribute links to a template through `LinkedFieldID` and inherits its type and options. The attributes an admin creates on the **Attribute Management** page are templates with linked user and channel attributes. See [Attribute Management](/administration-guide/manage/admin/attribute-management) for how admins use them.

The rules for linked fields:

- A linked field's type and options can't be changed. Change the template instead.
- Set `LinkedFieldID` to an empty string to unlink a field.
- A template can't be deleted while fields still link to it.

### Options and hierarchies

`select`, `multiselect`, `rank` and `graph` fields have options. Each option has an `id`, a `name` and an optional `color`. When you create a field, list its options in `Attrs["options"]`; Mattermost assigns an ID to every option that doesn't have one.

In a `graph` field, each option can name the options directly above it in `parents`, by name. A hierarchical attribute such as an organization chart is a `graph` field. An option can have up to 100 parents, a hierarchy can be up to 100 levels deep, and a `graph` field can hold up to 100,000 options. A field can't be converted to or from `graph`. To learn how access rules use hierarchies, see [Hierarchical attributes](/administration-guide/manage/admin/abac-policy-expressions#hierarchical-attributes).

A field read lists at most 1,000 options in `Attrs["options"]`. A field with more has `Attrs["options_omitted"]` set to `true` and the number of options in `Attrs["options_count"]`. From Mattermost v12.0, read the options of such a field one page at a time with `GetPropertyFieldOptions`, and change them with `CreatePropertyFieldOptions`, `UpdatePropertyFieldOptions` and `DeletePropertyFieldOptions`. These methods work only on fields in version 2 groups such as `access_control`.

## Use the plugin API

The examples call `p.API` directly. If your plugin uses the [`pluginapi`](https://pkg.go.dev/github.com/mattermost/mattermost/server/public/pluginapi) client, `client.Property` has the same methods with the same signatures.

The basic property methods need Mattermost v10.10 or later; the search and count methods need v11.0, and the option methods need v12.0. Set `min_server_version` in your [plugin manifest](/developers/integrate/plugins/manifest-reference) to match what you use.

### Register a group and create a field

Register the group and make sure your fields exist when the plugin activates. This example creates a `select` field for a status that the plugin stores on posts:

```go
package main

import (
	"encoding/json"
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

type Plugin struct {
	plugin.MattermostPlugin

	groupID     string
	statusField *model.PropertyField
}

func (p *Plugin) OnActivate() error {
	group, err := p.API.RegisterPropertyGroup("tasks_plugin")
	if err != nil {
		return fmt.Errorf("failed to register property group: %w", err)
	}
	p.groupID = group.ID

	// Reuse the field if an earlier activation created it.
	field, err := p.API.GetPropertyFieldByName(group.ID, "", "status")
	if err != nil {
		field, err = p.API.CreatePropertyField(&model.PropertyField{
			GroupID: group.ID,
			Name:    "status",
			Type:    model.PropertyFieldTypeSelect,
			Attrs: model.StringInterface{
				model.PropertyFieldAttributeOptions: []any{
					map[string]any{"name": "Open"},
					map[string]any{"name": "Done"},
				},
			},
		})
		if err != nil {
			return fmt.Errorf("failed to create status field: %w", err)
		}
	}
	p.statusField = field

	return nil
}
```

Leave `ID` empty when you create a field; Mattermost assigns it.

### Set and read values

To store a value, find the option ID and upsert the value for the post:

```go
// optionID returns the ID of the field's option with the given name.
func optionID(field *model.PropertyField, name string) (string, error) {
	raw, err := json.Marshal(field.Attrs[model.PropertyFieldAttributeOptions])
	if err != nil {
		return "", err
	}
	var options []model.PropertyFieldOption
	if err := json.Unmarshal(raw, &options); err != nil {
		return "", err
	}
	for _, option := range options {
		if option.Name == name {
			return option.ID, nil
		}
	}
	return "", fmt.Errorf("field %s has no option %q", field.Name, name)
}

func (p *Plugin) setStatus(postID, status string) error {
	id, err := optionID(p.statusField, status)
	if err != nil {
		return err
	}
	value, err := json.Marshal(id)
	if err != nil {
		return err
	}

	_, err = p.API.UpsertPropertyValue(&model.PropertyValue{
		GroupID:    p.groupID,
		FieldID:    p.statusField.ID,
		TargetType: "post",
		TargetID:   postID,
		Value:      value,
	})
	return err
}
```

To read values, search by target. `PerPage` is required:

```go
func (p *Plugin) getStatusOptionID(postID string) (string, error) {
	values, err := p.API.SearchPropertyValues(p.groupID, model.PropertyValueSearchOpts{
		TargetIDs: []string{postID},
		FieldID:   p.statusField.ID,
		PerPage:   1,
	})
	if err != nil {
		return "", err
	}
	if len(values) == 0 {
		return "", nil // no status set
	}

	var id string
	if err := json.Unmarshal(values[0].Value, &id); err != nil {
		return "", err
	}
	return id, nil
}
```

To write several values in one call, use `UpsertPropertyValues`. All the values in a call must belong to the same group, and each field can appear only once. To remove data when an object goes away, use `DeletePropertyValuesForTarget`.

### Page through options

`GetPropertyFieldOptions` reads a field's options one page at a time, ordered by creation time. It's the way to read a large option list, such as a big hierarchy in the `access_control` group. Each page can hold up to 200 options. For the first page, pass a zero cursor; then pass the cursor from the page you just read, and keep going while `HasMore` is `true`. Don't stop on a short page: a page can hold fewer options than you asked for even when more follow.

```go
func (p *Plugin) listOptions(groupID, fieldID string) ([]*model.PropertyFieldOption, error) {
	var all []*model.PropertyFieldOption
	var cursorCreateAt int64
	var cursorID string

	for {
		page, err := p.API.GetPropertyFieldOptions(groupID, fieldID, cursorCreateAt, cursorID, 200)
		if err != nil {
			return nil, err
		}
		all = append(all, page.Options...)
		if !page.HasMore {
			return all, nil
		}
		cursorCreateAt, cursorID = page.NextCursorCreateAt, page.NextCursorID
	}
}
```

Each option on a page has its `ID`, `Name` and `Color`. In a `graph` field, `Parents` lists the names of the options directly above it. Options that a linked field inherits from its template are marked `ReadOnly`.

The write methods take up to 200 options per call, and each call succeeds or fails as a whole:

- `CreatePropertyFieldOptions` adds options. Don't set `ID`; Mattermost assigns it. `Parents` can name options already in the field or options in the same call, so you can build a hierarchy in one call.
- `UpdatePropertyFieldOptions` changes options, each identified by `ID`. Anything you leave out stays as it was; `Parents`, when given, replaces the option's parents.
- `DeletePropertyFieldOptions` removes options by ID. You can't remove an option that still has options below it unless you remove those too. Values that name a removed option are left as they are; the removed option is ignored wherever it's read.

## React to changes

There are no server plugin hooks for property changes.

A web app plugin can listen to the websocket events that Mattermost sends when fields and values in version 2 groups change, with [`registerWebSocketEventHandler`](/developers/integrate/reference/webapp#registerWebSocketEventHandler):

| Event | Data |
|---|---|
| `property_field_created` | `property_field`: the field, as a JSON string. `object_type`: the field's object type. |
| `property_field_updated` | Same as `property_field_created`. |
| `property_field_deleted` | `field_id`, `object_type` |
| `property_values_updated` | `object_type`, `target_id`, and `values`: the changed values, as a JSON string. When all of a field's values are deleted at once, the event has `field_id` and an empty `values` list instead. |

Field events are sent whenever a field in a version 2 group changes, to the team or channel the field is defined for, or to everyone for a system field. They aren't sent for fields in version 1 groups. `property_values_updated` is sent for value changes made through the REST API and by Mattermost itself, and when values are deleted; creating or updating values through the plugin API doesn't send it. If your web app needs to know about changes your server plugin makes, send your own event with [`PublishWebSocketEvent`](/developers/integrate/reference/server#API.PublishWebSocketEvent).

Treat an event as a signal to refresh: read the field or values again to get what the current user is allowed to see.

## Use the REST API

The REST API works with version 2 groups such as `access_control`. See the [properties endpoints](/api/reference/properties) in the API reference. The [custom profile attributes endpoints](/api/reference/custom-profile-attributes) are deprecated; use the properties endpoints in the `access_control` group instead.
