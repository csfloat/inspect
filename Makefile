LOCAL_BIN:=$(CURDIR)/bin

.PHONY: help
help: ## Display this help screen
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

.PHONY: app-up
app-up: ## run app
	docker compose -f docker-compose.yml up -d

.PHONY: app-down
app-down: ## down app
	docker compose -f docker-compose.yml down

.PHONY: app-build-up
app-build-up: ## build and run app
	docker compose -f docker-compose.yml up --build -d

.PHONY: traefik-up
traefik-up: ## run traefik
	docker compose -f docker-compose.traefik.yml up --build -d

.PHONY: traefik-down
traefik-down: ## down traefik
	docker compose -f docker-compose.traefik.yml down

.PHONY: down
down: traefik-down app-down ## down all

.PHONY: up
up: traefik-up app-build-up ## build and run all


.PHONY: pull
pull: ## git  pull
	git pull && git submodule sync && git submodule update --init --recursive

.PHONY: reload
reload: pull down up ## pull & build & run all

.PHONY: logs
logs:
	@container_id=$$(docker ps -q -f name=inspect); \
	if [ -z "$$container_id" ]; then \
		echo "Container with inspect (inspect-inspect) not found."; \
	else \
		docker logs -f "$$container_id" 2>&1; \
	fi