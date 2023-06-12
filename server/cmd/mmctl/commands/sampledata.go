// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//nolint:gosec
package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/utils"

	"github.com/mattermost/mattermost/server/public/model"
	pUtils "github.com/mattermost/mattermost/server/public/utils"

	"github.com/icrowley/fake"
	"github.com/spf13/cobra"
)

const (
	deactivatedUser = "deactivated"
	guestUser       = "guest"
	attachmentsDir  = "attachments"
)

var SampledataCmd = &cobra.Command{
	Use:   "sampledata",
	Short: "Generate sample data",
	Long:  "Generate a sample data file and store it locally, or directly import it to the remote server",
	Example: `  # you can create a sampledata file and store it locally
  $ mmctl sampledata --bulk sampledata-file.jsonl

  # or you can simply print it to the stdout
  $ mmctl sampledata --bulk -

  # the amount of entities to create can be customized
  $ mmctl sampledata -t 7 -u 20 -g 4

  # the sampledata file can be directly imported in the remote server by not specifying a --bulk flag
  $ mmctl sampledata

  # and the sample users can be created with profile pictures
  $ mmctl sampledata --profile-images ./images/profiles`,
	Args: cobra.NoArgs,
	RunE: withClient(sampledataCmdF),
}

func init() {
	SampledataCmd.Flags().Int64P("seed", "s", 1, "Seed used for generating the random data (Different seeds generate different data).")
	SampledataCmd.Flags().IntP("teams", "t", 2, "The number of sample teams.")
	SampledataCmd.Flags().Int("channels-per-team", 10, "The number of sample channels per team.")
	SampledataCmd.Flags().IntP("users", "u", 15, "The number of sample users.")
	SampledataCmd.Flags().IntP("guests", "g", 1, "The number of sample guests.")
	SampledataCmd.Flags().Int("deactivated-users", 0, "The number of deactivated users.")
	SampledataCmd.Flags().Int("team-memberships", 2, "The number of sample team memberships per user.")
	SampledataCmd.Flags().Int("channel-memberships", 5, "The number of sample channel memberships per user in a team.")
	SampledataCmd.Flags().Int("posts-per-channel", 100, "The number of sample post per channel.")
	SampledataCmd.Flags().Int("direct-channels", 30, "The number of sample direct message channels.")
	SampledataCmd.Flags().Int("posts-per-direct-channel", 15, "The number of sample posts per direct message channel.")
	SampledataCmd.Flags().Int("group-channels", 15, "The number of sample group message channels.")
	SampledataCmd.Flags().Int("posts-per-group-channel", 30, "The number of sample posts per group message channel.")
	SampledataCmd.Flags().String("profile-images", "", "Optional. Path to folder with images to randomly pick as user profile image.")
	SampledataCmd.Flags().StringP("bulk", "b", "", "Optional. Path to write a JSONL bulk file instead of uploading into the remote server.")

	RootCmd.AddCommand(SampledataCmd)
}

func uploadAndProcess(c client.Client, zipPath string, isLocal bool) error {
	zipFile, err := os.Open(zipPath)
	if err != nil {
		return fmt.Errorf("cannot open import file %q: %w", zipPath, err)
	}
	defer zipFile.Close()

	info, err := zipFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat import file: %w", err)
	}

	userID := "me"
	if isLocal {
		userID = model.UploadNoUserID
	}

	// create session
	us, _, err := c.CreateUpload(context.TODO(), &model.UploadSession{
		Filename: info.Name(),
		FileSize: info.Size(),
		Type:     model.UploadTypeImport,
		UserId:   userID,
	})
	if err != nil {
		return fmt.Errorf("failed to create upload session: %w", err)
	}

	printer.PrintT("Upload session successfully created, ID: {{.Id}} ", us)

	// upload file
	finfo, _, err := c.UploadData(context.TODO(), us.Id, zipFile)
	if err != nil {
		return fmt.Errorf("failed to upload data: %w", err)
	}

	printer.PrintT("Import file successfully uploaded, name: {{.Name}}", finfo)

	// process
	job, _, err := c.CreateJob(context.TODO(), &model.Job{
		Type: model.JobTypeImportProcess,
		Data: map[string]string{
			"import_file": us.Id + "_" + finfo.Name,
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create import process job: %w", err)
	}

	printer.PrintT("Import process job successfully created, ID: {{.Id}}", job)

	for {
		job, _, err = c.GetJob(context.TODO(), job.Id)
		if err != nil {
			return fmt.Errorf("failed to get import job status: %w", err)
		}

		if job.Status != model.JobStatusPending && job.Status != model.JobStatusInProgress {
			break
		}

		time.Sleep(500 * time.Millisecond)
	}

	if job.Status != model.JobStatusSuccess {
		return fmt.Errorf("job reported non-success status: %s", job.Status)
	}

	printer.PrintT("Sampledata successfully processed", job)

	return nil
}

func processProfileImagesDir(profileImagesPath, tmpDir, bulk string) ([]string, error) {
	profileImages := []string{}
	var profileImagesStat os.FileInfo
	profileImagesStat, err := os.Stat(profileImagesPath)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("profile images folder doesn't exist")
	}
	if !profileImagesStat.IsDir() {
		return nil, fmt.Errorf("profile-images parameters must be a directory")
	}
	var profileImagesFiles []os.FileInfo
	profileImagesFiles, err = ioutil.ReadDir(profileImagesPath)
	if err != nil {
		return nil, fmt.Errorf("invalid profile-images parameter: %w", err)
	}

	// we need to copy the images to be part of the import zip
	if bulk == "" {
		for _, profileImage := range profileImagesFiles {
			profileImageSrc := filepath.Join(profileImagesPath, profileImage.Name())
			profileImagePath := filepath.Join(attachmentsDir, profileImage.Name())
			profileImageDst := filepath.Join(tmpDir, profileImagePath)
			if err := pUtils.CopyFile(profileImageSrc, profileImageDst); err != nil {
				return nil, fmt.Errorf("cannot copy file %q to %q: %w", profileImageSrc, profileImageDst, err)
			}
			// the path we use in the profile info is relative to the zipfile base
			profileImages = append(profileImages, profileImagePath)
		}
		// we're not importing the resulting file, so we keep the
		// image paths corresponding to the value of the flag
	} else {
		for _, profileImage := range profileImagesFiles {
			profileImages = append(profileImages, filepath.Join(profileImagesPath, profileImage.Name()))
		}
	}

	sort.Strings(profileImages)
	return profileImages, nil
}

//nolint:gocyclo
func sampledataCmdF(c client.Client, command *cobra.Command, args []string) error {
	seed, _ := command.Flags().GetInt64("seed")
	bulk, _ := command.Flags().GetString("bulk")
	teams, _ := command.Flags().GetInt("teams")
	channelsPerTeam, _ := command.Flags().GetInt("channels-per-team")
	users, _ := command.Flags().GetInt("users")
	deactivatedUsers, _ := command.Flags().GetInt("deactivated-users")
	guests, _ := command.Flags().GetInt("guests")
	teamMemberships, _ := command.Flags().GetInt("team-memberships")
	channelMemberships, _ := command.Flags().GetInt("channel-memberships")
	postsPerChannel, _ := command.Flags().GetInt("posts-per-channel")
	directChannels, _ := command.Flags().GetInt("direct-channels")
	postsPerDirectChannel, _ := command.Flags().GetInt("posts-per-direct-channel")
	groupChannels, _ := command.Flags().GetInt("group-channels")
	postsPerGroupChannel, _ := command.Flags().GetInt("posts-per-group-channel")
	profileImagesPath, _ := command.Flags().GetString("profile-images")
	withAttachments := profileImagesPath != ""

	if teamMemberships > teams {
		return fmt.Errorf("you can't have more team memberships than teams")
	}
	if channelMemberships > channelsPerTeam {
		return fmt.Errorf("you can't have more channel memberships than channels per team")
	}

	if users < 6 && groupChannels > 0 {
		return fmt.Errorf("you can't have group channels generation with less than 6 users. Use --group-channels 0 or increase the number of users")
	}

	var bulkFile *os.File
	var tmpDir string
	var err error
	switch bulk {
	case "":
		tmpDir, err = ioutil.TempDir("", "mmctl-sampledata-")
		if err != nil {
			return fmt.Errorf("unable to create temporary directory")
		}
		defer os.RemoveAll(tmpDir)

		if withAttachments {
			if err = os.Mkdir(filepath.Join(tmpDir, attachmentsDir), 0755); err != nil {
				return fmt.Errorf("cannot create attachments directory: %w", err)
			}
		}

		bulkFile, err = os.Create(filepath.Join(tmpDir, "import.jsonl"))
		if err != nil {
			return fmt.Errorf("unable to open temporary file: %w", err)
		}
		defer bulkFile.Close()
	case "-":
		bulkFile = os.Stdout
	default:
		bulkFile, err = os.OpenFile(bulk, os.O_RDWR|os.O_CREATE, 0755)
		if err != nil {
			return fmt.Errorf("unable to write into the %q file: %w", bulk, err)
		}
		defer bulkFile.Close()
	}

	profileImages := []string{}
	if profileImagesPath != "" {
		profileImages, err = processProfileImagesDir(profileImagesPath, tmpDir, bulk)
		if err != nil {
			return fmt.Errorf("cannot process profile images directory: %w", err)
		}
	}

	encoder := json.NewEncoder(bulkFile)
	version := 1
	if err := encoder.Encode(imports.LineImportData{Type: "version", Version: &version}); err != nil {
		return fmt.Errorf("could not encode version line: %w", err)
	}

	fake.Seed(seed)
	rand.Seed(seed)

	teamsAndChannels := make(map[string][]string, teams)
	for i := 0; i < teams; i++ {
		teamLine := createTeam(i)
		teamsAndChannels[*teamLine.Team.Name] = []string{}
		if err := encoder.Encode(teamLine); err != nil {
			return fmt.Errorf("could not encode team line: %w", err)
		}
	}

	teamsList := make([]string, len(teamsAndChannels))
	teamsListIndex := 0
	for teamName := range teamsAndChannels {
		teamsList[teamsListIndex] = teamName
		teamsListIndex++
	}
	sort.Strings(teamsList)

	for _, teamName := range teamsList {
		for i := 0; i < channelsPerTeam; i++ {
			channelLine := createChannel(i, teamName)
			teamsAndChannels[teamName] = append(teamsAndChannels[teamName], *channelLine.Channel.Name)
			if err := encoder.Encode(channelLine); err != nil {
				return fmt.Errorf("could not encode channel line: %w", err)
			}
		}
	}

	allUsers := make([]string, users+guests+deactivatedUsers)
	allUsersIndex := 0
	for i := 0; i < users; i++ {
		userLine := createUser(i, teamMemberships, channelMemberships, teamsAndChannels, profileImages, "")
		if err := encoder.Encode(userLine); err != nil {
			return fmt.Errorf("cannot encode user line: %w", err)
		}
		allUsers[allUsersIndex] = *userLine.User.Username
		allUsersIndex++
	}
	for i := 0; i < guests; i++ {
		userLine := createUser(i, teamMemberships, channelMemberships, teamsAndChannels, profileImages, guestUser)
		if err := encoder.Encode(userLine); err != nil {
			return fmt.Errorf("cannot encode user line: %w", err)
		}
		allUsers[allUsersIndex] = *userLine.User.Username
		allUsersIndex++
	}
	for i := 0; i < deactivatedUsers; i++ {
		userLine := createUser(i, teamMemberships, channelMemberships, teamsAndChannels, profileImages, deactivatedUser)
		if err := encoder.Encode(userLine); err != nil {
			return fmt.Errorf("cannot encode user line: %w", err)
		}
		allUsers[allUsersIndex] = *userLine.User.Username
		allUsersIndex++
	}

	for team, channels := range teamsAndChannels {
		for _, channel := range channels {
			dates := sortedRandomDates(postsPerChannel)

			for i := 0; i < postsPerChannel; i++ {
				postLine := createPost(team, channel, allUsers, dates[i])
				if err := encoder.Encode(postLine); err != nil {
					return fmt.Errorf("cannot encode post line: %w", err)
				}
			}
		}
	}

	for i := 0; i < directChannels; i++ {
		user1 := allUsers[rand.Intn(len(allUsers))]
		user2 := allUsers[rand.Intn(len(allUsers))]
		channelLine := createDirectChannel([]string{user1, user2})
		if err := encoder.Encode(channelLine); err != nil {
			return fmt.Errorf("cannot encode channel line: %w", err)
		}
	}

	for i := 0; i < directChannels; i++ {
		user1 := allUsers[rand.Intn(len(allUsers))]
		user2 := allUsers[rand.Intn(len(allUsers))]

		dates := sortedRandomDates(postsPerDirectChannel)
		for j := 0; j < postsPerDirectChannel; j++ {
			postLine := createDirectPost([]string{user1, user2}, dates[j])
			if err := encoder.Encode(postLine); err != nil {
				return fmt.Errorf("cannot encode post line: %w", err)
			}
		}
	}

	for i := 0; i < groupChannels; i++ {
		users := []string{}
		totalUsers := 3 + rand.Intn(3)
		for len(users) < totalUsers {
			user := allUsers[rand.Intn(len(allUsers))]
			if !utils.StringInSlice(user, users) {
				users = append(users, user)
			}
		}
		channelLine := createDirectChannel(users)
		if err := encoder.Encode(channelLine); err != nil {
			return fmt.Errorf("cannot encode channel line: %w", err)
		}
	}

	for i := 0; i < groupChannels; i++ {
		users := []string{}
		totalUsers := 3 + rand.Intn(3)
		for len(users) < totalUsers {
			user := allUsers[rand.Intn(len(allUsers))]
			if !utils.StringInSlice(user, users) {
				users = append(users, user)
			}
		}

		dates := sortedRandomDates(postsPerGroupChannel)
		for j := 0; j < postsPerGroupChannel; j++ {
			postLine := createDirectPost(users, dates[j])
			if err := encoder.Encode(postLine); err != nil {
				return fmt.Errorf("cannot encode post line: %w", err)
			}
		}
	}

	// if we're writing to stdout, we can finish here
	if bulk == "-" {
		return nil
	}

	if bulk == "" {
		zipPath := filepath.Join(os.TempDir(), "mmctl-sampledata.zip")
		defer os.Remove(zipPath)

		if err := zipDir(zipPath, tmpDir); err != nil {
			return fmt.Errorf("cannot compress %q directory into zipfile: %w", tmpDir, err)
		}

		isLocal, _ := command.Flags().GetBool("local")
		if err := uploadAndProcess(c, zipPath, isLocal); err != nil {
			return fmt.Errorf("cannot upload and process zipfile: %w", err)
		}
	}

	return nil
}
