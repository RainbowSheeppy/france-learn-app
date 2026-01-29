import os

from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/postgres")

# Disable SQL echo in production for performance and security
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() in ("true", "1", "yes")
engine = create_engine(DATABASE_URL, echo=SQL_ECHO)



def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
