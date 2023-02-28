package api

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

func (a *API) registerSystemRoutes(r *mux.Router) {
	// System APIs
	r.HandleFunc("/hello", a.handleHello).Methods("GET")
	r.HandleFunc("/ping", a.handlePing).Methods("GET")
}

func (a *API) handleHello(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /hello hello
	//
	// Responds with `Hello` if the web service is running.
	//
	// ---
	// produces:
	// - text/plain
	// responses:
	//   '200':
	//     description: success
	stringResponse(w, "Hello")
}

func (a *API) handlePing(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /ping ping
	//
	// Responds with server metadata if the web service is running.
	//
	// ---
	// produces:
	// - application/json
	// responses:
	//   '200':
	//     description: success
	serverMetadata := a.app.GetServerMetadata()

	if a.singleUserToken != "" {
		serverMetadata.SKU = "personal_desktop"
	}

	if serverMetadata.Edition == "plugin" {
		serverMetadata.SKU = "suite"
	}

	bytes, err := json.Marshal(serverMetadata)
	if err != nil {
		a.errorResponse(w, r, err)
	}

	jsonStringResponse(w, 200, string(bytes))
}
