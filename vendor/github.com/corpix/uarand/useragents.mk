.PHONY: useragents.go
useragents.go:
	curl -Ls -H'User-Agent: gotohellwithyour403'                            \
		http://techpatterns.com/downloads/firefox/useragentswitcher.xml \
	| ./scripts/extract-user-agents                                         \
	| ./scripts/generate-useragents-go $(name)                              \
	> $@
	go fmt $@

dependencies:: useragents.go
