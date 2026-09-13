// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type PropertyFieldResolver struct {
	propertyField app.PropertyField
}

type PropertyOptionResolver struct {
	option *model.PluginPropertyOption
}

type PropertyFieldAttrsResolver struct {
	attrs app.Attrs
}

func (r *PropertyFieldResolver) ID(ctx context.Context) string {
	return r.propertyField.ID
}

func (r *PropertyFieldResolver) Name(ctx context.Context) string {
	return r.propertyField.Name
}

func (r *PropertyFieldResolver) Type(ctx context.Context) string {
	return string(r.propertyField.Type)
}

func (r *PropertyFieldResolver) GroupID(ctx context.Context) string {
	return r.propertyField.GroupID
}

func (r *PropertyFieldResolver) CreateAt(ctx context.Context) float64 {
	return float64(r.propertyField.CreateAt)
}

func (r *PropertyFieldResolver) UpdateAt(ctx context.Context) float64 {
	return float64(r.propertyField.UpdateAt)
}

func (r *PropertyFieldResolver) DeleteAt(ctx context.Context) float64 {
	return float64(r.propertyField.DeleteAt)
}

func (r *PropertyFieldResolver) Attrs(ctx context.Context) *PropertyFieldAttrsResolver {
	return &PropertyFieldAttrsResolver{attrs: r.propertyField.Attrs}
}

func (r *PropertyFieldAttrsResolver) Visibility(ctx context.Context) string {
	return r.attrs.Visibility
}

func (r *PropertyFieldAttrsResolver) SortOrder(ctx context.Context) float64 {
	return r.attrs.SortOrder
}

func (r *PropertyFieldAttrsResolver) ParentID(ctx context.Context) *string {
	if r.attrs.ParentID == "" {
		return nil
	}
	return &r.attrs.ParentID
}

func (r *PropertyFieldAttrsResolver) Options(ctx context.Context) *[]*PropertyOptionResolver {
	if len(r.attrs.Options) == 0 {
		return nil
	}

	resolvers := make([]*PropertyOptionResolver, len(r.attrs.Options))
	for i, option := range r.attrs.Options {
		resolvers[i] = &PropertyOptionResolver{option: option}
	}
	return &resolvers
}

func (r *PropertyFieldAttrsResolver) ValueType(ctx context.Context) *string {
	if r.attrs.ValueType == "" {
		return nil
	}
	return &r.attrs.ValueType
}

func (r *PropertyOptionResolver) ID(ctx context.Context) string {
	return r.option.GetID()
}

func (r *PropertyOptionResolver) Name(ctx context.Context) string {
	return r.option.GetName()
}

func (r *PropertyOptionResolver) Color(ctx context.Context) *string {
	color := r.option.GetValue("color")
	if color == "" {
		return nil
	}
	return &color
}
