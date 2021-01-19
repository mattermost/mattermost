# Directory containing mjml templates
OUTPUT_DIR=compiled
MJML=mjml

build: ## Compile all mjml email templates
	mkdir -p ${OUTPUT_DIR}
	@for f in $(shell ls *.mjml); \
	do \
	  echo "{{define \"$${f%.*}\"}}\n" > $(OUTPUT_DIR)/$${f%.*}.html; \
		$(MJML) $${f} -s >> $(OUTPUT_DIR)/$${f%.*}.html; \
		echo "\n{{end}}" >> $(OUTPUT_DIR)/$${f%.*}.html; \
	done
