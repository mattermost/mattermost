// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitLdapLocal() {
	api.BaseRoutes.LDAP.Handle("/migrateid", api.ApiLocal(migrateIdLdap)).Methods("POST")
}
