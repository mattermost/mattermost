# Directory containing mjml templates
OUTPUT_DIR=.
MJML=mjml

## Also update the circleCI file if you update this.
check-prereq: ## check if mjml is installed
	@if ! [ -x "$$(command -v mjml)" ]; then \
		echo "mjml is not installed. Installing mjml"; \
		npm install -g mjml@4.9.0; \
	fi;


build: check-prereq ## Compile all mjml email templates
	@for f in $(shell ls *.mjml); \
	do \
	  echo "{{define \"$${f%.*}\"}}\n" > $(OUTPUT_DIR)/$${f%.*}.html; \
		$(MJML) $${f} -s >> $(OUTPUT_DIR)/$${f%.*}.html; \
		echo "\n{{end}}" >> $(OUTPUT_DIR)/$${f%.*}.html; \
	done
