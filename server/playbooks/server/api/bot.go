package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/bot"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/playbooks"
	"github.com/mattermost/mattermost-server/v6/model"
)

type BotHandler struct {
	*ErrorHandler
	api                playbooks.ServicesAPI
	poster             bot.Poster
	config             config.Service
	playbookRunService app.PlaybookRunService
	userInfoStore      app.UserInfoStore
}

func NewBotHandler(router *mux.Router, api playbooks.ServicesAPI, poster bot.Poster, config config.Service, playbookRunService app.PlaybookRunService, userInfoStore app.UserInfoStore) *BotHandler {
	handler := &BotHandler{
		ErrorHandler:       &ErrorHandler{},
		api:                api,
		poster:             poster,
		config:             config,
		playbookRunService: playbookRunService,
		userInfoStore:      userInfoStore,
	}

	botRouter := router.PathPrefix("/bot").Subrouter()

	notifyAdminsRouter := botRouter.PathPrefix("/notify-admins").Subrouter()
	notifyAdminsRouter.HandleFunc("", withContext(handler.notifyAdmins)).Methods(http.MethodPost)
	notifyAdminsRouter.HandleFunc("/button-start-trial", withContext(handler.startTrial)).Methods(http.MethodPost)

	botRouter.HandleFunc("/connect", withContext(handler.connect)).Methods(http.MethodGet)

	return handler
}

type messagePayload struct {
	MessageType string `json:"message_type"`
}

func (h *BotHandler) notifyAdmins(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var payload messagePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode message", err)
		return
	}

	if err := h.poster.NotifyAdmins(payload.MessageType, userID, !h.api.IsEnterpriseReady()); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func CanStartTrialLicense(userID string, api playbooks.ServicesAPI) error {
	if !api.HasPermissionTo(userID, model.PermissionManageLicenseInformation) {
		return errors.Wrap(app.ErrNoPermissions, "no permission to manage license information")
	}

	return nil
}

func (h *BotHandler) startTrial(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	if err := CanStartTrialLicense(userID, h.api); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "no permission to start a trial license", err)
		return
	}

	var requestData *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to parse json", err)
		return
	}
	if requestData == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "missing request data", nil)
		return
	}

	users, ok := requestData.Context["users"].(float64)
	if !ok {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "malformed context: users is not a number", nil)
		return
	}

	termsAccepted, ok := requestData.Context["termsAccepted"].(bool)
	if !ok {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "malformed context: termsAccepted is not a boolean", nil)
		return
	}

	receiveEmailsAccepted, ok := requestData.Context["receiveEmailsAccepted"].(bool)
	if !ok {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "malformed context: receiveEmailsAccepted is not a boolean", nil)
		return
	}

	originalPost, err := h.api.GetPost(requestData.PostId)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Modify the button text while the license is downloading
	originalAttachments := originalPost.Attachments()
outer:
	for _, attachment := range originalAttachments {
		for _, action := range attachment.Actions {
			if action.Id == "message" {
				action.Name = "Requesting trial..."
				break outer
			}
		}
	}
	model.ParseSlackAttachment(originalPost, originalAttachments)
	_, _ = h.api.UpdatePost(originalPost)

	post := &model.Post{
		Id: requestData.PostId,
	}

	if err := h.api.RequestTrialLicense(requestData.UserId, int(users), termsAccepted, receiveEmailsAccepted); err != nil {
		post.Message = "Trial license could not be retrieved. Visit [https://mattermost.com/trial/](https://mattermost.com/trial/) to request a license."

		if _, postErr := h.api.UpdatePost(post); postErr != nil {
			logrus.WithError(postErr).WithField("post_id", post.Id).Error("unable to edit the admin notification post")
		}

		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to request the trial license", err)
		return
	}

	post.Message = "Thank you!"
	attachments := []*model.SlackAttachment{
		{
			Title: "You’re currently on a free trial of Mattermost Enterprise.",
			Text:  "Your free trial will expire in **30 days**. Visit our Customer Portal to purchase a license to continue using commercial edition features after your trial ends.\n[Purchase a license](https://customers.mattermost.com/signup)\n[Contact sales](https://mattermost.com/contact-us/)",
		},
	}
	model.ParseSlackAttachment(post, attachments)

	if _, err := h.api.UpdatePost(post); err != nil {
		logrus.WithError(err).WithField("post_id", post.Id).Error("unable to edit the admin notification post")
	}

	ReturnJSON(w, post, http.StatusOK)
}

type DigestSenderParams struct {
	isWeekly bool
}

// connect handles the GET /bot/connect endpoint (a notification sent when the client wakes up or reconnects)
func (h *BotHandler) connect(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	info, err := h.userInfoStore.Get(userID)
	if errors.Is(err, app.ErrNotFound) {
		info = app.UserInfo{
			ID: userID,
		}
	} else if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	var timezone *time.Location
	offset, _ := strconv.Atoi(r.Header.Get("X-Timezone-Offset"))
	timezone = time.FixedZone("local", offset*60*60)

	sendRegularDigest := h.createDigestSender(c, w, userID, &info)

	// we want to first try a weekly digest
	// if we have already sent it this week, try with a daily one
	currentTime := time.UnixMilli(model.GetMillis()).In(timezone)
	if app.ShouldSendWeeklyDigestMessage(info, timezone, currentTime) {
		sendRegularDigest(DigestSenderParams{isWeekly: true})
	} else if app.ShouldSendDailyDigestMessage(info, timezone, currentTime) {
		sendRegularDigest(DigestSenderParams{isWeekly: false})
	}

	w.WriteHeader(http.StatusOK)
}

func (h *BotHandler) createDigestSender(c *Context, w http.ResponseWriter, userID string, userInfo *app.UserInfo) func(DigestSenderParams) {
	return func(params DigestSenderParams) {
		now := model.GetMillis()
		// record that we're sending a DM now (this will prevent us trying over and over on every
		// response if there's a failure later)
		userInfo.LastDailyTodoDMAt = now
		if err := h.userInfoStore.Upsert(*userInfo); err != nil {
			h.HandleError(w, c.logger, err)
			return
		}

		regulartity := "daily"
		if params.isWeekly {
			regulartity = "weekly"
		}

		if err := h.playbookRunService.DMTodoDigestToUser(userID, false, params.isWeekly); err != nil {
			h.HandleError(w, c.logger, errors.Wrapf(err, "failed to send '%s' DMTodoDigest to userID '%s'", regulartity, userID))
			return
		}
	}
}
