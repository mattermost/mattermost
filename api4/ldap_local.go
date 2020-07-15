// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitLdapLocal() {
	api.BaseRoutes.LDAP.Handle("/migrateid", api.ApiLocal(migrateIdLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/sync", api.ApiLocal(syncLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/test", api.ApiLocal(testLdap)).Methods("POST")
	api.BaseRoutes.LDAP.Handle("/groups", api.ApiLocal(getLdapGroups)).Methods("GET")
}
