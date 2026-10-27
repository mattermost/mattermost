// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
)

// globalAttributeListingPolicy is the part of the Global Attributes listing that
// depends on the licence and configuration, which only the app layer can read.
// It mirrors the webapp's useAllowedResourceTypes and
// useClassificationMarkingsReachable: user attributes always, channel attributes
// with the ChannelAttributes flag on Enterprise Advanced, post attributes with
// the PostAttributes flag, and the Classification template only with the
// ClassificationMarkings flag on Enterprise Advanced.
func (a *App) globalAttributeListingPolicy() properties.GlobalAttributeListingPolicy {
	flags := a.Config().FeatureFlags
	enterpriseAdvanced := model.MinimumEnterpriseAdvancedLicense(a.License())

	allowed := []string{model.PropertyFieldObjectTypeUser}
	if flags.ChannelAttributes && enterpriseAdvanced {
		allowed = append(allowed, model.PropertyFieldObjectTypeChannel)
	}
	if flags.PostAttributes {
		allowed = append(allowed, model.PropertyFieldObjectTypePost)
	}

	return properties.GlobalAttributeListingPolicy{
		AllowedResourceTypes:    allowed,
		ClassificationReachable: flags.ClassificationMarkings && enterpriseAdvanced,
	}
}

// SearchGlobalAttributeListing returns one page of the Global Attributes
// listing. Like every other access_control read it needs an Enterprise licence,
// refused with the same error the property service's licence hook raises.
// The search must already have its defaults set.
func (a *App) SearchGlobalAttributeListing(rctx request.CTX, search model.GlobalAttributeListingSearch) (*model.GlobalAttributeListing, *model.AppError) {
	if !model.MinimumEnterpriseLicense(a.License()) {
		return nil, mapPropertyServiceError("SearchGlobalAttributeListing", properties.ErrLicenseRequired)
	}

	group, err := a.Srv().propertyService.Group(model.AccessControlPropertyGroupName)
	if err != nil {
		return nil, model.NewAppError("SearchGlobalAttributeListing", "app.property_group.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	listing, err := a.Srv().propertyService.SearchGlobalAttributeListing(rctx, group.ID, search, a.globalAttributeListingPolicy())
	if err != nil {
		if appErr := mapPropertyServiceError("SearchGlobalAttributeListing", err); appErr != nil {
			return nil, appErr
		}
		return nil, model.NewAppError("SearchGlobalAttributeListing", "app.property_field.search_global_attribute_listing.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return listing, nil
}
