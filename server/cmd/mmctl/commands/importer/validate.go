// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package importer

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"image"
	_ "image/gif"  // image decoder
	_ "image/jpeg" // image decoder
	_ "image/png"  // image decoder
	"io"
	"mime"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"text/template"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	_ "golang.org/x/image/webp" // image decoder

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

const (
	SourceServer = "<server>"
	SourceAdhoc  = "<adhoc>"
)

type ChannelTeam struct {
	Channel string
	Team    string
}

type Validator struct { //nolint:govet
	archiveName           string
	onError               func(*ImportValidationError) error
	ignoreAttachments     bool
	createMissingTeams    bool
	checkServerDuplicates bool

	serverTeams    map[string]*model.Team
	serverChannels map[ChannelTeam]*model.Channel
	serverUsers    map[string]*model.User
	serverEmails   map[string]*model.User

	attachments     map[string]*zip.File
	attachmentsUsed map[string]uint64
	allFileNames    []string

	roles          map[string]ImportFileInfo
	schemes        map[string]ImportFileInfo
	teams          map[string]ImportFileInfo
	channels       map[ChannelTeam]ImportFileInfo
	users          map[string]ImportFileInfo
	posts          uint64
	directChannels uint64
	directPosts    uint64
	emojis         map[string]ImportFileInfo

	maxPostSize int

	start time.Time
	end   time.Time

	lines uint64
}

const (
	LineTypeVersion       = "version"
	LineTypeRole          = "role"
	LineTypeScheme        = "scheme"
	LineTypeTeam          = "team"
	LineTypeChannel       = "channel"
	LineTypeUser          = "user"
	LineTypeBot           = "bot"
	LineTypePost          = "post"
	LineTypeDirectChannel = "direct_channel"
	LineTypeDirectPost    = "direct_post"
	LineTypeEmoji         = "emoji"
)

func NewValidator(
	name string,
	ignoreAttachments,
	createMissingTeams bool,
	checkServerDuplicates bool,
	serverTeams map[string]*model.Team,
	serverChannels map[ChannelTeam]*model.Channel,
	serverUsers map[string]*model.User,
	serverEmails map[string]*model.User,
	maxPostSize int,
) *Validator {
	v := &Validator{
		archiveName:           name,
		onError:               func(ivErr *ImportValidationError) error { return ivErr },
		ignoreAttachments:     ignoreAttachments,
		createMissingTeams:    createMissingTeams,
		checkServerDuplicates: checkServerDuplicates,

		serverTeams:    serverTeams,
		serverChannels: serverChannels,
		serverUsers:    serverUsers,
		serverEmails:   serverEmails,

		attachments:     make(map[string]*zip.File),
		attachmentsUsed: make(map[string]uint64),

		roles:    map[string]ImportFileInfo{},
		schemes:  map[string]ImportFileInfo{},
		teams:    map[string]ImportFileInfo{},
		channels: map[ChannelTeam]ImportFileInfo{},
		users:    map[string]ImportFileInfo{},
		emojis:   map[string]ImportFileInfo{},

		maxPostSize: maxPostSize,
	}

	v.loadFromServer()
	return v
}

func (v *Validator) Roles() uint64 {
	return uint64(len(v.roles))
}

func (v *Validator) Schemes() uint64 {
	return uint64(len(v.schemes))
}

func (v *Validator) CreatedTeams() []string {
	createdTeams := make([]string, 0, len(v.teams))
	for name, team := range v.teams {
		if team.Source == SourceAdhoc {
			createdTeams = append(createdTeams, name)
		}
	}
	return createdTeams
}

func (v *Validator) TeamCount() uint64 {
	return uint64(len(v.teams) - len(v.serverTeams))
}

func (v *Validator) ChannelCount() uint64 {
	return uint64(len(v.channels) - len(v.serverChannels))
}

func (v *Validator) UserCount() uint64 {
	return uint64(len(v.users) - len(v.serverUsers))
}

func (v *Validator) PostCount() uint64 {
	return v.posts
}

func (v *Validator) DirectChannelCount() uint64 {
	return v.directChannels
}

func (v *Validator) DirectPostCount() uint64 {
	return v.directPosts
}

func (v *Validator) Emojis() uint64 {
	return uint64(len(v.emojis))
}

func (v *Validator) StartTime() time.Time {
	return v.start
}

func (v *Validator) EndTime() time.Time {
	return v.end
}

func (v *Validator) Duration() time.Duration {
	return v.end.Sub(v.start)
}

func (v *Validator) Lines() uint64 {
	return v.lines
}

func (v *Validator) OnError(f func(*ImportValidationError) error) {
	if f == nil {
		f = func(ivErr *ImportValidationError) error { return ivErr }
	}

	v.onError = f
}

func (v *Validator) createTeam(name string) {
	v.teams[name] = ImportFileInfo{
		Source: SourceAdhoc,
	}
}

func (v *Validator) loadFromServer() {
	for name := range v.serverTeams {
		v.teams[name] = ImportFileInfo{
			Source: SourceServer,
		}
	}
	for channelTeam := range v.serverChannels {
		v.channels[channelTeam] = ImportFileInfo{
			Source: SourceServer,
		}
	}
	for name := range v.serverUsers {
		v.users[name] = ImportFileInfo{
			Source: SourceServer,
		}
	}
}

func (v *Validator) Validate() error {
	v.start = time.Now()
	defer func() {
		v.end = time.Now()
	}()

	f, err := os.Open(v.archiveName)
	if err != nil {
		return fmt.Errorf("error opening the import file %q: %w", v.archiveName, err)
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return fmt.Errorf("error reading the metadata the input file: %w", err)
	}

	z, err := zip.NewReader(f, stat.Size())
	if err != nil {
		return fmt.Errorf("error reading the ZIP file: %w", err)
	}

	var jsonlZip *zip.File
	for _, zfile := range z.File {
		if filepath.Ext(zfile.Name) != ".jsonl" {
			continue
		}

		jsonlZip = zfile
		break
	}
	if jsonlZip == nil {
		return fmt.Errorf("could not find a .jsonl file in the import archive")
	}

	if !v.ignoreAttachments {
		for _, zfile := range z.File {
			if zfile.FileInfo().IsDir() {
				continue
			}
			if strings.HasPrefix(zfile.Name, "data/") {
				v.attachments[zfile.Name] = zfile
			}
			v.allFileNames = append(v.allFileNames, zfile.Name)
		}
	}

	v.lines, err = v.countLines(jsonlZip)
	if err != nil {
		return err
	}
	printer.PrintT("The .jsonl file has {{ .Total }} lines\n", struct {
		Total uint64 `json:"total_lines"`
	}{v.lines})

	info := ImportFileInfo{
		Source:     filepath.Base(v.archiveName),
		FileName:   jsonlZip.Name,
		TotalLines: v.lines,
	}

	err = v.validateLines(info, jsonlZip)
	if err != nil {
		return err
	}

	return err
}

func (v *Validator) countLines(zf *zip.File) (uint64, error) {
	f, err := zf.Open()
	if err != nil {
		return 0, fmt.Errorf("error counting the lines: %w", err)
	}
	defer f.Close()

	buffer := make([]byte, 64*1024)
	count := uint64(0)

	for {
		n, err := f.Read(buffer)

		for _, c := range buffer[:n] {
			if c == '\n' {
				count++
			}
		}

		printCount(count)

		if err != nil {
			if err == io.EOF {
				err = nil
			}
			return count, err
		}
	}
}

func (v *Validator) validateLines(info ImportFileInfo, zf *zip.File) error {
	f, err := zf.Open()
	if err != nil {
		return fmt.Errorf("error validating the lines: %w", err)
	}
	defer f.Close()

	s := bufio.NewScanner(f)
	buf := make([]byte, 0, 64*1024)
	s.Buffer(buf, 16*1024*1024)

	for s.Scan() {
		info.CurrentLine++

		rawLine := s.Bytes()

		// filter empty lines
		rawLine = bytes.TrimSpace(rawLine)
		if len(rawLine) == 0 {
			if err = v.onError(&ImportValidationError{
				ImportFileInfo: info,
				Err:            errors.New("unexpected empty line"),
			}); err != nil {
				return err
			}
		}

		// decode the line
		var line imports.LineImportData
		err = json.Unmarshal(rawLine, &line)
		if err != nil {
			if err = v.onError(&ImportValidationError{
				ImportFileInfo: info,
				Err:            err,
			}); err != nil {
				return err
			}
		}

		err = v.validateLine(info, line)
		if err != nil {
			return err
		}

		if info.CurrentLine%1024 == 0 {
			printProgress(info.CurrentLine, info.TotalLines)
		}
	}
	if err = s.Err(); err != nil {
		if err = v.onError(&ImportValidationError{
			ImportFileInfo: info,
			Err:            err,
		}); err != nil {
			return err
		}
	}

	printProgress(info.TotalLines, info.TotalLines)

	return nil
}

func (v *Validator) validateLine(info ImportFileInfo, line imports.LineImportData) error {
	var err error

	// make sure the file starts with a version
	if info.CurrentLine == 1 && line.Type != "version" {
		if err = v.onError(&ImportValidationError{
			ImportFileInfo: info,
			Err:            fmt.Errorf("first line has the wrong type: expected \"version\", got %q", line.Type),
		}); err != nil {
			return err
		}
	}

	switch line.Type {
	case LineTypeVersion:
		err = v.validateVersion(info, line)
	case LineTypeRole:
		err = v.validateRole(info, line)
	case LineTypeScheme:
		err = v.validateScheme(info, line)
	case LineTypeTeam:
		err = v.validateTeam(info, line)
	case LineTypeChannel:
		err = v.validateChannel(info, line)
	case LineTypeUser:
		err = v.validateUser(info, line)
	case LineTypeBot:
		err = v.validateBot(info, line)
	case LineTypePost:
		err = v.validatePost(info, line)
	case LineTypeDirectChannel:
		err = v.validateDirectChannel(info, line)
	case LineTypeDirectPost:
		err = v.validateDirectPost(info, line)
	case LineTypeEmoji:
		err = v.validateEmoji(info, line)
	default:
		err = v.onError(&ImportValidationError{
			ImportFileInfo: info,
			FieldName:      "type",
			Err:            fmt.Errorf("unknown import type %q", line.Type),
		})
	}

	return err
}

func (v *Validator) validateVersion(info ImportFileInfo, line imports.LineImportData) (err error) {
	if info.CurrentLine != 1 {
		if err = v.onError(&ImportValidationError{
			ImportFileInfo: info,
			Err:            fmt.Errorf("version info must be the first line of the file"),
		}); err != nil {
			return err
		}
	}

	if line.Version == nil {
		if err = v.onError(&ImportValidationError{
			ImportFileInfo: info,
			Err:            fmt.Errorf("version must not be null or missing"),
		}); err != nil {
			return err
		}
	} else if *line.Version != 1 {
		if err = v.onError(&ImportValidationError{
			ImportFileInfo: info,
			Err:            fmt.Errorf("version must not be 1"),
		}); err != nil {
			return err
		}
	}

	return nil
}

func (v *Validator) validateRole(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "role", line.Role, func(data imports.RoleImportData) *ImportValidationError {
		appErr := imports.ValidateRoleImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "role",
				Err:            appErr,
			}
		}

		if data.Name != nil {
			if existing, ok := v.roles[*data.Name]; ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "role",
					Err:            fmt.Errorf("duplicate entry, previous was in line: %d", existing.CurrentLine),
				}
			}
			v.roles[*data.Name] = info
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) validateScheme(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "scheme", line.Scheme, func(data imports.SchemeImportData) *ImportValidationError {
		appErr := imports.ValidateSchemeImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "scheme",
				Err:            appErr,
			}
		}

		if data.Name != nil {
			if existing, ok := v.schemes[*data.Name]; ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "scheme",
					Err:            fmt.Errorf("duplicate entry, previous was in line: %d", existing.CurrentLine),
				}
			}
			v.schemes[*data.Name] = info
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) checkDuplicateTeam(info ImportFileInfo, team string) *ImportValidationError {
	if v.checkServerDuplicates {
		if existing, ok := v.serverTeams[team]; ok {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "team",
				Err:            fmt.Errorf("duplicate entry, server already has a team named %q (display: %q, id: %s)", existing.Name, existing.DisplayName, existing.Id),
			}
		}
	}

	if existing, ok := v.teams[team]; ok && existing.Source != SourceServer {
		return &ImportValidationError{
			ImportFileInfo: info,
			FieldName:      "team",
			Err:            fmt.Errorf("duplicate entry, previous was in line: %d", existing.CurrentLine),
		}
	}

	return nil
}

func (v *Validator) validateTeam(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "team", line.Team, func(data imports.TeamImportData) *ImportValidationError {
		appErr := imports.ValidateTeamImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "team",
				Err:            appErr,
			}
		}

		if data.Name != nil {
			if ive := v.checkDuplicateTeam(info, *data.Name); ive != nil {
				return ive
			}
			v.teams[*data.Name] = info
		}
		if data.Scheme != nil {
			if _, ok := v.schemes[*data.Scheme]; !ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "team.scheme",
					Err:            fmt.Errorf("reference to unknown scheme %q", *data.Scheme),
				}
			}
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) checkDuplicateChannel(info ImportFileInfo, team, channel string) *ImportValidationError {
	if v.checkServerDuplicates {
		if existing, ok := v.serverChannels[ChannelTeam{Channel: channel, Team: team}]; ok {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "channel",
				Err:            fmt.Errorf("duplicate entry, server already has a channel %q (display: %q, id: %s) in team %q", existing.Name, existing.DisplayName, existing.Id, team),
			}
		}
	}

	if existing, ok := v.channels[ChannelTeam{Channel: channel, Team: team}]; ok && existing.Source != SourceServer {
		return &ImportValidationError{
			ImportFileInfo: info,
			FieldName:      "channel",
			Err:            fmt.Errorf("duplicate entry, previous was in line: %d", existing.CurrentLine),
		}
	}

	return nil
}

func (v *Validator) validateChannel(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "channel", line.Channel, func(data imports.ChannelImportData) *ImportValidationError {
		appErr := imports.ValidateChannelImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "channel",
				Err:            appErr,
			}
		}

		if data.Team != nil {
			if _, ok := v.teams[*data.Team]; !ok {
				if v.createMissingTeams {
					v.createTeam(*data.Team)
				} else {
					return &ImportValidationError{
						ImportFileInfo: info,
						FieldName:      "channel.team",
						Err:            fmt.Errorf("reference to unknown team %q", *data.Team),
					}
				}
			}
		}
		if data.Name != nil {
			if ive := v.checkDuplicateChannel(info, *data.Team, *data.Name); ive != nil {
				return ive
			}
			v.channels[ChannelTeam{Channel: *data.Name, Team: *data.Team}] = info
		}
		if data.Scheme != nil {
			if _, ok := v.schemes[*data.Scheme]; !ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "channel.scheme",
					Err:            fmt.Errorf("reference to unknown scheme %q", *data.Scheme),
				}
			}
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) checkDuplicateUser(info ImportFileInfo, username, email string) *ImportValidationError {
	if existing, ok := v.serverUsers[username]; ok {
		if emailUser, ok := v.serverEmails[email]; ok {
			if existing.Id != emailUser.Id {
				// there is another user which already has this email address, this will result in
				// an import errors regardless of the user merging.
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "user",
					Err:            fmt.Errorf("email address %q for %q is already used by another user %q (id: %s)", email, username, emailUser.Username, emailUser.Id),
				}
			}
		}

		if v.checkServerDuplicates {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "user",
				Err:            fmt.Errorf("duplicate entry, server already has a user %q (email: %q, id: %s)", existing.Username, existing.Email, existing.Id),
			}
		}
	}

	if existing, ok := v.users[username]; ok && existing.Source != SourceServer {
		return &ImportValidationError{
			ImportFileInfo: info,
			FieldName:      "user",
			Err:            fmt.Errorf("duplicate entry, previous was in line: %d", existing.CurrentLine),
		}
	}

	return nil
}

func (v *Validator) validateUser(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "user", line.User, func(data imports.UserImportData) *ImportValidationError {
		appErr := imports.ValidateUserImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "user",
				Err:            appErr,
			}
		}

		if data.Username != nil {
			if ive := v.checkDuplicateUser(info, *data.Username, *data.Email); ive != nil {
				return ive
			}
			v.users[*data.Username] = info
		}
		if data.Teams != nil {
			for i, team := range *data.Teams {
				if _, ok := v.teams[*team.Name]; !ok {
					if v.createMissingTeams {
						v.createTeam(*team.Name)
					} else {
						return &ImportValidationError{
							ImportFileInfo: info,
							FieldName:      fmt.Sprintf("user.teams[%d]", i),
							Err:            fmt.Errorf("reference to unknown team %q", *team.Name),
						}
					}
				}
			}
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) validateBot(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "bot", line.Bot, func(data imports.BotImportData) *ImportValidationError {
		appErr := imports.ValidateBotImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "bot",
				Err:            appErr,
			}
		}

		if data.Username != nil {
			// e-mails are for bots are converted to the the username@localhost format
			// see model.BotFromUser
			botMail := model.NormalizeEmail(fmt.Sprintf("%s@localhost", *data.Username))
			if ive := v.checkDuplicateUser(info, *data.Username, botMail); ive != nil {
				return ive
			}
			v.users[*data.Username] = info
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) validatePost(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "post", line.Post, func(data imports.PostImportData) *ImportValidationError {
		appErr := imports.ValidatePostImportData(&data, v.maxPostSize)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "post",
				Err:            appErr,
			}
		}

		if data.Team != nil {
			if _, ok := v.teams[*data.Team]; !ok {
				if v.createMissingTeams {
					v.createTeam(*data.Team)
				} else {
					return &ImportValidationError{
						ImportFileInfo: info,
						FieldName:      "post.team",
						Err:            fmt.Errorf("reference to unknown team %q", *data.Team),
					}
				}
			}
		}
		if data.Channel != nil {
			if _, ok := v.channels[ChannelTeam{Channel: *data.Channel, Team: *data.Team}]; !ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "post.channel",
					Err:            fmt.Errorf("reference to unknown channel \"%s/%s\"", *data.Team, *data.Channel),
				}
			}
		}
		if data.User != nil {
			if _, ok := v.users[*data.User]; !ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "post.user",
					Err:            fmt.Errorf("reference to unknown user %q", *data.User),
				}
			}
		}

		return nil
	})
	if ivErr != nil {
		if err = v.onError(ivErr); err != nil {
			return err
		}
	}

	if !v.ignoreAttachments && line.Post != nil && line.Post.Attachments != nil {
		for i, attachment := range *line.Post.Attachments {
			if attachment.Path == nil {
				continue
			}

			attachmentPath := *attachment.Path
			if _, ok := v.attachments[attachmentPath]; !ok {
				attachmentPath = path.Join("data", *attachment.Path)
			}

			if _, ok := v.attachments[attachmentPath]; !ok {
				helpful := ""
				candidates := v.findFileNameSuffix(*attachment.Path)
				if len(candidates) != 0 {
					helpful = "; we found a match outside the \"data/\" folder \"" + strings.Join(candidates, "\" or \"") + "\""
				}

				if err = v.onError(&ImportValidationError{
					ImportFileInfo: info,
					FieldName:      fmt.Sprintf("post.attachments[%d]", i),
					Err:            fmt.Errorf("missing attachment file %q%s", attachmentPath, helpful),
				}); err != nil {
					return err
				}
			} else {
				v.attachmentsUsed[attachmentPath]++
			}
		}
	}

	v.posts++

	return nil
}

func (v *Validator) validateDirectChannel(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "direct_channel", line.DirectChannel, func(data imports.DirectChannelImportData) *ImportValidationError {
		appErr := imports.ValidateDirectChannelImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "direct_channel",
				Err:            appErr,
			}
		}

		if data.FavoritedBy != nil {
			for i, favoritedBy := range *data.FavoritedBy {
				if _, ok := v.users[favoritedBy]; !ok {
					return &ImportValidationError{
						ImportFileInfo: info,
						FieldName:      fmt.Sprintf("direct_channel.favorited_by[%d]", i),
						Err:            fmt.Errorf("reference to unknown user %q", favoritedBy),
					}
				}
			}
		}

		if data.Participants != nil {
			for i, member := range data.Participants {
				if _, ok := v.users[*member.Username]; !ok {
					return &ImportValidationError{
						ImportFileInfo: info,
						FieldName:      fmt.Sprintf("direct_channel.members[%d]", i),
						Err:            fmt.Errorf("reference to unknown user %q", *member.Username),
					}
				}
			}
		} else if data.Members != nil {
			for i, member := range *data.Members {
				if _, ok := v.users[member]; !ok {
					return &ImportValidationError{
						ImportFileInfo: info,
						FieldName:      fmt.Sprintf("direct_channel.members[%d]", i),
						Err:            fmt.Errorf("reference to unknown user %q", member),
					}
				}
			}
		}

		return nil
	})
	if ivErr != nil {
		if err = v.onError(ivErr); err != nil {
			return err
		}
	}

	v.directChannels++

	return nil
}

func (v *Validator) validateDirectPost(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "direct_post", line.DirectPost, func(data imports.DirectPostImportData) *ImportValidationError {
		appErr := imports.ValidateDirectPostImportData(&data, v.maxPostSize)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "post",
				Err:            appErr,
			}
		}

		if data.User != nil {
			if _, ok := v.users[*data.User]; !ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "direct_post.user",
					Err:            fmt.Errorf("reference to unknown user %q", *data.User),
				}
			}
		}

		return nil
	})
	if ivErr != nil {
		if err = v.onError(ivErr); err != nil {
			return err
		}
	}

	if line.DirectPost != nil && line.DirectPost.ChannelMembers != nil {
		for i, member := range *line.DirectPost.ChannelMembers {
			if _, ok := v.users[member]; !ok {
				if err = v.onError(&ImportValidationError{
					ImportFileInfo: info,
					FieldName:      fmt.Sprintf("direct_post.channel_members[%d]", i),
					Err:            fmt.Errorf("reference to unknown user %q", member),
				}); err != nil {
					return err
				}
			}
		}
	}

	if !v.ignoreAttachments && line.DirectPost != nil && line.DirectPost.Attachments != nil {
		for i, attachment := range *line.DirectPost.Attachments {
			if attachment.Path == nil {
				continue
			}

			attachmentPath := *attachment.Path
			if _, ok := v.attachments[attachmentPath]; !ok {
				attachmentPath = path.Join("data", *attachment.Path)
			}

			if _, ok := v.attachments[attachmentPath]; !ok {
				helpful := ""
				candidates := v.findFileNameSuffix(*attachment.Path)
				if len(candidates) != 0 {
					helpful = "; we found a match outside the \"data/\" folder \"" + strings.Join(candidates, "\" or \"") + "\""
				}

				if err = v.onError(&ImportValidationError{
					ImportFileInfo: info,
					FieldName:      fmt.Sprintf("direct_post.attachments[%d]", i),
					Err:            fmt.Errorf("missing attachment file %q%s", attachmentPath, helpful),
				}); err != nil {
					return err
				}
			} else {
				v.attachmentsUsed[attachmentPath]++
			}
		}
	}

	v.directPosts++

	return nil
}

func (v *Validator) validateEmoji(info ImportFileInfo, line imports.LineImportData) (err error) {
	ivErr := validateNotNil(info, "emoji", line.Emoji, func(data imports.EmojiImportData) *ImportValidationError {
		appErr := imports.ValidateEmojiImportData(&data)
		if appErr != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "emoji",
				Err:            appErr,
			}
		}

		if data.Name != nil {
			if existing, ok := v.emojis[*data.Name]; ok {
				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "emoji",
					Err:            fmt.Errorf("duplicate entry, previous was in line: %d", existing.CurrentLine),
				}
			}
			v.emojis[*data.Name] = info
		}

		if !v.ignoreAttachments && data.Image != nil {
			attachmentPath := path.Join("data", *data.Image)

			zfile, ok := v.attachments[attachmentPath]
			if !ok {
				helpful := ""
				candidates := v.findFileNameSuffix(*data.Image)
				if len(candidates) != 0 {
					helpful = "; we found a match outside the \"data/\" folder \"" + strings.Join(candidates, "\" or \"") + "\""
				}

				return &ImportValidationError{
					ImportFileInfo: info,
					FieldName:      "emoji.image",
					Err:            fmt.Errorf("missing image file for emoji %s: %q%s", *data.Name, attachmentPath, helpful),
				}
			}

			return v.validateSupportedImage(info, zfile)
		}

		return nil
	})
	if ivErr != nil {
		return v.onError(ivErr)
	}

	return nil
}

func (v *Validator) Attachments() []string {
	used := make([]string, 0, len(v.attachmentsUsed))
	for attachment := range v.attachmentsUsed {
		used = append(used, attachment)
	}
	sort.Strings(used)
	return used
}

func (v *Validator) UnusedAttachments() []string {
	var unused []string
	for attachment := range v.attachments {
		if _, ok := v.attachmentsUsed[attachment]; !ok {
			unused = append(unused, attachment)
		}
	}
	sort.Strings(unused)
	return unused
}

func (v *Validator) validateSupportedImage(info ImportFileInfo, zfile *zip.File) *ImportValidationError {
	f, err := zfile.Open()
	if err != nil {
		return &ImportValidationError{
			ImportFileInfo: info,
			FieldName:      "emoji.image",
			Err:            fmt.Errorf("error opening emoji image: %w", err),
		}
	}
	defer f.Close()

	if mime.TypeByExtension(strings.ToLower(path.Ext(zfile.Name))) == "image/svg+xml" {
		var svg struct{}
		err = xml.NewDecoder(f).Decode(&svg)
		if err != nil {
			return &ImportValidationError{
				ImportFileInfo: info,
				FieldName:      "emoji.image",
				Err:            fmt.Errorf("error decoding emoji SVG file: %w", err),
			}
		}

		return nil
	}

	_, _, err = image.Decode(f)
	if err != nil {
		return &ImportValidationError{
			ImportFileInfo: info,
			FieldName:      "emoji.image",
			Err:            fmt.Errorf("error decoding emoji image: %w", err),
		}
	}

	return nil
}

func validateNotNil[T any](info ImportFileInfo, name string, value *T, then func(T) *ImportValidationError) *ImportValidationError {
	if value == nil {
		return &ImportValidationError{
			ImportFileInfo: info,
			FieldName:      name,
			Err:            errors.New("field must not be null or missing"),
		}
	}

	if then != nil {
		return then(*value)
	}

	return nil
}

func (v *Validator) findFileNameSuffix(name string) []string {
	var candidates []string
	for _, fileName := range v.allFileNames {
		if strings.HasSuffix(fileName, name) {
			candidates = append(candidates, fileName)
		}
	}
	return candidates
}

var progressTemplate = template.Must(template.New("").Parse("Progress: {{ .Current }}/{{ .Total }} ({{ printf \"%.2f\" .Percent }}%)\r"))

func printProgress(current, total uint64) {
	percent := float64(current) * 100 / float64(total)

	data := struct {
		Current uint64  `json:"current_line"`
		Total   uint64  `json:"total_lines"`
		Percent float64 `json:"percent"`
	}{current, total, percent}

	printer.PrintPreparedT(progressTemplate, data)
	printer.Flush()
}

var countTemplate = template.Must(template.New("").Parse("Counting lines: {{ .Total }}\r"))

func printCount(total uint64) {
	data := struct {
		Total uint64 `json:"total_lines"`
	}{total}

	printer.PrintPreparedT(countTemplate, data)
	printer.Flush()
}
