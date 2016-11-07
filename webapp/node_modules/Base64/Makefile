ISTANBUL = node_modules/.bin/istanbul
UGLIFYJS = node_modules/.bin/uglifyjs
XYZ = node_modules/.bin/xyz --message X.Y.Z --tag X.Y.Z

SRC = base64.js
MIN = $(patsubst %.js,%.min.js,$(SRC))


.PHONY: all
all: $(MIN)

%.min.js: %.js
	$(UGLIFYJS) $< --compress --mangle > $@


.PHONY: bytes
bytes: base64.min.js
	gzip --best --stdout $< | wc -c | tr -d ' '


.PHONY: clean
clean:
	rm -f -- $(MIN)


.PHONY: release-major release-minor release-patch
release-major:
	$(XYZ) --increment major
release-minor:
	$(XYZ) --increment minor
release-patch:
	$(XYZ) --increment patch


.PHONY: setup
setup:
	npm install


.PHONY: test
test:
	$(ISTANBUL) cover node_modules/.bin/_mocha -- --compilers coffee:coffee-script/register
