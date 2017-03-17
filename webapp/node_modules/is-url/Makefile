
build: components index.js
	@component build --dev

clean:
	@rm -fr build components node_modules

components: component.json
	@component install --dev

node_modules: package.json
	@npm install

test: node_modules build
	@./node_modules/.bin/mocha --reporter spec
	@component test phantom

.PHONY: clean test
