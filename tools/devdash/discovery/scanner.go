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

	// 3. Discover sub-packages (nested package.json) for all repos
	var subRepos []model.Repo
	for _, repo := range repos {
		subs := discoverSubPackages(repo)
		subRepos = append(subRepos, subs...)
	}
	repos = append(repos, subRepos...)

	return repos, nil
}

// discoverSubPackages scans a repo's directory tree (up to 3 levels) for
// nested package.json files that aren't the repo's root package.json.
// Each becomes a separate Repo entry with a "parent/subpath" display name.
func discoverSubPackages(parent model.Repo) []model.Repo {
	var subs []model.Repo
	rootPkg := parent.PackageJSON

	walkDir(parent.Path, parent.Path, 0, 3, func(pkgPath, relDir string) {
		// Skip if this is the root package.json already on the parent
		if pkgPath == rootPkg {
			return
		}

		scripts, err := ParseNpmScripts(pkgPath)
		if err != nil || len(scripts) == 0 {
			return
		}

		// Check for a Makefile in the same directory
		var makeTargets []model.Target
		var mfPath string
		mf := filepath.Join(filepath.Dir(pkgPath), "Makefile")
		if fileExists(mf) {
			mfPath = mf
			if targets, err := ParseMakeTargets(mf); err == nil {
				makeTargets = targets
			}
		}

		subs = append(subs, model.Repo{
			Name:         parent.Name + "/" + relDir,
			Path:         filepath.Dir(pkgPath),
			Kind:         parent.Kind,
			PackageJSON:  pkgPath,
			NpmScripts:   scripts,
			MakefilePath: mfPath,
			MakeTargets:  makeTargets,
		})
	})

	return subs
}

// walkDir recursively scans for package.json files up to maxDepth levels,
// skipping node_modules, .git, dist, and build directories.
func walkDir(root, dir string, depth, maxDepth int, fn func(pkgPath, relDir string)) {
	if depth > maxDepth {
		return
	}

	pkg := filepath.Join(dir, "package.json")
	if fileExists(pkg) && depth > 0 { // depth > 0 skips the root
		rel, _ := filepath.Rel(root, dir)
		fn(pkg, rel)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		// Skip directories that never contain useful sub-packages
		if name == "node_modules" || name == ".git" || name == "dist" ||
			name == "build" || name == "vendor" || name == ".next" {
			continue
		}
		walkDir(root, filepath.Join(dir, name), depth+1, maxDepth, fn)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
