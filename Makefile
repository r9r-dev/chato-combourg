.PHONY: build run stop clean dev icons help

# Variables
IMAGE_NAME := chateau-combo
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build Docker image
	docker build -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest --build-arg APP_VERSION=$(VERSION) .

run: ## Run with docker-compose
	docker-compose up -d

stop: ## Stop containers
	docker-compose down

logs: ## Show logs
	docker-compose logs -f

clean: ## Remove containers and images
	docker-compose down --rmi local -v

dev: ## Run local development server
	npx http-server -p 8080 -c-1

icons: ## Generate PWA icons
	node scripts/generate-icons.js

install: ## Install dependencies
	npm install
