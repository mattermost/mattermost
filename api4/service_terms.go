package api4

import (
	"net/http"
)

func (api *API) InitServiceTerms() {
	api.BaseRoutes.ServiceTerms.Handle("", api.ApiSessionRequired(getServiceTerms)).Methods("GET")
}

func getServiceTerms(c *Context, w http.ResponseWriter, r *http.Request) {
	serviceTerms, err := c.App.GetServiceTerms()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(serviceTerms.ToJson()))
}
