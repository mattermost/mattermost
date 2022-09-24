package slashcommands

import (
	"fmt"
	"strings"

	fbClient "github.com/mattermost/focalboard/server/client"
	fbModel "github.com/mattermost/focalboard/server/model"
	fbUtils "github.com/mattermost/focalboard/server/utils"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
)

const (
	AgendaCommands       = "queue, list"
	CommandTriggerAgenda = "agenda"

	StatusPropName = "Status"
	StatusUpNext   = "Up Next"
	StatusDone     = "Done"
	StatusRevisit  = "Revisit"
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
	if a.Config().ServiceSettings.SiteURL == nil {
		return responsef("SiteURL must be set to use the agenda command")
	}

	split := strings.Fields(message)

	if len(split) < 1 {
		return responsef("Missing command. You can try queue, list, help: " + message)
	}

	action := split[0]

	switch action {
	case "queue":
		topic := strings.Join(split[1:], " ")

		return ap.executeQueueCommand(a, c, args, topic)

	case "list":
		return ap.executeListCommand(a, c, args)
	}

	return &model.CommandResponse{}
}

func (ap *AgendaProvider) executeQueueCommand(a *app.App, c request.CTX, args *model.CommandArgs, topic string) *model.CommandResponse {

	channel, appErr := a.GetChannel(c, args.ChannelId)
	if appErr != nil || channel == nil {
		return responsef("unable to get current Channel: %s", appErr.Message)
	}

	userSession := args.Session.Token

	cardLink, err := ap.addCardToBoard(a, c, channel, args.UserId, topic, userSession)
	if err != nil {
		return responsef("Error creating board card: " + err.Error())
	}

	cardAddedPost := &model.Post{
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
		Message:   cardLink,
	}

	_, appErr = a.CreatePost(c, cardAddedPost, channel, false, true)
	if appErr != nil {
		return responsef("Error creating post: %s", appErr.Message)
	}

	return &model.CommandResponse{}
}

func (ap *AgendaProvider) executeListCommand(app *app.App, c request.CTX, args *model.CommandArgs) *model.CommandResponse {
	fmt.Println("Listing agenda items here")

	client := getBoardsClient(app, args.Session.Token)

	channel, appErr := app.GetChannel(c, args.ChannelId)
	if appErr != nil || channel == nil {
		return responsef("Error fetching channel")
	}

	// get agenda board for current channel
	// ToDo:  don't create missing board for list action
	board, err := ap.getOrCreateBoardForChannel(args.ChannelId, args.UserId, client, app, c)
	if err != nil {
		return responsef("Error fetching agenda board")
	}

	// make card link for every "up next" card
	cards, resp := client.GetCards(board.ID, 0, 100)
	if resp.Error != nil {
		return responsef("Error fetching agenda cards")
	}

	if len(cards) == 0 {
		return responsef("No agenda items found")
	}

	cardLinks := make([]string, 0, len(cards))

	statusProp := getCardPropertyByName(board, StatusPropName)
	statusPropID := statusProp["id"].(string)
	statusOpt := getPropertyOptionByValue(statusProp, StatusUpNext)
	statusUpNextID := statusOpt["id"]

	for _, card := range cards {
		// look for "Up Next" value in "Status" prop
		val, ok := card.Properties[statusPropID]
		if !ok || val != statusUpNextID {
			continue
		}

		link := fmt.Sprintf("[%s](%s)", card.Title, makeCardLink(app, args.TeamId, board.ID, card.ID))
		cardLinks = append(cardLinks, link)
	}

	// post ephemeral message for each card link; unfurl will display the card for user.
	for _, link := range cardLinks {
		post := &model.Post{
			UserId:    args.UserId,
			ChannelId: args.ChannelId,
			RootId:    args.RootId,
			Message:   link,
		}
		_, appErr := app.CreatePost(c, post, channel, false, true)
		if appErr != nil {
			return responsef("Error creating post: " + appErr.Error())
		}
	}
	return &model.CommandResponse{}
}

func (ap *AgendaProvider) addCardToBoard(a *app.App, c request.CTX, channel *model.Channel, userID, title, usersession string) (string, error) {
	// We are connecting to the Focalboard API directly
	// while it is brought in as part of the multi-product architecture
	fbClient := getBoardsClient(a, usersession)

	board, err := ap.getOrCreateBoardForChannel(channel.Id, userID, fbClient, a, c)
	if err != nil {
		fmt.Println("error getting board" + err.Error())
		return "", err
	}

	statusProp := getCardPropertyByName(board, StatusPropName)
	if statusProp == nil {
		return "", errors.New("status card property not found on board")
	}

	creator := userID

	statusOption := getPropertyOptionByValue(statusProp, StatusUpNext)
	if statusOption == nil {
		return "", errors.New("option not found on status card property")
	}

	postIDProp := getCardPropertyByName(board, "Post ID")
	if postIDProp == nil {
		return "", errors.New("post id card property not found on board")
	}

	createdByProp := getCardPropertyByName(board, "Created By")
	if createdByProp == nil {
		return "", errors.New("created by card property not found on board")
	}

	now := model.GetMillis()

	card := fbModel.Block{
		BoardID:   board.ID,
		Type:      fbModel.TypeCard,
		Title:     title,
		CreatedBy: creator,
		Fields: map[string]interface{}{
			"icon": "📋",
			"properties": map[string]interface{}{
				statusProp["id"].(string):    statusOption["id"],
				postIDProp["id"].(string):    "",
				createdByProp["id"].(string): creator,
			},
		},
		CreateAt: now,
		UpdateAt: now,
		DeleteAt: 0,
	}

	blocks, resp := fbClient.InsertBlocks(board.ID, []fbModel.Block{card}, false)
	if resp.Error != nil {
		return "", resp.Error
	}

	if len(blocks) != 1 {
		return "", errors.New("blocks not inserted correctly to board created")
	}

	cardUrl := fbUtils.MakeCardLink(*a.Config().ServiceSettings.SiteURL, channel.TeamId, board.ID, blocks[0].ID)
	return cardUrl, err
}

func (ap *AgendaProvider) getOrCreateBoardForChannel(channelID, creatorUserID string, client *fbClient.Client, a *app.App, c request.CTX) (*fbModel.Board, error) {

	channel, appErr := a.GetChannel(c, channelID)
	if appErr != nil || channel == nil {
		return nil, errors.Wrap(appErr, "unable to get current Channel")
	}

	boardSearchKey := "agenda-" + channelID

	boards, resp := client.SearchBoardsForUser(channel.TeamId, boardSearchKey, fbModel.BoardSearchFieldPropertyName)
	if resp.Error != nil {
		return nil, errors.Wrap(resp.Error, "unable to get board by id")
	}

	if len(boards) > 0 {
		return boards[0], nil
	}

	// If no board is found,
	// let's create one
	now := model.GetMillis()

	createdByProp := map[string]interface{}{
		"id":      model.NewId(),
		"name":    "Created By",
		"type":    "person",
		"options": []interface{}{},
	}

	propSearchId := "agenda-" + channelID

	board := &fbModel.Board{
		ID:        fbUtils.NewID(fbUtils.IDTypeBoard),
		TeamID:    channel.TeamId,
		ChannelID: channel.Id,
		Type:      fbModel.BoardTypeOpen,
		Title:     "Meeting Agenda",
		CreatedBy: creatorUserID,
		Properties: map[string]interface{}{
			propSearchId: "",
		},
		CardProperties: []map[string]interface{}{
			createdByProp,
			{
				"id":      model.NewId(),
				"name":    "Created At",
				"type":    "createdTime",
				"options": []interface{}{},
			},
			{
				"id":   model.NewId(),
				"name": StatusPropName,
				"type": "select",
				"options": []map[string]interface{}{
					{
						"id":    model.NewId(),
						"value": StatusUpNext,
						"color": "propColorGray",
					},
					{
						"id":    model.NewId(),
						"value": StatusRevisit,
						"color": "propColorYellow",
					},
					{
						"id":    model.NewId(),
						"value": StatusDone,
						"color": "propColorGreen",
					},
				},
			},
			{
				"id":      model.NewId(),
				"name":    "Post ID",
				"type":    "text",
				"options": []interface{}{},
			},
		},
		CreateAt: now,
		UpdateAt: now,
		DeleteAt: 0,
	}

	block := fbModel.Block{
		ID:       model.NewId(),
		Type:     fbModel.TypeView,
		BoardID:  board.ID,
		ParentID: board.ID,
		Schema:   1,
		Fields: map[string]interface{}{
			"viewType":           fbModel.TypeBoard,
			"sortOptions":        []interface{}{},
			"visiblePropertyIds": []interface{}{createdByProp["id"].(string)},
			"visibleOptionIds":   []interface{}{},
			"hiddenOptionIds":    []interface{}{},
			"collapsedOptionIds": []interface{}{},
			"filter": map[string]interface{}{
				"operation": "and",
				"filters":   []interface{}{},
			},
			"cardOrder":          []interface{}{},
			"columnWidths":       map[string]interface{}{},
			"columnCalculations": map[string]interface{}{},
			"kanbanCalculations": map[string]interface{}{},
			"defaultTemplateId":  "",
		},
		Title:    "All",
		CreateAt: now,
		UpdateAt: now,
		DeleteAt: 0,
	}

	boardsAndBlocks := &fbModel.BoardsAndBlocks{Boards: []*fbModel.Board{board}, Blocks: []fbModel.Block{block}}

	boardsAndBlocks, resp = client.CreateBoardsAndBlocks(boardsAndBlocks)
	if resp.Error != nil {
		return nil, errors.Wrap(resp.Error, "unable to create board")
	}
	if len(boardsAndBlocks.Boards) == 0 {
		return nil, errors.New("no boards or blocks returned at board creation")
	}

	board = boardsAndBlocks.Boards[0]

	member := &fbModel.BoardMember{
		BoardID:     board.ID,
		UserID:      creatorUserID,
		SchemeAdmin: true,
	}

	_, resp = client.AddMemberToBoard(member)
	if resp.Error != nil {
		return nil, errors.Wrap(resp.Error, "unable to add user to board")
	}

	return board, nil
}

func getCardPropertyByName(board *fbModel.Board, name string) map[string]interface{} {
	for _, prop := range board.CardProperties {
		if prop["name"] == name {
			return prop
		}
	}

	return nil
}

func getPropertyOptionByValue(property map[string]interface{}, value string) map[string]interface{} {
	optionInterfaces, ok := property["options"].([]interface{})
	if !ok {
		return nil
	}

	for _, optionInterface := range optionInterfaces {
		option, ok := optionInterface.(map[string]interface{})
		if !ok {
			continue
		}

		if option["value"] == value {
			return option
		}
	}

	return nil
}

func getBoardsClient(app *app.App, userSession string) *fbClient.Client {
	fbUrl := fmt.Sprintf("%s/plugins/focalboard", *app.Config().ServiceSettings.SiteURL)
	return fbClient.NewClient(fbUrl, userSession)
}

func makeCardLink(app *app.App, teamID, boardID, cardID string) string {
	return fbUtils.MakeCardLink(*app.Config().ServiceSettings.SiteURL+"/boards", teamID, boardID, cardID)
}
