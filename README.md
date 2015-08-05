**Mattermost Alpha**  
**Team Communication Service**  
**Development Build**


About Mattermost
================

Mattermost is an open-source team communication service. It brings team messaging and file sharing into one place, accessible across PCs and phones, with archiving and search.

Learn More
==========
- Ask the core team anything at: http://forum.mattermost.org
- Share feature requests and upvotes: http://www.mattermost.org/feature-requests/
- File bugs: http://www.mattermost.org/filing-issues/
- Make a pull request: http://www.mattermost.org/contribute-to-mattermost/


Installing Mattermost
=====================

You're installing "Mattermost Alpha", a pre-released version providing an early look at what we're building. While the core team runs this version internally, it's not recommended for production since we can't guarantee API stability or backwards compatibility.

That said, any issues at all, please let us know on the Mattermost forum at: http://forum.mattermost.org

Notes: 
- For Alpha, Docker is intentionally setup as a single container, since production deployment not yet recommended.

Local Machine Setup (Docker)
-----------------------------

### Mac OSX ###

1. Follow the instructions at: http://docs.docker.com/installation/mac/  
    1. Use the Boot2Docker command-line utility.
    2. If you do command-line setup use: `boot2docker init eval “$(boot2docker shellinit)”`  
2. Get your Docker IP address with: `boot2docker ip`
3. Add a line to your /etc/hosts that goes: `<Docker IP> dockerhost`
4. Run: `boot2docker shellinit` and copy the export statements to your ~/.bash\_profile.
5. Run: `docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform`
6. When docker is done fetching the image, open http://dockerhost:8065/ in your browser.

### Ubuntu ###
1. Follow the instructions at https://docs.docker.com/installation/ubuntulinux/ or use the summary below:

	``` bash
	sudo apt-get update
	sudo apt-get install wget
	wget -qO- https://get.docker.com/ | sh
	sudo usermod -aG docker <username>
	sudo service docker start
	newgrp docker
	```

2. Start docker container:

	``` bash
	docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform
	```

3. When docker is done fetching the image, open http://localhost:8065/ in your browser.

### Arch ###
1. Install docker using the following commands:

	``` bash
	pacman -S docker
	systemctl enable docker.service
	systemctl start docker.service
	gpasswd -a <username> docker
	newgrp docker
	```

2. Start docker container:

	``` bash
	docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform
	```

3. When docker is done fetching the image, open http://localhost:8065/ in your browser.

### Additional Notes ###
- If you want to work with the latest bits in the repository (i.e. not a stable release) you can run the cmd:  
`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:dev`

- You can update to the latest bits by running:  
`docker pull mattermost/platform:dev`

- If you wish to remove mattermost-dev use:   
	`docker stop mattermost-dev`
	`docker rm -v mattermost-dev`

- If you wish to gain access to a shell on the container use:  
	`docker exec -ti mattermost-dev /bin/bash`

AWS Elastic Beanstalk Setup (Docker)
------------------------------------

1. Create a new elastic beanstalk docker application using the [Dockerrun.aws.json](docker/0.6/Dockerrun.aws.json) file provided. 
	1. From the AWS console select Elastic Beanstalk.
	2. Select "Create New Application" from the top right.
	3. Name the application and press next.
	4. Select "Create a web server" environment.
	5. If asked, select create an IAM role and instance profile and press next.
	6. For predefined configuration select under Generic: Docker. For environment type select single instance.
	7. For application source, select upload your own and upload Dockerrun.aws.json from [docker/0.6/Dockerrun.aws.json](docker/0.6/Dockerrun.aws.json). Everything else may be left at default.
	8. Select an environment name, this is how you will refer to your environment. Make sure the URL is available then press next.
	9. The options on the additional resources page may be left at default unless you wish to change them. Press Next.
	10. On the configuration details place. Select an instance type of t2.small or larger.
	11. You can set the configuration details as you please but they may be left at their defaults. When you are done press next.
	12. Environment tags my be left blank. Press next.
	13. You will be asked to review your information. Press Launch.

4. Try it out!
	14. Wait for beanstalk to update the environment.
	15. Try it out by entering the domain of the form \*.elasticbeanstalk.com found at the top of the dashboard into your browser. You can also map your own domain if you wish.

Configuration Settings
----------------------

There are a few configuration settings you might want to adjust when setting up your instance of Mattermost. You can edit them in [config/config.json](config/config.json) or [docker/0.6/config_docker.json](docker/0.6/config_docker.json) if you're running a docker instance.

* *EmailSettings*:*ByPassEmail* - If this is set to true, then users on the system will not need to verify their email addresses when signing up. In addition, no emails will ever be sent.  
* *ServiceSettings*:*UseLocalStorage* - If this is set to true, then your Mattermost server will store uploaded files in the storage directory specified by *StorageDirectory*. *StorageDirectory* must be set if *UseLocalStorage* is set to true.  
* *ServiceSettings*:*StorageDirectory* - The file path where files will be stored locally if *UseLocalStorage* is set to true. The operating system user that is running the Mattermost application must have read and write privileges to this directory.  
* *AWSSettings*:*S3*\* - If *UseLocalStorage* is set to false, and the S3 settings are configured here, then Mattermost will store files in the provided S3 bucket.

Contributing
------------

To contribute to this open source project please review the [Mattermost Contribution Guidelines]( http://www.mattermost.org/contribute-to-mattermost/).

To setup your machine for development of mattermost see: [Developer Machine Setup](scripts/README_DEV.md)

License
-------

Mattermost is licensed under an "Apache-wrapped AGPL" model inspired by MongoDB. Similar to MongoDB, you can run and link to the system using Configuration Files and Admin Tools licensed under Apache, version 2.0, as described in the LICENSE file, as an explicit exception to the terms of the GNU Affero General Public License (AGPL) that applies to most of the remaining source files. See individual files for details.

