**Mattermost Alpha**  
**Team Communication Service**  
**Development Build**


About Mattermost
================

Mattermost is an open-source team communication service. It brings team messaging and file sharing into one place, accessible across PCs and phones, with archiving and search.



Installing Mattermost
=====================

You're installing "Mattermost Alpha", a pre-released version providing an early look at what we're building. While the core team runs this version internally, it's not recommended for production since we can't guarantee API stability or backwards compatibility.

That said, any issues at all, please let us know on the Mattermost forum.

Notes: 
- For Alpha, Docker is intentionally setup as a single container, since production deployment is not yet recommended.

Local Machine Setup (Docker)
-----------------------------

To run an instance of the latest version of mattermost on your local machine you can run:

`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform`

To update this image to the latest version you can run:

`docker pull mattermost/platform`

To run an instance of the latest code from the master branch on GitHub you can run:

`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:dev`


License
-------

Mattermost is licensed under an "Apache-wrapped AGPL" model inspired by MongoDB. Similar to MongoDB, you can run and link to the system using Configuration Files and Admin Tools licensed under Apache, version 2.0, as described in the LICENSE file, as an explicit exception to the terms of the GNU Affero General Public License (AGPL) that applies to most of the remaining source files. See individual files for details.

