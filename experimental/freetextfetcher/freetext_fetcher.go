package freetextfetcher

import (
	"fmt"

	"github.com/mattermost/mattermost-plugin-api/experimental/bot/logger"
	"github.com/mattermost/mattermost-plugin-api/experimental/bot/poster"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
)

// FreetextFetcher defines the behavior of free text fetchers
type FreetextFetcher interface {
	MessageHasBeenPosted(c *plugin.Context, post *model.Post, api plugin.API, l logger.Logger, botUserID string, pluginURL string)
	StartFetching(userID string, payload string)
	UpdateHooks(validate func(string) string, onFetch func(string, string), onCancel func(string))
	URL() string
}

type freetextFetcher struct {
	id       string
	baseURL  string
	poster   poster.Poster
	store    FreetextStore
	validate func(string) string
	onFetch  func(string, string)
	onCancel func(string)
}

// NewFreetextFetcher creates a new FreetextFetcher
func NewFreetextFetcher(
	baseURL string,
	store FreetextStore,
	validate func(string) string,
	onFetch func(string, string),
	onCancel func(string),
	r *mux.Router,
	p poster.Poster,
) FreetextFetcher {
	ftf := &freetextFetcher{
		id:       model.NewId(),
		baseURL:  baseURL,
		store:    store,
		validate: validate,
		onFetch:  onFetch,
		onCancel: onCancel,
		poster:   p,
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

func (ftf *freetextFetcher) StartFetching(userID, payload string) {
	_ = ftf.store.StartFetching(userID, ftf.id, payload)
}

func (ftf *freetextFetcher) MessageHasBeenPosted(c *plugin.Context, post *model.Post, api plugin.API, l logger.Logger, botUserID, pluginURL string) {
	if botUserID == post.UserId {
		return
	}

	ch, appErr := api.GetDirectChannel(botUserID, post.UserId)
	if appErr != nil {
		l.Errorf("error getting direct channel: %s", appErr.Error())
		return
	}

	if ch.Id != post.ChannelId {
		return
	}

	shouldProcess, payload, err := ftf.store.ShouldProcessFreetext(post.UserId, ftf.id)
	if err != nil {
		l.Errorf("error checking if should process the text: %s", err.Error())
		return
	}

	if !shouldProcess {
		return
	}

	validation := ftf.validate(post.Message)
	if validation != "" {
		_, _ = ftf.poster.DM(post.UserId, validation)
		return
	}

	ftf.postConfirmation(post.UserId, post.Message, pluginURL, payload)
	err = ftf.store.StopFetching(post.UserId)
	if err != nil {
		l.Errorf("error stopping the text fetching: %s", err.Error())
		return
	}
}

func (ftf *freetextFetcher) URL() string {
	return ftf.baseURL + "/" + ftf.id
}

func (ftf *freetextFetcher) postConfirmation(userID, message, pluginURL, payload string) {
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

	title := "Confirm input"
	text := fmt.Sprintf("You have typed `%s`. Is that correct?", message)
	sa := &model.SlackAttachment{
		Title:    title,
		Text:     text,
		Fallback: fmt.Sprintf("%s: %s", title, text),
		Actions:  []*model.PostAction{&actionConfirm, &actionRetry, &actionCancel},
	}

	_, _ = ftf.poster.DMWithAttachments(userID, sa)
}
