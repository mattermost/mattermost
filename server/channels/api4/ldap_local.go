// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitLdapLocal() {
	api.BaseRoutes.LDAP.Handle("/migrateid", api.APILocal(migrateIDLdap)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/sync", api.APILocal(syncLdap)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/test", api.APILocal(testLdap)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/groups", api.APILocal(getLdapGroups)).Methods(http.MethodGet)
	api.BaseRoutes.LDAP.Handle("/certificate/public", api.APILocal(addLdapPublicCertificate)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/certificate/private", api.APILocal(addLdapPrivateCertificate)).Methods(http.MethodPost)
	api.BaseRoutes.LDAP.Handle("/certificate/public", api.APILocal(removeLdapPublicCertificate)).Methods(http.MethodDelete)
	api.BaseRoutes.LDAP.Handle("/certificate/private", api.APILocal(removeLdapPrivateCertificate)).Methods(http.MethodDelete)
}
