# Directory containing mjml templates
OUTPUT_DIR=.
MJML=mjml

check-prereq: ## check if mjml is installed
	@if ! [ -x "$$(command -v mjml)" ]; then \
		echo "mjml is not installed. Installing mjml"; \
		npm install -g mjml; \
	fi;


build: check-prereq ## Compile all mjml email templates
	@for f in $(shell ls *.mjml); \
	do \
	  echo "{{define \"$${f%.*}\"}}\n" > $(OUTPUT_DIR)/$${f%.*}.html; \
		$(MJML) $${f} -s >> $(OUTPUT_DIR)/$${f%.*}.html; \
		echo "\n{{end}}" >> $(OUTPUT_DIR)/$${f%.*}.html; \
	done
