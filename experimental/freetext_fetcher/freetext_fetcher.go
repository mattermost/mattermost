package freetext_fetcher

import (
	"fmt"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

type FreetextFetcher interface {
	MessageHasBeenPosted(c *plugin.Context, post *model.Post, api plugin.API, loggerBot logger.Logger, botUserID string, pluginURL string)
	StartFetching(userID string, payload string)
	UpdateHooks(validate func(string) string, onFetch func(string, string), onCancel func(string))
	URL() string
}

type freetextFetcher struct {
	id        string
	baseUrl   string
	posterBot poster.Poster
	store     FreetextStore
	validate  func(string) string
	onFetch   func(string, string)
	onCancel  func(string)
}

func NewFreetextFetcher(baseURL string, store FreetextStore, validate func(string) string, onFetch func(string, string), onCancel func(string), r *mux.Router, posterBot poster.Poster) FreetextFetcher {
	ftf := &freetextFetcher{
		id:        model.NewId(),
		baseUrl:   baseURL,
		store:     store,
		validate:  validate,
		onFetch:   onFetch,
		onCancel:  onCancel,
		posterBot: posterBot,
	}
	ftf.initHandle(r)
	ftfManager.ftfList = append(ftfManager.ftfList, ftf)
	return ftf
}

func (ftf *freetextFetcher) UpdateHooks(validate func(string) string, onFetch func(string, string), onCancel func(string)) {
	if validate != nil {
		ftf.validate = validate
	}

	if onFetch != nil {
		ftf.onFetch = onFetch
	}

	if onCancel != nil {
		ftf.onCancel = onCancel
	}
}

func (ftf *freetextFetcher) StartFetching(userID string, payload string) {
	ftf.store.StartFetching(userID, ftf.id, payload)
}

func (ftf *freetextFetcher) MessageHasBeenPosted(c *plugin.Context, post *model.Post, api plugin.API, loggerBot logger.Logger, botUserID string, pluginURL string) {
	if botUserID == post.UserId {
		return
	}

	ch, appErr := api.GetDirectChannel(botUserID, post.UserId)
	if appErr != nil {
		loggerBot.Errorf("error getting direct channel: %s", appErr.Error())
		return
	}

	if ch.Id != post.ChannelId {
		return
	}

	shouldProcess, payload, err := ftf.store.ShouldProcessFreetext(post.UserId, ftf.id)
	if err != nil {
		loggerBot.Errorf("error checking if should process the text: %s", err.Error())
		return
	}

	if !shouldProcess {
		return
	}

	validation := ftf.validate(post.Message)
	if validation != "" {
		ftf.posterBot.DM(post.UserId, validation)
		return
	}

	ftf.postConfirmation(post.UserId, post.Message, pluginURL, payload)
	err = ftf.store.StopFetching(post.UserId)
	if err != nil {
		loggerBot.Errorf("error stopping the text fetching: %s", err.Error())
		return
	}
}

func (ftf *freetextFetcher) URL() string {
	return ftf.baseUrl + "/" + ftf.id
}

func (ftf *freetextFetcher) postConfirmation(userID, message string, pluginURL string, payload string) {
	handleURL := pluginURL + ftf.URL()
	actionConfirm := model.PostAction{
		Name: "Confirm",
		Integration: &model.PostActionIntegration{
			URL: handleURL,
			Context: map[string]interface{}{
				ContextMessageKey: message,
				ContextPayloadKey: payload,
			},
		},
	}

	actionRetry := model.PostAction{
		Name: "Retry",
		Integration: &model.PostActionIntegration{
			URL: handleURL,
			Context: map[string]interface{}{
				ContextPayloadKey: payload,
			},
		},
	}

	actionCancel := model.PostAction{
		Name: "Cancel",
		Integration: &model.PostActionIntegration{
			URL: handleURL,
			Context: map[string]interface{}{
				ContextActionKey:  CancelAction,
				ContextPayloadKey: payload,
			},
		},
	}

	sa := &model.SlackAttachment{
		Title:   "Confirm input",
		Text:    fmt.Sprintf("You have typed `%s`. Is that correct?", message),
		Actions: []*model.PostAction{&actionConfirm, &actionRetry, &actionCancel},
	}

	ftf.posterBot.DMWithAttachments(userID, sa)
}
