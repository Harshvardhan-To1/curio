.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help dev up down logs build seed test lint typecheck install ps clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Build images and start the full stack (postgres, redis, api, worker)
	$(COMPOSE) up --build

up: ## Start the stack in the background
	$(COMPOSE) up -d --build

down: ## Stop the stack
	$(COMPOSE) down

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show running services
	$(COMPOSE) ps

seed: ## Run the end-to-end crawl smoke test against the running API
	cd backend && npm run seed

install: ## Install backend dependencies
	cd backend && npm ci

test: ## Run backend unit tests with coverage
	cd backend && npm run test:cov

lint: ## Lint the backend
	cd backend && npm run lint

typecheck: ## Type-check the backend
	cd backend && npm run typecheck

build: ## Compile the backend
	cd backend && npm run build

clean: ## Stop the stack and remove volumes
	$(COMPOSE) down -v
