### Production Installation on Ubuntu 14.04

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
