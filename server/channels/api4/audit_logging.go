package api4

import "net/http"

func (api *API) InitAuditLogging() {
	api.BaseRoutes.AuditLogs.Handle("/certificate", api.APISessionRequired(addAuditLogCertificate)).Methods(http.MethodPost)
	api.BaseRoutes.AuditLogs.Handle("/certificate", api.APISessionRequired(removeAuditLogCertificate)).Methods(http.MethodDelete)
}

func addAuditLogCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Logger.Debug("addAuditLogCertificate")
}

func removeAuditLogCertificate(c *Context, w http.ResponseWriter, r *http.Request) {
	c.Logger.Debug("removeAuditLogCertificate")
}
