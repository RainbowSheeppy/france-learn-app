#!/usr/bin/env python3
"""
Script to reset the database and create initial users.
Run this from the project root with: python -m scripts.reset_db
Or inside Docker: docker-compose exec backend python -m scripts.reset_db
"""

import os
import sys

# Add parent directory to path to allow imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, SQLModel, select
from app.database import engine
from app.models import (
    User, FiszkiGroup, Fiszka, FiszkaProgress,
    TranslatePlFrGroup, TranslatePlFr, TranslatePlFrProgress,
    TranslateFrPlGroup, TranslateFrPl, TranslateFrPlProgress,
    GuessObjectGroup, GuessObject, GuessObjectProgress,
    FillBlankGroup, FillBlank, FillBlankProgress
)
from app.auth import get_password_hash


def reset_database():
    """Drop all tables and recreate them."""
    print("Dropping all tables...")
    SQLModel.metadata.drop_all(engine)
    print("Creating all tables...")
    SQLModel.metadata.create_all(engine)
    print("Database reset complete!")


def create_users():
    """Create admin and student accounts."""
    users_to_create = [
        {
            "name": os.getenv("ADMIN1_NAME", "Admin"),
            "email": os.getenv("ADMIN1_EMAIL", "admin@example.com"),
            "password": os.getenv("ADMIN1_PASSWORD", "admin123"),
            "is_superuser": True,
        },
        {
            "name": "Oleńka",
            "email": "alexandrawypasek@gmail.com",
            "password": "kawaiherbata",
            "is_superuser": False,
        },
    ]

    with Session(engine) as session:
        for user_data in users_to_create:
            existing = session.exec(
                select(User).where(User.email == user_data["email"])
            ).first()

            if existing:
                print(f"User {user_data['email']} already exists, skipping...")
                continue

            user = User(
                name=user_data["name"],
                email=user_data["email"],
                password_hash=get_password_hash(user_data["password"]),
                is_superuser=user_data["is_superuser"],
                total_points=0,
                current_streak=0,
                highest_combo=0,
            )
            session.add(user)
            role = "admin" if user_data["is_superuser"] else "student"
            print(f"Created {role}: {user_data['email']} ({user_data['name']})")

        session.commit()

    print("\nUsers created successfully!")


def main():
    print("=" * 50)
    print("France Learn App - Database Reset Script")
    print("=" * 50)

    confirm = input("\nThis will DELETE ALL DATA. Are you sure? (yes/no): ")
    if confirm.lower() != "yes":
        print("Aborted.")
        return

    print()
    reset_database()
    print()
    create_users()
    print()
    print("=" * 50)
    print("Done! Database has been reset with:")
    print("  - 1 admin account (from .env)")
    print("  - 1 student account: alexandrawypasek@gmail.com")
    print("=" * 50)


if __name__ == "__main__":
    main()
