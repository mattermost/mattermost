// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"bytes"
	"crypto/md5"
	_ "embed"
	"fmt"
	"io"
	"log"
	"os"
	"path"
	"sort"
	"text/template"

	"github.com/pkg/errors"
	"golang.org/x/tools/imports"
	"gopkg.in/yaml.v3"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/worktemplates"
)

type WorkTemplateWithMD5 struct {
	worktemplates.WorkTemplate
	MD5 string
}

type WorkTemplateCategoryWithMD5 struct {
	worktemplates.WorkTemplateCategory `yaml:",inline"`
	MD5                                string
}

func getFileContent(filename string) ([]byte, error) {
	return os.ReadFile(path.Join(filename))
}

func main() {
	// parse categories first
	dat, err := getFileContent("categories.yaml")
	if err != nil {
		log.Fatal(errors.Wrap(err, "failed to read categories.yaml"))
	}

	illustrations := []string{}

	h := md5.New()

	cats := []WorkTemplateCategoryWithMD5{} // meow
	err = yaml.Unmarshal(dat, &cats)
	if err != nil {
		log.Fatal(errors.Wrap(err, "failed to unmarshal categories.yaml"))
	}

	// validate categories
	categoryIds := map[string]struct{}{}
	lastCategory := ""
	for id := range cats {
		cat := cats[id]

		if cat.ID == "" && cat.Name == "" {
			// skip empty array element
			continue
		}

		if cat.ID == "" {
			log.Fatal(errors.New("category ID cannot be empty"))
		}
		if cat.Name == "" {
			log.Fatal(errors.New("category name cannot be empty"))
		}
		lastCategory = cat.ID
		categoryIds[cat.ID] = struct{}{}

		h.Write([]byte(cat.ID))
		cats[id].MD5 = fmt.Sprintf("%x", h.Sum(nil))
		h.Reset()
	}
	if lastCategory != "other" {
		log.Fatal(errors.New("category 'other' must exist AND be the last category"))
	}

	dat, err = getFileContent("templates.yaml")
	if err != nil {
		log.Fatal(errors.Wrap(err, "failed to read templates.yaml"))
	}

	dec := yaml.NewDecoder(bytes.NewReader(dat))
	ts := []WorkTemplateWithMD5{}
	for {
		t := worktemplates.WorkTemplate{}
		err = dec.Decode(&t)
		if err != nil {
			if err == io.EOF {
				break
			}
			log.Fatal(err)
		}
		if t.ID == "" {
			continue
		}

		h.Write([]byte(t.ID))
		err = t.Validate(categoryIds)
		if err != nil {
			log.Fatal(errors.Wrap(err, "failed to validate template"))
		}

		ts = append(ts, WorkTemplateWithMD5{
			WorkTemplate: t,
			MD5:          fmt.Sprintf("%x", h.Sum(nil)),
		})
		h.Reset()

		// add illustrations to the list
		illustrations = append(illustrations, t.Illustration)
		if t.Description.Channel != nil && t.Description.Channel.Illustration != "" {
			illustrations = append(illustrations, t.Description.Channel.Illustration)
		}
		if t.Description.Board != nil && t.Description.Board.Illustration != "" {
			illustrations = append(illustrations, t.Description.Board.Illustration)
		}
		if t.Description.Integration != nil && t.Description.Integration.Illustration != "" {
			illustrations = append(illustrations, t.Description.Integration.Illustration)
		}
		if t.Description.Playbook != nil && t.Description.Playbook.Illustration != "" {
			illustrations = append(illustrations, t.Description.Playbook.Illustration)
		}

		for i := range t.Content {
			if t.Content[i].Channel != nil && t.Content[i].Channel.Illustration != "" {
				illustrations = append(illustrations, t.Content[i].Channel.Illustration)
			}
			if t.Content[i].Board != nil && t.Content[i].Board.Illustration != "" {
				illustrations = append(illustrations, t.Content[i].Board.Illustration)
			}
			if t.Content[i].Playbook != nil && t.Content[i].Playbook.Illustration != "" {
				illustrations = append(illustrations, t.Content[i].Playbook.Illustration)
			}
		}
	}

	code := bytes.NewBuffer(nil)
	tmpl, err := template.New("worktemplates").Parse(tpl)
	if err != nil {
		log.Fatal(err)
	}
	tmpl.Execute(code, struct {
		Templates  []WorkTemplateWithMD5
		Categories []WorkTemplateCategoryWithMD5
	}{
		Templates:  ts,
		Categories: cats,
	})

	formattedCode, err := imports.Process(path.Join("worktemplate_generated.go"), code.Bytes(), &imports.Options{Comments: true})
	if err != nil {
		log.Fatal(errors.Wrap(err, "failed to format code"))
	}

	err = os.WriteFile(path.Join("worktemplate_generated.go"), formattedCode, 0644)
	if err != nil {
		log.Fatal(err)
	}

	// order ts by category alphabetically and by name alphabetically
	sort.Slice(ts, func(i, j int) bool {
		if ts[i].Category == ts[j].Category {
			return ts[i].UseCase < ts[j].UseCase
		}
		return ts[i].Category < ts[j].Category
	})

	// print all translatable content
	fmt.Println("\nTranslation helpers:\n====================")
	for _, t := range ts {
		translationHelper(t.Description.Board)
		translationHelper(t.Description.Channel)
		translationHelper(t.Description.Integration)
		translationHelper(t.Description.Playbook)
	}

	fmt.Println("Missing illustrations:")
	for _, illustration := range illustrations {
		// check if file exists
		illusPath := path.Join("../../../../webapp/channels/src/images", illustration[8:])
		if _, err := os.Stat(illusPath); os.IsNotExist(err) {
			fmt.Println("\t" + illusPath)
		}
	}
}

var translationHelperTemplate = `{
    "id": %q,
    "translation": %q
},`

func translationHelper(t *worktemplates.TranslatableString) {
	if t != nil && t.ID != "" && t.DefaultMessage != "" {
		fmt.Printf(translationHelperTemplate, t.ID, t.DefaultMessage)
		fmt.Println("")
	}
}

//go:embed worktemplate.tmpl
var tpl string
