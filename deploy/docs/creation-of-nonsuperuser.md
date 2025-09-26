## Migrating existing superuser to a less privileged user

Mattermost-docker used to use the initially created user while database initialization. This is being accomplished by using the
`POSTGRES_USER` environment variable of the PostgreSQL Docker image. While this is convinient because it requires less setup steps
it's best practice and desirable to us a less privileged user to connect to the database. The following steps should be safe and
executable while Mattermost is running.

**NOTE:** Commands with a **$** prefix denote those are executed as user, **#** as root and commands without a prefix are database commands.
We assume the database name is *mattermost* and the database user *mmuser*.

### 1. Find out the name or id of the PostgreSQL container
To get either the name or the id of the running PostgeSQL container we can use `$ sudo docker ps`.

### 2. Attaching to the database container
`$ sudo docker exec -it POSTGRES_CONTAINER_NAME/ID /bin/sh`

### 3. Connecting to the database
```
# psql DATABASE_NAME USERNAME
e.g.
# psql mattermost mmuser
```

### 4. Checking if the Mattermost user is a superuser
The following PostgreSQL command will print a list of the present users and its attributes.
```
\du
```
A possible output can look like the following:

```
                                   List of roles
 Role name |                         Attributes                         | Member of
-----------+------------------------------------------------------------+-----------
 mmuser    | Superuser, Create role, Create DB, Replication, Bypass RLS | {}
```

### 5. Creating a new `superuser` and changing existing role attributes
**ATTENTION:** It's strongly recommended to create a database prior alteration. This can be done by stopping the database
and backup the PostgreSQL data path at filesystem level and/or to use `pg_dumpall`. For this attach to the running PostgreSQL
container described in step 2 and execute:
```
pg_dump -U mmuser -d mattermost > /var/lib/postgresql/data/BACKUP_MATTERMOST.sql
```
This dumps your *mattermost* database to the mounted directory, specified in the docker-compose.yml file.

After your backup is done you can connect to the database (see step 3) and execute the following SQL queries:
```
CREATE ROLE superuser WITH BYPASSRLS REPLICATION CREATEDB CREATEROLE SUPERUSER LOGIN PASSWORD 'superuser_passwd';

ALTER DATABASE mattermost OWNER TO superuser;
ALTER DATABASE postgres OWNER TO superuser;
ALTER DATABASE template0 OWNER TO superuser;
ALTER DATABASE template1 OWNER TO superuser;

GRANT ALL PRIVILEGES ON DATABASE mattermost to mmuser;

ALTER ROLE mmuser NOBYPASSRLS NOREPLICATION NOCREATEDB NOCREATEROLE NOSUPERUSER;
```

Even though you can apply the changes in a non-downtime it's required to restart the containers.
