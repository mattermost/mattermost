package api4

import (
	"net/http"
	"github.com/mattermost/mattermost-server/mlog"
)

func (api *API) InitRemind() {

	//test
	//api.api
	api.BaseRoutes.Remind.Handle("", api.ApiSessionRequired(testTest)).Methods("POST")

}

func testTest(c *Context, w http.ResponseWriter, r *http.Request) {
	mlog.Info("absolutely fabulous")
}
