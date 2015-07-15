// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/mssola/user_agent"
	"github.com/nfnt/resize"
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func InitUser(r *mux.Router) {
	l4g.Debug("Initializing user api routes")

	sr := r.PathPrefix("/users").Subrouter()
	sr.Handle("/create", ApiAppHandler(createUser)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updateUser)).Methods("POST")
	sr.Handle("/update_roles", ApiUserRequired(updateRoles)).Methods("POST")
	sr.Handle("/update_active", ApiUserRequired(updateActive)).Methods("POST")
	sr.Handle("/update_notify", ApiUserRequired(updateUserNotify)).Methods("POST")
	sr.Handle("/newpassword", ApiUserRequired(updatePassword)).Methods("POST")
	sr.Handle("/send_password_reset", ApiAppHandler(sendPasswordReset)).Methods("POST")
	sr.Handle("/reset_password", ApiAppHandler(resetPassword)).Methods("POST")
	sr.Handle("/login", ApiAppHandler(login)).Methods("POST")
	sr.Handle("/logout", ApiUserRequired(logout)).Methods("POST")
	sr.Handle("/revoke_session", ApiUserRequired(revokeSession)).Methods("POST")

	sr.Handle("/newimage", ApiUserRequired(uploadProfileImage)).Methods("POST")

	sr.Handle("/me", ApiAppHandler(getMe)).Methods("GET")
	sr.Handle("/status", ApiUserRequiredActivity(getStatuses, false)).Methods("GET")
	sr.Handle("/profiles", ApiUserRequired(getProfiles)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}", ApiUserRequired(getUser)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/sessions", ApiUserRequired(getSessions)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/audits", ApiUserRequired(getAudits)).Methods("GET")
	sr.Handle("/{id:[A-Za-z0-9]+}/image", ApiUserRequired(getProfileImage)).Methods("GET")
}

func createUser(c *Context, w http.ResponseWriter, r *http.Request) {

	user := model.UserFromJson(r.Body)

	if user == nil {
		c.SetInvalidParam("createUser", "user")
		return
	}

	if !model.IsUsernameValid(user.Username) {
		c.Err = model.NewAppError("createUser", "That username is invalid", "might be using a resrved username")
		return
	}

	user.EmailVerified = false

	var team *model.Team

	if result := <-Srv.Store.Team().Get(user.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	hash := r.URL.Query().Get("h")

	shouldVerifyHash := true

	if team.Type == model.TEAM_INVITE && len(team.AllowedDomains) > 0 && len(hash) == 0 {
		domains := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(team.AllowedDomains, "@", " ", -1), ",", " ", -1))))

		matched := false
		for _, d := range domains {
			if strings.HasSuffix(user.Email, "@"+d) {
				matched = true
				break
			}
		}

		if matched {
			shouldVerifyHash = false
		} else {
			c.Err = model.NewAppError("createUser", "The signup link does not appear to be valid", "allowed domains failed")
			return
		}
	}

	if team.Type == model.TEAM_OPEN {
		shouldVerifyHash = false
	}

	if len(hash) > 0 {
		shouldVerifyHash = true
	}

	if shouldVerifyHash {
		data := r.URL.Query().Get("d")
		props := model.MapFromJson(strings.NewReader(data))

		if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.InviteSalt)) {
			c.Err = model.NewAppError("createUser", "The signup link does not appear to be valid", "")
			return
		}

		t, err := strconv.ParseInt(props["time"], 10, 64)
		if err != nil || model.GetMillis()-t > 1000*60*60*48 { // 48 hours
			c.Err = model.NewAppError("createUser", "The signup link has expired", "")
			return
		}

		if user.TeamId != props["id"] {
			c.Err = model.NewAppError("createUser", "Invalid team name", data)
			return
		}

		user.Email = props["email"]
		user.EmailVerified = true
	}

	ruser := CreateUser(c, team, user)
	if c.Err != nil {
		return
	}

	w.Write([]byte(ruser.ToJson()))

}

func CreateValet(c *Context, team *model.Team) *model.User {
	valet := &model.User{}
	valet.TeamId = team.Id
	valet.Email = utils.Cfg.EmailSettings.FeedbackEmail
	valet.EmailVerified = true
	valet.Username = model.BOT_USERNAME
	valet.Password = model.NewId()

	return CreateUser(c, team, valet)
}

func CreateUser(c *Context, team *model.Team, user *model.User) *model.User {

	channelRole := ""
	if team.Email == user.Email {
		user.Roles = model.ROLE_ADMIN
		channelRole = model.CHANNEL_ROLE_ADMIN
	} else {
		user.Roles = ""
	}

	user.MakeNonNil()
	if len(user.Props["theme"]) == 0 {
		user.AddProp("theme", utils.Cfg.TeamSettings.DefaultThemeColor)
	}

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		c.Err = result.Err
		return nil
	} else {
		ruser := result.Data.(*model.User)

		// Soft error if there is an issue joining the default channels
		if err := JoinDefaultChannels(c, ruser, channelRole); err != nil {
			l4g.Error("Encountered an issue joining default channels user_id=%s, team_id=%s, err=%v", ruser.Id, ruser.TeamId, err)
		}

		//fireAndForgetWelcomeEmail(strings.Split(ruser.FullName, " ")[0], ruser.Email, team.Name, c.TeamUrl+"/channels/town-square")

		if user.EmailVerified {
			if cresult := <-Srv.Store.User().VerifyEmail(ruser.Id); cresult.Err != nil {
				l4g.Error("Failed to set email verified err=%v", cresult.Err)
			}
		} else {
			FireAndForgetVerifyEmail(result.Data.(*model.User).Id, strings.Split(ruser.FullName, " ")[0], ruser.Email, team.Name, c.TeamUrl)
		}

		ruser.Sanitize(map[string]bool{})

		// This message goes to every channel, so the channelId is irrelevant
		message := model.NewMessage(team.Id, "", ruser.Id, model.ACTION_NEW_USER)

		store.PublishAndForget(message)

		return ruser
	}
}

func fireAndForgetWelcomeEmail(name, email, teamName, link string) {
	go func() {

		subjectPage := NewServerTemplatePage("welcome_subject", link)
		bodyPage := NewServerTemplatePage("welcome_body", link)
		bodyPage.Props["FullName"] = name
		bodyPage.Props["TeamName"] = teamName
		bodyPage.Props["FeedbackName"] = utils.Cfg.EmailSettings.FeedbackName

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error("Failed to send welcome email successfully err=%v", err)
		}

	}()
}

func FireAndForgetVerifyEmail(userId, name, email, teamName, teamUrl string) {
	go func() {

		link := fmt.Sprintf("%s/verify?uid=%s&hid=%s", teamUrl, userId, model.HashPassword(userId))

		subjectPage := NewServerTemplatePage("verify_subject", teamUrl)
		subjectPage.Props["TeamName"] = teamName
		bodyPage := NewServerTemplatePage("verify_body", teamUrl)
		bodyPage.Props["FullName"] = name
		bodyPage.Props["TeamName"] = teamName
		bodyPage.Props["VerifyUrl"] = link

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error("Failed to send verification email successfully err=%v", err)
		}
	}()
}

func login(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	extraInfo := ""
	var result store.StoreResult

	if len(props["id"]) != 0 {
		extraInfo = props["id"]
		if result = <-Srv.Store.User().Get(props["id"]); result.Err != nil {
			c.Err = result.Err
			return
		}
	}

	var team *model.Team
	if result.Data == nil && len(props["email"]) != 0 && len(props["domain"]) != 0 {
		extraInfo = props["email"] + " in " + props["domain"]

		if nr := <-Srv.Store.Team().GetByDomain(props["domain"]); nr.Err != nil {
			c.Err = nr.Err
			return
		} else {
			team = nr.Data.(*model.Team)

			if result = <-Srv.Store.User().GetByEmail(team.Id, props["email"]); result.Err != nil {
				c.Err = result.Err
				return
			}
		}
	}

	if result.Data == nil {
		c.Err = model.NewAppError("login", "Login failed because we couldn't find a valid account", extraInfo)
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	user := result.Data.(*model.User)

	if team == nil {
		if tResult := <-Srv.Store.Team().Get(user.TeamId); tResult.Err != nil {
			c.Err = tResult.Err
			return
		} else {
			team = tResult.Data.(*model.Team)
		}
	}

	c.LogAuditWithUserId(user.Id, "attempt")

	if !model.ComparePassword(user.Password, props["password"]) {
		c.LogAuditWithUserId(user.Id, "fail")
		c.Err = model.NewAppError("login", "Login failed because of invalid password", extraInfo)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if !user.EmailVerified && !utils.Cfg.EmailSettings.ByPassEmail {
		c.Err = model.NewAppError("login", "Login failed because email address has not been verified", extraInfo)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if user.DeleteAt > 0 {
		c.Err = model.NewAppError("login", "Login failed because your account has been set to inactive.  Please contact an administrator.", extraInfo)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	session := &model.Session{UserId: user.Id, TeamId: team.Id, Roles: user.Roles, DeviceId: props["device_id"]}

	maxAge := model.SESSION_TIME_WEB_IN_SECS

	if len(props["device_id"]) > 0 {
		session.SetExpireInDays(model.SESSION_TIME_MOBILE_IN_DAYS)
		maxAge = model.SESSION_TIME_MOBILE_IN_SECS
	} else {
		session.SetExpireInDays(model.SESSION_TIME_WEB_IN_DAYS)
	}

	ua := user_agent.New(r.UserAgent())

	plat := ua.Platform()
	if plat == "" {
		plat = "unknown"
	}

	os := ua.OS()
	if os == "" {
		os = "unknown"
	}

	bname, bversion := ua.Browser()
	if bname == "" {
		bname = "unknown"
	}

	if bversion == "" {
		bversion = "0.0"
	}

	session.AddProp(model.SESSION_PROP_PLATFORM, plat)
	session.AddProp(model.SESSION_PROP_OS, os)
	session.AddProp(model.SESSION_PROP_BROWSER, fmt.Sprintf("%v/%v", bname, bversion))

	if result := <-Srv.Store.Session().Save(session); result.Err != nil {
		c.Err = result.Err
		c.Err.StatusCode = http.StatusForbidden
		return
	} else {
		session = result.Data.(*model.Session)
		sessionCache.Add(session.Id, session)
	}

	w.Header().Set(model.HEADER_TOKEN, session.Id)
	sessionCookie := &http.Cookie{
		Name:     model.SESSION_TOKEN,
		Value:    session.Id,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
	}

	http.SetCookie(w, sessionCookie)
	user.Sanitize(map[string]bool{})

	c.Session = *session
	c.LogAuditWithUserId(user.Id, "success")

	w.Write([]byte(result.Data.(*model.User).ToJson()))
}

func revokeSession(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)
	altId := props["id"]

	if result := <-Srv.Store.Session().GetSessions(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		sessions := result.Data.([]*model.Session)

		for _, session := range sessions {
			if session.AltId == altId {
				c.LogAudit("session_id=" + session.AltId)
				sessionCache.Remove(session.Id)
				if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
					c.Err = result.Err
					return
				} else {
					w.Write([]byte(model.MapToJson(props)))
					return
				}
			}
		}
	}
}

func RevokeAllSession(c *Context, userId string) {
	if result := <-Srv.Store.Session().GetSessions(userId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		sessions := result.Data.([]*model.Session)

		for _, session := range sessions {
			c.LogAuditWithUserId(userId, "session_id="+session.AltId)
			sessionCache.Remove(session.Id)
			if result := <-Srv.Store.Session().Remove(session.Id); result.Err != nil {
				c.Err = result.Err
				return
			}
		}
	}
}

func getSessions(c *Context, w http.ResponseWriter, r *http.Request) {

	params := mux.Vars(r)
	id := params["id"]

	if !c.HasPermissionsToUser(id, "getSessions") {
		return
	}

	if result := <-Srv.Store.Session().GetSessions(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		sessions := result.Data.([]*model.Session)
		for _, session := range sessions {
			session.Sanitize()
		}

		w.Write([]byte(model.SessionsToJson(sessions)))
	}
}

func logout(c *Context, w http.ResponseWriter, r *http.Request) {
	data := make(map[string]string)
	data["user_id"] = c.Session.UserId

	Logout(c, w, r)
	if c.Err == nil {
		w.Write([]byte(model.MapToJson(data)))
	}
}

func Logout(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")
	c.RemoveSessionCookie(w)
	if result := <-Srv.Store.Session().Remove(c.Session.Id); result.Err != nil {
		c.Err = result.Err
		return
	}
}

func getMe(c *Context, w http.ResponseWriter, r *http.Request) {

	if len(c.Session.UserId) == 0 {
		return
	}

	if result := <-Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
		c.Err = result.Err
		c.RemoveSessionCookie(w)
		l4g.Error("Error in getting users profile for id=%v forcing logout", c.Session.UserId)
		return
	} else if HandleEtag(result.Data.(*model.User).Etag(), w, r) {
		return
	} else {
		result.Data.(*model.User).Sanitize(map[string]bool{})
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.User).Etag())
		w.Header().Set("Expires", "-1")
		w.Write([]byte(result.Data.(*model.User).ToJson()))
		return
	}
}

func getUser(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if !c.HasPermissionsToUser(id, "getUser") {
		return
	}

	if result := <-Srv.Store.User().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.User).Etag(), w, r) {
		return
	} else {
		result.Data.(*model.User).Sanitize(map[string]bool{})
		w.Header().Set(model.HEADER_ETAG_SERVER, result.Data.(*model.User).Etag())
		w.Write([]byte(result.Data.(*model.User).ToJson()))
		return
	}
}

func getProfiles(c *Context, w http.ResponseWriter, r *http.Request) {

	etag := (<-Srv.Store.User().GetEtagForProfiles(c.Session.TeamId)).Data.(string)
	if HandleEtag(etag, w, r) {
		return
	}

	if result := <-Srv.Store.User().GetProfiles(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		profiles := result.Data.(map[string]*model.User)

		for k, p := range profiles {
			options := utils.SanitizeOptions
			options["passwordupdate"] = false
			p.Sanitize(options)
			profiles[k] = p
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Header().Set("Cache-Control", "max-age=120, public") // 2 mins
		w.Write([]byte(model.UserMapToJson(profiles)))
		return
	}
}

func getAudits(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if !c.HasPermissionsToUser(id, "getAudits") {
		return
	}

	userChan := Srv.Store.User().Get(id)
	auditChan := Srv.Store.Audit().Get(id, 20)

	if c.Err = (<-userChan).Err; c.Err != nil {
		return
	}

	if result := <-auditChan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		audits := result.Data.(model.Audits)
		etag := audits.Etag()

		if HandleEtag(etag, w, r) {
			return
		}

		if len(etag) > 0 {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		}

		w.Write([]byte(audits.ToJson()))
		return
	}
}

func createProfileImage(username string, userId string) ([]byte, *model.AppError) {

	colors := []color.NRGBA{
		{197, 8, 126, 255},
		{227, 207, 18, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
		{28, 181, 105, 255},
		{35, 188, 224, 255},
		{116, 49, 196, 255},
		{197, 8, 126, 255},
		{197, 19, 19, 255},
		{250, 134, 6, 255},
		{227, 207, 18, 255},
		{123, 201, 71, 255},
	}

	h := fnv.New32a()
	h.Write([]byte(userId))
	seed := h.Sum32()

	color := colors[int64(seed)%int64(len(colors))]
	img := image.NewRGBA(image.Rect(0, 0, int(utils.Cfg.ImageSettings.ProfileWidth), int(utils.Cfg.ImageSettings.ProfileHeight)))
	draw.Draw(img, img.Bounds(), &image.Uniform{color}, image.ZP, draw.Src)

	buf := new(bytes.Buffer)

	if imgErr := png.Encode(buf, img); imgErr != nil {
		return nil, model.NewAppError("getProfileImage", "Could not encode default profile image", imgErr.Error())
	} else {
		return buf.Bytes(), nil
	}
}

func getProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	if result := <-Srv.Store.User().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		var img []byte
		var err *model.AppError

		if !utils.IsS3Configured() {
			img, err = createProfileImage(result.Data.(*model.User).Username, id)
			if err != nil {
				c.Err = err
				return
			}
		} else {
			var auth aws.Auth
			auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
			auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

			s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
			bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

			path := "teams/" + c.Session.TeamId + "/users/" + id + "/profile.png"

			if data, getErr := bucket.Get(path); getErr != nil {
				img, err = createProfileImage(result.Data.(*model.User).Username, id)
				if err != nil {
					c.Err = err
					return
				}

				options := s3.Options{}
				if err := bucket.Put(path, img, "image", s3.Private, options); err != nil {
					c.Err = model.NewAppError("getImage", "Couldn't upload default profile image", err.Error())
					return
				}

			} else {
				img = data
			}
		}

		if c.Session.UserId == id {
			w.Header().Set("Cache-Control", "max-age=300, public") // 5 mins
		} else {
			w.Header().Set("Cache-Control", "max-age=86400, public") // 24 hrs
		}

		w.Write(img)
	}
}

func uploadProfileImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if !utils.IsS3Configured() {
		c.Err = model.NewAppError("uploadProfileImage", "Unable to upload image. Amazon S3 not configured. ", "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if err := r.ParseMultipartForm(10000000); err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "Could not parse multipart form", "")
		return
	}

	var auth aws.Auth
	auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
	auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

	s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
	bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

	m := r.MultipartForm

	imageArray, ok := m.File["image"]
	if !ok {
		c.Err = model.NewAppError("uploadProfileImage", "No file under 'image' in request", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if len(imageArray) <= 0 {
		c.Err = model.NewAppError("uploadProfileImage", "Empty array under 'image' in request", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	imageData := imageArray[0]

	file, err := imageData.Open()
	defer file.Close()
	if err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "Could not open image file", err.Error())
		return
	}

	// Decode image into Image object
	img, _, err := image.Decode(file)
	if err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "Could not decode profile image", err.Error())
		return
	}

	// Scale profile image
	img = resize.Resize(utils.Cfg.ImageSettings.ProfileWidth, utils.Cfg.ImageSettings.ProfileHeight, img, resize.Lanczos3)

	buf := new(bytes.Buffer)
	err = png.Encode(buf, img)
	if err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "Could not encode profile image", err.Error())
		return
	}

	path := "teams/" + c.Session.TeamId + "/users/" + c.Session.UserId + "/profile.png"

	options := s3.Options{}
	if err := bucket.Put(path, buf.Bytes(), "image", s3.Private, options); err != nil {
		c.Err = model.NewAppError("uploadProfileImage", "Couldn't upload profile image", "")
		return
	}

	Srv.Store.User().UpdateUpdateAt(c.Session.UserId)

	c.LogAudit("")
}

func updateUser(c *Context, w http.ResponseWriter, r *http.Request) {
	user := model.UserFromJson(r.Body)

	if user == nil {
		c.SetInvalidParam("updateUser", "user")
		return
	}

	if !c.HasPermissionsToUser(user.Id, "updateUser") {
		return
	}

	if result := <-Srv.Store.User().Update(user, false); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAudit("")

		rusers := result.Data.([2]*model.User)

		if rusers[0].Email != rusers[1].Email {
			if tresult := <-Srv.Store.Team().Get(rusers[1].TeamId); tresult.Err != nil {
				l4g.Error(tresult.Err.Message)
			} else {
				fireAndForgetEmailChangeEmail(rusers[1].Email, tresult.Data.(*model.Team).Name, c.TeamUrl)
			}
		}

		rusers[0].Password = ""
		rusers[0].AuthData = ""
		w.Write([]byte(rusers[0].ToJson()))
	}
}

func updatePassword(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempted")

	props := model.MapFromJson(r.Body)
	userId := props["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("updatePassword", "user_id")
		return
	}

	currentPassword := props["current_password"]
	if len(currentPassword) <= 0 {
		c.SetInvalidParam("updatePassword", "current_password")
		return
	}

	newPassword := props["new_password"]
	if len(newPassword) < 5 {
		c.SetInvalidParam("updatePassword", "new_password")
		return
	}

	if userId != c.Session.UserId {
		c.Err = model.NewAppError("updatePassword", "Update password failed because context user_id did not match props user_id", "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	var result store.StoreResult

	if result = <-Srv.Store.User().Get(userId); result.Err != nil {
		c.Err = result.Err
		return
	}

	if result.Data == nil {
		c.Err = model.NewAppError("updatePassword", "Update password failed because we couldn't find a valid account", "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	user := result.Data.(*model.User)

	tchan := Srv.Store.Team().Get(user.TeamId)

	if !model.ComparePassword(user.Password, currentPassword) {
		c.Err = model.NewAppError("updatePassword", "Update password failed because of invalid password", "")
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if uresult := <-Srv.Store.User().UpdatePassword(c.Session.UserId, model.HashPassword(newPassword)); uresult.Err != nil {
		c.Err = model.NewAppError("updatePassword", "Update password failed", uresult.Err.Error())
		c.Err.StatusCode = http.StatusForbidden
		return
	} else {
		c.LogAudit("completed")

		if tresult := <-tchan; tresult.Err != nil {
			l4g.Error(tresult.Err.Message)
		} else {
			fireAndForgetPasswordChangeEmail(user.Email, tresult.Data.(*model.Team).Name, c.TeamUrl, "using the settings menu")
		}

		data := make(map[string]string)
		data["user_id"] = uresult.Data.(string)
		w.Write([]byte(model.MapToJson(data)))
	}
}

func updateRoles(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	user_id := props["user_id"]
	if len(user_id) != 26 {
		c.SetInvalidParam("updateRoles", "user_id")
		return
	}

	new_roles := props["new_roles"]
	// no check since we allow the clearing of Roles

	var user *model.User
	if result := <-Srv.Store.User().Get(user_id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if !c.HasPermissionsToTeam(user.TeamId, "updateRoles") {
		return
	}

	if !strings.Contains(c.Session.Roles, model.ROLE_ADMIN) && !c.IsSystemAdmin() {
		c.Err = model.NewAppError("updateRoles", "You do not have the appropriate permissions", "userId="+user_id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	// make sure there is at least 1 other active admin
	if strings.Contains(user.Roles, model.ROLE_ADMIN) && !strings.Contains(new_roles, model.ROLE_ADMIN) {
		if result := <-Srv.Store.User().GetProfiles(user.TeamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			activeAdmins := -1
			profileUsers := result.Data.(map[string]*model.User)
			for _, profileUser := range profileUsers {
				if profileUser.DeleteAt == 0 && strings.Contains(profileUser.Roles, model.ROLE_ADMIN) {
					activeAdmins = activeAdmins + 1
				}
			}

			if activeAdmins <= 0 {
				c.Err = model.NewAppError("updateRoles", "There must be at least one active admin", "userId="+user_id)
				return
			}
		}
	}

	user.Roles = new_roles

	if result := <-Srv.Store.User().Update(user, true); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAuditWithUserId(user.Id, "roles="+new_roles)

		ruser := result.Data.([2]*model.User)[0]
		options := utils.SanitizeOptions
		options["passwordupdate"] = false
		ruser.Sanitize(options)
		w.Write([]byte(ruser.ToJson()))
	}
}

func updateActive(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	user_id := props["user_id"]
	if len(user_id) != 26 {
		c.SetInvalidParam("updateActive", "user_id")
		return
	}

	active := props["active"] == "true"

	var user *model.User
	if result := <-Srv.Store.User().Get(user_id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if !c.HasPermissionsToTeam(user.TeamId, "updateActive") {
		return
	}

	if !strings.Contains(c.Session.Roles, model.ROLE_ADMIN) && !c.IsSystemAdmin() {
		c.Err = model.NewAppError("updateActive", "You do not have the appropriate permissions", "userId="+user_id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	// make sure there is at least 1 other active admin
	if !active && strings.Contains(user.Roles, model.ROLE_ADMIN) {
		if result := <-Srv.Store.User().GetProfiles(user.TeamId); result.Err != nil {
			c.Err = result.Err
			return
		} else {
			activeAdmins := -1
			profileUsers := result.Data.(map[string]*model.User)
			for _, profileUser := range profileUsers {
				if profileUser.DeleteAt == 0 && strings.Contains(profileUser.Roles, model.ROLE_ADMIN) {
					activeAdmins = activeAdmins + 1
				}
			}

			if activeAdmins <= 0 {
				c.Err = model.NewAppError("updateRoles", "There must be at least one active admin", "userId="+user_id)
				return
			}
		}
	}

	if active {
		user.DeleteAt = 0
	} else {
		user.DeleteAt = model.GetMillis()
	}

	if result := <-Srv.Store.User().Update(user, true); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAuditWithUserId(user.Id, fmt.Sprintf("active=%v", active))

		if user.DeleteAt > 0 {
			RevokeAllSession(c, user.Id)
		}

		ruser := result.Data.([2]*model.User)[0]
		options := utils.SanitizeOptions
		options["passwordupdate"] = false
		ruser.Sanitize(options)
		w.Write([]byte(ruser.ToJson()))
	}
}

func sendPasswordReset(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("sendPasswordReset", "email")
		return
	}

	domain := props["domain"]
	if len(domain) == 0 {
		c.SetInvalidParam("sendPasswordReset", "domain")
		return
	}

	var team *model.Team
	if result := <-Srv.Store.Team().GetByDomain(domain); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-Srv.Store.User().GetByEmail(team.Id, email); result.Err != nil {
		c.Err = model.NewAppError("sendPasswordReset", "We couldn’t find an account with that address.", "email="+email+" team_id="+team.Id)
		return
	} else {
		user = result.Data.(*model.User)
	}

	newProps := make(map[string]string)
	newProps["user_id"] = user.Id
	newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

	data := model.MapToJson(newProps)
	hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.ResetSalt))

	link := fmt.Sprintf("%s/reset_password?d=%s&h=%s", c.TeamUrl, url.QueryEscape(data), url.QueryEscape(hash))

	subjectPage := NewServerTemplatePage("reset_subject", c.TeamUrl)
	bodyPage := NewServerTemplatePage("reset_body", c.TeamUrl)
	bodyPage.Props["ResetUrl"] = link

	if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
		c.Err = model.NewAppError("sendPasswordReset", "Failed to send password reset email successfully", "err="+err.Message)
		return
	}

	c.LogAuditWithUserId(user.Id, "sent="+email)

	w.Write([]byte(model.MapToJson(props)))
}

func resetPassword(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	newPassword := props["new_password"]
	if len(newPassword) < 5 {
		c.SetInvalidParam("resetPassword", "new_password")
		return
	}

	hash := props["hash"]
	if len(hash) == 0 {
		c.SetInvalidParam("resetPassword", "hash")
		return
	}

	data := model.MapFromJson(strings.NewReader(props["data"]))

	userId := data["user_id"]
	if len(userId) != 26 {
		c.SetInvalidParam("resetPassword", "data:user_id")
		return
	}

	timeStr := data["time"]
	if len(timeStr) == 0 {
		c.SetInvalidParam("resetPassword", "data:time")
		return
	}

	domain := props["domain"]
	if len(domain) == 0 {
		c.SetInvalidParam("resetPassword", "domain")
		return
	}

	c.LogAuditWithUserId(userId, "attempt")

	var team *model.Team
	if result := <-Srv.Store.Team().GetByDomain(domain); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var user *model.User
	if result := <-Srv.Store.User().Get(userId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	if user.TeamId != team.Id {
		c.Err = model.NewAppError("resetPassword", "Trying to reset password for user on wrong team.", "userId="+user.Id+", teamId="+team.Id)
		c.Err.StatusCode = http.StatusForbidden
		return
	}

	if !model.ComparePassword(hash, fmt.Sprintf("%v:%v", props["data"], utils.Cfg.ServiceSettings.ResetSalt)) {
		c.Err = model.NewAppError("resetPassword", "The reset password link does not appear to be valid", "")
		return
	}

	t, err := strconv.ParseInt(timeStr, 10, 64)
	if err != nil || model.GetMillis()-t > 1000*60*60 { // one hour
		c.Err = model.NewAppError("resetPassword", "The reset link has expired", "")
		return
	}

	if result := <-Srv.Store.User().UpdatePassword(userId, model.HashPassword(newPassword)); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAuditWithUserId(userId, "success")
	}

	fireAndForgetPasswordChangeEmail(user.Email, team.Name, c.TeamUrl, "using a reset password link")

	props["new_password"] = ""
	w.Write([]byte(model.MapToJson(props)))
}

func fireAndForgetPasswordChangeEmail(email, teamName, teamUrl, method string) {
	go func() {

		subjectPage := NewServerTemplatePage("password_change_subject", teamUrl)
		subjectPage.Props["TeamName"] = teamName
		bodyPage := NewServerTemplatePage("password_change_body", teamUrl)
		bodyPage.Props["TeamName"] = teamName
		bodyPage.Props["Method"] = method

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error("Failed to send update password email successfully err=%v", err)
		}

	}()
}

func fireAndForgetEmailChangeEmail(email, teamName, teamUrl string) {
	go func() {

		subjectPage := NewServerTemplatePage("email_change_subject", teamUrl)
		subjectPage.Props["TeamName"] = teamName
		bodyPage := NewServerTemplatePage("email_change_body", teamUrl)
		bodyPage.Props["TeamName"] = teamName

		if err := utils.SendMail(email, subjectPage.Render(), bodyPage.Render()); err != nil {
			l4g.Error("Failed to send update password email successfully err=%v", err)
		}

	}()
}

func updateUserNotify(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.MapFromJson(r.Body)

	user_id := props["user_id"]
	if len(user_id) != 26 {
		c.SetInvalidParam("updateUserNotify", "user_id")
		return
	}

	uchan := Srv.Store.User().Get(user_id)

	if !c.HasPermissionsToUser(user_id, "updateUserNotify") {
		return
	}

	delete(props, "user_id")

	email := props["email"]
	if len(email) == 0 {
		c.SetInvalidParam("updateUserNotify", "email")
		return
	}

	desktop_sound := props["desktop_sound"]
	if len(desktop_sound) == 0 {
		c.SetInvalidParam("updateUserNotify", "desktop_sound")
		return
	}

	desktop := props["desktop"]
	if len(desktop) == 0 {
		c.SetInvalidParam("updateUserNotify", "desktop")
		return
	}

	var user *model.User
	if result := <-uchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		user = result.Data.(*model.User)
	}

	user.NotifyProps = props

	if result := <-Srv.Store.User().Update(user, false); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		c.LogAuditWithUserId(user.Id, "")

		ruser := result.Data.([2]*model.User)[0]
		options := utils.SanitizeOptions
		options["passwordupdate"] = false
		ruser.Sanitize(options)
		w.Write([]byte(ruser.ToJson()))
	}
}

func getStatuses(c *Context, w http.ResponseWriter, r *http.Request) {

	if result := <-Srv.Store.User().GetProfiles(c.Session.TeamId); result.Err != nil {
		c.Err = result.Err
		return
	} else {

		profiles := result.Data.(map[string]*model.User)

		statuses := map[string]string{}
		for _, profile := range profiles {
			if profile.IsOffline() {
				statuses[profile.Id] = model.USER_OFFLINE
			} else if profile.IsAway() {
				statuses[profile.Id] = model.USER_AWAY
			} else {
				statuses[profile.Id] = model.USER_ONLINE
			}
		}

		//w.Header().Set("Cache-Control", "max-age=9, public") // 2 mins
		w.Write([]byte(model.MapToJson(statuses)))
		return
	}
}
