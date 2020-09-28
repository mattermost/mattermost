// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

package oauther

import (
	"context"
	"fmt"
	"net/http"
	"strings"
)

func (o *oAuther) oauth2Complete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	authedUserID := r.Header.Get("Mattermost-User-ID")
	if authedUserID == "" {
		o.logger.Debugf("oauth2Complete: reached by non authed user")
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		o.logger.Debugf("oauth2Complete: reached with no code")
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	state := r.URL.Query().Get("state")

	var storedState string
	err := o.store.Get(o.getStateKey(authedUserID), &storedState)
	if err != nil {
		o.logger.Warnf("oauth2Complete: cannot get state, err=%s", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if storedState != state {
		o.logger.Debugf("oauth2Complete: state mismatch")
		o.logger.Debugf("received state '%s'; expected state '%s%", state, storedState)
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	userID := strings.Split(state, "_")[1]
	if userID != authedUserID {
		o.logger.Debugf("oauth2Complete: authed user mismatch")
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	ctx := context.Background()
	token, err := o.config.Exchange(ctx, code)
	if err != nil {
		o.logger.Warnf("oauth2Complete: could not generate token, err=%s", err.Error())
		http.Error(w, "Not authorized", http.StatusUnauthorized)
		return
	}

	var payload []byte
	err = o.store.Get(o.getPayloadKey(userID), &payload)
	if err != nil {
		o.logger.Errorf("oauth2Complete: could not fetch payload, err=&s", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	ok, err := o.store.Set(o.getTokenKey(userID), token)
	if err != nil {
		o.logger.Errorf("oauth2Complete: cannot store the token, err=%s", err.Error())
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if !ok {
		o.logger.Errorf("oauth2Complete: cannot store token without error")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	html := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
			<head>
				<script>
					window.close();
				</script>
			</head>
			<body>
				<p>%s</p>
			</body>
		</html>
		`, o.connectedString)

	w.Header().Set("Content-Type", "text/html")
	_, err = w.Write([]byte(html))
	if err != nil {
		o.logger.Errorf("oauth2Complete: error writing response, err=%s", err.Error())
	}

	if o.onConnect != nil {
		o.onConnect(userID, *token, payload)
	}
}
