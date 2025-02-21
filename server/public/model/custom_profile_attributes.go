// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const CustomProfileAttributesPropertyGroupName = "custom_profile_attributes"

const CustomProfileAttributesPropertyAttrsSortOrder = "sort_order"

func CustomProfileAttributesPropertySortOrder(p *PropertyField) int {
	value, ok := p.Attrs[CustomProfileAttributesPropertyAttrsSortOrder]
	if !ok {
		return 0
	}

	order, ok := value.(float64)
	if !ok {
		return 0
	}

	return int(order)
}
