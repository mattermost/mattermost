# Production Installation on Ubuntu 14.04 LTS

## Install Ubuntu Server 14.04 LTS
1. Set up 3 machines with Ubuntu 14.04 with 2GB of RAM or more.  The servers will be used for the Load Balancer, Mattermost, and Database.
1. Make sure the system is up to date with the most recent security patches.
  * ```~$ sudo apt-get update```
  * ```~$ sudo apt-get upgrade```

## Setup Database Server
1. For the purposes of this guide we will assume this server has an IP address of 10.10.10.1
1. Install PostgreSQL 9.3+ (or MySQL 5.2+)
  * ```~$ sudo apt-get install postgresql postgresql-contrib```
1. PostgreSQL created a user account called `postgres`.  You will need to log into that account with:
  * ```~$ sudo -i -u postgres```
1. You can get a PostgreSQL prompt by typing:
  * ```~$ psql```
1. Create the Mattermost database by typing:
  * ```postgres=# CREATE DATABASE mattermost;```
1. Create the Mattermost user by typing:
  * ```postgres=# CREATE USER mmuser WITH PASSWORD 'mmuser_password';```
1. Grant the user access to the Mattermost database by typing:
  * ```postgres=# GRANT ALL PRIVILEGES ON DATABASE mattermost to mmuser;```
1. You can exit out of PostgreSQL by typing:
  * ```postgre=# \q```
1. You can exit the postgres account by typing:
  * ```~$ exit```

## Setup Mattermost Server
1. For the purposes of this guide we will assume this server has an IP address of 10.10.10.2
1. Download the lastest Mattermost Server by typing:
  * ```~$ wget https://github.com/mattermost/platform/releases/download/v1.0.0/mattermost.tar.gz```
1. Unzip the Mattermost Server by typing:
  * ```~$ tar -xvzf mattermost.tar.gz```
1. For the sake of making this guide simple we located the files at `/home/ubuntu/mattermost`, in the future we will give guidance for storing under `/opt`.
1. We have also elected to run the Mattermost Server as the `ubuntu` account for simplicity.  We recommend settings up and running the service under a `mattermost` user account with limited permissions.
1. Create the stoarge directory for files.  We assume you will have attached a large drive for storage of images and files.  For this setup we will assume the directory is located at `/mattermost/data`.
  * Create the direcotry by typing:
  * ```~$ sudo mkdir -p /mattermost/data```
  * Set the ubuntu account as the directory owner by typing:
  * ```~$ sudo chown -R ubuntu /mattermost```
1. Configure Mattermost Server by editing the config.json file at /home/ubuntu/mattermost/config`
  * ```~$ cd ~/mattermost/config```
  * Edit the file by typing:
  * ```~$ vi config.json```
  * replace `DriverName": "mysql"` with `DriverName": "postgres"`
  * replace `"DataSource": "mmuser:mostest@tcp(dockerhost:3306)/mattermost_test?charset=utf8mb4,utf8"` with `"DataSource": "postgres://mmuser:mmuser_password@10.10.10.1:5432/mattermost?sslmode=disable&connect_timeout=10"`
  * Optionally you may continue to edit configuration settings in `config.json` or use the System Console described in a later section to finish the configuration.
1. Test the Mattermost Server
  * ```~$ cd ~/mattermost/bin```
  * Run the Mattermost Server by typing:
  * ```~$ ./platform```
  * You should see a console log like `Server is listening on :8065` letting you know the service is running.
  * Stop the server for now by typing `ctrl-c`
1. Setup Mattermost to use the Ubuntu Upstart daemon which handles supervision of the Mattermost process.
  * ```~$ sudo touch /etc/init/mattermost.conf```
  * ```~$ sudo vi /etc/init/mattermost.conf```
  * Copy the following lines into `/etc/init/mattermost.conf`
  * ```start on runlevel [2345]
	stop on runlevel [016]
	respawn
	chdir /home/ubuntu/mattermost
	setuid ubuntu
	exec bin/platform
	``` 
  * You can manage the process by typing:
  * ```~$ sudo start mattermost```
  * Verify the service is running by typing:
  * ```~$ curl http://10.10.10.2:8065```
  * You should see a page titles *Mattermost - Signup*
  * You can also stop the process by running the command `~$ sudo stop mattermost`, but we will skip this step for now.

## Setup Nginx Server
1. For the purposes of this guide we will assume this server has an IP address of 10.10.10.3
1. We use Nginx for proxying request to the Mattermost Server.  The main benefits are:
  * SSL terminiation
  * http to https redirect
  * Port mapping :80 to :8065
  * Standard request logs
1. Install Nginx on Ubuntu with
  * ```~$ sudo apt-get install nginx```
1. Verify Nginx is running
  * ```~$ curl http://10.10.10.3```
  * You should see a *Welcome to nginx!* page
1. You can manage Nginx with the following commands
  * ```~$ sudo service nginx stop```
  * ```~$ sudo service nginx start```
  * ```~$ sudo service nginx restart```
1. Map a FQDN (fully qualified domain name) like **mattermost.example.com** to point to the Nginx server.
1. Configure Nginx to proxy connections from the internet to the Mattermost Server
  * Create a configuration for Mattermost
  * ```~$ sudo touch /etc/nginx/sites-available/mattermost```
  * Below is a sample configuration with the minimum settings required to configure Mattermost.
  * ```
    server {
      location / {
		  client_max_body_size 50M;
		  proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
		  proxy_set_header Host $http_host;
		  proxy_set_header X-Real-IP $remote_addr;
		  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		  proxy_set_header X-Forwarded-Proto $scheme;
		  proxy_set_header   X-Frame-Options   SAMEORIGIN;
          proxy_pass http://localhost:8065;
      }
    }```
  * Remove the existing file with
  * ```~$ sudo rm /etc/nginx/sites-enabled/default```
  * Link the mattermost config by typing:
  * ```sudo ln -s /etc/nginx/sites-available/mattermost /etc/nginx/sites-enabled/mattermost```
  * Restart Nginx by typing:
  * ```~$ sudo service nginx restart```
  * Verify you can see Mattermost thru the proxy by typing:
  * ```~$ curl http://localhost```
  * You should see a page titles *Mattermost - Signup*
  














1. Download [latest stable compiled verison of Mattermost](https://github.com/mattermost/platform/releases) from GitHub 
2. Set up machine with Ubuntu 14.04 with 2GB of RAM or similar 
3. Install and configure Ngnix as a proxy to Mattermost 
4. Install SSL certificate 
5. Configure proxy pass thru
6. Install Postgres 9.3+ or MySQL 5.2+ (optionally, this install could be made on another machine)
7. Create a database using following SQL commands:  

   ```
   DROP DATABASE mattermost;
   CREATE DATABASE mattermost;
   CREATE USER mmuser WITH PASSWORD 'mostest';
   GRANT ALL PRIVILEGES ON DATABASE mattermost to mmuser;
   ```
8. Replace and configure SQL settings section of config.json file with:  

   ```
"DriverName": "mysql",
"DataSource": "mmuser:mostest@tcp(localhost:3306)/mattermost?charset=utf8mb4,utf8",
"DataSourceReplicas": ["mmuser:mostest@tcp(localhost:3306)/mattermost?charset=utf8mb4,utf8"],
   ```
or 
   ```
"DriverName": "postgres",
"DataSource": "postgres://mmuser:password@localhost:5432/mattermost?sslmode=disable&connect_timeout=10",
"DataSourceReplicas": ["postgres://mmuser:password@localhost:5432/mattermost?sslmode=disable&connect_timeout=10"],
```
9. [Set up email notifications](https://github.com/mattermost/platform/blob/master/doc/config/smtp-email-setup.md)
10. On Ubuntu configure upstart to manage the mattermost process (or configure something similar using systemd) then copy following lines to /etc/init/mattermost.conf

  ```
  start on runlevel [2345]
  stop on runlevel [016]
  respawn
  chdir /home/ubuntu/mattermost
  setuid ubuntu
  exec bin/platform
  ``` 
11. Run `sudo start mattermost`
12. Then `curl localhost:8065`