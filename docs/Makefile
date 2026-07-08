# Convenience targets for the Mattermost documentation site.
# Run from the repo root:   make -C docs <target>
# Run from docs/ directly:  make <target>

.PHONY: docs-install docs-dev docs-build docs-serve docs-lint

docs-install:
	cd site && npm ci

docs-dev:
	cd site && npm start

docs-build:
	cd site && npm run build

docs-serve:
	cd site && npm run serve

docs-lint:
	vale main develop api
