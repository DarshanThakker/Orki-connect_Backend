start:
	@echo "Starting Bank Backend..."
	@lsof -ti:$${PORT:-5000} | xargs kill -9 2>/dev/null || true
	npm start