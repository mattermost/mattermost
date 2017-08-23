// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

type GiphyProvider struct {
}

const (
	CMD_GIPHY = "giphy"
)

func init() {
	RegisterCommandProvider(&GiphyProvider{})
}

func (me *GiphyProvider) GetTrigger() string {
	return CMD_GIPHY
}

func (me *GiphyProvider) GetCommand(T goi18n.TranslateFunc) *model.Command {
	return &model.Command{
		Trigger:          CMD_GIPHY,
		AutoComplete:     true,
		AutoCompleteDesc: T("api.command_giphy.desc"),
		AutoCompleteHint: T("api.command_giphy.hint"),
		DisplayName:      T("api.command_giphy.name"),
	}
}

type giphyTranslateResponse struct {
	Data struct {
		Type             string `json:"type"`
		ID               string `json:"id"`
		Slug             string `json:"slug"`
		URL              string `json:"url"`
		BitlyGifURL      string `json:"bitly_gif_url"`
		BitlyURL         string `json:"bitly_url"`
		EmbedURL         string `json:"embed_url"`
		Username         string `json:"username"`
		Source           string `json:"source"`
		Rating           string `json:"rating"`
		ContentURL       string `json:"content_url"`
		SourceTld        string `json:"source_tld"`
		SourcePostURL    string `json:"source_post_url"`
		IsIndexable      int    `json:"is_indexable"`
		ImportDatetime   string `json:"import_datetime"`
		TrendingDatetime string `json:"trending_datetime"`
		Images           struct {
			FixedHeightStill struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
			} `json:"fixed_height_still"`
			OriginalStill struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
			} `json:"original_still"`
			FixedWidth struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Mp4      string `json:"mp4"`
				Mp4Size  string `json:"mp4_size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"fixed_width"`
			FixedHeightSmallStill struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
			} `json:"fixed_height_small_still"`
			FixedHeightDownsampled struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"fixed_height_downsampled"`
			Preview struct {
				Width   string `json:"width"`
				Height  string `json:"height"`
				Mp4     string `json:"mp4"`
				Mp4Size string `json:"mp4_size"`
			} `json:"preview"`
			FixedHeightSmall struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Mp4      string `json:"mp4"`
				Mp4Size  string `json:"mp4_size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"fixed_height_small"`
			DownsizedStill struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
			} `json:"downsized_still"`
			Downsized struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
				Size   string `json:"size"`
			} `json:"downsized"`
			DownsizedLarge struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
				Size   string `json:"size"`
			} `json:"downsized_large"`
			FixedWidthSmallStill struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
			} `json:"fixed_width_small_still"`
			PreviewWebp struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
				Size   string `json:"size"`
			} `json:"preview_webp"`
			FixedWidthStill struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
			} `json:"fixed_width_still"`
			FixedWidthSmall struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Mp4      string `json:"mp4"`
				Mp4Size  string `json:"mp4_size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"fixed_width_small"`
			DownsizedSmall struct {
				Width   string `json:"width"`
				Height  string `json:"height"`
				Mp4     string `json:"mp4"`
				Mp4Size string `json:"mp4_size"`
			} `json:"downsized_small"`
			FixedWidthDownsampled struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"fixed_width_downsampled"`
			DownsizedMedium struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
				Size   string `json:"size"`
			} `json:"downsized_medium"`
			Original struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Frames   string `json:"frames"`
				Mp4      string `json:"mp4"`
				Mp4Size  string `json:"mp4_size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"original"`
			FixedHeight struct {
				URL      string `json:"url"`
				Width    string `json:"width"`
				Height   string `json:"height"`
				Size     string `json:"size"`
				Mp4      string `json:"mp4"`
				Mp4Size  string `json:"mp4_size"`
				Webp     string `json:"webp"`
				WebpSize string `json:"webp_size"`
			} `json:"fixed_height"`
			Looping struct {
				Mp4     string `json:"mp4"`
				Mp4Size string `json:"mp4_size"`
			} `json:"looping"`
			OriginalMp4 struct {
				Width   string `json:"width"`
				Height  string `json:"height"`
				Mp4     string `json:"mp4"`
				Mp4Size string `json:"mp4_size"`
			} `json:"original_mp4"`
			PreviewGif struct {
				URL    string `json:"url"`
				Width  string `json:"width"`
				Height string `json:"height"`
				Size   string `json:"size"`
			} `json:"preview_gif"`
		} `json:"images"`
	} `json:"data"`
	Meta struct {
		Status     int    `json:"status"`
		Msg        string `json:"msg"`
		ResponseID string `json:"response_id"`
	} `json:"meta"`
}

func (me *GiphyProvider) DoCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	giphyApiKey := "c2ee6099a4f94a82b45e6ac5f71be18d"
	escapedQuery := url.PathEscape(message)
	giphyUrl := fmt.Sprintf("https://api.giphy.com/v1/gifs/translate?api_key=%s&s=%s", giphyApiKey, escapedQuery)

	resp, err := http.Get(giphyUrl)
	if err != nil {
		l4g.Error("An error occurred while querying Giphy, err=%v", err)
	}
	defer resp.Body.Close()

	var giphyResponse giphyTranslateResponse
	if bytes, err := ioutil.ReadAll(resp.Body); err != nil {
		l4g.Error("An error occurred while reading the Giphy response body, err=%v", err)
	} else if err := json.Unmarshal(bytes, &giphyResponse); err != nil {
		l4g.Error("An error occurred while deserializing the Giphy response, err=%v", err)
	}

	post := &model.Post{
		ChannelId: args.ChannelId,
		RootId:    args.RootId,
		ParentId:  args.ParentId,
		UserId:    args.UserId,
		Message:   fmt.Sprintf("%v\n%v", message, giphyResponse.Data.Images.Original.URL),
	}

	if _, err := CreatePost(post, args.TeamId, true); err != nil {
		l4g.Error("Unable to create /echo post, err=%v", err)
	}

	return &model.CommandResponse{}
}
