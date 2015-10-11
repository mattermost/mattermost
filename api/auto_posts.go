// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	"mime/multipart"
	"os"
)

type AutoPostCreator struct {
	client         *model.Client
	channelid      string
	Fuzzy          bool
	TextLength     utils.Range
	HasImage       bool
	ImageFilenames []string
	Users          []string
	Mentions       utils.Range
	Tags           utils.Range
}

// Automatic poster used for testing
func NewAutoPostCreator(client *model.Client, channelid string) *AutoPostCreator {
	return &AutoPostCreator{
		client:         client,
		channelid:      channelid,
		Fuzzy:          false,
		TextLength:     utils.Range{100, 200},
		HasImage:       false,
		ImageFilenames: TEST_IMAGE_FILENAMES,
		Users:          []string{},
		Mentions:       utils.Range{0, 5},
		Tags:           utils.Range{0, 7},
	}
}

func (cfg *AutoPostCreator) UploadTestFile() ([]string, bool) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	filename := cfg.ImageFilenames[utils.RandIntFromRange(utils.Range{0, len(cfg.ImageFilenames) - 1})]

	part, err := writer.CreateFormFile("files", filename)
	if err != nil {
		return nil, false
	}

	path := utils.FindDir("web/static/images")
	file, err := os.Open(path + "/" + filename)
	defer file.Close()

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, false
	}

	field, err := writer.CreateFormField("channel_id")
	if err != nil {
		return nil, false
	}

	_, err = field.Write([]byte(cfg.channelid))
	if err != nil {
		return nil, false
	}

	err = writer.Close()
	if err != nil {
		return nil, false
	}

	resp, appErr := cfg.client.UploadFile("/files/upload", body.Bytes(), writer.FormDataContentType())
	if appErr != nil {
		return nil, false
	}

	return resp.Data.(*model.FileUploadResponse).Filenames, true
}

func (cfg *AutoPostCreator) CreateRandomPost() (*model.Post, bool) {
	var filenames []string
	if cfg.HasImage {
		var err1 bool
		filenames, err1 = cfg.UploadTestFile()
		if err1 == false {
			return nil, false
		}
	}

	var postText string
	if cfg.Fuzzy {
		postText = utils.FuzzPost()
	} else {
		postText = utils.RandomText(cfg.TextLength, cfg.Tags, cfg.Mentions, cfg.Users)
	}

	post := &model.Post{
		ChannelId: cfg.channelid,
		Message:   postText,
		Filenames: filenames}
	result, err2 := cfg.client.CreatePost(post)
	if err2 != nil {
		return nil, false
	}
	return result.Data.(*model.Post), true
}

func (cfg *AutoPostCreator) CreateTestPosts(rangePosts utils.Range) ([]*model.Post, bool) {
	numPosts := utils.RandIntFromRange(rangePosts)
	posts := make([]*model.Post, numPosts)

	for i := 0; i < numPosts; i++ {
		var err bool
		posts[i], err = cfg.CreateRandomPost()
		if err != true {
			return posts, false
		}
	}

	return posts, true
}
