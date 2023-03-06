#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

# Copy in the code to the right places
mkdir -p server/playbooks
rsync --archive --delete --exclude dist ../mattermost-plugin-playbooks/client/ server/playbooks/client
rsync --archive --delete --exclude dist ../mattermost-plugin-playbooks/product/ server/playbooks/product
rsync --archive --delete --exclude dist ../mattermost-plugin-playbooks/server/ server/playbooks/server

mkdir -p webapp/playbooks
rsync --archive --delete ../mattermost-plugin-playbooks/webapp/ webapp/playbooks

# Remove ununsed files
rm -f server/playbooks/client/go.mod
rm -f server/playbooks/client/go.sum

# Fix import paths
grep -lR --include \*.go 'github.com/mattermost/mattermost-plugin-playbooks' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-plugin-playbooks@github.com/mattermost/mattermost-server/server/v7/playbooks@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/app' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/app@github.com/mattermost/mattermost-server/server/v7/channels/app@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/api4' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/api4@github.com/mattermost/mattermost-server/server/v7/channels/api4@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/utils' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/utils@github.com/mattermost/mattermost-server/server/v7/channels/utils@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/store/storetest' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/store/storetest@github.com/mattermost/mattermost-server/server/v7/channels/store/storetest@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/product' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/product@github.com/mattermost/mattermost-server/server/v7/channels/product@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/shared' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/shared@github.com/mattermost/mattermost-server/server/v7/platform/shared@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/services' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/services@github.com/mattermost/mattermost-server/server/v7/platform/services@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/model' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/model@github.com/mattermost/mattermost-server/server/v7/model@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/plugin' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/plugin@github.com/mattermost/mattermost-server/server/v7/plugin@'
grep -lR --include \*.go 'github.com/mattermost/mattermost-server/v6/config' server/playbooks | xargs gsed -i 's@github.com/mattermost/mattermost-server/v6/config@github.com/mattermost/mattermost-server/server/v7/config@'

# Replace logrus with mlog
# cd server/playbooks
# grep -lR --include \*.go 'github.com/sirupsen/logrus' . | xargs gsed -i 's@github.com/sirupsen/logrus@github.com/mattermost/mattermost-server/v6/platform/shared/mlog@'
# grep -lR --include \*.go 'logrus' . | xargs gsed -E -i 's@logrus.Error\(("[^"]+")\)@mlog.Error(\1)@'
# grep -lR --include \*.go 'logrus' . | xargs gsed -E -i 's@logrus.Warn\(("[^"]+")\)@mlog.Warn(\1)@'
# grep -lR --include \*.go 'logrus' . | xargs gsed -E -i 's@logrus.WithError\(([^)]+)\).Error\(("[^"]+")\)@mlog.With(mlog.Err(\1)).Error(\2)@'
# grep -lR --include \*.go 'logrus' . | xargs gsed -E -i 's@logrus.WithError\(([^)]+)\).Warn\(("[^"]+")\)@mlog.With(mlog.Err(\1)).Warn(\2)@'
# grep -lR --include \*.go 'logrus' . | xargs gsed -E -i 's@logrus.WithError\(([^)]+)\).Debug\(("[^"]+")\)@mlog.With(mlog.Err(\1)).Debug(\2)@'
# grep -lR --include \*.go 'logrus' . | xargs gsed -E -i 's@logrus.WithError\(([^)]+)\).WithField\(("[^"]+"), ([^)]+)\).Error\(("[^"]+")\)@mlog.With(mlog.Err(\1), mlog.String(\2, \3)).Error(\4)@'

# Fix goimports
goimports -w server/playbooks



