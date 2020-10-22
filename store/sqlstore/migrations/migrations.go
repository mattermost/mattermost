//go:generate go-bindata -prefix postgres_files/ -pkg postgres -o postgres/bindata.go ./postgres_files
//go:generate go-bindata -prefix mysql_files/ -pkg mysql -o mysql/bindata.go ./mysql_files
package migrations
