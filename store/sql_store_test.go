// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"strings"
	"testing"
)

var store Store

func Setup() {
	if store == nil {
		utils.LoadConfig("config.json")
		store = NewSqlStore()
	}
}

func TestSqlStore1(t *testing.T) {
	utils.LoadConfig("config.json")
	utils.Cfg.SqlSettings.Trace = true

	store := NewSqlStore()
	store.Close()

	utils.LoadConfig("config.json")
}

func TestSqlStore2(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("should have been fatal")
		}
	}()

	utils.LoadConfig("config.json")
	utils.Cfg.SqlSettings.DriverName = "missing"
	store = NewSqlStore()

	utils.LoadConfig("config.json")
}

func TestSqlStore3(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("should have been fatal")
		}
	}()

	utils.LoadConfig("config.json")
	utils.Cfg.SqlSettings.DataSource = "missing"
	store = NewSqlStore()

	utils.LoadConfig("config.json")
}

func TestEncrypt(t *testing.T) {
	m := make(map[string]string)

	key := []byte("IPc17oYK9NAj6WfJeCqm5AxIBF6WBNuN") // AES-256

	originalText1 := model.MapToJson(m)
	cryptoText1, _ := encrypt(key, originalText1)
	text1, _ := decrypt(key, cryptoText1)
	rm1 := model.MapFromJson(strings.NewReader(text1))

	if len(rm1) != 0 {
		t.Fatal("error in encrypt")
	}

	m["key"] = "value"
	originalText2 := model.MapToJson(m)
	cryptoText2, _ := encrypt(key, originalText2)
	text2, _ := decrypt(key, cryptoText2)
	rm2 := model.MapFromJson(strings.NewReader(text2))

	if rm2["key"] != "value" {
		t.Fatal("error in encrypt")
	}
}
