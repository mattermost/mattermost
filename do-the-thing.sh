#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

KEEP_HISTORY=false

ROOT=`pwd`
mkdir -p $ROOT/webapp/channels/src
rsync --archive --delete --ignore .git ../mattermost-webapp/ $ROOT/webapp/channels/src

######## Move web app files out of src
cd "$ROOT/webapp/channels/src"

[ -f .editorconfig ] && mv .editorconfig  ..
[ -f .eslintignore ] && mv .eslintignore  ..
[ -f .eslintrc.json ] && mv .eslintrc.json  ..
[ -f .github ] && mv .github  .. # TODO Needed for GitHub Actions
[ -f .gitignore ] && mv .gitignore  ..
[ -f .gitlab-ci.yml ] && mv .gitlab-ci.yml  .. # TODO Needed for GitLab
[ -f .gitpod.yml ] && mv .gitpod.yml  .. # TODO Needed for Gitpod
[ -f .gobom.json ] && mv .gobom.json  .. # TODO Needed for GitLab
[ -f .npm-upgrade.json ] && mv .npm-upgrade.json  ..
[ -f .npmrc ] && mv .npmrc  ..
[ -f .nvmrc ] && mv .nvmrc  ..
[ -f .stylelintignore ] && mv .stylelintignore  ..
[ -f .stylelintrc.json ] && mv .stylelintrc.json  ..
[ -f babel.config.js ] && mv babel.config.js  ..
[ -f CODEOWNERS ] && mv CODEOWNERS  .. # TODO Needs to be merged between repos
[ -f CONTRIBUTING.md ] && mv CONTRIBUTING.md  .. # TODO Needs to be merged between repos
[ -f config.mk ] && mv config.mk  ..
[ -f jest.config.js ] && mv jest.config.js  ..
[ -f LICENSE.txt ] && mv LICENSE.txt  ..
[ -f Makefile ] && mv Makefile  ..
[ -f NOTICE.txt ] && mv NOTICE.txt  .. # TODO Needs to be merged between repos
[ -f package-lock.json ] && mv package-lock.json  .. # TODO this needs to be updated eventually or just recreated
[ -f package.json ] && mv package.json  ..
[ -f README.md ] && mv README.md  ..
[ -f SECURITY.md ] && mv SECURITY.md  .. # TODO Needs to be merged between repos
[ -f skip_integrity_check.js ] && mv skip_integrity_check.js  .. # TODO move this into scripts?
[ -f tsconfig.json ] && mv tsconfig.json  ..
[ -f webpack.config.js ] && mv webpack.config.js  ..

[ -d build ] && mv build  ..
[ -d e2e ] && mv e2e ..
[ -d scripts ] && mv scripts ..

######## Update web app files for src directory

cd "$ROOT/webapp/channels"

perl -pi -e "s/entry: \['\.\/root\.tsx', 'root\.html'\],/entry: ['.\/src\/root.tsx', '.\/src\/root.html'],/" webpack.config.js
perl -pi -e "s/includePaths: \['sass'\]/includePaths: ['src', 'src\/sass']/" webpack.config.js
perl -pi -e "s/path\.resolve\(__dirname\),/'.\/src',/" webpack.config.js
perl -pi -e "s/template: 'root\.html',/template: 'src\/root.html',/" webpack.config.js
perl -pi -e "s/\{from: 'images\//\{from: 'src\/images\//" webpack.config.js
perl -pi -e "s/path\.resolve\('images\/favicon\//path.resolve('src\/images\/favicon\//" webpack.config.js
perl -pi -e "s/config\.entry = \['\.\/root.tsx'\];/config.entry = ['.src\/root.tsx'];/" webpack.config.js
perl -pi -e "s/'\.\/styles': '\.\/sass\/styles\.scss'/'\.\/styles': '\.\/src\/sass\/styles\.scss'/" webpack.config.js

perl -pi -e 's/"baseUrl": "\.",/"baseUrl": ".\/src",/' tsconfig.json
perl -pi -e 's/"\.\/\*\*\/\*"/"\.\/src\/\*\*\/\*"/' tsconfig.json
perl -pi -e 's/"\.\/packages/".\/src\/packages/' tsconfig.json

perl -pi -e 's/eslint --ext \.js,\.jsx,\.tsx,\.ts \. --quiet --cache/eslint --ext .js,.jsx,.tsx,.ts .\/src --quiet --cache/' package.json
perl -pi -e 's/eslint --ext \.js,\.jsx,\.tsx,\.ts \. --quiet --fix --cache/eslint --ext .js,.jsx,.tsx,.ts .\/src --quiet --fix --cache/' package.json
perl -pi -e 's/"npm run mmjstool -- i18n extract-webapp"/"npm run mmjstool -- i18n extract-webapp --webapp-dir .\/src"/' package.json
perl -pi -e 's/"npm run mmjstool -- i18n clean-empty --webapp-dir \."/"npm run mmjstool -- i18n clean-empty --webapp-dir .\/src"/' package.json
perl -pi -e 's/"npm run mmjstool -- i18n check-empty-src --webapp-dir \."/"npm run mmjstool -- i18n check-empty-src --webapp-dir .\/src"/' package.json
perl -pi -e 's/"packages\//"src\/packages\//' package.json

perl -pi -e "s/'actions\/\*\*/'actions\/src\/**/" jest.config.js
perl -pi -e "s/'client\/\*\*/'client\/src\/**/" jest.config.js
perl -pi -e "s/'components\/\*\*/'components\/src\/**/" jest.config.js
perl -pi -e "s/'plugins\/\*\*/'plugins\/src\/**/" jest.config.js
perl -pi -e "s/'reducers\/\*\*/'reducers\/src\/**/" jest.config.js
perl -pi -e "s/'routes\/\*\*/'routes\/src\/**/" jest.config.js
perl -pi -e "s/'selectors\/\*\*/'selectors\/src\/**/" jest.config.js
perl -pi -e "s/'stores\/\*\*/'stores\/src\/**/" jest.config.js
perl -pi -e "s/'utils\/\*\*/'utils\/src\/**/" jest.config.js
perl -pi -e "s/'<rootDir>\/packages\//'<rootDir>\/src\/packages\//" jest.config.js
perl -pi -e "s/'<rootDir>\/tests\/i18n_mock\.json'/'<rootDir>\/src\/tests\/i18n_mock.json'/" jest.config.js
perl -pi -e "s/'<rootDir>\/tests\/setup\.js'/'<rootDir>\/src\/tests\/setup.js'/" jest.config.js

perl -pi -e 's/"tests\/\*\*"/"src\/tests\/**"/' .eslintrc.json
perl -pi -e 's/"tests\/\*\.js"/"src\/tests\/*.js"/' .eslintrc.json
perl -pi -e 's/"packages\/mattermost-redux\/test\/\*"/"src\/packages\/mattermost-redux\/test\/*"/' .eslintrc.json

npm install # Update package-lock.json

# git add .
# git commit -m "Update web app configuration files for src directory"

perl -pi -e "s/'packages\/mattermost-redux\/test\/assets\//'src\/packages\/mattermost-redux\/test\/assets\//" src/packages/mattermost-redux/src/actions/admin.test.ts
perl -pi -e "s/'packages\/mattermost-redux\/test\/assets\//'src\/packages\/mattermost-redux\/test\/assets\//" src/packages/mattermost-redux/src/actions/emojis.test.ts
perl -pi -e "s/\`packages\/mattermost-redux\/test\/assets\//\`src\/packages\/mattermost-redux\/test\/assets\//" src/packages/mattermost-redux/src/actions/files.test.ts
perl -pi -e "s/'packages\/mattermost-redux\/test\/assets\//'src\/packages\/mattermost-redux\/test\/assets\//" src/packages/mattermost-redux/src/actions/posts.test.ts
perl -pi -e "s/'packages\/mattermost-redux\/test\/assets\//'src\/packages\/mattermost-redux\/test\/assets\//" src/packages/mattermost-redux/src/actions/teams.test.ts
perl -pi -e "s/'packages\/mattermost-redux\/test\/assets\//'src\/packages\/mattermost-redux\/test\/assets\//" src/packages/mattermost-redux/src/actions/users.test.ts

perl -p0i -e 's/(\/\/ Copyright[^\n]*\n\/\/ See.[^\n]*\n\n)(import)/$1\/* eslint-disable no-console *\/\n\n$2/' src/tests/setup.js

exit 0 # This is the end for now

######## Move packages out of web app

cd "$ROOT/mattermost-webapp-staging/webapp"

mkdir platform

mv channels/src/packages/README.md platform/README.md
mv channels/src/packages/client platform/client
mv channels/src/packages/components platform/components
mv channels/src/packages/types platform/types

git add .
git commit -m "Move packages out of web app"

######## Update subpackages to build properly again

# TODO update web app configuration files (tsconfig, jest config)
# TODO update README

# TODO

######## Set up higher level package.json/Makefile

# TODO

######## Check out the server

######## TODO
# - stop faking that our version of createSelector comes from the real reselect (can be done before)
# - move build folder into scripts?
# - move skip_integrity_check into scripts?
# - figure out what to do with GitLab CI stuff
# - share more configs
# - get configs into packages
# - remove browser part of package.json (can be done before)
# - add node_modules to client package clean script (can be done before)
# - do something with  COMMIT_HASH
