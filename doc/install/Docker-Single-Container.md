# Local Machine Setup and Upgrade

The following install instructions are for single-container installs of Mattermost using Docker for exploring product functionality and upgrading to newer versions.

### One-line Docker Install ###

If you have Docker set up, Mattermost installs in one-line:  
`docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform`

Otherwise, see step-by-step available: 

### Mac OSX ###

1. Install Docker Toolbox using instructions at: http://docs.docker.com/installation/mac/  
    1. Start Docker Toolbox from the command line and run: `docker-machine create -d virtualbox dev`  
2. Get your Docker IP address with: `docker-machine ip dev`
3. Use `sudo nano /etc/hosts` to add `<Docker IP> dockerhost` to your /etc/hosts file 
4. Run: `docker-machine env dev` and copy the export statements to your ~/.bash\_profile by running `sudo nano ~/.bash_profile`. Then run: `source ~/.bash_profile`
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
1. Install Docker using the following commands:

	``` bash
	pacman -S docker
	systemctl enable docker.service
	systemctl start docker.service
	gpasswd -a <username> docker
	newgrp docker
	```

2. Start Docker container:

	``` bash
	docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform
	```

3. When Docker is done fetching the image, open http://localhost:8065/ in your browser.

### Additional Notes ###
- If you want to work with the latest master from the repository (i.e. not a stable release) you can run the cmd:  

	``` bash
    docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform:dev
    ```

- Instructions on how to update your Docker image are found below. 

- If you wish to remove mattermost-dev use:   

	``` bash
	docker stop mattermost-dev
	docker rm -v mattermost-dev
    ```

- If you wish to gain access to a shell on the container use:  

	``` bash
	docker exec -ti mattermost-dev /bin/bash
    ```

## Configuration Settings

There are a few configuration settings you might want to adjust when setting up your instance of Mattermost. You can edit them in `config.json` or `config_docker.json` if you're running a Docker instance.

* *EmailSettings*:*ByPassEmail* - If this is set to true, then users on the system will not need to verify their email addresses when signing up. In addition, no emails will ever be sent.  
* *ServiceSettings*:*UseLocalStorage* - If this is set to true, then your Mattermost server will store uploaded files in the storage directory specified by *StorageDirectory*. *StorageDirectory* must be set if *UseLocalStorage* is set to true.  
* *ServiceSettings*:*StorageDirectory* - The file path where files will be stored locally if *UseLocalStorage* is set to true. The operating system user that is running the Mattermost application must have read and write privileges to this directory.  
* *AWSSettings*:*S3*\* - If *UseLocalStorage* is set to false, and the S3 settings are configured here, then Mattermost will store files in the provided S3 bucket.

### (Recommended) Enable Email 

The default single-container Docker instance for Mattermost is designed for product evaluation, and sets `ByPassEmail=true` so the product can run without enabling email, when doing so maybe difficult. 
	
To see the product's full functionality, [enabling SMTP email is recommended](SMTP-Email-Setup.md).

## Upgrading Mattermost 

### Docker ###
To upgrade your Docker image to a preview of the latest stable release (NOTE: this will erase all data in the Docker container, including the database):

1. Stop your Docker container by running: 

    ``` bash
    docker stop mattermost-dev
    ```
2. Delete your Docker container by running:

    ``` bash
    docker rm mattermost-dev
    ```
3. Update your Docker image by running:

    ``` bash
    docker pull mattermost/platform
    ```
4. Start your Docker container by running:

    ``` bash
    docker run --name mattermost-dev -d --publish 8065:80 mattermost/platform
    ```

To upgrade to the latest development build on master from the repository replace `mattermost/platform` with `mattermost/platform:dev` in the instructions 3) and 4) above. 
