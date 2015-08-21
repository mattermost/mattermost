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
- For Alpha, Docker is intentionally setup as a single container, since production deployment is not yet recommended.

Local Machine Setup (Docker)
-----------------------------

### Mac OSX ###

1. Install Boot2Docker using instructions at: http://docs.docker.com/installation/mac/  
    1. Start Boot2Docker from the command line and run: `boot2docker init eval “$(boot2docker shellinit)”`  
2. Get your Docker IP address with: `boot2docker ip`
3. Use `sudo nano /etc/hosts` to add `<Docker IP> dockerhost` to your /etc/hosts file 
4. Run: `boot2docker shellinit` and copy the export statements to your ~/.bash\_profile by running `sudo nano ~/.bash_profile`. Then run: `source ~/.bash_profile`
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
- If you want to work with the latest master from the repository (i.e. not a stable release) you can run the cmd:  

	``` bash
    docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:dev
    ```

- Instructions on how to update your docker image are found below. 

- If you wish to remove mattermost-dev use:   

	``` bash
	docker stop mattermost-dev
	docker rm -v mattermost-dev
    ```

- If you wish to gain access to a shell on the container use:  

	``` bash
	docker exec -ti mattermost-dev /bin/bash
    ```

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

Email Setup (Optional)
----------------------

1. Setup an email sending service. If you already have credentials for a SMTP server you can skip this step.
	1. [Setup Amazon Simple Email Service](https://console.aws.amazon.com/ses)
	2. From the `SMTP Settings` menu click `Create My SMTP Credentials`
	3. Copy the `Server Name`, `Port`, `SMTP Username`, and `SMTP Password`
	4. From the `Domains` menu setup and verify a new domain. It it also a good practice to enable `Generate DKIM Settings` for this domain.
	5. Choose an email address like `feedback@example.com` for Mattermost to send emails from.
	6. Test sending an email from `feedback@example.com` by clicking the `Send a Test Email` button and verify everything appears to be working correctly.
2. Modify the Mattermost configuration file config.json or config_docker.json with the SMTP information.
	1. If you're running Mattermost on Amazon Beanstalk you can shell into the instance with the following commands
	2. `ssh ec2-user@[domain for the docker instance]`
	3. `sudo gpasswd -a ec2-user docker`
	4. Retrieve the name of the container with `sudo docker ps`
	5. `sudo docker exec -ti container_name /bin/bash`
2. Edit the config file `vi /config_docker.json` with the settings you captured from the step above. See an example below and notice `ByPassEmail` has been set to `false`

``` bash
"EmailSettings": { 
	"ByPassEmail" : false, 
	"SMTPUsername": "AKIADTOVBGERKLCBV", 
	"SMTPPassword": "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY", 
	"SMTPServer": "email-smtp.us-east-1.amazonaws.com:465", 
	"UseTLS": true, 
	"FeedbackEmail": "feedback@example.com", 
	"FeedbackName": "Feedback", 
	"ApplePushServer": "", 
	"ApplePushCertPublic": "", 
	"ApplePushCertPrivate": ""
}
```

3. Restart Mattermost
	1. Find the process id with `ps -A` and look for the process named `platform`
	2. Kill the process `kill pid`
	3. The service should restart automatically. Verify the Mattermost service is running with `ps -A`
	4. Current logged in users will not be affected, but upon logging out or session expiration users will be required to verify their email address.

Upgrading Mattermost
---------------------

### Docker ###
To upgrade your docker image to the latest release (NOTE: this will destroy all data in the docker container):

1. Stop your docker container by running: 

    ``` bash
    docker stop mattermost-dev
    ```
2. Delete your docker container by running:

    ``` bash
    docker rm mattermost-dev
    ```
3. Update your docker image by running:

    ``` bash
    docker pull mattermost/platform
    ```
4. Start your docker container by running:

    ``` bash
    docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform
    ```

To upgrade to the latest master from the repository replace `mattermost/platform` with `mattermost/platform:dev` in the above instructions.

Contributing
------------

To contribute to this open source project please review the [Mattermost Contribution Guidelines]( http://www.mattermost.org/contribute-to-mattermost/).

To setup your machine for development of mattermost see: [Developer Machine Setup](scripts/README_DEV.md)

License
-------

Mattermost is licensed under an "Apache-wrapped AGPL" model inspired by MongoDB. Similar to MongoDB, you can run and link to the system using Configuration Files and Admin Tools licensed under Apache, version 2.0, as described in the LICENSE file, as an explicit exception to the terms of the GNU Affero General Public License (AGPL) that applies to most of the remaining source files. See individual files for details.

