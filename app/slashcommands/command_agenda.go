package slashcommands

import (
	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

const (
	AgendaCommands       = "queue, list"
	CommandTriggerAgenda = "agenda"
)

type AgendaProvider struct{}

func init() {
	app.RegisterCommandProvider(&AgendaProvider{})
}

func (ap *AgendaProvider) GetTrigger() string {
	return CommandTriggerAgenda
}

func (ap *AgendaProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	agenda := model.NewAutocompleteData(ap.GetTrigger(), "[action]", AgendaCommands)

	queue := model.NewAutocompleteData("queue", "[item title]", "queue an item for next meeting")
	list := model.NewAutocompleteData("list", "", "view agenda items board")

	agenda.AddCommand(queue)
	agenda.AddCommand(list)

	return &model.Command{
		Trigger:          ap.GetTrigger(),
		AutoComplete:     true,
		AutoCompleteDesc: "Queue items in this channel's Agenda",
		AutoCompleteHint: "[action]",
		DisplayName:      "agenda",
		AutocompleteData: agenda,
	}
}

func (ap *AgendaProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	return responsef("hey, that tickles")
}
