package discovery

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

// internalSubs are sub-projects within the mattermost repo.
var internalSubs = []struct {
	name        string
	makefileSub string
	pkgJSONSub  string
}{
	{"server", "server/Makefile", ""},
	{"webapp", "webapp/Makefile", "webapp/package.json"},
	{"e2e-tests", "e2e-tests/Makefile", ""},
	{"api", "api/Makefile", ""},
}

func ScanAll(mmRoot string) ([]model.Repo, error) {
	var repos []model.Repo

	// 1. Internal sub-projects
	for _, sub := range internalSubs {
		mfPath := filepath.Join(mmRoot, sub.makefileSub)
		if _, err := os.Stat(mfPath); err != nil {
			continue
		}

		repo := model.Repo{
			Name:         sub.name,
			Path:         filepath.Join(mmRoot, strings.Split(sub.makefileSub, "/")[0]),
			Kind:         model.RepoKindInternal,
			MakefilePath: mfPath,
		}

		targets, err := ParseMakeTargets(mfPath)
		if err == nil {
			repo.MakeTargets = targets
		}

		if sub.pkgJSONSub != "" {
			pkgPath := filepath.Join(mmRoot, sub.pkgJSONSub)
			if _, err := os.Stat(pkgPath); err == nil {
				repo.PackageJSON = pkgPath
				scripts, err := ParseNpmScripts(pkgPath)
				if err == nil {
					repo.NpmScripts = scripts
				}
			}
		}

		repos = append(repos, repo)
	}

	// 2. Sibling repos (other projects alongside mattermost)
	scanRoot := filepath.Dir(mmRoot)
	mmDirName := filepath.Base(mmRoot)
	entries, err := os.ReadDir(scanRoot)
	if err != nil {
		return repos, nil // non-fatal
	}

	var siblings []model.Repo
	var plugins []model.Repo
	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == mmDirName {
			continue
		}

		repoPath := filepath.Join(scanRoot, entry.Name())

		// Need at least a Makefile or package.json
		mfPath := filepath.Join(repoPath, "Makefile")
		pkgPath := filepath.Join(repoPath, "package.json")
		hasMakefile := fileExists(mfPath)
		hasPkgJSON := fileExists(pkgPath)
		if !hasMakefile && !hasPkgJSON {
			continue
		}

		// Determine kind and display name
		isPlugin := strings.HasPrefix(entry.Name(), "mattermost-plugin-")
		kind := model.RepoKindSibling
		displayName := entry.Name()
		if isPlugin {
			kind = model.RepoKindPlugin
			displayName = strings.TrimPrefix(entry.Name(), "mattermost-plugin-")
		} else {
			// Shorten common prefixes
			displayName = strings.TrimPrefix(displayName, "mattermost-")
		}

		repo := model.Repo{
			Name: displayName,
			Path: repoPath,
			Kind: kind,
		}

		if hasMakefile {
			repo.MakefilePath = mfPath
			targets, err := ParseMakeTargets(mfPath)
			if err == nil {
				repo.MakeTargets = targets
			}
		}

		if hasPkgJSON {
			repo.PackageJSON = pkgPath
			scripts, err := ParseNpmScripts(pkgPath)
			if err == nil {
				repo.NpmScripts = scripts
			}
		}

		// Also check webapp/package.json for repos that have a nested webapp
		if !hasPkgJSON {
			wpPath := filepath.Join(repoPath, "webapp", "package.json")
			if fileExists(wpPath) {
				repo.PackageJSON = wpPath
				scripts, err := ParseNpmScripts(wpPath)
				if err == nil {
					repo.NpmScripts = scripts
				}
			}
		}

		if isPlugin {
			plugins = append(plugins, repo)
		} else {
			siblings = append(siblings, repo)
		}
	}

	sort.Slice(siblings, func(i, j int) bool {
		return siblings[i].Name < siblings[j].Name
	})
	sort.Slice(plugins, func(i, j int) bool {
		return plugins[i].Name < plugins[j].Name
	})

	repos = append(repos, siblings...)
	repos = append(repos, plugins...)
	return repos, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
