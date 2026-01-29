FROM python:3.11-slim

# Disable output buffering for real-time logs
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (required for some python packages)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements/metadata first to leverage cache
COPY pyproject.toml .

# Install dependencies using pip
RUN pip install --no-cache-dir .

# Copy the rest of the application
COPY . .

# Expose port (Railway uses $PORT env var)
EXPOSE 8000

# Command to run the application
# Note: Railway will override this with the startCommand in railway.toml
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
