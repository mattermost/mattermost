// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	CmdCustomStatusTrigger = "status"
	usernameSpecialChars   = ".-_"
	maxTriggerLen          = 512
)

var atMentionRegexp = regexp.MustCompile(`\B@[[:alnum:]][[:alnum:]\.\-_:]*`)

type CommandProvider interface {
	GetTrigger() string
	GetCommand(a *App, T i18n.TranslateFunc) *model.Command
	DoCommand(a *App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse
}

var commandProviders = make(map[string]CommandProvider)

func RegisterCommandProvider(newProvider CommandProvider) {
	commandProviders[newProvider.GetTrigger()] = newProvider
}

func GetCommandProvider(name string) CommandProvider {
	provider, ok := commandProviders[name]
	if ok {
		return provider
	}

	return nil
}

// @openTracingParams teamID, skipSlackParsing
func (a *App) CreateCommandPost(c request.CTX, post *model.Post, teamID string, response *model.CommandResponse, skipSlackParsing bool) (*model.Post, *model.AppError) {
	if skipSlackParsing {
		post.Message = response.Text
	} else {
		post.Message = model.ParseSlackLinksToMarkdown(response.Text)
	}

	post.CreateAt = model.GetMillis()

	if strings.HasPrefix(post.Type, model.PostSystemMessagePrefix) {
		err := model.NewAppError("CreateCommandPost", "api.context.invalid_param.app_error", map[string]any{"Name": "post.type"}, "", http.StatusBadRequest)
		return nil, err
	}

	if response.Attachments != nil {
		model.ParseSlackAttachment(post, response.Attachments)
	}

	if response.ResponseType == model.CommandResponseTypeInChannel {
		return a.CreatePostMissingChannel(c, post, true, true)
	}

	if (response.ResponseType == "" || response.ResponseType == model.CommandResponseTypeEphemeral) && (response.Text != "" || response.Attachments != nil) {
		a.SendEphemeralPost(c, post.UserId, post)
	}

	return post, nil
}

// @openTracingParams teamID
// previous ListCommands now ListAutocompleteCommands
func (a *App) ListAutocompleteCommands(teamID string, T i18n.TranslateFunc) ([]*model.Command, *model.AppError) {
	commands := make([]*model.Command, 0, 32)
	seen := make(map[string]bool)

	// Disable custom status slash command if the feature or the setting is off
	if !*a.Config().TeamSettings.EnableCustomUserStatuses {
		seen[CmdCustomStatusTrigger] = true
	}

	for _, cmd := range a.CommandsForTeam(teamID) {
		if cmd.AutoComplete && !seen[cmd.Trigger] {
			seen[cmd.Trigger] = true
			commands = append(commands, cmd)
		}
	}

	if *a.Config().ServiceSettings.EnableCommands {
		teamCmds, err := a.Srv().Store().Command().GetByTeam(teamID)
		if err != nil {
			return nil, model.NewAppError("ListAutocompleteCommands", "app.command.listautocompletecommands.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, cmd := range teamCmds {
			if cmd.AutoComplete && !seen[cmd.Trigger] {
				cmd.Sanitize()
				seen[cmd.Trigger] = true
				commands = append(commands, cmd)
			}
		}
	}

	for _, value := range commandProviders {
		if cmd := value.GetCommand(a, T); cmd != nil {
			cpy := *cmd
			if cpy.AutoComplete && !seen[cpy.Trigger] {
				cpy.Sanitize()
				seen[cpy.Trigger] = true
				commands = append(commands, &cpy)
			}
		}
	}

	return commands, nil
}

func (a *App) ListTeamCommands(teamID string) ([]*model.Command, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCommands {
		return nil, model.NewAppError("ListTeamCommands", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	teamCmds, err := a.Srv().Store().Command().GetByTeam(teamID)
	if err != nil {
		return nil, model.NewAppError("ListTeamCommands", "app.command.listteamcommands.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return teamCmds, nil
}

func (a *App) ListAllCommands(teamID string, T i18n.TranslateFunc) ([]*model.Command, *model.AppError) {
	commands := make([]*model.Command, 0, 32)
	seen := make(map[string]bool)
	for _, value := range commandProviders {
		if cmd := value.GetCommand(a, T); cmd != nil {
			cpy := *cmd
			if cpy.AutoComplete && !seen[cpy.Trigger] {
				cpy.Sanitize()
				seen[cpy.Trigger] = true
				commands = append(commands, &cpy)
			}
		}
	}

	for _, cmd := range a.CommandsForTeam(teamID) {
		if !seen[cmd.Trigger] {
			seen[cmd.Trigger] = true
			commands = append(commands, cmd)
		}
	}

	if *a.Config().ServiceSettings.EnableCommands {
		teamCmds, err := a.Srv().Store().Command().GetByTeam(teamID)
		if err != nil {
			return nil, model.NewAppError("ListAllCommands", "app.command.listallcommands.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for _, cmd := range teamCmds {
			if !seen[cmd.Trigger] {
				cmd.Sanitize()
				seen[cmd.Trigger] = true
				commands = append(commands, cmd)
			}
		}
	}

	return commands, nil
}

// @openTracingParams args
func (a *App) ExecuteCommand(c request.CTX, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	trigger := ""
	message := ""
	index := strings.IndexFunc(args.Command, unicode.IsSpace)
	if index != -1 {
		trigger = args.Command[:index]
		message = args.Command[index+1:]
	} else {
		trigger = args.Command
	}
	trigger = strings.ToLower(trigger)
	if !strings.HasPrefix(trigger, "/") {
		return nil, model.NewAppError("command", "api.command.execute_command.format.app_error", map[string]any{"Trigger": trigger}, "", http.StatusBadRequest)
	}
	trigger = strings.TrimPrefix(trigger, "/")

	clientTriggerId, triggerId, appErr := model.GenerateTriggerId(args.UserId, a.AsymmetricSigningKey())
	if appErr != nil {
		c.Logger().Warn("error occurred in generating trigger Id for a user ", mlog.Err(appErr))
	}

	args.TriggerId = triggerId

	// Plugins can override built in and custom commands
	cmd, response, appErr := a.tryExecutePluginCommand(c, args)
	if appErr != nil {
		return nil, appErr
	} else if cmd != nil && response != nil {
		response.TriggerId = clientTriggerId
		return a.HandleCommandResponse(c, cmd, args, response, true)
	}

	// Custom commands can override built ins
	cmd, response, appErr = a.tryExecuteCustomCommand(c, args, trigger, message)
	if appErr != nil {
		return nil, appErr
	} else if cmd != nil && response != nil {
		response.TriggerId = clientTriggerId
		return a.HandleCommandResponse(c, cmd, args, response, false)
	}

	cmd, response = a.tryExecuteBuiltInCommand(c, args, trigger, message)
	if cmd != nil && response != nil {
		return a.HandleCommandResponse(c, cmd, args, response, true)
	}

	if len(trigger) > maxTriggerLen {
		trigger = trigger[:maxTriggerLen]
		trigger += "..."
	}
	return nil, model.NewAppError("command", "api.command.execute_command.not_found.app_error", map[string]any{"Trigger": trigger}, "", http.StatusNotFound)
}

// MentionsToTeamMembers returns all the @ mentions found in message that
// belong to users in the specified team, linking them to their users
func (a *App) MentionsToTeamMembers(c request.CTX, message, teamID string) model.UserMentionMap {
	type mentionMapItem struct {
		Name string
		Id   string
	}

	possibleMentions := possibleAtMentions(message)
	mentionChan := make(chan *mentionMapItem, len(possibleMentions))

	var wg sync.WaitGroup
	for _, mention := range possibleMentions {
		wg.Add(1)
		go func(mention string) {
			defer wg.Done()
			user, nErr := a.Srv().Store().User().GetByUsername(mention)

			var nfErr *store.ErrNotFound
			if nErr != nil && !errors.As(nErr, &nfErr) {
				c.Logger().Warn("Failed to retrieve user @"+mention, mlog.Err(nErr))
				return
			}

			// If it's a http.StatusNotFound error, check for usernames in substrings
			// without trailing punctuation
			if nErr != nil {
				trimmed, ok := trimUsernameSpecialChar(mention)
				for ; ok; trimmed, ok = trimUsernameSpecialChar(trimmed) {
					userFromTrimmed, nErr := a.Srv().Store().User().GetByUsername(trimmed)
					if nErr != nil && !errors.As(nErr, &nfErr) {
						return
					}

					if nErr != nil {
						continue
					}

					_, err := a.GetTeamMember(c, teamID, userFromTrimmed.Id)
					if err != nil {
						// The user is not in the team, so we should ignore it
						return
					}

					mentionChan <- &mentionMapItem{trimmed, userFromTrimmed.Id}
					return
				}

				return
			}

			_, err := a.GetTeamMember(c, teamID, user.Id)
			if err != nil {
				// The user is not in the team, so we should ignore it
				return
			}

			mentionChan <- &mentionMapItem{mention, user.Id}
		}(mention)
	}

	wg.Wait()
	close(mentionChan)

	atMentionMap := make(model.UserMentionMap)
	for mention := range mentionChan {
		atMentionMap[mention.Name] = mention.Id
	}

	return atMentionMap
}

// MentionsToPublicChannels returns all the mentions to public channels,
// linking them to their channels
func (a *App) MentionsToPublicChannels(c request.CTX, message, teamID string) model.ChannelMentionMap {
	type mentionMapItem struct {
		Name string
		Id   string
	}

	channelMentions := model.ChannelMentions(message)
	mentionChan := make(chan *mentionMapItem, len(channelMentions))

	var wg sync.WaitGroup
	for _, channelName := range channelMentions {
		wg.Add(1)
		go func(channelName string) {
			defer wg.Done()
			channel, err := a.GetChannelByName(c, channelName, teamID, false)
			if err != nil {
				return
			}

			if !channel.IsOpen() {
				return
			}

			mentionChan <- &mentionMapItem{channelName, channel.Id}
		}(channelName)
	}

	wg.Wait()
	close(mentionChan)

	channelMentionMap := make(model.ChannelMentionMap)
	for mention := range mentionChan {
		channelMentionMap[mention.Name] = mention.Id
	}

	return channelMentionMap
}

// tryExecuteBuiltInCommand attempts to run a built in command based on the given arguments. If no such command can be
// found, returns nil for all arguments.
func (a *App) tryExecuteBuiltInCommand(c request.CTX, args *model.CommandArgs, trigger string, message string) (*model.Command, *model.CommandResponse) {
	provider := GetCommandProvider(trigger)
	if provider == nil {
		return nil, nil
	}

	cmd := provider.GetCommand(a, args.T)
	if cmd == nil {
		return nil, nil
	}

	return cmd, provider.DoCommand(a, c, args, message)
}

// tryExecuteCustomCommand attempts to run a custom command based on the given arguments. If no such command can be
// found, returns nil for all arguments.
func (a *App) tryExecuteCustomCommand(c request.CTX, args *model.CommandArgs, trigger string, message string) (*model.Command, *model.CommandResponse, *model.AppError) {
	// Handle custom commands
	if !*a.Config().ServiceSettings.EnableCommands {
		return nil, nil, model.NewAppError("ExecuteCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	chanChan := make(chan store.StoreResult[*model.Channel], 1)
	go func() {
		channel, err := a.Srv().Store().Channel().Get(args.ChannelId, true)
		chanChan <- store.StoreResult[*model.Channel]{Data: channel, NErr: err}
		close(chanChan)
	}()

	teamChan := make(chan store.StoreResult[*model.Team], 1)
	go func() {
		team, err := a.Srv().Store().Team().Get(args.TeamId)
		teamChan <- store.StoreResult[*model.Team]{Data: team, NErr: err}
		close(teamChan)
	}()

	userChan := make(chan store.StoreResult[*model.User], 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), args.UserId)
		userChan <- store.StoreResult[*model.User]{Data: user, NErr: err}
		close(userChan)
	}()

	teamCmds, err := a.Srv().Store().Command().GetByTeam(args.TeamId)
	if err != nil {
		return nil, nil, model.NewAppError("tryExecuteCustomCommand", "app.command.tryexecutecustomcommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	tr := <-teamChan
	if tr.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(tr.NErr, &nfErr):
			return nil, nil, model.NewAppError("tryExecuteCustomCommand", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(tr.NErr)
		default:
			return nil, nil, model.NewAppError("tryExecuteCustomCommand", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(tr.NErr)
		}
	}
	team := tr.Data

	ur := <-userChan
	if ur.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(ur.NErr, &nfErr):
			return nil, nil, model.NewAppError("tryExecuteCustomCommand", MissingAccountError, nil, "", http.StatusNotFound).Wrap(ur.NErr)
		default:
			return nil, nil, model.NewAppError("tryExecuteCustomCommand", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(ur.NErr)
		}
	}
	user := ur.Data

	cr := <-chanChan
	if cr.NErr != nil {
		errCtx := map[string]any{"channel_id": args.ChannelId}
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(cr.NErr, &nfErr):
			return nil, nil, model.NewAppError("tryExecuteCustomCommand", "app.channel.get.existing.app_error", errCtx, "", http.StatusNotFound).Wrap(cr.NErr)
		default:
			return nil, nil, model.NewAppError("tryExecuteCustomCommand", "app.channel.get.find.app_error", errCtx, "", http.StatusInternalServerError).Wrap(cr.NErr)
		}
	}
	channel := cr.Data

	var cmd *model.Command

	for _, teamCmd := range teamCmds {
		if trigger == teamCmd.Trigger {
			cmd = teamCmd
		}
	}

	if cmd == nil {
		return nil, nil, nil
	}

	c.Logger().Debug("Executing command", mlog.String("command", trigger), mlog.String("user_id", args.UserId))

	p := url.Values{}
	p.Set("token", cmd.Token)

	p.Set("team_id", cmd.TeamId)
	p.Set("team_domain", team.Name)

	p.Set("channel_id", args.ChannelId)
	p.Set("channel_name", channel.Name)

	p.Set("user_id", args.UserId)
	p.Set("user_name", user.Username)

	p.Set("command", "/"+trigger)
	p.Set("text", message)

	p.Set("trigger_id", args.TriggerId)

	userMentionMap := a.MentionsToTeamMembers(c, message, team.Id)
	for key, values := range userMentionMap.ToURLValues() {
		p[key] = values
	}

	channelMentionMap := a.MentionsToPublicChannels(c, message, team.Id)
	for key, values := range channelMentionMap.ToURLValues() {
		p[key] = values
	}

	hook, appErr := a.CreateCommandWebhook(cmd.Id, args)
	if appErr != nil {
		return cmd, nil, model.NewAppError("command", "api.command.execute_command.failed.app_error", map[string]any{"Trigger": trigger}, "", http.StatusInternalServerError).Wrap(appErr)
	}
	p.Set("response_url", args.SiteURL+"/hooks/commands/"+hook.Id)

	return a.DoCommandRequest(c, cmd, p)
}

func (a *App) DoCommandRequest(rctx request.CTX, cmd *model.Command, p url.Values) (*model.Command, *model.CommandResponse, *model.AppError) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*a.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout)*time.Second)
	defer cancel()

	var accessToken *model.OutgoingOAuthConnectionToken

	// Retrieve an access token from a connection if one exists to use for the webhook request
	if a.Config().ServiceSettings.EnableOutgoingOAuthConnections != nil && *a.Config().ServiceSettings.EnableOutgoingOAuthConnections && a.OutgoingOAuthConnections() != nil {
		connection, err := a.OutgoingOAuthConnections().GetConnectionForAudience(rctx, cmd.URL)
		if err != nil {
			a.Log().Error("Failed to find an outgoing oauth connection for the webhook", mlog.Err(err))
		}

		if connection != nil {
			accessToken, err = a.OutgoingOAuthConnections().RetrieveTokenForConnection(rctx, connection)
			if err != nil {
				a.Log().Error("Failed to retrieve token for outgoing oauth connection", mlog.Err(err))
			}
		}
	}

	// Prepare the request
	var req *http.Request
	var err error
	if cmd.Method == model.CommandMethodGet {
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, cmd.URL, nil)
	} else {
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, cmd.URL, strings.NewReader(p.Encode()))
	}

	if err != nil {
		return cmd, nil, model.NewAppError("command", "api.command.execute_command.failed.app_error", map[string]any{"Trigger": cmd.Trigger}, "", http.StatusInternalServerError).Wrap(err)
	}

	if cmd.Method == model.CommandMethodGet {
		if req.URL.RawQuery != "" {
			req.URL.RawQuery += "&"
		}
		req.URL.RawQuery += p.Encode()
	}

	req.Header.Set("Accept", "application/json")
	if cmd.Token != "" {
		req.Header.Set("Authorization", "Token "+cmd.Token)
	}

	if accessToken != nil {
		req.Header.Set("Authorization", accessToken.AsHeaderValue())
	}

	if cmd.Method == model.CommandMethodPost {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	resp, err := a.Srv().outgoingWebhookClient.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			rctx.Logger().Info("Outgoing Command request timed out. Consider increasing ServiceSettings.OutgoingIntegrationRequestsTimeout.")
		}
		return cmd, nil, model.NewAppError("command", "api.command.execute_command.failed.app_error", map[string]any{"Trigger": cmd.Trigger}, "", http.StatusInternalServerError).Wrap(err)
	}

	defer resp.Body.Close()

	// Handle the response
	body := io.LimitReader(resp.Body, MaxIntegrationResponseSize)

	if resp.StatusCode != http.StatusOK {
		// Ignore the error below because the resulting string will just be the empty string if bodyBytes is nil
		bodyBytes, _ := io.ReadAll(body)

		return cmd, nil, model.NewAppError("command", "api.command.execute_command.failed_resp.app_error", map[string]any{"Trigger": cmd.Trigger, "Status": resp.Status}, string(bodyBytes), http.StatusInternalServerError)
	}

	response, err := model.CommandResponseFromHTTPBody(resp.Header.Get("Content-Type"), body)
	if err != nil {
		return cmd, nil, model.NewAppError("command", "api.command.execute_command.failed.app_error", map[string]any{"Trigger": cmd.Trigger}, "", http.StatusInternalServerError).Wrap(err)
	} else if response == nil {
		return cmd, nil, model.NewAppError("command", "api.command.execute_command.failed_empty.app_error", map[string]any{"Trigger": cmd.Trigger}, "", http.StatusInternalServerError)
	}

	return cmd, response, nil
}

func (a *App) HandleCommandResponse(c request.CTX, command *model.Command, args *model.CommandArgs, response *model.CommandResponse, builtIn bool) (*model.CommandResponse, *model.AppError) {
	trigger := ""
	if args.Command != "" {
		parts := strings.Split(args.Command, " ")
		trigger = parts[0][1:]
		trigger = strings.ToLower(trigger)
	}

	var lastError *model.AppError
	_, err := a.HandleCommandResponsePost(c, command, args, response, builtIn)

	if err != nil {
		c.Logger().Debug("Error occurred in handling command response post", mlog.Err(err))
		lastError = err
	}

	if response.ExtraResponses != nil {
		for _, resp := range response.ExtraResponses {
			_, err := a.HandleCommandResponsePost(c, command, args, resp, builtIn)

			if err != nil {
				c.Logger().Debug("Error occurred in handling command response post", mlog.Err(err))
				lastError = err
			}
		}
	}

	if lastError != nil {
		return response, model.NewAppError("command", "api.command.execute_command.create_post_failed.app_error", map[string]any{"Trigger": trigger}, "", http.StatusInternalServerError)
	}

	return response, nil
}

func (a *App) HandleCommandResponsePost(c request.CTX, command *model.Command, args *model.CommandArgs, response *model.CommandResponse, builtIn bool) (*model.Post, *model.AppError) {
	post := &model.Post{}
	post.ChannelId = args.ChannelId
	post.RootId = args.RootId
	post.UserId = args.UserId
	post.Type = response.Type
	post.SetProps(response.Props)

	if response.ChannelId != "" {
		_, err := a.GetChannelMember(c, response.ChannelId, args.UserId)
		if err != nil {
			err = model.NewAppError("HandleCommandResponsePost", "api.command.command_post.forbidden.app_error", nil, "", http.StatusForbidden).Wrap(err)
			return nil, err
		}
		post.ChannelId = response.ChannelId
	}

	isBotPost := !builtIn

	if *a.Config().ServiceSettings.EnablePostUsernameOverride {
		if command.Username != "" {
			post.AddProp("override_username", command.Username)
			isBotPost = true
		} else if response.Username != "" {
			post.AddProp("override_username", response.Username)
			isBotPost = true
		}
	}

	if *a.Config().ServiceSettings.EnablePostIconOverride {
		if command.IconURL != "" {
			post.AddProp("override_icon_url", command.IconURL)
			isBotPost = true
		} else if response.IconURL != "" {
			post.AddProp("override_icon_url", response.IconURL)
			isBotPost = true
		} else {
			post.AddProp("override_icon_url", "")
		}
	}

	if isBotPost {
		post.AddProp("from_webhook", "true")
	}

	// Process Slack text replacements if the response does not contain "skip_slack_parsing": true.
	if !response.SkipSlackParsing {
		response.Text = a.ProcessSlackText(response.Text)
		response.Attachments = a.ProcessSlackAttachments(response.Attachments)
	}

	if _, err := a.CreateCommandPost(c, post, args.TeamId, response, response.SkipSlackParsing); err != nil {
		return post, err
	}

	return post, nil
}

func (a *App) CreateCommand(cmd *model.Command) (*model.Command, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCommands {
		return nil, model.NewAppError("CreateCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	return a.createCommand(cmd)
}

func (a *App) createCommand(cmd *model.Command) (*model.Command, *model.AppError) {
	cmd.Trigger = strings.ToLower(cmd.Trigger)

	teamCmds, err := a.Srv().Store().Command().GetByTeam(cmd.TeamId)
	if err != nil {
		return nil, model.NewAppError("CreateCommand", "app.command.createcommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, existingCommand := range teamCmds {
		if cmd.Trigger == existingCommand.Trigger {
			return nil, model.NewAppError("CreateCommand", "api.command.duplicate_trigger.app_error", nil, "", http.StatusBadRequest)
		}
	}

	for _, builtInProvider := range commandProviders {
		builtInCommand := builtInProvider.GetCommand(a, i18n.T)
		if builtInCommand != nil && cmd.Trigger == builtInCommand.Trigger {
			return nil, model.NewAppError("CreateCommand", "api.command.duplicate_trigger.app_error", nil, "", http.StatusBadRequest)
		}
	}

	command, nErr := a.Srv().Store().Command().Save(cmd)
	if nErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(nErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("CreateCommand", "app.command.createcommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}
	}

	return command, nil
}

func (a *App) GetCommand(commandID string) (*model.Command, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCommands {
		return nil, model.NewAppError("GetCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	command, err := a.Srv().Store().Command().Get(commandID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SqlCommandStore.Get", "store.sql_command.get.missing.app_error", map[string]any{"command_id": commandID}, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetCommand", "app.command.getcommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return command, nil
}

func (a *App) UpdateCommand(oldCmd, updatedCmd *model.Command) (*model.Command, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCommands {
		return nil, model.NewAppError("UpdateCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	updatedCmd.Trigger = strings.ToLower(updatedCmd.Trigger)
	updatedCmd.Id = oldCmd.Id
	updatedCmd.Token = oldCmd.Token
	updatedCmd.CreateAt = oldCmd.CreateAt
	updatedCmd.UpdateAt = model.GetMillis()
	updatedCmd.DeleteAt = oldCmd.DeleteAt
	updatedCmd.CreatorId = oldCmd.CreatorId
	updatedCmd.PluginId = oldCmd.PluginId
	updatedCmd.TeamId = oldCmd.TeamId

	command, err := a.Srv().Store().Command().Update(updatedCmd)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SqlCommandStore.Update", "store.sql_command.update.missing.app_error", map[string]any{"command_id": updatedCmd.Id}, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("UpdateCommand", "app.command.updatecommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return command, nil
}

func (a *App) MoveCommand(team *model.Team, command *model.Command) *model.AppError {
	command.TeamId = team.Id

	_, err := a.Srv().Store().Command().Update(command)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("SqlCommandStore.Update", "store.sql_command.update.missing.app_error", map[string]any{"command_id": command.Id}, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &appErr):
			return appErr
		default:
			return model.NewAppError("MoveCommand", "app.command.movecommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}

func (a *App) RegenCommandToken(cmd *model.Command) (*model.Command, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCommands {
		return nil, model.NewAppError("RegenCommandToken", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	cmd.Token = model.NewId()

	command, err := a.Srv().Store().Command().Update(cmd)
	if err != nil {
		var nfErr *store.ErrNotFound
		var appErr *model.AppError
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SqlCommandStore.Update", "store.sql_command.update.missing.app_error", map[string]any{"command_id": cmd.Id}, "", http.StatusNotFound).Wrap(err)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("RegenCommandToken", "app.command.regencommandtoken.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return command, nil
}

func (a *App) DeleteCommand(commandID string) *model.AppError {
	if !*a.Config().ServiceSettings.EnableCommands {
		return model.NewAppError("DeleteCommand", "api.command.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	err := a.Srv().Store().Command().Delete(commandID, model.GetMillis())
	if err != nil {
		return model.NewAppError("DeleteCommand", "app.command.deletecommand.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

// possibleAtMentions returns all substrings in message that look like valid @
// mentions.
func possibleAtMentions(message string) []string {
	var names []string

	if !strings.Contains(message, "@") {
		return names
	}

	alreadyMentioned := make(map[string]bool)
	for _, match := range atMentionRegexp.FindAllString(message, -1) {
		name := model.NormalizeUsername(match[1:])
		if !alreadyMentioned[name] && model.IsValidUsernameAllowRemote(name) {
			names = append(names, name)
			alreadyMentioned[name] = true
		}
	}

	return names
}

// trimUsernameSpecialChar tries to remove the last character from word if it
// is a special character for usernames (dot, dash or underscore). If not, it
// returns the same string.
func trimUsernameSpecialChar(word string) (string, bool) {
	l := len(word)

	if l > 0 && strings.LastIndexAny(word, usernameSpecialChars) == (l-1) {
		return word[:l-1], true
	}

	return word, false
}
