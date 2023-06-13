// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package command

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/bot"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/config"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/playbooks"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/timeutils"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const helpText = "###### Mattermost Playbooks Plugin - Slash Command Help\n" +
	"* `/playbook run` - Run a playbook. \n" +
	"* `/playbook finish` - Finish the playbook run in this channel. \n" +
	"* `/playbook update` - Provide a status update. \n" +
	"* `/playbook check [checklist #] [item #]` - check/uncheck the checklist item. \n" +
	"* `/playbook checkadd [checklist #] [item text]` - add a checklist item. \n" +
	"* `/playbook checkremove [checklist #] [item #]` - remove a checklist item. \n" +
	"* `/playbook owner [@username]` - Show or change the current owner. \n" +
	"* `/playbook info` - Show a summary of the current playbook run. \n" +
	"* `/playbook timeline` - Show the timeline for the current playbook run. \n" +
	"* `/playbook todo` - Get a list of your assigned tasks. \n" +
	"* `/playbook settings digest [on/off]` - turn daily digest on/off. \n" +
	"* `/playbook settings weekly-digest [on/off]` - turn weekly digest on/off. \n" +
	"\n" +
	"Learn more [in our documentation](https://mattermost.com/pl/default-incident-response-app-documentation). \n" +
	""

const confirmPrompt = "CONFIRM"

// Register is a function that allows the runner to register commands with the mattermost server.
type Register func(*model.Command) error

// RegisterCommands should be called by the plugin to register all necessary commands
func RegisterCommands(registerFunc Register, addTestCommands bool) error {
	return registerFunc(getCommand(addTestCommands))
}

func getCommand(addTestCommands bool) *model.Command {
	return &model.Command{
		Trigger:          "playbook",
		DisplayName:      "Playbook",
		Description:      "Playbooks",
		AutoComplete:     true,
		AutoCompleteDesc: "Available commands: run, finish, update, check, list, owner, info, todo, settings",
		AutoCompleteHint: "[command]",
		AutocompleteData: getAutocompleteData(addTestCommands),
	}
}

func getAutocompleteData(addTestCommands bool) *model.AutocompleteData {
	command := model.NewAutocompleteData("playbook", "[command]",
		"Available commands: run, finish, update, check, checkadd, checkremove, list, owner, info, timeline, todo, settings")

	run := model.NewAutocompleteData("run", "", "Starts a new playbook run")
	command.AddCommand(run)

	finish := model.NewAutocompleteData("finish", "",
		"Finishes a playbook run associated with the current channel")
	finish.AddDynamicListArgument(
		"List of channel runs is loading",
		"api/v0/runs/runs-autocomplete", true)
	command.AddCommand(finish)

	update := model.NewAutocompleteData("update", "",
		"Provide a status update.")
	update.AddDynamicListArgument(
		"List of channel runs is loading",
		"api/v0/runs/runs-autocomplete", true)
	command.AddCommand(update)

	checklist := model.NewAutocompleteData("check", "[checklist item]",
		"Checks or unchecks a checklist item.")
	checklist.AddDynamicListArgument(
		"List of checklist items is loading",
		"api/v0/runs/checklist-autocomplete-item", true)
	command.AddCommand(checklist)

	itemAdd := model.NewAutocompleteData("checkadd", "[checklist]",
		"Add a checklist item")
	itemAdd.AddDynamicListArgument(
		"List of checklist items is loading",
		"api/v0/runs/checklist-autocomplete", true)

	itemRemove := model.NewAutocompleteData("checkremove", "[checklist item]",
		"Remove a checklist item")
	itemRemove.AddDynamicListArgument(
		"List of checklist items is loading",
		"api/v0/runs/checklist-autocomplete-item", true)

	command.AddCommand(itemAdd)
	command.AddCommand(itemRemove)

	owner := model.NewAutocompleteData("owner", "[@username]",
		"Show or change the current owner")
	owner.AddDynamicListArgument(
		"List of channel runs is loading",
		"api/v0/runs/runs-autocomplete", true)
	owner.AddTextArgument("The desired new owner.", "[@username]", "")
	command.AddCommand(owner)

	info := model.NewAutocompleteData("info", "", "Shows a summary of the current playbook run")
	info.AddDynamicListArgument(
		"List of channel runs is loading",
		"api/v0/runs/runs-autocomplete", true)
	command.AddCommand(info)

	timeline := model.NewAutocompleteData("timeline", "", "Shows the timeline for the current playbook run")
	timeline.AddDynamicListArgument(
		"List of channel runs is loading",
		"api/v0/runs/runs-autocomplete", true)
	command.AddCommand(timeline)

	todo := model.NewAutocompleteData("todo", "", "Get a list of your assigned tasks")
	command.AddCommand(todo)

	settings := model.NewAutocompleteData("settings", "", "Change personal playbook settings")
	display := model.NewAutocompleteData(" ", "Display current settings", "")
	settings.AddCommand(display)

	weeklyDigest := model.NewAutocompleteData("weekly-digest", "[on/off]", "Turn weekly digest on/off")
	weeklyDigestValues := []model.AutocompleteListItem{{
		HelpText: "Turn weekly digest on",
		Item:     "on",
	}, {
		HelpText: "Turn weekly digest off",
		Item:     "off",
	}}
	weeklyDigest.AddStaticListArgument("", true, weeklyDigestValues)
	settings.AddCommand((weeklyDigest))

	digest := model.NewAutocompleteData("digest", "[on/off]", "Turn digest on/off")
	digestValue := []model.AutocompleteListItem{{
		HelpText: "Turn daily digest on",
		Item:     "on",
	}, {
		HelpText: "Turn daily digest off",
		Item:     "off",
	}}
	digest.AddStaticListArgument("", true, digestValue)
	settings.AddCommand(digest)
	command.AddCommand(settings)

	if addTestCommands {
		test := model.NewAutocompleteData("test", "", "Commands for testing and debugging.")

		testGeneratePlaybooks := model.NewAutocompleteData("create-playbooks", "[total playbooks]", "Create one or more playbooks based on number of playbooks defined")
		testGeneratePlaybooks.AddTextArgument("An integer indicating how many playbooks will be generated (at most 5).", "Number of playbooks", "")
		test.AddCommand(testGeneratePlaybooks)

		testCreate := model.NewAutocompleteData("create-playbook-run", "[playbook ID] [timestamp] [name]", "Run a playbook with a specific creation date")
		testCreate.AddDynamicListArgument("List of playbooks is loading", "api/v0/playbooks/autocomplete", true)
		testCreate.AddTextArgument("Date in format 2020-01-31", "Creation timestamp", `/[0-9]{4}-[0-9]{2}-[0-9]{2}/`)
		testCreate.AddTextArgument("Name of the playbook run", "Name", "")
		test.AddCommand(testCreate)

		testData := model.NewAutocompleteData("bulk-data", "[ongoing] [ended] [days] [seed]", "Generate random test data in bulk")
		testData.AddTextArgument("An integer indicating how many ongoing playbook runs will be generated.", "Number of ongoing playbook runs", "")
		testData.AddTextArgument("An integer indicating how many ended playbook runs will be generated.", "Number of ended playbook runs", "")
		testData.AddTextArgument("An integer n. The playbook runs generated will have a start date between n days ago and today.", "Range of days for the start date", "")
		testData.AddTextArgument("An integer in case you need random, but reproducible, results", "Random seed (optional)", "")
		test.AddCommand(testData)

		testSelf := model.NewAutocompleteData("self", "", "DESTRUCTIVE ACTION - Perform a series of self tests to ensure everything works as expected.")
		test.AddCommand(testSelf)

		command.AddCommand(test)
	}

	return command
}

// Runner handles commands.
type Runner struct {
	context            *plugin.Context
	args               *model.CommandArgs
	api                playbooks.ServicesAPI
	poster             bot.Poster
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	configService      config.Service
	userInfoStore      app.UserInfoStore
	userInfoTelemetry  app.UserInfoTelemetry
	permissions        *app.PermissionsService
}

// NewCommandRunner creates a command runner.
func NewCommandRunner(ctx *plugin.Context,
	args *model.CommandArgs,
	api playbooks.ServicesAPI,
	poster bot.Poster,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	configService config.Service,
	userInfoStore app.UserInfoStore,
	userInfoTelemetry app.UserInfoTelemetry,
	permissions *app.PermissionsService,
) *Runner {
	return &Runner{
		context:            ctx,
		args:               args,
		api:                api,
		poster:             poster,
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		configService:      configService,
		userInfoStore:      userInfoStore,
		userInfoTelemetry:  userInfoTelemetry,
		permissions:        permissions,
	}
}

func (r *Runner) isValid() error {
	if r.context == nil || r.args == nil || r.api == nil {
		return errors.New("invalid arguments to command.Runner")
	}
	return nil
}

func (r *Runner) postCommandResponse(text string) {
	post := &model.Post{
		Message: text,
	}
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, post)
}

func (r *Runner) warnUserAndLogErrorf(format string, args ...interface{}) {
	logrus.Errorf(format, args...)
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, &model.Post{
		Message: "Your request could not be completed. Check the system logs for more information.",
	})
}

func (r *Runner) actionRun(args []string) {
	clientID := ""
	if len(args) > 0 {
		clientID = args[0]
	}

	postID := ""
	if len(args) == 2 {
		postID = args[1]
	}

	requesterInfo := app.RequesterInfo{
		UserID:  r.args.UserId,
		TeamID:  r.args.TeamId,
		IsAdmin: app.IsSystemAdmin(r.args.UserId, r.api),
	}

	playbooksResults, err := r.playbookService.GetPlaybooksForTeam(requesterInfo, r.args.TeamId,
		app.PlaybookFilterOptions{
			Sort:      app.SortByTitle,
			Direction: app.DirectionAsc,
			Page:      0,
			PerPage:   app.PerPageDefault,
		})
	if err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}

	if err := r.playbookRunService.OpenCreatePlaybookRunDialog(r.args.TeamId, r.args.UserId, r.args.TriggerId, postID, clientID, playbooksResults.Items); err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

// actionRunPlaybook is intended for scripting use, not use by the end user (they would have
// to type in the correct playbookID).
func (r *Runner) actionRunPlaybook(args []string) {
	if len(args) != 2 {
		r.postCommandResponse("Usage: `/playbook run-playbook <playbookID> <clientID>`")
		return
	}

	playbookID := args[0]
	clientID := args[1]

	requesterInfo := app.RequesterInfo{
		UserID:  r.args.UserId,
		TeamID:  r.args.TeamId,
		IsAdmin: app.IsSystemAdmin(r.args.UserId, r.api),
	}

	// Using the GetPlaybooksForTeam so that requesterInfo and the expected security restrictions
	// are respected.
	playbooksResults, err := r.playbookService.GetPlaybooksForTeam(requesterInfo, r.args.TeamId,
		app.PlaybookFilterOptions{
			Sort:      app.SortByTitle,
			Direction: app.DirectionAsc,
			Page:      0,
			PerPage:   app.PerPageDefault,
		})
	if err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}

	var playbook []app.Playbook
	for _, pb := range playbooksResults.Items {
		if pb.ID == playbookID {
			playbook = append(playbook, pb)
			break
		}
	}
	if len(playbook) == 0 {
		r.postCommandResponse("Playbook not found for id: " + playbookID)
		return
	}

	if err := r.playbookRunService.OpenCreatePlaybookRunDialog(r.args.TeamId, r.args.UserId, r.args.TriggerId, "", clientID, playbook); err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionCheck(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if !multipleRuns && len(args) != 2 {
		r.postCommandResponse("Command expects two arguments: the checklist number and the item number.")
		return
	}

	if multipleRuns && len(args) != 3 {
		r.postCommandResponse("Command expects three arguments: the run number, the checklist number and the item number.")
		return
	}

	run := 0
	index := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[index]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
		index++
	}

	checklist, err := strconv.Atoi(args[index])
	index++
	if err != nil {
		r.postCommandResponse("Error parsing the argument. Must be a number.")
		return
	}

	item, err := strconv.Atoi(args[index])
	if err != nil {
		r.postCommandResponse("Error parsing the argument. Must be a number.")
		return
	}

	if err = r.permissions.RunManageProperties(r.args.UserId, playbookRuns[run].ID); err != nil {
		r.postCommandResponse("Become a participant to interact with this run.")
		return
	}

	err = r.playbookRunService.ToggleCheckedState(playbookRuns[run].ID, r.args.UserId, checklist, item)
	if err != nil {
		r.warnUserAndLogErrorf("Error checking/unchecking item: %v", err)
	}
}

func (r *Runner) actionAddChecklistItem(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if !multipleRuns && len(args) < 1 {
		r.postCommandResponse("Command expects one argument: the checklist number.")
		return
	}

	if multipleRuns && len(args) < 2 {
		r.postCommandResponse("Command expects two arguments: the run number and the checklist number.")
		return
	}

	run := 0
	index := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[index]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
		index++
	}

	checklist, err := strconv.Atoi(args[index])
	index++
	if err != nil {
		r.postCommandResponse("Error parsing the argument. Must be a number.")
		return
	}

	if err = r.permissions.RunManageProperties(r.args.UserId, playbookRuns[run].ID); err != nil {
		r.postCommandResponse("Become a participant to interact with this run.")
		return
	}

	// If we didn't get the item's text, then use the interactive dialog
	if len(args) == index {
		if err := r.playbookRunService.OpenAddChecklistItemDialog(r.args.TriggerId, r.args.UserId, playbookRuns[run].ID, checklist); err != nil {
			r.warnUserAndLogErrorf("Error: %v", err)
			return
		}
		return
	}

	combineargs := strings.Join(args[index:], " ")
	if err := r.playbookRunService.AddChecklistItem(playbookRuns[run].ID, r.args.UserId, checklist, app.ChecklistItem{
		Title: combineargs,
	}); err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionRemoveChecklistItem(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if !multipleRuns && len(args) != 2 {
		r.postCommandResponse("Command expects two arguments: the checklist number and the item number.")
		return
	}

	if multipleRuns && len(args) != 3 {
		r.postCommandResponse("Command expects three arguments: the run number, the checklist number and the item number.")
		return
	}

	run := 0
	index := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[index]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
		index++
	}

	checklist, err := strconv.Atoi(args[index])
	index++
	if err != nil {
		r.postCommandResponse("Error parsing the first argument. Must be a number.")
		return
	}

	item, err := strconv.Atoi(args[index])
	if err != nil {
		r.postCommandResponse("Error parsing the second argument. Must be a number.")
		return
	}

	if err = r.permissions.RunManageProperties(r.args.UserId, playbookRuns[run].ID); err != nil {
		r.postCommandResponse("Become a participant to interact with this run.")
		return
	}

	err = r.playbookRunService.RemoveChecklistItem(playbookRuns[run].ID, r.args.UserId, checklist, item)
	if err != nil {
		r.warnUserAndLogErrorf("Error removing item: %v", err)
	}
}

func (r *Runner) actionOwner(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1
	extraArg := 0
	// if channel has multiple runs, we require additional argument: run number
	if multipleRuns {
		extraArg = 1
	}

	switch len(args) - extraArg {
	case 0:
		r.actionShowOwner(args, playbookRuns)
	case 1:
		r.actionChangeOwner(args, playbookRuns)
	default:
		r.postCommandResponse("/playbook owner expects at most one argument.")
	}
}

func (r *Runner) actionShowOwner(args []string, playbookRuns []app.PlaybookRun) {
	multipleRuns := len(playbookRuns) > 1
	run := 0
	if multipleRuns {
		var err error
		if run, err = strconv.Atoi(args[0]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
	}

	currentPlaybookRun := playbookRuns[run]
	ownerUser, err := r.api.GetUserByID(currentPlaybookRun.OwnerUserID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving owner user: %v", err)
		return
	}

	r.postCommandResponse(fmt.Sprintf("**@%s** is the current owner for this playbook run.", ownerUser.Username))
}

func (r *Runner) actionChangeOwner(args []string, playbookRuns []app.PlaybookRun) {
	multipleRuns := len(playbookRuns) > 1
	run := 0
	index := 0
	if multipleRuns {
		var err error
		if run, err = strconv.Atoi(args[index]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
		index++
	}

	targetOwnerUsername := strings.TrimLeft(args[index], "@")

	if err := r.permissions.RunManageProperties(r.args.UserId, playbookRuns[run].ID); err != nil {
		r.postCommandResponse("Become a participant to interact with this run.")
		return
	}

	currentPlaybookRun := playbookRuns[run]

	targetOwnerUser, err := r.api.GetUserByUsername(targetOwnerUsername)
	if errors.Is(err, app.ErrNotFound) {
		r.postCommandResponse(fmt.Sprintf("Unable to find user @%s", targetOwnerUsername))
		return
	} else if err != nil {
		r.warnUserAndLogErrorf("Error finding user @%s: %v", targetOwnerUsername, err)
		return
	}

	if currentPlaybookRun.OwnerUserID == targetOwnerUser.Id {
		r.postCommandResponse(fmt.Sprintf("User @%s is already owner of this playbook run.", targetOwnerUsername))
		return
	}

	err = r.playbookRunService.ChangeOwner(currentPlaybookRun.ID, r.args.UserId, targetOwnerUser.Id)
	if err != nil {
		r.warnUserAndLogErrorf("Failed to change owner to @%s: %v", targetOwnerUsername, err)
		return
	}
}

func (r *Runner) actionInfo(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	session, err := r.api.GetSession(r.context.SessionId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving session: %v", err)
		return
	}

	if !session.IsMobileApp() {
		// The RHS was opened by the webapp, so inform the user
		r.postCommandResponse("Your playbook run details are already open in the right hand side of the channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if multipleRuns && len(args) == 0 {
		r.postCommandResponse("Command expects one argument: the run number.")
		return
	}

	run := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[0]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
	}

	playbookRun := playbookRuns[run]
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook run: %v", err)
		return
	}

	owner, err := r.api.GetUserByID(playbookRun.OwnerUserID)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving owner user: %v", err)
		return
	}

	tasks := ""
	for _, checklist := range playbookRun.Checklists {
		for _, item := range checklist.Items {
			icon := ":white_large_square: "
			timestamp := ""
			if item.State == app.ChecklistItemStateClosed {
				icon = ":white_check_mark: "
				timestamp = " (" + timeutils.GetTimeForMillis(item.StateModified).Format("15:04 PM") + ")"
			}

			tasks += icon + item.Title + timestamp + "\n"
		}
	}
	attachment := &model.SlackAttachment{
		Fields: []*model.SlackAttachmentField{
			{Title: "Name:", Value: fmt.Sprintf("**%s**", strings.Trim(playbookRun.Name, " "))},
			{Title: "Duration:", Value: timeutils.DurationString(timeutils.GetTimeForMillis(playbookRun.CreateAt), time.Now())},
			{Title: "Owner:", Value: fmt.Sprintf("@%s", owner.Username)},
			{Title: "Tasks:", Value: tasks},
		},
	}

	post := &model.Post{
		Props: map[string]interface{}{
			"attachments": []*model.SlackAttachment{attachment},
		},
	}
	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, post)
}

func (r *Runner) actionFinish(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if multipleRuns && len(args) == 0 {
		r.postCommandResponse("Command expects one argument: the run number.")
		return
	}

	run := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[0]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
	}

	r.actionFinishByID([]string{playbookRuns[run].ID})
}

func (r *Runner) actionFinishByID(args []string) {
	if len(args) == 0 {
		r.postCommandResponse("Command expects one argument: the run ID.")
		return
	}

	if err := r.permissions.RunManageProperties(r.args.UserId, args[0]); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			r.postCommandResponse(fmt.Sprintf("userID `%s` is not an admin or channel member", r.args.UserId))
			return
		}
		r.warnUserAndLogErrorf("Error retrieving playbook run: %v", err)
		return
	}

	err := r.playbookRunService.OpenFinishPlaybookRunDialog(args[0], r.args.UserId, r.args.TriggerId)
	if err != nil {
		r.warnUserAndLogErrorf("Error finishing the playbook run: %v", err)
		return
	}
}

func (r *Runner) actionUpdate(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if multipleRuns && len(args) == 0 {
		r.postCommandResponse("Command expects one argument: the run number.")
		return
	}

	run := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[0]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
	}

	if err = r.permissions.RunManageProperties(r.args.UserId, playbookRuns[run].ID); err != nil {
		if errors.Is(err, app.ErrNoPermissions) {
			r.postCommandResponse(fmt.Sprintf("userID `%s` is not an admin or channel member", r.args.UserId))
			return
		}
		r.warnUserAndLogErrorf("Error retrieving playbook run: %v", err)
		return
	}

	err = r.playbookRunService.OpenUpdateStatusDialog(playbookRuns[run].ID, r.args.UserId, r.args.TriggerId)
	switch {
	case errors.Is(err, app.ErrPlaybookRunNotActive):
		r.postCommandResponse("This playbook run has already been closed.")
		return
	case err != nil:
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionAdd(args []string) {
	if len(args) != 1 {
		r.postCommandResponse("Need to provide a postId")
		return
	}

	postID := args[0]
	if postID == "" {
		r.postCommandResponse("Need to provide a postId")
		return
	}

	requesterInfo, err := app.GetRequesterInfo(r.args.UserId, r.api)
	if err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}

	if err := r.playbookRunService.OpenAddToTimelineDialog(requesterInfo, postID, r.args.TeamId, r.args.TriggerId); err != nil {
		r.warnUserAndLogErrorf("Error: %v", err)
		return
	}
}

func (r *Runner) actionTimeline(args []string) {
	playbookRuns, err := r.playbookRunService.GetPlaybookRunsForChannelByUser(r.args.ChannelId, r.args.UserId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook runs: %v", err)
		return
	}
	if len(playbookRuns) == 0 {
		r.postCommandResponse("This command only works when run from a playbook run channel.")
		return
	}

	multipleRuns := len(playbookRuns) > 1

	if multipleRuns && len(args) == 0 {
		r.postCommandResponse("Command expects one argument: the run number.")
		return
	}

	run := 0
	if multipleRuns {
		if run, err = strconv.Atoi(args[0]); err != nil {
			r.postCommandResponse("Error parsing the first argument. Must be a number.")
			return
		}
		if run < 0 || run >= len(playbookRuns) {
			r.postCommandResponse("Invalid run number")
			return
		}
	}

	playbookRun := playbookRuns[run]
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving playbook run: %v", err)
		return
	}

	if len(playbookRun.TimelineEvents) == 0 {
		r.postCommandResponse("There are no timeline events to display.")
		return
	}

	team, err := r.api.GetTeam(r.args.TeamId)
	if err != nil {
		r.warnUserAndLogErrorf("Error retrieving team: %v", err)
		return
	}
	postURL := fmt.Sprintf("/%s/pl/", team.Name)

	message := "Timeline for **" + playbookRun.Name + "**:\n\n" +
		"|Event Time | Since Reported | Event |\n" +
		"|:----------|:---------------|:------|\n"

	var reported time.Time
	for _, e := range playbookRun.TimelineEvents {
		if e.EventType == app.PlaybookRunCreated {
			reported = timeutils.GetTimeForMillis(e.EventAt)
			break
		}
	}
	for _, e := range playbookRun.TimelineEvents {
		if e.EventType == app.AssigneeChanged ||
			e.EventType == app.TaskStateModified ||
			e.EventType == app.RanSlashCommand {
			continue
		}

		timeLink := timeutils.GetTimeForMillis(e.EventAt).Format("Jan 2 15:04")
		if e.PostID != "" {
			timeLink = " [" + timeLink + "](" + postURL + e.PostID + ") "
		}
		message += "|" + timeLink + "|" + r.timeSince(e, reported) + "|" + r.summaryMessage(e) + "|\n"
	}

	r.poster.EphemeralPost(r.args.UserId, r.args.ChannelId, &model.Post{Message: message})
}

func (r *Runner) summaryMessage(event app.TimelineEvent) string {
	var username string
	user, err := r.api.GetUserByID(event.SubjectUserID)
	if err == nil {
		username = user.Username
	}

	switch event.EventType {
	case app.PlaybookRunCreated:
		return "Run started by @" + username
	case app.StatusUpdated:
		if event.Summary == "" {
			return "@" + username + " posted a status update"
		}
		return "@" + username + " changed status from " + event.Summary
	case app.OwnerChanged:
		return "Owner changes from " + event.Summary
	case app.TaskStateModified:
		return "@" + username + " " + event.Summary
	case app.AssigneeChanged:
		return "@" + username + " " + event.Summary
	case app.RanSlashCommand:
		return "@" + username + " " + event.Summary
	case app.PublishedRetrospective:
		return "@" + username + " published retrospective"
	case app.CanceledRetrospective:
		return "@" + username + " canceled retrospective"
	default:
		return event.Summary
	}
}

func (r *Runner) timeSince(event app.TimelineEvent, reported time.Time) string {
	if event.EventType == app.PlaybookRunCreated {
		return ""
	}
	eventAt := timeutils.GetTimeForMillis(event.EventAt)
	if reported.Before(eventAt) {
		return timeutils.DurationString(reported, eventAt)
	}
	return "-" + timeutils.DurationString(eventAt, reported)
}

func (r *Runner) actionTodo() {
	if err := r.playbookRunService.EphemeralPostTodoDigestToUser(r.args.UserId, r.args.ChannelId, true, true); err != nil {
		r.warnUserAndLogErrorf("Error getting tasks and runs digest: %v", err)
	}
}

func (r *Runner) actionSettings(args []string) {
	settingsHelpText := "###### Playbooks Personal Settings - Slash Command Help\n" +
		"* `/playbook settings` - display current settings. \n" +
		"* `/playbook settings digest on` - turn daily digest on. \n" +
		"* `/playbook settings digest off` - turn daily digest off. \n" +
		"* `/playbook settings weekly-digest on` - turn weekly digest on. \n" +
		"* `/playbook settings weekly-digest off` - turn weekly digest off. \n"

	if len(args) == 0 {
		r.displayCurrentSettings()
		return
	}

	isDigest := args[0] == "digest" || args[0] == "weekly-digest"

	if len(args) != 2 || !isDigest || (args[1] != "on" && args[1] != "off") {
		r.postCommandResponse(settingsHelpText)
		return
	}

	info, err := r.userInfoStore.Get(r.args.UserId)
	if errors.Is(err, app.ErrNotFound) {
		info = app.UserInfo{
			ID: r.args.UserId,
		}
	} else if err != nil {
		r.warnUserAndLogErrorf("Error getting userInfo: %v", err)
		return
	}

	oldInfo := info

	if args[0] == "weekly-digest" && args[1] == "off" {
		info.DisableWeeklyDigest = true
	} else if args[0] == "weekly-digest" {
		info.DisableWeeklyDigest = false
	} else if args[0] == "digest" && args[1] == "off" {
		info.DisableDailyDigest = true
	} else {
		info.DisableDailyDigest = false
	}

	if err = r.userInfoStore.Upsert(info); err != nil {
		r.warnUserAndLogErrorf("Error updating userInfo: %v", err)
		return
	}

	r.userInfoTelemetry.ChangeDigestSettings(r.args.UserId, oldInfo.DigestNotificationSettings, info.DigestNotificationSettings)

	r.displayCurrentSettings()
}

func (r *Runner) displayCurrentSettings() {
	info, err := r.userInfoStore.Get(r.args.UserId)
	if err != nil {
		if !errors.Is(err, app.ErrNotFound) {
			r.warnUserAndLogErrorf("Error getting userInfo: %v", err)
			return
		}
	}

	dailyDigestSetting := "Daily digest: on"
	if info.DisableDailyDigest {
		dailyDigestSetting = "Daily digest: off"
	}
	weeklyDigestSetting := "Weekly digest: on"
	if info.DisableWeeklyDigest {
		weeklyDigestSetting = "Weekly digest: off"
	}
	r.postCommandResponse(fmt.Sprintf("###### Playbooks Personal Settings\n- %s, %s", dailyDigestSetting, weeklyDigestSetting))
}

func (r *Runner) actionTestSelf(args []string) {
	if r.api.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.api.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse(helpText)
		return
	}

	if !r.api.HasPermissionTo(r.args.UserId, model.PermissionManageSystem) {
		r.postCommandResponse("Running the self-test is restricted to system administrators.")
		return
	}

	if len(args) != 3 || args[0] != confirmPrompt || args[1] != "TEST" || args[2] != "SELF" {
		r.postCommandResponse("Are you sure you want to self-test (which will nuke the database and delete all data -- instances, configuration)? " +
			"All data will be lost. To self-test, type `/playbook test self CONFIRM TEST SELF`")
		return
	}

	if err := r.playbookRunService.NukeDB(); err != nil {
		r.postCommandResponse("There was an error while nuking db. Err: " + err.Error())
		return
	}

	shortDescription := "A short description."
	longDescription := `A very long description describing the item in a very descriptive way. Now with Markdown syntax! We have *italics* and **bold**. We have [external](http://example.com) and [internal links](/ad-1/playbooks/playbooks). We have even links to channels: ~town-square. And links to users: @sysadmin, @user-1. We do have the usual headings and lists, of course:
## Unordered List
- One
- Two
- Three

### Ordered List
1. One
2. Two
3. Three

We also have images:

![Mattermost logo](/static/icon_152x152.png)

And... yes, of course, we have emojis

:muscle: :sunglasses: :tada: :confetti_ball: :balloon: :cowboy_hat_face: :nail_care:`

	testPlaybook := app.Playbook{
		Title:  "testing playbook",
		TeamID: r.args.TeamId,
		Checklists: []app.Checklist{
			{
				Title: "Identification",
				Items: []app.ChecklistItem{
					{
						Title:       "Create Jira ticket",
						Description: longDescription,
					},
					{
						Title: "Add on-call team members",
						State: app.ChecklistItemStateClosed,
					},
					{
						Title:       "Identify blast radius",
						Description: shortDescription,
					},
					{
						Title: "Identify impacted services",
					},
					{
						Title: "Collect server data logs",
					},
					{
						Title: "Identify blast Analyze data logs",
					},
				},
			},
			{
				Title: "Resolution",
				Items: []app.ChecklistItem{
					{
						Title: "Align on plan of attack",
					},
					{
						Title: "Confirm resolution",
					},
				},
			},
			{
				Title: "Analysis",
				Items: []app.ChecklistItem{
					{
						Title: "Writeup root-cause analysis",
					},
					{
						Title: "Review post-mortem",
					},
				},
			},
		},
	}
	playbookID, err := r.playbookService.Create(testPlaybook, r.args.UserId)
	if err != nil {
		r.postCommandResponse("There was an error while creating playbook. Err: " + err.Error())
		return
	}

	gotplaybook, err := r.playbookService.Get(playbookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("There was an error while retrieving playbook. ID: %v Err: %v", playbookID, err.Error()))
		return
	}

	if gotplaybook.Title != testPlaybook.Title {
		r.postCommandResponse(fmt.Sprintf("Retrieved playbook is wrong, ID: %v Playbook: %+v", playbookID, gotplaybook))
		return
	}

	if gotplaybook.ID == "" {
		r.postCommandResponse("Retrieved playbook has a blank ID")
		return
	}

	gotPlaybooks, err := r.playbookService.GetPlaybooks()
	if err != nil {
		r.postCommandResponse("There was an error while retrieving all playbooks. Err: " + err.Error())
		return
	}

	if len(gotPlaybooks) != 1 || gotPlaybooks[0].Title != testPlaybook.Title {
		r.postCommandResponse(fmt.Sprintf("Retrieved playbooks are wrong: %+v", gotPlaybooks))
		return
	}

	gotplaybook.Title = "This is an updated title"
	if err = r.playbookService.Update(gotplaybook, r.args.UserId); err != nil {
		r.postCommandResponse("Unable to update playbook Err:" + err.Error())
		return
	}

	gotupdated, err := r.playbookService.Get(playbookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("There was an error while retrieving playbook. ID: %v Err: %v", playbookID, err.Error()))
		return
	}

	if gotupdated.Title != gotplaybook.Title {
		r.postCommandResponse("Update was ineffective")
		return
	}

	todeleteid, err := r.playbookService.Create(testPlaybook, r.args.UserId)
	if err != nil {
		r.postCommandResponse("There was an error while creating playbook. Err: " + err.Error())
		return
	}
	testPlaybook.ID = todeleteid
	if err = r.playbookService.Archive(testPlaybook, r.args.UserId); err != nil {
		r.postCommandResponse("There was an error while deleting playbook. Err: " + err.Error())
		return
	}

	if deletedPlaybook, _ := r.playbookService.Get(todeleteid); deletedPlaybook.Title != "" {
		r.postCommandResponse("Playbook should have been vaporized! Where's the kaboom? There was supposed to be an earth-shattering Kaboom!")
		return
	}

	playbookRun, err := r.playbookRunService.CreatePlaybookRun(&app.PlaybookRun{
		Name:                "Cloud Incident 4739",
		TeamID:              r.args.TeamId,
		OwnerUserID:         r.args.UserId,
		PlaybookID:          gotplaybook.ID,
		Checklists:          gotplaybook.Checklists,
		BroadcastChannelIDs: gotplaybook.BroadcastChannelIDs,
		Type:                app.RunTypePlaybook,
	}, &gotplaybook, r.args.UserId, true)
	if err != nil {
		r.postCommandResponse("Unable to create test playbook run: " + err.Error())
		return
	}

	if err := r.playbookRunService.AddChecklistItem(playbookRun.ID, r.args.UserId, 0, app.ChecklistItem{
		Title: "I should be checked and second",
	}); err != nil {
		r.postCommandResponse("Unable to add checklist item: " + err.Error())
		return
	}

	if err := r.playbookRunService.AddChecklistItem(playbookRun.ID, r.args.UserId, 0, app.ChecklistItem{
		Title: "I should be deleted",
	}); err != nil {
		r.postCommandResponse("Unable to add checklist item: " + err.Error())
		return
	}

	if err := r.playbookRunService.AddChecklistItem(playbookRun.ID, r.args.UserId, 0, app.ChecklistItem{
		Title: "I should not say this.",
		State: app.ChecklistItemStateClosed,
	}); err != nil {
		r.postCommandResponse("Unable to add checklist item: " + err.Error())
		return
	}

	if err := r.playbookRunService.ModifyCheckedState(playbookRun.ID, r.args.UserId, app.ChecklistItemStateClosed, 0, 0); err != nil {
		r.postCommandResponse("Unable to modify checked state: " + err.Error())
		return
	}

	if err := r.playbookRunService.ModifyCheckedState(playbookRun.ID, r.args.UserId, app.ChecklistItemStateOpen, 0, 2); err != nil {
		r.postCommandResponse("Unable to modify checked state: " + err.Error())
		return
	}

	if err := r.playbookRunService.RemoveChecklistItem(playbookRun.ID, r.args.UserId, 0, 1); err != nil {
		r.postCommandResponse("Unable to remove checklist item: " + err.Error())
		return
	}

	if err := r.playbookRunService.EditChecklistItem(playbookRun.ID, r.args.UserId, 0, 1,
		"I should say this! and be unchecked and first!", "", ""); err != nil {
		r.postCommandResponse("Unable to remove checklist item: " + err.Error())
		return
	}

	if err := r.playbookRunService.MoveChecklistItem(playbookRun.ID, r.args.UserId, 0, 0, 0, 1); err != nil {
		r.postCommandResponse("Unable to remove checklist item: " + err.Error())
		return
	}

	r.postCommandResponse("Self test success.")
}

func (r *Runner) actionTest(args []string) {
	if r.api.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.api.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse("Setting `EnableTesting` must be set to `true` to run the test command.")
		return
	}

	if !r.api.HasPermissionTo(r.args.UserId, model.PermissionManageSystem) {
		r.postCommandResponse("Running the test command is restricted to system administrators.")
		return
	}

	if len(args) < 1 {
		r.postCommandResponse("The `/playbook test` command needs at least one command.")
		return
	}

	command := strings.ToLower(args[0])
	var params = []string{}
	if len(args) > 1 {
		params = args[1:]
	}

	switch command {
	case "create-playbooks":
		r.actionTestGeneratePlaybooks(params)
	case "create-playbook-run":
		r.actionTestCreate(params)
		return
	case "bulk-data":
		r.actionTestData(params)
	case "self":
		r.actionTestSelf(params)
	default:
		r.postCommandResponse(fmt.Sprintf("Command '%s' unknown.", args[0]))
		return
	}
}

func (r *Runner) actionTestGeneratePlaybooks(params []string) {
	if len(params) < 1 {
		r.postCommandResponse("The command expects one parameter: <numPlaybooks>")
		return
	}

	numPlaybooks, err := strconv.Atoi(params[0])
	if err != nil {
		r.postCommandResponse("Error parsing the first argument. Must be a number.")
		return
	}

	if numPlaybooks > 5 {
		r.postCommandResponse("Maximum number of playbooks is 5")
		return
	}

	rand.Shuffle(len(dummyListPlaybooks), func(i, j int) {
		dummyListPlaybooks[i], dummyListPlaybooks[j] = dummyListPlaybooks[j], dummyListPlaybooks[i]
	})

	playbookIds := make([]string, 0, numPlaybooks)
	for i := 0; i < numPlaybooks; i++ {
		dummyPlaybook := dummyListPlaybooks[i]
		dummyPlaybook.TeamID = r.args.TeamId
		dummyPlaybook.Members = []app.PlaybookMember{
			{
				UserID: r.args.UserId,
				Roles:  []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin},
			},
		}
		newPlaybookID, errCreatePlaybook := r.playbookService.Create(dummyPlaybook, r.args.UserId)
		if errCreatePlaybook != nil {
			r.warnUserAndLogErrorf("unable to create playbook: %v", err)
			return
		}

		playbookIds = append(playbookIds, newPlaybookID)
	}

	msg := "Playbooks successfully created"
	for i, playbookID := range playbookIds {
		url := fmt.Sprintf("/playbooks/playbooks/%s", playbookID)
		msg += fmt.Sprintf("\n- [%s](%s)", dummyListPlaybooks[i].Title, url)
	}

	r.postCommandResponse(msg)
}

func (r *Runner) actionTestCreate(params []string) {
	if len(params) < 3 {
		r.postCommandResponse("The command expects three parameters: <playbook_id> <timestamp> <name>")
		return
	}

	playbookID := params[0]
	if !model.IsValidId(playbookID) {
		r.postCommandResponse("The first parameter, <playbook_id>, must be a valid ID.")
		return
	}
	playbook, err := r.playbookService.Get(playbookID)
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The playbook with ID '%s' does not exist.", playbookID))
		return
	}

	creationTimestamp, err := time.ParseInLocation("2006-01-02", params[1], time.Now().Location())
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("Timestamp '%s' could not be parsed as a date. If you want the playbook run to start on January 2, 2006, the timestamp should be '2006-01-02'.", params[1]))
		return
	}

	playbookRunName := strings.Join(params[2:], " ")

	playbookRun, err := r.playbookRunService.CreatePlaybookRun(
		&app.PlaybookRun{
			Name:        playbookRunName,
			OwnerUserID: r.args.UserId,
			TeamID:      r.args.TeamId,
			PlaybookID:  playbookID,
			Checklists:  playbook.Checklists,
			Type:        app.RunTypePlaybook,
		},
		&playbook,
		r.args.UserId,
		true,
	)

	if err != nil {
		r.warnUserAndLogErrorf("unable to create playbook run: %v", err)
		return
	}

	if err = r.playbookRunService.ChangeCreationDate(playbookRun.ID, creationTimestamp); err != nil {
		r.warnUserAndLogErrorf("unable to change date of recently created playbook run: %v", err)
		return
	}

	channel, err := r.api.GetChannelByID(playbookRun.ChannelID)
	if err != nil {
		r.warnUserAndLogErrorf("unable to retrieve information of playbook run's channel: %v", err)
		return
	}

	r.postCommandResponse(fmt.Sprintf("PlaybookRun successfully created: ~%s.", channel.Name))
}

func (r *Runner) actionTestData(params []string) {
	if len(params) < 3 {
		r.postCommandResponse("`/playbook test bulk-data` expects at least 3 arguments: [ongoing] [ended] [days]. Optionally, a fourth argument can be added: [seed].")
		return
	}

	ongoing, err := strconv.Atoi(params[0])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for ongoing playbook runs, '%s', is not an integer.", params[0]))
		return
	}

	ended, err := strconv.Atoi(params[1])
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for ended playbook runs, '%s', is not an integer.", params[1]))
		return
	}

	days, err := strconv.Atoi((params[2]))
	if err != nil {
		r.postCommandResponse(fmt.Sprintf("The provided value for days, '%s', is not an integer.", params[2]))
		return
	}

	if days < 1 {
		r.postCommandResponse(fmt.Sprintf("The provided value for days, '%d', is not greater than 0.", days))
		return
	}

	begin := time.Now().AddDate(0, 0, -days)
	end := time.Now()

	seed := time.Now().Unix()
	if len(params) > 3 {
		parsedSeed, err := strconv.ParseInt(params[3], 10, 0)
		if err != nil {
			r.postCommandResponse(fmt.Sprintf("The provided value for the random seed, '%s', is not an integer.", params[3]))
			return
		}

		seed = parsedSeed
	}

	r.generateTestData(ongoing, ended, begin, end, seed)
}

var fakeCompanyNames = []string{
	"Dach Inc",
	"Schuster LLC",
	"Kirlin Group",
	"Kohler Group",
	"Ruelas S.L.",
	"Armenta S.L.",
	"Vega S.A.",
	"Delarosa S.A.",
	"Sarabia S.A.",
	"Torp - Reilly",
	"Heathcote Inc",
	"Swift - Bruen",
	"Stracke - Lemke",
	"Shields LLC",
	"Bruen Group",
	"Senger - Stehr",
	"Krogh - Eide",
	"Andresen BA",
	"Hagen - Holm",
	"Martinsen BA",
	"Holm BA",
	"Berg BA",
	"Fossum RFH",
	"Nordskaug - Torp",
	"Gran - Lunde",
	"Nordby BA",
	"Ryan Gruppen",
	"Karlsson AB",
	"Nilsson HB",
	"Karlsson Group",
	"Miller - Harber",
	"Yost Group",
	"Leuschke Group",
	"Mertz Group",
	"Welch LLC",
	"Baumbach Group",
	"Ward - Schmitt",
	"Romaguera Group",
	"Hickle - Kemmer",
	"Stewart Corp",
}

var playbookRunNames = []string{
	"Cluster servers are down",
	"API performance degradation",
	"Customers unable to login",
	"Deployment failed",
	"Build failed",
	"Build timeout failure",
	"Server is unresponsive",
	"Server is crashing on start-up",
	"MM crashes on start-up",
	"Provider is down",
	"Database is unresponsive",
	"Database servers are down",
	"Database replica lag",
	"LDAP fails to sync",
	"LDAP account unable to login",
	"Broken MFA process",
	"MFA fails to login users",
	"UI is unresponsive",
	"Security threat",
	"Security breach",
	"Customers data breach",
	"SLA broken",
	"MySQL max connections error",
	"Postgres max connections error",
	"Elastic Search unresponsive",
	"Posts deleted",
	"Mentions deleted",
	"Replies deleted",
	"Cloud server is down",
	"Cloud deployment failed",
	"Cloud provisioner is down",
	"Cloud running out of memory",
	"Unable to create new users",
	"Installations in crashloop",
	"Compliance report timeout",
	"RN crash",
	"RN out of memory",
	"RN performance issues",
	"MM fails to start",
	"MM HA sync errors",
}

var dummyListPlaybooks = []app.Playbook{
	{
		Title:       "Blank Playbook",
		Description: "This is an example of an empty playbook",
	},
	{
		Title:                "Test playbook",
		RetrospectiveEnabled: true,
		StatusUpdateEnabled:  true,
		Checklists: []app.Checklist{
			{
				Title: "Identification",
				Items: []app.ChecklistItem{
					{
						Title: "Create Jira ticket",
					},
					{
						Title: "Add on-call team members",
						State: app.ChecklistItemStateClosed,
					},
					{
						Title: "Identify blast radius",
					},
					{
						Title: "Identify impacted services",
					},
					{
						Title: "Collect server data logs",
					},
					{
						Title: "Identify blast Analyze data logs",
					},
				},
			},
			{
				Title: "Resolution",
				Items: []app.ChecklistItem{
					{
						Title: "Align on plan of attack",
					},
					{
						Title: "Confirm resolution",
					},
				},
			},
			{
				Title: "Analysis",
				Items: []app.ChecklistItem{
					{
						Title: "Writeup root-cause analysis",
					},
					{
						Title: "Review post-mortem",
					},
				},
			},
		},
	},
	{
		Title:                "Release 2.4",
		RetrospectiveEnabled: true,
		StatusUpdateEnabled:  true,
		Checklists: []app.Checklist{
			{
				Title: "Preparation",
				Items: []app.ChecklistItem{
					{
						Title:   "Invite Feature Team to Channel",
						Command: "/echo ''",
					},
					{
						Title: "Acknowledge Alert",
					},
					{
						Title:   "Get Alert Info",
						Command: "/announce ~release-checklist",
					},
					{
						Title:   "Invite Escalators",
						Command: "/github mvp-2.4",
					},
					{
						Title: "Determine Priority",
					},
					{
						Title: "Update Alert Priority",
					},
				},
			},
			{
				Title: "Meeting",
				Items: []app.ChecklistItem{
					{
						Title: "Final Testing by QA",
					},
					{
						Title: "Prepare Deployment Documentation",
					},
					{
						Title: "Create New Alert for User",
					},
				},
			},
			{
				Title: "Deployment",
				Items: []app.ChecklistItem{
					{
						Title: "Database Backup",
					},
					{
						Title: "Migrate New migration File",
					},
					{
						Title: "Deploy Backend API",
					},
					{
						Title: "Deploy Front-end",
					},
					{
						Title: "Create new tag in gitlab",
					},
				},
			},
		},
	},
	{
		Title:                "Incident #4281",
		Description:          "There is an error when accessing message from deleted channel",
		RetrospectiveEnabled: true,
		StatusUpdateEnabled:  true,
		Checklists: []app.Checklist{
			{
				Title: "Prepare the Jira card for this task",
				Items: []app.ChecklistItem{
					{
						Title: "Create new Jira Card and fill the description",
					},
					{
						Title: "Set someone to be asignee for this task",
					},
					{
						Title: "Set story point for this card",
					},
				},
			},
			{
				Title: "Resolve the issue",
				Items: []app.ChecklistItem{
					{
						Title: "Check the root cause of the issue",
					},
					{
						Title: "Fix the bug",
					},
					{
						Title: "Testing the issue manually by programmer",
					},
				},
			},
			{
				Title: "QA",
				Items: []app.ChecklistItem{
					{
						Title: "Create several scenario testing",
					},
					{
						Title: "Implement it using cypress",
					},
					{
						Title: "Run the testing and check the result",
					},
				},
			},
			{
				Title: "Deployment",
				Items: []app.ChecklistItem{
					{
						Title: "Merge the result to branch 'master'",
					},
					{
						Title: "Create new Merge Request",
					},
					{
						Title: "Run deployment pipeline",
					},
					{
						Title: "Test the result in production",
					},
				},
			},
		},
	},
	{
		Title:                "Playbooks Playbook",
		Description:          "Sample playbook",
		RetrospectiveEnabled: true,
		StatusUpdateEnabled:  true,
		Checklists: []app.Checklist{
			{
				Title: "Triage",
				Items: []app.ChecklistItem{
					{
						Title: "Announce incident type and resources",
					},
					{
						Title: "Acknowledge alert",
					},
					{
						Title: "Get alert info",
					},
					{
						Title: "Invite escalators",
					},
					{
						Title: "Determine priority",
					},
					{
						Title: "Update alert priority",
					},
					{
						Title: "Update alert priority",
					},
					{
						Title:   "Create a JIRA ticket",
						Command: "/jira create",
					},
					{
						Title:   "Find out who’s on call",
						Command: "/genie whoisoncall",
					},
					{
						Title: "Announce incident",
					},
					{
						Title: "Invite on-call lead",
					},
				},
			}, {
				Title: "Investigation",
				Items: []app.ChecklistItem{
					{
						Title: "Perform initial investigation",
					},
					{
						Title: "Escalate to other on-call members (optional)",
					},
					{
						Title: "Escalate to other engineering teams (optional)",
					},
				},
			}, {
				Title: "Resolution",
				Items: []app.ChecklistItem{
					{
						Title: "Close alert",
					},
					{
						Title:   "End the incident",
						Command: "/playbook end",
					},
					{
						Title: "Schedule a post-mortem",
					},
					{
						Title: "Record post-mortem action items",
					},
					{
						Title: "Update playbook with learnings",
					},
					{
						Title:   "Export channel message history",
						Command: "/export",
					},
					{
						Title: "Archive this channel",
					},
				},
			},
		},
	},
}

// generateTestData generates `numActivePlaybookRuns` ongoing playbook runs and
// `numEndedPlaybookRuns` ended playbook runs, whose creation timestamp lies randomly
// between the `begin` and `end` timestamps.
// All playbook runs are created with a playbook randomly picked from the ones the
// user is a member of, and the randomness is controlled by the `seed` parameter
// to create reproducible results if needed.
func (r *Runner) generateTestData(numActivePlaybookRuns, numEndedPlaybookRuns int, begin, end time.Time, seed int64) {
	rand.Seed(seed)

	beginMillis := begin.Unix() * 1000
	endMillis := end.Unix() * 1000

	numPlaybookRuns := numActivePlaybookRuns + numEndedPlaybookRuns

	if numPlaybookRuns == 0 {
		r.postCommandResponse("Zero playbook runs created.")
		return
	}

	timestamps := make([]int64, 0, numPlaybookRuns)
	for i := 0; i < numPlaybookRuns; i++ {
		timestamp := rand.Int63n(endMillis-beginMillis) + beginMillis
		timestamps = append(timestamps, timestamp)
	}

	requesterInfo := app.RequesterInfo{
		UserID:  r.args.UserId,
		TeamID:  r.args.TeamId,
		IsAdmin: app.IsSystemAdmin(r.args.UserId, r.api),
	}

	playbooksResult, err := r.playbookService.GetPlaybooksForTeam(requesterInfo, r.args.TeamId, app.PlaybookFilterOptions{
		Page:    0,
		PerPage: app.PerPageDefault,
	})
	if err != nil {
		r.warnUserAndLogErrorf("Error getting playbooks: %v", err)
		return
	}

	var playbooks []app.Playbook
	if len(playbooksResult.Items) == 0 {
		for _, dummyPlaybook := range dummyListPlaybooks {
			dummyPlaybook.TeamID = r.args.TeamId
			dummyPlaybook.Members = []app.PlaybookMember{
				{
					UserID: r.args.UserId,
					Roles:  []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin},
				},
			}
			newPlaybookID, err := r.playbookService.Create(dummyPlaybook, r.args.UserId)
			if err != nil {
				r.warnUserAndLogErrorf("unable to create playbook: %v", err)
				return
			}

			newPlaybook, err := r.playbookService.Get(newPlaybookID)
			if err != nil {
				r.warnUserAndLogErrorf("Error getting playbook: %v", err)
				return
			}

			playbooks = append(playbooks, newPlaybook)
		}
	} else {
		playbooks = make([]app.Playbook, 0, len(playbooksResult.Items))
		for _, thePlaybook := range playbooksResult.Items {
			wholePlaybook, err := r.playbookService.Get(thePlaybook.ID)
			if err != nil {
				r.warnUserAndLogErrorf("Error getting playbook: %v", err)
				return
			}

			playbooks = append(playbooks, wholePlaybook)
		}
	}

	tableMsg := "| Run name | Created at | Status |\n|-	|-	|-	|\n"
	playbookRuns := make([]*app.PlaybookRun, 0, numPlaybookRuns)
	for i := 0; i < numPlaybookRuns; i++ {
		playbook := playbooks[rand.Intn(len(playbooks))]

		playbookRunName := playbookRunNames[rand.Intn(len(playbookRunNames))]
		// Give a company name to 1/3 of the playbook runs created
		if rand.Intn(3) == 0 {
			companyName := fakeCompanyNames[rand.Intn(len(fakeCompanyNames))]
			playbookRunName = fmt.Sprintf("[%s] %s", companyName, playbookRunName)
		}

		playbookRun, err := r.playbookRunService.CreatePlaybookRun(
			&app.PlaybookRun{
				Name:                 playbookRunName,
				OwnerUserID:          r.args.UserId,
				TeamID:               r.args.TeamId,
				PlaybookID:           playbook.ID,
				Checklists:           playbook.Checklists,
				RetrospectiveEnabled: playbook.RetrospectiveEnabled,
				StatusUpdateEnabled:  playbook.StatusUpdateEnabled,
				Type:                 app.RunTypePlaybook,
			},
			&playbook,
			r.args.UserId,
			true,
		)

		if err != nil {
			r.warnUserAndLogErrorf("Error creating playbook run: %v", err)
			return
		}

		createAt := timeutils.GetTimeForMillis(timestamps[i])
		err = r.playbookRunService.ChangeCreationDate(playbookRun.ID, createAt)
		if err != nil {
			r.warnUserAndLogErrorf("Error changing creation date: %v", err)
			return
		}

		channel, err := r.api.GetChannelByID(playbookRun.ChannelID)
		if err != nil {
			r.warnUserAndLogErrorf("Error retrieveing playbook run's channel: %v", err)
			return
		}

		status := "Ended"
		if i >= numEndedPlaybookRuns {
			status = "Ongoing"
		}
		tableMsg += fmt.Sprintf("|~%s|%s|%s|\n", channel.Name, createAt.Format("2006-01-02"), status)

		playbookRuns = append(playbookRuns, playbookRun)
	}

	for i := 0; i < numEndedPlaybookRuns; i++ {
		err := r.playbookRunService.FinishPlaybookRun(playbookRuns[i].ID, r.args.UserId)
		if err != nil {
			r.warnUserAndLogErrorf("Error ending the playbook run: %v", err)
			return
		}
	}

	r.postCommandResponse(fmt.Sprintf("The test data was successfully generated:\n\n%s\n", tableMsg))
}

func (r *Runner) actionNukeDB(args []string) {
	if r.api.GetConfig().ServiceSettings.EnableTesting == nil ||
		!*r.api.GetConfig().ServiceSettings.EnableTesting {
		r.postCommandResponse(helpText)
		return
	}

	if !r.api.HasPermissionTo(r.args.UserId, model.PermissionManageSystem) {
		r.postCommandResponse("Nuking the database is restricted to system administrators.")
		return
	}

	if len(args) != 2 || args[0] != "CONFIRM" || args[1] != "NUKE" {
		r.postCommandResponse("Are you sure you want to nuke the database (delete all data -- instances, configuration)?" +
			"All data will be lost. To nuke database, type `/playbook nuke-db CONFIRM NUKE`")
		return
	}

	if err := r.playbookRunService.NukeDB(); err != nil {
		r.warnUserAndLogErrorf("There was an error while nuking db: %v", err)
		return
	}
	r.postCommandResponse("DB has been reset.")
}

// Execute should be called by the plugin when a command invocation is received from the Mattermost server.
func (r *Runner) Execute() error {
	if err := r.isValid(); err != nil {
		return err
	}

	split := strings.Fields(r.args.Command)
	command := split[0]
	parameters := []string{}
	cmd := ""
	if len(split) > 1 {
		cmd = split[1]
	}
	if len(split) > 2 {
		parameters = split[2:]
	}

	if command != "/playbook" {
		return nil
	}

	switch cmd {
	case "run":
		r.actionRun(parameters)
	case "run-playbook":
		r.actionRunPlaybook(parameters)
	case "finish":
		r.actionFinish(parameters)
	case "finish-by-id":
		r.actionFinishByID(parameters)
	case "update":
		r.actionUpdate(parameters)
	case "check":
		r.actionCheck(parameters)
	case "checkadd":
		r.actionAddChecklistItem(parameters)
	case "checkremove":
		r.actionRemoveChecklistItem(parameters)
	case "owner":
		r.actionOwner(parameters)
	case "info":
		r.actionInfo(parameters)
	case "add":
		r.actionAdd(parameters)
	case "timeline":
		r.actionTimeline(parameters)
	case "todo":
		r.actionTodo()
	case "settings":
		r.actionSettings(parameters)
	case "nuke-db":
		r.actionNukeDB(parameters)
	case "test":
		r.actionTest(parameters)
	default:
		r.postCommandResponse(helpText)
	}

	return nil
}
