// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/dyatlov/go-opengraph/opengraph/types/article"
	"github.com/dyatlov/go-opengraph/opengraph/types/audio"
	"github.com/dyatlov/go-opengraph/opengraph/types/book"
	"github.com/dyatlov/go-opengraph/opengraph/types/image"
	"github.com/dyatlov/go-opengraph/opengraph/types/profile"
	"github.com/dyatlov/go-opengraph/opengraph/types/video"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const BigText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus maximus faucibus ex, vitae placerat neque feugiat ac. Nam tempus libero quis pellentesque feugiat. Cras tristique diam vel condimentum viverra. Proin molestie posuere leo. Nam pulvinar, ex quis tristique cursus, turpis ante commodo elit, a dapibus est ipsum id eros. Mauris tortor dolor, posuere ac velit vitae, faucibus viverra fusce."

func sampleImage(imageName string) *image.Image {
	return &image.Image{
		URL:       fmt.Sprintf("http://example.com/%s", imageName),
		SecureURL: fmt.Sprintf("https://example.com/%s", imageName),
		Type:      "png",
		Width:     32,
		Height:    32,
	}
}

func TestLinkMetadataIsValid(t *testing.T) {
	for _, test := range []struct {
		Name     string
		Metadata *LinkMetadata
		Expected bool
	}{
		{
			Name: "should be valid image metadata",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeImage,
				Data:      &PostImage{},
			},
			Expected: true,
		},
		{
			Name: "should be valid opengraph metadata",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeOpengraph,
				Data:      &opengraph.OpenGraph{},
			},
			Expected: true,
		},
		{
			Name: "should be valid with no metadata",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeNone,
				Data:      nil,
			},
			Expected: true,
		},
		{
			Name: "should be invalid because of empty URL",
			Metadata: &LinkMetadata{
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeImage,
				Data:      &PostImage{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of empty timestamp",
			Metadata: &LinkMetadata{
				URL:  "http://example.com",
				Type: LinkMetadataTypeImage,
				Data: &PostImage{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of unrounded timestamp",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800001,
				Type:      LinkMetadataTypeImage,
				Data:      &PostImage{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of invalid type",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      "garbage",
				Data:      &PostImage{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of empty data",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeImage,
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of mismatched data and type, image type and opengraph data",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeImage,
				Data:      &opengraph.OpenGraph{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of mismatched data and type, opengraph type and image data",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeOpengraph,
				Data:      &PostImage{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of mismatched data and type, image type and random data",
			Metadata: &LinkMetadata{
				URL:       "http://example.com",
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeOpengraph,
				Data:      &Channel{},
			},
			Expected: false,
		},
		{
			Name: "should be invalid because of URL length being too long",
			Metadata: &LinkMetadata{
				URL:       "http://example.com/?" + strings.Repeat("a", 2048),
				Timestamp: 1546300800000,
				Type:      LinkMetadataTypeImage,
				Data:      &PostImage{},
			},
			Expected: false,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			appErr := test.Metadata.IsValid()

			if test.Expected {
				assert.Nil(t, appErr)
			} else {
				assert.NotNil(t, appErr)
			}
		})
	}
}

func TestLinkMetadataDeserializeDataToConcreteType(t *testing.T) {
	t.Run("should convert []byte to PostImage", func(t *testing.T) {
		image := &PostImage{
			Height: 400,
			Width:  500,
		}

		js, err := json.Marshal(image)
		assert.NoError(t, err)
		metadata := &LinkMetadata{
			Type: LinkMetadataTypeImage,
			Data: js,
		}

		require.IsType(t, []byte{}, metadata.Data)

		err = metadata.DeserializeDataToConcreteType()

		assert.NoError(t, err)
		assert.IsType(t, &PostImage{}, metadata.Data)
		assert.Equal(t, *image, *metadata.Data.(*PostImage))
	})

	t.Run("should convert string to OpenGraph", func(t *testing.T) {
		og := &opengraph.OpenGraph{
			URL:         "http://example.com",
			Description: "Hello, world!",
			Images: []*image.Image{
				{
					URL: "http://example.com/image.png",
				},
			},
		}

		b, err := json.Marshal(og)

		require.NoError(t, err)

		metadata := &LinkMetadata{
			Type: LinkMetadataTypeOpengraph,
			Data: b,
		}

		require.IsType(t, []byte{}, metadata.Data)

		err = metadata.DeserializeDataToConcreteType()

		assert.NoError(t, err)
		assert.IsType(t, &opengraph.OpenGraph{}, metadata.Data)
		assert.Equal(t, *og, *metadata.Data.(*opengraph.OpenGraph))
	})

	t.Run("should ignore data of the correct type", func(t *testing.T) {
		metadata := &LinkMetadata{
			Type: LinkMetadataTypeOpengraph,
			Data: 1234,
		}

		err := metadata.DeserializeDataToConcreteType()

		assert.NoError(t, err)
	})

	t.Run("should ignore an invalid type", func(t *testing.T) {
		metadata := &LinkMetadata{
			Type: "garbage",
			Data: "garbage",
		}

		err := metadata.DeserializeDataToConcreteType()

		assert.NoError(t, err)
	})

	t.Run("should return error for invalid data", func(t *testing.T) {
		metadata := &LinkMetadata{
			Type: LinkMetadataTypeImage,
			Data: "garbage",
		}

		err := metadata.DeserializeDataToConcreteType()

		assert.Error(t, err)
	})
}

func TestFloorToNearestHour(t *testing.T) {
	assert.True(t, isRoundedToNearestHour(FloorToNearestHour(1546346096000)))
}

func TestTruncateText(t *testing.T) {
	t.Run("Shouldn't affect strings smaller than 300 characters", func(t *testing.T) {
		assert.Equal(t, utf8.RuneCountInString(truncateText("abc")), 3, "should be 3")
	})
	t.Run("Shouldn't affect empty strings", func(t *testing.T) {
		assert.Equal(t, utf8.RuneCountInString(truncateText("")), 0, "should be empty")
	})
	t.Run("Truncates string to 300 + 5", func(t *testing.T) {
		assert.Equal(t, utf8.RuneCountInString(truncateText(BigText)), 305, "should be 300 chars + 5")
	})
	t.Run("Truncated text ends in ellipsis", func(t *testing.T) {
		assert.True(t, strings.HasSuffix(truncateText(BigText), "[...]"))
	})
}

func TestFirstNImages(t *testing.T) {
	t.Run("when empty, return an empty one", func(t *testing.T) {
		empty := make([]*image.Image, 0)
		assert.Exactly(t, firstNImages(empty, 1), empty, "Should be the same element")
	})
	t.Run("when it contains one element, return the same array", func(t *testing.T) {
		one := []*image.Image{sampleImage("image.png")}
		assert.Exactly(t, firstNImages(one, 1), one, "Should be the same element")
	})
	t.Run("when it contains more than one element and asking for only one, return the first one", func(t *testing.T) {
		two := []*image.Image{sampleImage("image.png"), sampleImage("notme.png")}
		assert.True(t, strings.HasSuffix(firstNImages(two, 1)[0].URL, "image.png"), "Should be the image element")
	})
	t.Run("when it contains less than asked, return the original", func(t *testing.T) {
		two := []*image.Image{sampleImage("image.png"), sampleImage("notme.png")}
		assert.Equal(t, two, firstNImages(two, 10), "should be the same pointer")
	})

	t.Run("asking for negative images", func(t *testing.T) {
		six := []*image.Image{
			sampleImage("image.png"),
			sampleImage("another.png"),
			sampleImage("yetanother.jpg"),
			sampleImage("metoo.gif"),
			sampleImage("fifth.ico"),
			sampleImage("notme.tiff"),
		}
		assert.Len(t, firstNImages(six, -10), LinkMetadataMaxImages, "On negative, go for defaults")
	})
}

func TestTruncateOpenGraph(t *testing.T) {
	og := opengraph.OpenGraph{
		Type:             "something",
		URL:              "http://myawesomesite.com",
		Title:            BigText,
		Description:      BigText,
		Determiner:       BigText,
		SiteName:         BigText,
		Locale:           "[EN-en]",
		LocalesAlternate: []string{"[EN-ca]", "[ES-es]"},
		Images: []*image.Image{
			sampleImage("image.png"),
			sampleImage("another.png"),
			sampleImage("yetanother.jpg"),
			sampleImage("metoo.gif"),
			sampleImage("fifth.ico"),
			sampleImage("notme.tiff")},
		Audios:  []*audio.Audio{{}},
		Videos:  []*video.Video{{}},
		Article: &article.Article{},
		Book:    &book.Book{},
		Profile: &profile.Profile{},
	}
	result := TruncateOpenGraph(&og)
	assert.Nil(t, result.Article, "No article stored")
	assert.Nil(t, result.Book, "No book stored")
	assert.Nil(t, result.Profile, "No profile stored")
	assert.Len(t, result.Images, 5, "Only the first 5 images")
	assert.Empty(t, result.Audios, "No audios stored")
	assert.Empty(t, result.Videos, "No videos stored")
	assert.Empty(t, result.LocalesAlternate, "No alternate locales stored")
	assert.Equal(t, result.Determiner, "", "No determiner stored")
	assert.Equal(t, utf8.RuneCountInString(result.Title), 305, "Title text is truncated")
	assert.Equal(t, utf8.RuneCountInString(result.Description), 305, "Description text is truncated")
	assert.Equal(t, utf8.RuneCountInString(result.SiteName), 305, "SiteName text is truncated")
}
