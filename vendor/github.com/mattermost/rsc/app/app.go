package app

import (
	"fmt"
	"net/http"

	"appengine"
	"appengine/memcache"

	_ "github.com/mattermost/rsc/appfs/server"
	_ "github.com/mattermost/rsc/blog/post"
)

func init() {
	http.HandleFunc("/admin/", Admin)
}

func Admin(w http.ResponseWriter, req *http.Request) {
	c := appengine.NewContext(req)
	switch req.FormValue("op") {
	default:
		fmt.Fprintf(w, "unknown op %s\n", req.FormValue("op"))
	case "memcache-get":
		key := req.FormValue("key")
		item, err := memcache.Get(c, key)
		if err != nil {
			fmt.Fprintf(w, "ERROR: %s\n", err)
			return
		}
		w.Write(item.Value)
	case "memcache-delete":
		key := req.FormValue("key")
		if err := memcache.Delete(c, key); err != nil {
			fmt.Fprintf(w, "ERROR: %s\n", err)
			return
		}
		fmt.Fprintf(w, "deleted %s\n", key)
	}
}
