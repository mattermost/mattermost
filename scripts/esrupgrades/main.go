package main

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	if len(os.Args) != 4 {
		log.Fatal("this script expects three arguments: the driver name ('mysql' or 'postgres'), the DNS connection string and the path to the upgrade file")
	}

	driver := os.Args[1]
	dns := os.Args[2]
	upgradeFilePath := os.Args[3]

	if driver != "mysql" && driver != "postgres" {
		log.Fatal("driver must be 'mysql' or 'postgres'")
	}

	db, err := sql.Open(driver, dns)
	if err != nil {
		log.Fatalf("unable to connect to %q: %s", dns, err.Error())
	}
	defer db.Close()

	queries, err := os.ReadFile(upgradeFilePath)
	if err != nil {
		log.Fatalf("unable to read ESR upgrade file %q: %s", upgradeFilePath, err.Error())
	}

	_, err = db.Exec(string(queries))
	if err != nil {
		log.Fatalf("unable to run migration file: %s", err.Error())
	}
}
