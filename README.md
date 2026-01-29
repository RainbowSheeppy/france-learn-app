# France Learn App

A modern full-stack application built with FastAPI and React, designed to help users learn French.
The application features a robust backend API, a responsive frontend, and PostgreSQL integration.

## Features

- **Backend**: FastAPI with SQLModel for high-performance API and data modeling.
- **Frontend**: React (Vite) with TailwindCSS for a modern, responsive UI.
- **Database**: PostgreSQL for reliable data persistence.
- **Containerization**: Full Docker support for easy development and deployment.
- **Tools**: Ruff for linting/formatting, Alembic for migrations.

## Project Structure

- `app/`: Backend application code (FastAPI).
- `frontend/`: Frontend application code (React + Vite).
- `scripts/`: Utility scripts.
- `alembic/`: Database migrations.

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

### Method 1: Running with Docker Compose (Recommended)

The easiest way to run the entire application (Backend + Frontend + Database) is using Docker Compose.

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd france-learn-app-main
   ```

2. **Start the application:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - **Frontend**: [http://localhost:5173](http://localhost:5173) (or the port shown in terminal)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Method 2: Manual Local Setup

If you prefer running services individually without Docker Compose.

#### 1. Database Setup
Ensure you have a PostgreSQL database running. You can use a local installation or a Docker container:
```bash
docker run --name postgres-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres -p 5432:5432 -d postgres:15
```

#### 2. Backend Setup
1. Navigate to the root directory.
2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   
   # Linux/Mac
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install .
   ```
4. Run the backend:
   ```bash
   # Make sure DB environment variables are set or use defaults
   uvicorn app.main:app --reload
   ```

#### 3. Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

For detailed instructions on how to deploy this application to Railway, please refer to [railway_tut.md](./railway_tut.md).

## License

MIT