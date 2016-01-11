Mattermost
==========

http:/mattermost.org

Mattermost is an open-source team communication service. It brings team messaging and file sharing into one place, accessible across PCs and phones, with archiving and search.

Installing Mattermost
=====================

To run an instance of the latest version of mattermost on your local machine you can run:

`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform`

To update this image to the latest version you can run:

`docker pull mattermost/platform`

To run an instance of the latest code from the master branch on GitHub you can run:

`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:dev`

Any questions, please visit http://forum.mattermost.org
