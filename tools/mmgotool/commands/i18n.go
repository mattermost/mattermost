// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

const enterpriseKeyPrefix = "ent."
const untranslatedKey = "<untranslated>"

type Translation struct {
	Id          string      `json:"id"`
	Translation interface{} `json:"translation"`
}

type Item struct {
	ID          string          `json:"id"`
	Translation json.RawMessage `json:"translation"`
}

var I18nCmd = &cobra.Command{
	Use:   "i18n",
	Short: "Management of Mattermost translations",
}

var ExtractCmd = &cobra.Command{
	Use:     "extract",
	Short:   "Extract translations",
	Long:    "Extract translations from the source code and put them into the i18n/en.json file",
	Example: "  i18n extract",
	RunE:    extractCmdF,
}

var CheckCmd = &cobra.Command{
	Use:     "check",
	Short:   "Check translations",
	Long:    "Check translations existing in the source code and compare it to the i18n/en.json file",
	Example: "  i18n check",
	RunE:    checkCmdF,
}

var CheckEmptySrcCmd = &cobra.Command{
	Use:     "check-empty-src",
	Short:   "Check for empty translation source strings",
	Long:    "Check the en.json file for empty translation source strings",
	Example: "  i18n check-empty-src",
	RunE:    checkEmptySrcCmdF,
}

var CleanEmptyCmd = &cobra.Command{
	Use:     "clean-empty",
	Short:   "Clean empty translations",
	Long:    "Clean empty translations in translation files other than i18n/en.json base file",
	Example: "  i18n clean-empty",
	RunE:    cleanEmptyCmdF,
}

func init() {
	ExtractCmd.Flags().Bool("skip-dynamic", false, "Whether to skip dynamically added translations")
	ExtractCmd.Flags().String("portal-dir", "../customer-web-server", "Path to folder with the Mattermost Customer Portal source code")
	ExtractCmd.Flags().String("enterprise-dir", "../../enterprise", "Path to folder with the Mattermost enterprise source code")
	ExtractCmd.Flags().String("server-dir", "./", "Path to folder with the Mattermost server source code")
	ExtractCmd.Flags().String("model-dir", "../model", "Path to folder with the Mattermost model package source code")
	ExtractCmd.Flags().String("plugin-dir", "../plugin", "Path to folder with the Mattermost plugin package source code")
	ExtractCmd.Flags().Bool("contributor", false, "Allows contributors safely extract translations from source code without removing enterprise messages keys")

	CheckCmd.Flags().Bool("skip-dynamic", false, "Whether to skip dynamically added translations")
	CheckCmd.Flags().String("portal-dir", "../customer-web-server", "Path to folder with the Mattermost Customer Portal source code")
	CheckCmd.Flags().String("enterprise-dir", "../../enterprise", "Path to folder with the Mattermost enterprise source code")
	CheckCmd.Flags().String("server-dir", "./", "Path to folder with the Mattermost server source code")
	CheckCmd.Flags().String("model-dir", "../model", "Path to folder with the Mattermost model package source code")
	CheckCmd.Flags().String("plugin-dir", "../plugin", "Path to folder with the Mattermost plugin package source code")

	CheckEmptySrcCmd.Flags().String("portal-dir", "../customer-web-server", "Path to folder with the Mattermost Customer Portal source code")
	CheckEmptySrcCmd.Flags().String("enterprise-dir", "../../enterprise", "Path to folder with the Mattermost enterprise source code")
	CheckEmptySrcCmd.Flags().String("server-dir", "./", "Path to folder with the Mattermost server source code")

	CleanEmptyCmd.Flags().Bool("dry-run", false, "Run without applying changes")
	CleanEmptyCmd.Flags().Bool("check", false, "Throw exit code on empty translation strings")
	CleanEmptyCmd.Flags().String("portal-dir", "../customer-web-server", "Path to folder with the Mattermost Customer Portal source code")
	CleanEmptyCmd.Flags().String("enterprise-dir", "../../enterprise", "Path to folder with the Mattermost enterprise source code")
	CleanEmptyCmd.Flags().String("server-dir", "./", "Path to folder with the Mattermost server source code")

	I18nCmd.AddCommand(
		ExtractCmd,
		CheckCmd,
		CheckEmptySrcCmd,
		CleanEmptyCmd,
	)
	RootCmd.AddCommand(I18nCmd)
}

func getBaseFileSrcStrings(mattermostDir string) ([]Translation, error) {
	jsonFile, err := ioutil.ReadFile(path.Join(mattermostDir, "i18n", "en.json"))
	if err != nil {
		return nil, err
	}
	var translations []Translation
	_ = json.Unmarshal(jsonFile, &translations)
	return translations, nil
}

func extractSrcStrings(enterpriseDir, mattermostDir, modelDir, pluginDir, portalDir string) map[string]bool {
	i18nStrings := map[string]bool{}
	walkFunc := func(p string, info os.FileInfo, err error) error {
		if strings.HasPrefix(p, path.Join(mattermostDir, "vendor")) {
			return nil
		}
		return extractFromPath(p, info, err, i18nStrings)
	}
	if portalDir != "" {
		_ = filepath.Walk(portalDir, walkFunc)
	} else {
		_ = filepath.Walk(mattermostDir, walkFunc)
		_ = filepath.Walk(enterpriseDir, walkFunc)
		_ = filepath.Walk(modelDir, walkFunc)
		_ = filepath.Walk(pluginDir, walkFunc)
	}
	return i18nStrings
}

func extractCmdF(command *cobra.Command, args []string) error {
	skipDynamic, err := command.Flags().GetBool("skip-dynamic")
	if err != nil {
		return errors.New("invalid skip-dynamic parameter")
	}
	enterpriseDir, err := command.Flags().GetString("enterprise-dir")
	if err != nil {
		return errors.New("invalid enterprise-dir parameter")
	}
	mattermostDir, err := command.Flags().GetString("server-dir")
	if err != nil {
		return errors.New("invalid server-dir parameter")
	}
	contributorMode, err := command.Flags().GetBool("contributor")
	if err != nil {
		return errors.New("invalid contributor parameter")
	}
	portalDir, err := command.Flags().GetString("portal-dir")
	if err != nil {
		return errors.New("invalid portal-dir parameter")
	}
	modelDir, err := command.Flags().GetString("model-dir")
	if err != nil {
		return errors.New("invalid model-dir parameter")
	}
	pluginDir, err := command.Flags().GetString("plugin-dir")
	if err != nil {
		return errors.New("invalid plugin-dir parameter")
	}
	translationDir := mattermostDir
	if portalDir != "" {
		if enterpriseDir != "" || mattermostDir != "" {
			return errors.New("please specify EITHER portal-dir or enterprise-dir/server-dir")
		}
		skipDynamic = true // dynamics are not needed for portal
		translationDir = portalDir
	}
	i18nStrings := extractSrcStrings(enterpriseDir, mattermostDir, modelDir, pluginDir, portalDir)
	if !skipDynamic {
		addDynamicallyGeneratedStrings(i18nStrings)
	}
	// Delete any untranslated keys
	delete(i18nStrings, untranslatedKey)
	var i18nStringsList []string
	for id := range i18nStrings {
		i18nStringsList = append(i18nStringsList, id)
	}
	sort.Strings(i18nStringsList)

	sourceStrings, err := getBaseFileSrcStrings(translationDir)
	if err != nil {
		return err
	}

	var baseFileList []string
	idx := map[string]bool{}
	resultMap := map[string]Translation{}
	for _, t := range sourceStrings {
		idx[t.Id] = true
		baseFileList = append(baseFileList, t.Id)
		resultMap[t.Id] = t
	}
	sort.Strings(baseFileList)

	for _, translationKey := range i18nStringsList {
		if _, hasKey := idx[translationKey]; !hasKey {
			resultMap[translationKey] = Translation{Id: translationKey, Translation: ""}
		}
	}

	for _, translationKey := range baseFileList {
		if _, hasKey := i18nStrings[translationKey]; !hasKey {
			if contributorMode && strings.HasPrefix(translationKey, enterpriseKeyPrefix) {
				continue
			}
			delete(resultMap, translationKey)
		}
	}

	var result []Translation
	for _, t := range resultMap {
		result = append(result, t)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Id < result[j].Id })

	f, err := os.Create(path.Join(mattermostDir, "i18n", "en.json"))
	if err != nil {
		return err
	}
	defer f.Close()

	encoder := json.NewEncoder(f)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	err = encoder.Encode(result)
	if err != nil {
		return err
	}

	return nil
}

func checkCmdF(command *cobra.Command, args []string) error {
	skipDynamic, err := command.Flags().GetBool("skip-dynamic")
	if err != nil {
		return errors.New("invalid skip-dynamic parameter")
	}
	enterpriseDir, err := command.Flags().GetString("enterprise-dir")
	if err != nil {
		return errors.New("invalid enterprise-dir parameter")
	}
	mattermostDir, err := command.Flags().GetString("server-dir")
	if err != nil {
		return errors.New("invalid server-dir parameter")
	}
	portalDir, err := command.Flags().GetString("portal-dir")
	if err != nil {
		return errors.New("invalid portal-dir parameter")
	}
	modelDir, err := command.Flags().GetString("model-dir")
	if err != nil {
		return errors.New("invalid model-dir parameter")
	}
	pluginDir, err := command.Flags().GetString("plugin-dir")
	if err != nil {
		return errors.New("invalid plugin-dir parameter")
	}
	translationDir := mattermostDir
	if portalDir != "" {
		if enterpriseDir != "" || mattermostDir != "" {
			return errors.New("please specify EITHER portal-dir or enterprise-dir/server-dir")
		}
		translationDir = portalDir
		skipDynamic = true // dynamics are not needed for portal
	}
	extractedSrcStrings := extractSrcStrings(enterpriseDir, mattermostDir, modelDir, pluginDir, portalDir)
	if !skipDynamic {
		addDynamicallyGeneratedStrings(extractedSrcStrings)
	}
	// Delete any untranslated keys
	delete(extractedSrcStrings, untranslatedKey)
	var extractedList []string
	for id := range extractedSrcStrings {
		extractedList = append(extractedList, id)
	}
	sort.Strings(extractedList)

	srcStrings, err := getBaseFileSrcStrings(translationDir)
	if err != nil {
		return err
	}

	var baseFileList []string
	idx := map[string]bool{}
	for _, t := range srcStrings {
		idx[t.Id] = true
		baseFileList = append(baseFileList, t.Id)
	}
	sort.Strings(baseFileList)

	changed := false
	for _, translationKey := range extractedList {
		if _, hasKey := idx[translationKey]; !hasKey {
			fmt.Println("Added:", translationKey)
			changed = true
		}
	}

	for _, translationKey := range baseFileList {
		if _, hasKey := extractedSrcStrings[translationKey]; !hasKey {
			fmt.Println("Removed:", translationKey)
			changed = true
		}
	}
	if changed {
		command.SilenceUsage = true
		return errors.New("translation source strings file out of date")
	}
	return nil
}

func addDynamicallyGeneratedStrings(i18nStrings map[string]bool) {
	i18nStrings["model.user.is_valid.pwd.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_number.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_number_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_uppercase.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_uppercase_number.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_uppercase_number_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_lowercase_uppercase_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_number.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_number_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_uppercase.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_uppercase_number.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_uppercase_number_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.pwd_uppercase_symbol.app_error"] = true
	i18nStrings["model.user.is_valid.id.app_error"] = true
	i18nStrings["model.user.is_valid.create_at.app_error"] = true
	i18nStrings["model.user.is_valid.update_at.app_error"] = true
	i18nStrings["model.user.is_valid.username.app_error"] = true
	i18nStrings["model.user.is_valid.email.app_error"] = true
	i18nStrings["model.user.is_valid.nickname.app_error"] = true
	i18nStrings["model.user.is_valid.position.app_error"] = true
	i18nStrings["model.user.is_valid.first_name.app_error"] = true
	i18nStrings["model.user.is_valid.last_name.app_error"] = true
	i18nStrings["model.user.is_valid.auth_data.app_error"] = true
	i18nStrings["model.user.is_valid.auth_data_type.app_error"] = true
	i18nStrings["model.user.is_valid.auth_data_pwd.app_error"] = true
	i18nStrings["model.user.is_valid.password_limit.app_error"] = true
	i18nStrings["model.user.is_valid.locale.app_error"] = true
	i18nStrings["January"] = true
	i18nStrings["February"] = true
	i18nStrings["March"] = true
	i18nStrings["April"] = true
	i18nStrings["May"] = true
	i18nStrings["June"] = true
	i18nStrings["July"] = true
	i18nStrings["August"] = true
	i18nStrings["September"] = true
	i18nStrings["October"] = true
	i18nStrings["November"] = true
	i18nStrings["December"] = true
}

func extractByFuncName(name string, args []ast.Expr) *string {
	if name == "T" {
		if len(args) == 0 {
			return nil
		}

		key, ok := args[0].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "NewAppError" {
		if len(args) < 2 {
			return nil
		}

		key, ok := args[1].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "newAppError" {
		if len(args) < 1 {
			return nil
		}
		key, ok := args[0].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "NewUserFacingError" {
		if len(args) < 1 {
			return nil
		}
		key, ok := args[0].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "translateFunc" {
		if len(args) < 1 {
			return nil
		}

		key, ok := args[0].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "TranslateAsHTML" || name == "TranslateAsHtml" {
		if len(args) < 2 {
			return nil
		}

		key, ok := args[1].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "userLocale" {
		if len(args) < 1 {
			return nil
		}

		key, ok := args[0].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	} else if name == "localT" {
		if len(args) < 1 {
			return nil
		}

		key, ok := args[0].(*ast.BasicLit)
		if !ok {
			return nil
		}
		return &key.Value
	}
	return nil
}

func extractForConstants(name string, valueNode ast.Expr) *string {
	validConstants := map[string]bool{
		"MISSING_CHANNEL_ERROR":        true,
		"MISSING_CHANNEL_MEMBER_ERROR": true,
		"CHANNEL_EXISTS_ERROR":         true,
		"MISSING_STATUS_ERROR":         true,
		"TEAM_MEMBER_EXISTS_ERROR":     true,
		"MISSING_AUTH_ACCOUNT_ERROR":   true,
		"MISSING_ACCOUNT_ERROR":        true,
		"EXPIRED_LICENSE_ERROR":        true,
		"INVALID_LICENSE_ERROR":        true,
		"MissingChannelError":          true,
		"MissingChannelMemberError":    true,
		"ChannelExistsError":           true,
		"MissingStatusError":           true,
		"TeamMemberExistsError":        true,
		"MissingAuthAccountError":      true,
		"MissingAccountError":          true,
		"ExpiredLicenseError":          true,
		"InvalidLicenseError":          true,
		"NoTranslation":                true,
	}

	if _, ok := validConstants[name]; !ok {
		return nil
	}
	value, ok := valueNode.(*ast.BasicLit)

	if !ok {
		return nil
	}
	return &value.Value

}

func extractFromPath(path string, info os.FileInfo, err error, i18nStrings map[string]bool) error {
	if strings.HasSuffix(path, "model/client4.go") {
		return nil
	}
	if strings.HasSuffix(path, "_test.go") {
		return nil
	}
	if !strings.HasSuffix(path, ".go") {
		return nil
	}
	if strings.Contains(path, ".git/") || strings.HasPrefix(path, ".git/") {
		return nil
	}

	src, err := ioutil.ReadFile(path)
	if err != nil {
		panic(err)
	}

	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "", src, 0)
	if err != nil {
		fmt.Printf("error parsing source: %s\n", path)
		panic(err)
	}

	ast.Inspect(f, func(n ast.Node) bool {
		var id *string = nil

		switch expr := n.(type) {
		case *ast.CallExpr:
			switch fun := expr.Fun.(type) {
			case *ast.SelectorExpr:
				id = extractByFuncName(fun.Sel.Name, expr.Args)
				if id == nil {
					return true
				}
				break
			case *ast.Ident:
				id = extractByFuncName(fun.Name, expr.Args)
				break
			default:
				return true
			}
			break
		case *ast.GenDecl:
			if expr.Tok == token.CONST {
				for _, spec := range expr.Specs {
					valueSpec, ok := spec.(*ast.ValueSpec)
					if !ok {
						continue
					}
					if len(valueSpec.Names) == 0 {
						continue
					}
					if len(valueSpec.Values) == 0 {
						continue
					}
					id = extractForConstants(valueSpec.Names[0].Name, valueSpec.Values[0])
					if id == nil {
						continue
					}
					i18nStrings[strings.Trim(*id, "\"")] = true
				}
			}
			return true
		default:
			return true
		}

		if id != nil {
			i18nStrings[strings.Trim(*id, "\"")] = true
		}

		return true
	})
	return nil
}

func checkEmptySrcCmdF(command *cobra.Command, args []string) error {
	enterpriseDir, err := command.Flags().GetString("enterprise-dir")
	if err != nil {
		return errors.New("invalid enterprise-dir parameter")
	}
	mattermostDir, err := command.Flags().GetString("server-dir")
	if err != nil {
		return errors.New("invalid server-dir parameter")
	}
	portalDir, err := command.Flags().GetString("portal-dir")
	if err != nil {
		return errors.New("invalid portal-dir parameter")
	}
	translationDir := path.Join(mattermostDir, "i18n")
	if portalDir != "" {
		if enterpriseDir != "" || mattermostDir != "" {
			return errors.New("please specify EITHER portal-dir or enterprise-dir/server-dir")
		}
		translationDir = portalDir
	}
	srcJSON, err := ioutil.ReadFile(path.Join(translationDir, "en.json"))
	if err != nil {
		return err
	}
	var items []Item
	if err = json.Unmarshal(srcJSON, &items); err != nil {
		return err
	}
	err = countEmptyItems(items)
	if err != nil {
		return err
	}
	return nil
}

func countEmptyItems(items []Item) error {
	hasError := false
	for _, t := range items {
		str := string(t.Translation)
		if !strings.HasPrefix(str, "\"") {
			continue
		}
		unquoted, err := strconv.Unquote(str)
		if err != nil {
			return fmt.Errorf("error unquoting translation for %s, %v", t.ID, err)
		}
		if strings.TrimSpace(unquoted) == "" {
			log.Printf("Empty translation for %s. Please fix it.\n", t.ID)
			hasError = true
		}
	}
	if hasError {
		return errors.New("empty translations found")
	}
	return nil
}

func cleanEmptyCmdF(command *cobra.Command, args []string) error {
	dryRun, err := command.Flags().GetBool("dry-run")
	if err != nil {
		return errors.New("invalid dry-run parameter")
	}
	check, err := command.Flags().GetBool("check")
	if err != nil {
		return errors.New("invalid check parameter")
	}
	enterpriseDir, err := command.Flags().GetString("enterprise-dir")
	if err != nil {
		return errors.New("invalid enterprise-dir parameter")
	}
	mattermostDir, err := command.Flags().GetString("server-dir")
	if err != nil {
		return errors.New("invalid server-dir parameter")
	}
	portalDir, err := command.Flags().GetString("portal-dir")
	if err != nil {
		return errors.New("invalid portal-dir parameter")
	}
	translationDir := path.Join(mattermostDir, "i18n")
	if portalDir != "" {
		if enterpriseDir != "" || mattermostDir != "" {
			return errors.New("please specify EITHER portal-dir or enterprise-dir/server-dir")
		}
		translationDir = portalDir
	}

	var shippedFiles []string
	files, err := ioutil.ReadDir(translationDir)
	if err != nil {
		return err
	}
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".json" && file.Name() != "en.json" {
			shippedFiles = append(shippedFiles, file.Name())
		}
	}

	results := ""
	for _, file := range shippedFiles {
		result, err2 := clean(translationDir, file, dryRun, check)
		if err2 != nil {
			return err2
		}
		results += *result
	}
	if results == "" {
		return nil
	}
	fmt.Print("\n" + results)
	if check {
		os.Exit(1)
	}
	return nil
}

func clean(translationDir string, file string, dryRun bool, check bool) (*string, error) {
	oldJSON, err := ioutil.ReadFile(path.Join(translationDir, file))
	if err != nil {
		return nil, err
	}

	var oldList []Item
	if err = json.Unmarshal(oldJSON, &oldList); err != nil {
		return nil, err
	}
	newList, count := removeEmptyTranslations(oldList)
	result := ""
	if count == 0 {
		return &result, nil
	}
	result = fmt.Sprintf("%v has %v empty translations\n", file, count)
	if dryRun || check {
		return &result, nil
	}

	newJSON, err := JSONMarshal(newList)
	if err != nil {
		return nil, err
	}
	filename := path.Join(translationDir, file)
	fileInfo, err := os.Lstat(filename)
	if err != nil {
		return nil, err
	}
	if err = ioutil.WriteFile(filename, newJSON, fileInfo.Mode().Perm()); err != nil {
		return nil, err
	}
	return &result, nil
}

func removeEmptyTranslations(oldList []Item) ([]Item, int) {
	var count int
	var newList []Item
	for i, t := range oldList {
		if string(t.Translation) != "\"\"" {
			newList = append(newList, oldList[i])
		} else {
			count++
		}

	}
	return newList, count
}

func JSONMarshal(t interface{}) ([]byte, error) {
	buffer := &bytes.Buffer{}
	encoder := json.NewEncoder(buffer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "    ")
	err := encoder.Encode(t)
	return buffer.Bytes(), err
}
