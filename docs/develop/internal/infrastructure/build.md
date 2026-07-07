---
title: "Build"
sidebar_position: 50
---

## Jenkins

### [build.mattermost.com](https://build.mattermost.com/)

Most of our automated builds currently take place on Jenkins at [build.mattermost.com](https://build.mattermost.com/).

#### Updating Go

Builds on this Jenkins installation use a globally installed Golang distribution. To update it, you'll need to access the master instance and all of its slaves. Make sure the machine isn't in use, then run the following (replacing "1.22" with the desired Go version):

```bash
wget https://storage.googleapis.com/golang/go1.22.linux-amd64.tar.gz
sudo su
rm -r /usr/local/go/
tar -C /usr/local -xzf go1.22.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
env GOOS=windows GOARCH=amd64 go install std
env GOOS=darwin GOARCH=amd64 go install std
```

### [newbuild.mattermost.com](https://newbuild.mattermost.com/)

The Jenkins installation at [newbuild.mattermost.com](https://newbuild.mattermost.com/) is currently used only by the webapp build, but is intended to be the home of new builds that use more modern practices such as containerization and configuration as code via [Jenkins pipelines](https://jenkins.io/doc/book/pipeline/).

## Travis CI

Some light-weight, open source projects use [Travis CI](https://travis-ci.org/).
