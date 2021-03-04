# CockroachDB tutorial for beginners (insecure cluster)

## Create/configure database

First, let's start a local cluster - follow step 1. and 2. from [the docs](https://www.cockroachlabs.com/docs/stable/start-a-local-cluster.html#step-1-start-the-first-node).

Once you have it, create a database. Here I am going to create a database called `example`.
Our user here is `cockroach`. We are not going to use a password, since it's not supported for insecure cluster.
```
cockroach sql --insecure --host=localhost:26257
```
```
CREATE DATABASE example;
CREATE USER IF NOT EXISTS cockroach;
GRANT ALL ON DATABASE example TO cockroach;
```

When using Migrate CLI we need to pass to database URL. Let's export it to a variable for convienience:
```
export COCKROACHDB_URL='cockroachdb://cockroach:@localhost:26257/example?sslmode=disable'
```
`sslmode=disable` means that the connection with our database will not be encrypted. This is needed to connect to an insecure node.

**NOTE:** Do not use COCKROACH_URL as a variable name here, it's already in use for discrete parameters and you may run into connection problems. For more info check out [docs](https://www.cockroachlabs.com/docs/stable/connection-parameters.html#connect-using-discrete-parameters).

You can find further description of database URLs [here](README.md#database-urls).

## Create migrations
Let's create a table called `users`:
```
migrate create -ext sql -dir db/migrations -seq create_users_table
```
If there were no errors, we should have two files available under `db/migrations` folder:
- 000001_create_users_table.down.sql
- 000001_create_users_table.up.sql

Note the `sql` extension that we provided.

In the `.up.sql` file let's create the table:
```
CREATE TABLE IF NOT EXISTS example.users
(
   user_id INT PRIMARY KEY,
   username VARCHAR (50) UNIQUE NOT NULL,
   password VARCHAR (50) NOT NULL,
   email VARCHAR (300) UNIQUE NOT NULL
);
```
And in the `.down.sql` let's delete it:
```
DROP TABLE IF EXISTS example.users;
```
By adding `IF EXISTS/IF NOT EXISTS` we are making migrations idempotent - you can read more about idempotency in [getting started](GETTING_STARTED.md#create-migrations)

## Run migrations
```
migrate -database ${COCKROACHDB_URL} -path db/migrations up
```
Let's check if the table was created properly by running `cockroach sql --insecure --host=localhost:26257 -e "show columns from example.users;"`.
The output you are supposed to see:
```
  column_name |  data_type   | is_nullable | column_default | generation_expression |                   indices                    | is_hidden
+-------------+--------------+-------------+----------------+-----------------------+----------------------------------------------+-----------+
  user_id     | INT8         |    false    | NULL           |                       | {primary,users_username_key,users_email_key} |   false
  username    | VARCHAR(50)  |    false    | NULL           |                       | {users_username_key}                         |   false
  password    | VARCHAR(50)  |    false    | NULL           |                       | {}                                           |   false
  email       | VARCHAR(300) |    false    | NULL           |                       | {users_email_key}                            |   false
(4 rows)
```
Now let's check if running reverse migration also works:
```
migrate -database ${COCKROACHDB_URL} -path db/migrations down
```
Make sure to check if your database changed as expected in this case as well.

## Database transactions

To show database transactions usage, let's create another set of migrations by running:
```
migrate create -ext sql -dir db/migrations -seq add_mood_to_users
```
Again, it should create for us two migrations files:
- 000002_add_mood_to_users.down.sql
- 000002_add_mood_to_users.up.sql

In Cockroach, when we want our queries to be done in a transaction, we need to wrap it with `BEGIN` and `COMMIT` commands, similar to PostgreSQL.
In our example, we are going to add a column to our database that can only accept enumerable values or NULL.
Migration up:
```
BEGIN;

ALTER TABLE example.users ADD COLUMN mood STRING;
ALTER TABLE example.users ADD CONSTRAINT check_mood CHECK (mood IN ('happy', 'sad', 'neutral'));

COMMIT;
```
Migration down:
```
ALTER TABLE example.users DROP COLUMN mood;
```

Now we can run our new migration and check the database:
```
migrate -database ${COCKROACHDB_URL} -path db/migrations up
cockroach sql --insecure --host=localhost:26257 -e "show columns from example.users;"
```
Expected output:
```
  column_name |  data_type   | is_nullable | column_default | generation_expression |                   indices                    | is_hidden  
+-------------+--------------+-------------+----------------+-----------------------+----------------------------------------------+-----------+
  user_id     | INT8         |    false    | NULL           |                       | {primary,users_username_key,users_email_key} |   false    
  username    | VARCHAR(50)  |    false    | NULL           |                       | {users_username_key}                         |   false    
  password    | VARCHAR(50)  |    false    | NULL           |                       | {}                                           |   false    
  email       | VARCHAR(300) |    false    | NULL           |                       | {users_email_key}                            |   false    
  mood        | STRING       |    true     | NULL           |                       | {}                                           |   false    
(5 rows)
```

## Optional: Run migrations within your Go app
Here is a very simple app running migrations for the above configuration:
```
import (
	"log"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/cockroachdb"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	m, err := migrate.New(
		"file://db/migrations",
		"cockroachdb://cockroach:@localhost:26257/example?sslmode=disable")
	if err != nil {
		log.Fatal(err)
	}
	if err := m.Up(); err != nil {
		log.Fatal(err)
	}
}
```
You can find details [here](README.md#use-in-your-go-project)