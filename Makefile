
test:
	@./node_modules/.bin/mocha \
		--reporter spec

build:
	@mkdir -p dist/
	@NODE_ENV=development ./node_modules/.bin/browserify lib/index.js -t [ loose-envify ] -o dist/socrates.js
	@NODE_ENV=production ./node_modules/.bin/browserify lib/index.js -t [ loose-envify ] -o dist/socrates.prod.js

dist: build minify

minify: dist/socrates.prod.js
	@curl -s \
			-d compilation_level=SIMPLE_OPTIMIZATIONS \
			-d output_format=text \
			-d output_info=compiled_code \
			--data-urlencode "js_code@$<" \
			http://closure-compiler.appspot.com/compile \
			> $<.tmp
		@mv $<.tmp dist/socrates.min.js
		@rm dist/socrates.prod.js


.PHONY: test
