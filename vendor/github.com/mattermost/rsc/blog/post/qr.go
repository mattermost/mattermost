package post

import (
	"fmt"
	"net/http"
	"runtime/debug"

	qrweb "github.com/mattermost/rsc/qr/web"
)

func carp(f http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				w.Header().Set("Content-Type", "text/plain")
				fmt.Fprintf(w, "<pre>\npanic: %s\n\n%s\n", err, debug.Stack())
			}
		}()
		f.ServeHTTP(w, req)
	})
}

func init() {
	//	http.Handle("/qr/bits", carp(qrweb.Bits))
	http.Handle("/qr/frame", carp(qrweb.Frame))
	http.Handle("/qr/frames", carp(qrweb.Frames))
	http.Handle("/qr/mask", carp(qrweb.Mask))
	http.Handle("/qr/masks", carp(qrweb.Masks))
	http.Handle("/qr/arrow", carp(qrweb.Arrow))
	http.Handle("/qr/draw", carp(qrweb.Draw))
	http.Handle("/qr/bitstable", carp(qrweb.BitsTable))
	http.Handle("/qr/encode", carp(qrweb.Encode))
	http.Handle("/qr/show/", carp(qrweb.Show))
}
