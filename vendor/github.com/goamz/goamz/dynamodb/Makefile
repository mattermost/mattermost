DYNAMODB_LOCAL_VERSION = 2013-12-12

launch: DynamoDBLocal.jar
	cd dynamodb_local_$(DYNAMODB_LOCAL_VERSION) && java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar

DynamoDBLocal.jar: dynamodb_local_$(DYNAMODB_LOCAL_VERSION).tar.gz
	[ -d dynamodb_local_$(DYNAMODB_LOCAL_VERSION) ] || tar -zxf dynamodb_local_$(DYNAMODB_LOCAL_VERSION).tar.gz

dynamodb_local_$(DYNAMODB_LOCAL_VERSION).tar.gz:
	curl -O https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_$(DYNAMODB_LOCAL_VERSION).tar.gz

clean:
	rm -rf dynamodb_local_$(DYNAMODB_LOCAL_VERSION)*
