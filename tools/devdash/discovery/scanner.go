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

	// 2. Sibling plugin repos
	scanRoot := filepath.Dir(mmRoot)
	entries, err := os.ReadDir(scanRoot)
	if err != nil {
		return repos, nil // non-fatal
	}

	var plugins []model.Repo
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "mattermost-plugin-") {
			continue
		}

		repoPath := filepath.Join(scanRoot, entry.Name())
		mfPath := filepath.Join(repoPath, "Makefile")
		if _, err := os.Stat(mfPath); err != nil {
			continue
		}

		// Shorten display name: mattermost-plugin-playbooks -> playbooks
		displayName := strings.TrimPrefix(entry.Name(), "mattermost-plugin-")

		repo := model.Repo{
			Name:         displayName,
			Path:         repoPath,
			Kind:         model.RepoKindPlugin,
			MakefilePath: mfPath,
		}

		targets, err := ParseMakeTargets(mfPath)
		if err == nil {
			repo.MakeTargets = targets
		}

		// Check for webapp/package.json
		pkgPath := filepath.Join(repoPath, "webapp", "package.json")
		if _, err := os.Stat(pkgPath); err == nil {
			repo.PackageJSON = pkgPath
			scripts, err := ParseNpmScripts(pkgPath)
			if err == nil {
				repo.NpmScripts = scripts
			}
		}

		plugins = append(plugins, repo)
	}

	sort.Slice(plugins, func(i, j int) bool {
		return plugins[i].Name < plugins[j].Name
	})

	repos = append(repos, plugins...)
	return repos, nil
}
