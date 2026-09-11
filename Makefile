.PHONY: help check hooks

help:
	@echo "check   parse every mermaid diagram in the guide"
	@echo "hooks   install the git pre-commit hook"

check:
	npm ci --silent --no-audit --no-fund
	npm run --silent check

hooks:
	./scripts/install-hooks.sh
