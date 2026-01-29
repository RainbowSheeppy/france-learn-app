# Base App

A minimal FastAPI application skeleton with SQLModel and PostgreSQL integration.  
Designed as a flexible foundation for building modern backend services.

## Features

- FastAPI for building APIs
- SQLModel for ORM and data modeling
- PostgreSQL integration
- Ready for Docker containerization
- Code formatting and linting with Ruff

## Getting Started

Install dependencies:

```sh
uv sync --frozen
```

## How to Run with Docker Compose

Build and start the application:

```sh
docker-compose up --build
```

The API will be available at [http://localhost:8000](http://localhost:8000).

## Docker Images

- **Application:** Built using [`ghcr.io/astral-sh/uv:python3.11-bookworm-slim`](https://github.com/astral-sh/uv) as the base image in the Dockerfile.
- **Database:** Uses the official [`postgres:15`](https://hub.docker.com/_/postgres) image.

## Live Code Updates

The application code is automatically updated in the running container.  
Any changes made to files in the `app` directory on your host machine are reflected immediately inside the Docker container, thanks to the mounted volume:

```yaml
volumes:
  - ./app:/code/app
```

This allows for rapid development and testing without rebuilding the image.

## Database Configuration

- **User:** `postgres`
- **Password:** `postgres`
- **Database name:** `postgres`
- **Host:** `db` (inside Docker network)
- **Port:** `5432`

## Build Information

- The application image is built locally using the provided Dockerfile.
- The final image size is typically around **250 MB** (may vary depending on dependencies and code).

## Volumes

- PostgreSQL data is persisted in the `postgres_data` Docker volume.

## License

MIT