# test-te used to just run the team edition tests, but now runs whatever is available
test-te: test-server

# test-ee used to just run the enterprise edition tests, but now runs whatever is available
test-ee: test-server

# clean old docker images
clean-old-docker:
	@echo Removing docker containers

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-mysql$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-mysql; \
		docker stop mattermost-mysql > /dev/null; \
		docker rm -v mattermost-mysql > /dev/null; \
	fi

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-mysql-unittest$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-mysql-unittest; \
		docker stop mattermost-mysql-unittest > /dev/null; \
		docker rm -v mattermost-mysql-unittest > /dev/null; \
	fi

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-postgres$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-postgres; \
		docker stop mattermost-postgres > /dev/null; \
		docker rm -v mattermost-postgres > /dev/null; \
	fi

	@if [ $(shell docker ps -a --no-trunc --quiet --filter name=^/mattermost-postgres-unittest$$ | wc -l) -eq 1 ]; then \
		echo removing mattermost-postgres-unittest; \
		docker stop mattermost-postgres-unittest > /dev/null; \
		docker rm -v mattermost-postgres-unittest > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-openldap) -eq 1 ]; then \
		echo removing mattermost-openldap; \
		docker stop mattermost-openldap > /dev/null; \
		docker rm -v mattermost-openldap > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-inbucket) -eq 1 ]; then \
		echo removing mattermost-inbucket; \
		docker stop mattermost-inbucket > /dev/null; \
		docker rm -v mattermost-inbucket > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-minio) -eq 1 ]; then \
		echo removing mattermost-minio; \
		docker stop mattermost-minio > /dev/null; \
		docker rm -v mattermost-minio > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-elasticsearch) -eq 1 ]; then \
		echo removing mattermost-elasticsearch; \
		docker stop mattermost-elasticsearch > /dev/null; \
		docker rm -v mattermost-elasticsearch > /dev/null; \
	fi

	@if [ $(shell docker ps -a | grep -ci mattermost-redis) -eq 1 ]; then \
		echo removing mattermost-redis; \
		docker stop mattermost-redis > /dev/null; \
		docker rm -v mattermost-redis > /dev/null; \
	fi
