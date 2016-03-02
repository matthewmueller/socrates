
test:
	@./node_modules/.bin/mocha \
		--require should \
		--reporter spec

build:
	@mkdir -p dist/
	@./node_modules/.bin/browserify lib/index.js -o dist/socrates.js

dist: build minify

minify: dist/socrates.js
	@curl -s \
			-d compilation_level=SIMPLE_OPTIMIZATIONS \
			-d output_format=text \
			-d output_info=compiled_code \
			--data-urlencode "js_code@$<" \
			http://closure-compiler.appspot.com/compile \
			> $<.tmp
		@mv $<.tmp dist/socrates.min.js


.PHONY: test
