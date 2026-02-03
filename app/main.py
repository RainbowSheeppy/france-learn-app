import datetime
import csv
import io
import os
import re
import uuid
import random
from contextlib import asynccontextmanager
from typing import Annotated, Optional
from pydantic import BaseModel

from fastapi import Depends, FastAPI, HTTPException, status, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import event, func
from sqlmodel import Session, select
from openai import OpenAI, AsyncOpenAI
import asyncio
import json

from .auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    get_current_superuser,
    get_password_hash,
    verify_password,
)
from .database import engine, get_session, init_db
from .models import (
    TargetLanguage,
    User,
    UserCreate,
    UserRead,
    Token,
    FiszkiGroup,
    FiszkiGroupCreate,
    FiszkiGroupRead,
    FiszkiGroupUpdate,
    Fiszka,
    FiszkaCreate,
    FiszkaRead,
    FiszkaUpdate,
    FiszkaProgress,
    TranslatePlToTargetGroup,
    TranslatePlToTargetGroupCreate,
    TranslatePlToTargetGroupRead,
    TranslatePlToTargetGroupUpdate,
    TranslatePlToTarget,
    TranslatePlToTargetCreate,
    TranslatePlToTargetRead,
    TranslatePlToTargetUpdate,
    TranslatePlToTargetProgress,
    TranslateTargetToPlGroup,
    TranslateTargetToPlGroupCreate,
    TranslateTargetToPlGroupRead,
    TranslateTargetToPlGroupUpdate,
    TranslateTargetToPl,
    TranslateTargetToPlCreate,
    TranslateTargetToPlRead,
    TranslateTargetToPlUpdate,
    TranslateTargetToPlProgress,
    GroupStudyRead,
    ProgressUpdate,
    StudySessionRequest,
    GenerateRequest,
    GeneratedItem,
    BatchCreatePlToTarget,
    BatchCreateTargetToPl,
    # Guess Object (Zgadnij przedmiot)
    GuessObjectGroup,
    GuessObjectGroupCreate,
    GuessObjectGroupRead,
    GuessObjectGroupUpdate,
    GuessObject,
    GuessObjectCreate,
    GuessObjectRead,
    GuessObjectUpdate,
    GuessObjectProgress,
    BatchCreateGuessObject,
    GenerateGuessObjectRequest,
    GeneratedGuessObjectItem,
    # Fill Blank (Uzupełnij zdanie)
    FillBlankGroup,
    FillBlankGroupCreate,
    FillBlankGroupRead,
    FillBlankGroupUpdate,
    FillBlank,
    FillBlankCreate,
    FillBlankRead,
    FillBlankUpdate,
    FillBlankProgress,
    BatchCreateFillBlank,
    GenerateFillBlankRequest,
    GeneratedFillBlankItem,
    # AI Verification
    AIVerifyRequest,
    AIVerifyResponse,
    WordleGame,
)
from .gamification import calculate_score, generate_wordle_word, check_wordle_guess


# ===========================================
# OpenAI Client Singleton & Helper Functions
# ===========================================

_openai_client: OpenAI | None = None
_async_openai_client: AsyncOpenAI | None = None


def get_openai_client() -> OpenAI:
    """Zwraca singleton klienta OpenAI (unika tworzenia nowego przy każdym wywołaniu)."""
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def get_async_openai_client() -> AsyncOpenAI:
    """Zwraca singleton async klienta OpenAI dla równoległych zapytań."""
    global _async_openai_client
    if _async_openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
        _async_openai_client = AsyncOpenAI(api_key=api_key)
    return _async_openai_client


def clean_json_response(output_text: str) -> str:
    """Czyści odpowiedź AI z markdown code blocks."""
    text = output_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


async def call_openai_async(prompt: str, model: str = "gpt-5-nano") -> str:
    """Asynchroniczne wywołanie OpenAI API."""
    client = get_async_openai_client()
    response = await client.responses.create(model=model, input=prompt)
    return response.output_text.strip()


async def call_openai_batch_async(prompts: list[str], model: str = "gpt-5-nano") -> list[str]:
    """Równoległe wywołanie wielu promptów - znacznie szybsze dla batch operations."""
    client = get_async_openai_client()
    tasks = [client.responses.create(model=model, input=p) for p in prompts]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    results = []
    for r in responses:
        if isinstance(r, Exception):
            print(f"Batch call error: {r}")
            results.append("")
        else:
            results.append(r.output_text.strip())
    return results


def get_seed_users() -> list[dict]:
    """Get seed users from environment variables for production safety."""
    users = []

    # Admin 1 - from env vars
    admin1_email = os.getenv("ADMIN1_EMAIL")
    admin1_password = os.getenv("ADMIN1_PASSWORD")
    admin1_name = os.getenv("ADMIN1_NAME", "Admin 1")
    if admin1_email and admin1_password:
        users.append({
            "name": admin1_name,
            "email": admin1_email,
            "password": admin1_password,
            "is_superuser": True
        })

    # Student account - from env vars (optional)
    student_email = os.getenv("STUDENT_EMAIL")
    student_password = os.getenv("STUDENT_PASSWORD")
    student_name = os.getenv("STUDENT_NAME", "Student")
    if student_email and student_password:
        users.append({
            "name": student_name,
            "email": student_email,
            "password": student_password,
            "is_superuser": False
        })

    return users


def reset_database():
    """Drop all tables and recreate them. USE WITH CAUTION!"""
    from sqlmodel import SQLModel
    print("=" * 50)
    print("RESETTING DATABASE - All data will be deleted!")
    print("=" * 50)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    print("Database reset complete.")


async def _seed_content_type_parallel(
    session: Session,
    content_type: str,
    group_names: list[tuple[str, str]],
    items_per_group: int = 20
) -> tuple[int, int]:
    """
    Generuje zawartość dla jednego typu równolegle.
    Zwraca (liczba_grup, liczba_elementów).
    """
    groups_created = 0
    items_created = 0

    # Twórz wszystkie grupy najpierw
    created_groups = []
    for name, desc in group_names:
        if content_type == "translate_pl_target":
            group = TranslatePlToTargetGroup(name=f"PL→Target: {name}", description=desc)
        elif content_type == "translate_target_pl":
            group = TranslateTargetToPlGroup(name=f"Target→PL: {name}", description=desc)
        elif content_type == "guess_object":
            group = GuessObjectGroup(name=f"Zgadnij: {name}", description=desc)
        elif content_type == "fill_blank":
            group = FillBlankGroup(name=f"Uzupełnij: {name}", description=desc)
        else:
            continue

        session.add(group)
        session.commit()
        session.refresh(group)
        created_groups.append(group)
        groups_created += 1

    # Generuj zawartość dla wszystkich grup równolegle
    total_items = items_per_group * len(created_groups)

    if content_type == "translate_pl_target":
        all_items = await generate_ai_content_parallel("B1", total_items, "mixed", TargetLanguage.FR, batch_size=10)
    elif content_type == "translate_target_pl":
        all_items = await generate_ai_content_parallel("B1", total_items, "mixed", TargetLanguage.FR, batch_size=10)
    elif content_type == "guess_object":
        all_items = await generate_guess_object_parallel("B1", total_items, TargetLanguage.FR, batch_size=10)
    elif content_type == "fill_blank":
        all_items = await generate_fill_blank_parallel("B1", total_items, None, TargetLanguage.FR, batch_size=10)
    else:
        all_items = []

    # Rozdziel elementy między grupy
    items_per_group_actual = len(all_items) // len(created_groups) if created_groups else 0
    for i, group in enumerate(created_groups):
        start_idx = i * items_per_group_actual
        end_idx = start_idx + items_per_group_actual if i < len(created_groups) - 1 else len(all_items)
        group_items = all_items[start_idx:end_idx]

        for item in group_items:
            try:
                if content_type == "translate_pl_target":
                    if item.get("text_pl") and item.get("text_target"):
                        db_item = TranslatePlToTarget(
                            text_pl=item["text_pl"],
                            text_target=item["text_target"],
                            category=item.get("category", "mixed"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        items_created += 1
                elif content_type == "translate_target_pl":
                    if item.get("text_pl") and item.get("text_target"):
                        db_item = TranslateTargetToPl(
                            text_target=item["text_target"],
                            text_pl=item["text_pl"],
                            category=item.get("category", "mixed"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        items_created += 1
                elif content_type == "guess_object":
                    if item.get("description_target") and item.get("answer_target"):
                        db_item = GuessObject(
                            description_target=item["description_target"],
                            description_pl=item.get("description_pl"),
                            answer_target=item["answer_target"],
                            answer_pl=item.get("answer_pl"),
                            category=item.get("category"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        items_created += 1
                elif content_type == "fill_blank":
                    if item.get("sentence_with_blank") and item.get("answer"):
                        db_item = FillBlank(
                            sentence_with_blank=item["sentence_with_blank"],
                            sentence_pl=item.get("sentence_pl"),
                            answer=item["answer"],
                            full_sentence=item.get("full_sentence", ""),
                            hint=item.get("hint"),
                            grammar_focus=item.get("grammar_focus"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        items_created += 1
            except Exception as e:
                print(f"Error adding item: {e}")

        session.commit()

    return groups_created, items_created


def seed_generated_content():
    """
    Generate initial content for all learning modes using AI.
    Używa równoległego przetwarzania dla szybszego generowania.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("WARNING: OPENAI_API_KEY not set, skipping content generation")
        return

    print("\n" + "=" * 50)
    print("GENERATING INITIAL CONTENT (B1 level) - PARALLEL MODE")
    print("=" * 50)

    group_names = [
        ("Zestaw startowy 1", "Podstawowe słownictwo i zwroty B1"),
        ("Zestaw startowy 2", "Rozszerzony zestaw B1"),
    ]

    async def run_parallel_generation():
        total_groups = 0
        total_items = 0

        with Session(engine) as session:
            content_types = [
                ("translate_pl_target", "Tłumaczenie PL → Target"),
                ("translate_target_pl", "Tłumaczenie Target → PL"),
                ("guess_object", "Zgadnij przedmiot"),
                ("fill_blank", "Uzupełnij lukę"),
            ]

            for i, (content_type, label) in enumerate(content_types, 1):
                print(f"\n[{i}/4] Generowanie: {label}...")
                try:
                    groups, items = await _seed_content_type_parallel(
                        session, content_type, group_names, items_per_group=20
                    )
                    total_groups += groups
                    total_items += items
                    print(f"  ✓ Utworzono {groups} grup, {items} elementów")
                except Exception as e:
                    print(f"  ✗ Błąd: {e}")

        return total_groups, total_items

    # Uruchom asynchroniczne generowanie
    total_groups, total_items = asyncio.run(run_parallel_generation())

    print("\n" + "=" * 50)
    print("GENEROWANIE ZAKOŃCZONE!")
    print(f"Utworzono: {total_groups} grup, {total_items} elementów")
    print("=" * 50 + "\n")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ============================================================
    # RESET DATABASE ON STARTUP - SET TO False AFTER FIRST DEPLOY
    # ============================================================
    RESET_DB_ON_STARTUP = False  # <-- Change to False to keep data
    # ============================================================

    # ============================================================
    # GENERATE CONTENT ON STARTUP - SET TO False TO SKIP
    # ============================================================
    GENERATE_CONTENT_ON_STARTUP = False  # <-- Change to True to generate content
    # ============================================================

    if RESET_DB_ON_STARTUP:
        reset_database()
        if GENERATE_CONTENT_ON_STARTUP:
            seed_generated_content()
    else:
        init_db()

    # Seed data from environment variables
    users_data = get_seed_users()

    if users_data:
        with Session(engine) as session:
            print("Seeding users from environment variables...")
            for user_data in users_data:
                existing_user = session.exec(select(User).where(User.email == user_data["email"])).first()
                if not existing_user:
                    print(f"Creating user {user_data['email']}...")
                    user = User(
                        name=user_data["name"],
                        email=user_data["email"],
                        password_hash=get_password_hash(user_data["password"]),
                        is_superuser=user_data.get("is_superuser", False),
                    )
                    session.add(user)
                else:
                    print(f"User {user_data['email']} already exists, skipping...")
            session.commit()
            print("User seeding complete.")
    else:
        print("No seed users configured in environment variables.")

    yield
    print("Shutting down...")


# Event Listeners for Updated At
@event.listens_for(User, "before_update")
def update_user_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(FiszkiGroup, "before_update")
def update_fiszkigroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(Fiszka, "before_update")
def update_fiszka_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslatePlToTargetGroup, "before_update")
def update_translateplfrgroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslatePlToTarget, "before_update")
def update_translateplfr_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslateTargetToPlGroup, "before_update")
def update_translatefrplgroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslateTargetToPl, "before_update")
def update_translatefrpl_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(GuessObjectGroup, "before_update")
def update_guessobjectgroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(GuessObject, "before_update")
def update_guessobject_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(FillBlankGroup, "before_update")
def update_fillblankgroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(FillBlank, "before_update")
def update_fillblank_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


# Production configuration from environment
DEBUG_MODE = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

def parse_cors_origins(origins_str: str) -> list[str]:
    """Parses CORS origins and ensures they have a scheme."""
    origins = origins_str.split(",")
    valid_origins = []
    for origin in origins:
        origin = origin.strip()
        if not origin:
            continue
        if not origin.startswith("http://") and not origin.startswith("https://"):
            # Assume HTTPS for production domains, unless it looks like localhost which is risky to assume but usually localhost has http
            # Actually, better to just add https:// for remote
            valid_origins.append(f"https://{origin}")
        else:
            valid_origins.append(origin)
    return valid_origins

CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))

app = FastAPI(debug=DEBUG_MODE, lifespan=lifespan)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Language Configuration
LANGUAGE_CONFIG = {
    TargetLanguage.FR: {
        "name": "francuski",
        "name_en": "French",
        "code": "FR",
        "flag": "🇫🇷",
        "expert": "ekspert od języka francuskiego",
        "wordle_fallback": ["POMME", "LIVRE", "CHIEN", "CHAT", "TABLE", "JOUER", "AIMER", "VIVRE", "ROUGE", "VERTE"],
        "grammar": "passé composé, subjonctif, imparfait",
        "direction_from_pl": "PL→FR",
        "direction_to_pl": "FR→PL",
    },
    TargetLanguage.EN: {
        "name": "angielski",
        "name_en": "English",
        "code": "EN",
        "flag": "🇬🇧",
        "expert": "ekspert od języka angielskiego",
        "wordle_fallback": ["APPLE", "HOUSE", "WATER", "LIGHT", "HORSE", "CLOUD", "BREAD", "STONE", "GREEN", "WHITE"],
        "grammar": "present perfect, past simple, conditionals",
        "direction_from_pl": "PL→EN",
        "direction_to_pl": "EN→PL",
    }
}


# Helper for OpenAI Translation
def get_translation(text: str, target_lang: str = "francuski", language: TargetLanguage = TargetLanguage.FR) -> str:
    """Tłumaczy tekst używając OpenAI (z singleton klientem)."""
    try:
        client = get_openai_client()
        lang_config = LANGUAGE_CONFIG[language]
        lang_name = lang_config["name"]

        # Zoptymalizowany prompt - minimalny format dla oszczędności tokenów
        if target_lang == lang_name or target_lang == "target":
            prompt = f"PL→{lang_config['code']}: {text}"
        else:
            prompt = f"{lang_config['code']}→PL: {text}"

        response = client.responses.create(model="gpt-5-nano", input=prompt)
        return response.output_text.strip()
    except Exception as e:
        print(f"Translation Error: {e}")
        return f"[MOCK TRANSLATION] {text}"


# Helper for OpenAI AI Generation
def _build_generate_prompt(level: str, count: int, category: Optional[str], language: TargetLanguage) -> tuple[str, str]:
    """Buduje prompt do generowania zdań. Zwraca (prompt, cat_name)."""
    lang_config = LANGUAGE_CONFIG[language]
    lang_name = lang_config["name"]
    lang_code = lang_config["code"]

    category_instructions = {
        "vocabulary": "słownictwo - rzeczowniki, przymiotniki, przysłówki",
        "grammar": "gramatyka - zdania testujące konstrukcje gramatyczne",
        "phrases": "zwroty i wyrażenia - codzienne frazy",
        "idioms": f"idiomy i przysłowia {lang_name}ie",
        "verbs": "czasowniki - odmiana i użycie",
    }

    cat_instruction = ""
    cat_name = category
    if category and category in category_instructions:
        cat_instruction = f"Skup się na: {category_instructions[category]}."
    elif not category:
        cat_name = "mixed"

    prompt = f"""Wygeneruj {count} par zdań PL-{lang_code} na poziomie {level}.
Język docelowy: {lang_name}.
{cat_instruction}
Format JSON (bez dodatkowego tekstu):
[{{"text_pl": "...", "text_target": "...", "category": "{cat_name}"}}]"""

    return prompt, cat_name or "mixed"


def _normalize_content_keys(items: list[dict], lang_code: str) -> list[dict]:
    """Normalizuje klucze odpowiedzi AI do text_target."""
    for item in items:
        if "text_target" not in item:
            if f"text_{lang_code.lower()}" in item:
                item["text_target"] = item[f"text_{lang_code.lower()}"]
            elif "text_fr" in item:
                item["text_target"] = item["text_fr"]
            elif "text_en" in item:
                item["text_target"] = item["text_en"]
    return items


def generate_ai_content(level: str, count: int, category: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje pary zdań z opcjonalną kategorią (synchronicznie)."""
    try:
        client = get_openai_client()
        lang_code = LANGUAGE_CONFIG[language]["code"]
        prompt, _ = _build_generate_prompt(level, count, category, language)

        response = client.responses.create(model="gpt-5-nano", input=prompt)

        usage_info = getattr(response, "usage", "N/A")
        print(f"Token usage: {usage_info}")

        output_text = clean_json_response(response.output_text)
        items = json.loads(output_text)
        return _normalize_content_keys(items, lang_code)
    except Exception as e:
        print(f"Generation Error: {e}")
        return []


async def generate_ai_content_async(level: str, count: int, category: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje pary zdań asynchronicznie (szybsze dla wielu zapytań)."""
    try:
        lang_code = LANGUAGE_CONFIG[language]["code"]
        prompt, _ = _build_generate_prompt(level, count, category, language)

        output_text = await call_openai_async(prompt)
        output_text = clean_json_response(output_text)
        items = json.loads(output_text)
        return _normalize_content_keys(items, lang_code)
    except Exception as e:
        print(f"Async Generation Error: {e}")
        return []


async def generate_ai_content_parallel(level: str, total_count: int, category: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR, batch_size: int = 10) -> list[dict]:
    """
    Generuje pary zdań równolegle w mniejszych batchach.
    Dla total_count=20 i batch_size=10 wykonuje 2 równoległe zapytania po 10.
    """
    if total_count <= batch_size:
        return await generate_ai_content_async(level, total_count, category, language)

    lang_code = LANGUAGE_CONFIG[language]["code"]
    num_batches = (total_count + batch_size - 1) // batch_size
    items_per_batch = total_count // num_batches

    prompts = []
    for i in range(num_batches):
        batch_count = items_per_batch if i < num_batches - 1 else total_count - (items_per_batch * (num_batches - 1))
        prompt, _ = _build_generate_prompt(level, batch_count, category, language)
        prompts.append(prompt)

    print(f"Generating {total_count} items in {num_batches} parallel batches...")
    responses = await call_openai_batch_async(prompts)

    all_items = []
    for output_text in responses:
        if output_text:
            try:
                cleaned = clean_json_response(output_text)
                batch_items = json.loads(cleaned)
                all_items.extend(_normalize_content_keys(batch_items, lang_code))
            except json.JSONDecodeError as e:
                print(f"JSON parse error in batch: {e}")

    return all_items


@app.post("/api/ai/generate", response_model=list[GeneratedItem])
async def generate_sentences_endpoint(request: GenerateRequest, current_user: User = Depends(get_current_superuser)):
    """
    Generuje pary zdań do tłumaczeń.
    Dla count > 10 używa równoległego przetwarzania (szybsze).
    """
    if request.count > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 sentences at once")

    # Użyj równoległego przetwarzania dla większych requestów
    if request.count > 10:
        generated_data = await generate_ai_content_parallel(
            request.level, request.count, request.category, current_user.active_language, batch_size=10
        )
    else:
        generated_data = await generate_ai_content_async(
            request.level, request.count, request.category, current_user.active_language
        )

    # Map to GeneratedItem
    items = []
    for item in generated_data:
        t_target = item.get("text_target")
        if item.get("text_pl") and t_target:
            items.append(GeneratedItem(
                text_pl=item.get("text_pl"),
                text_target=t_target,
                category=item.get("category", request.category)
            ))

    return items


# Helper for AI Answer Verification
def verify_answer_with_ai(question: str, expected_answer: str, user_answer: str, task_type: str, language: TargetLanguage = TargetLanguage.FR) -> dict:
    """Weryfikuje odpowiedź użytkownika używając AI (z singleton klientem)."""
    try:
        client = get_openai_client()
        lang_config = LANGUAGE_CONFIG[language]
        lang_name = lang_config["name"]

        task_descriptions = {
            "translate_pl_to_target": f"tłumaczenie z polskiego na {lang_name}",
            "translate_target_to_pl": f"tłumaczenie z {lang_name}ego na polski",
            "translate_pl_fr": f"tłumaczenie z polskiego na {lang_name}",
            "translate_fr_pl": f"tłumaczenie z {lang_name}ego na polski",
            "fill_blank": f"uzupełnienie luki w zdaniu {lang_name}im"
        }
        task_desc = task_descriptions.get(task_type, "zadanie językowe")

        prompt = f"""Jesteś {lang_config['expert']}. Sprawdź czy odpowiedź użytkownika jest poprawna.

Typ zadania: {task_desc}
Pytanie/Zdanie: {question}
Oczekiwana odpowiedź: {expected_answer}
Odpowiedź użytkownika: {user_answer}

Odpowiedz TYLKO w formacie JSON (bez dodatkowego tekstu):
{{"is_correct": true/false, "explanation": "krótkie wyjaśnienie po polsku (max 2 zdania)"}}

Zasady oceny:
- Akceptuj poprawne synonimy i alternatywne tłumaczenia
- Ignoruj drobne różnice w interpunkcji i wielkości liter
- Dla tłumaczeń akceptuj różne poprawne warianty zdania
- Bądź wyrozumiały ale sprawiedliwy"""

        response = client.responses.create(model="gpt-5-nano", input=prompt)
        output_text = clean_json_response(response.output_text)
        return json.loads(output_text)
    except Exception as e:
        print(f"AI Verification Error: {e}")
        raise HTTPException(status_code=500, detail=f"Błąd weryfikacji AI: {str(e)}")


@app.post("/api/ai/verify-answer", response_model=AIVerifyResponse)
def verify_answer_endpoint(
    request: AIVerifyRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Weryfikuje odpowiedź użytkownika przez AI i ewentualnie dodaje jako alternatywę."""
    
    # Verify task_type
    # Map old types to new types if necessary
    valid_types = ["translate_pl_to_target", "translate_target_to_pl", "translate_pl_fr", "translate_fr_pl", "fill_blank"]
    if request.task_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid task_type. Must be one of: {valid_types}")
    
    # Call AI verification
    ai_result = verify_answer_with_ai(
        question=request.question,
        expected_answer=request.expected_answer,
        user_answer=request.user_answer,
        task_type=request.task_type,
        language=current_user.active_language
    )
    
    is_correct = ai_result.get("is_correct", False)
    explanation = ai_result.get("explanation", "Brak wyjaśnienia")
    answer_added = False
    
    if is_correct:
        # Add user's answer as alternative and update progress
        item = None
        progress_model = None
        
        if request.task_type == "translate_pl_fr" or request.task_type == "translate_pl_to_target":
            item = session.get(TranslatePlToTarget, request.item_id)
            progress_model = TranslatePlToTargetProgress
        elif request.task_type == "translate_fr_pl" or request.task_type == "translate_target_to_pl":
            item = session.get(TranslateTargetToPl, request.item_id)
            progress_model = TranslateTargetToPlProgress
        elif request.task_type == "fill_blank":
            item = session.get(FillBlank, request.item_id)
            progress_model = FillBlankProgress
        
        if item:
            # Add to alternative_answers if not already there
            current_alternatives = item.alternative_answers or []
            normalized_user_answer = request.user_answer.strip().lower()
            normalized_alternatives = [a.strip().lower() for a in current_alternatives]
            
            if normalized_user_answer not in normalized_alternatives:
                current_alternatives.append(request.user_answer.strip())
                item.alternative_answers = current_alternatives
                session.add(item)
                answer_added = True
            
            # Update progress to learned
            if progress_model:
                progress = session.exec(
                    select(progress_model).where(
                        progress_model.user_id == current_user.id,
                        progress_model.item_id == request.item_id
                    )
                ).first()
                
                if progress:
                    progress.learned = True
                    session.add(progress)
                else:
                    # Create new progress entry
                    new_progress = progress_model(
                        user_id=current_user.id,
                        item_id=request.item_id,
                        learned=True
                    )
                    session.add(new_progress)
            
            session.commit()
    
    return AIVerifyResponse(
        is_correct=is_correct,
        explanation=explanation,
        answer_added=answer_added
    )


# Root endpoint
@app.get("/")
def root():
    return {"message": "Hello, France Learn App!"}


# Auth endpoints
@app.get("/auth/me")
def get_current_user_endpoint(current_user: User = Depends(get_current_user)):
    """Zwraca dane zalogowanego użytkownika"""
    return current_user


@app.post("/auth/login", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/logout")
def logout():
    return {"message": "Successfully logged out"}


# ==========================================
# User Language Endpoints
# ==========================================


class LanguageRequest(BaseModel):
    language: TargetLanguage


class LanguageResponse(BaseModel):
    language: TargetLanguage
    config: dict


@app.get("/user/language", response_model=LanguageResponse)
def get_user_language(current_user: User = Depends(get_current_user)):
    """Pobiera aktywny język użytkownika."""
    lang = current_user.active_language
    return LanguageResponse(
        language=lang,
        config={
            "name": LANGUAGE_CONFIG[lang]["name"],
            "name_en": LANGUAGE_CONFIG[lang]["name_en"],
            "code": LANGUAGE_CONFIG[lang]["code"],
            "flag": LANGUAGE_CONFIG[lang]["flag"],
        }
    )


@app.post("/user/language", response_model=LanguageResponse)
def set_user_language(
    request: LanguageRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Ustawia aktywny język użytkownika."""
    current_user.active_language = request.language
    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    lang = current_user.active_language
    return LanguageResponse(
        language=lang,
        config={
            "name": LANGUAGE_CONFIG[lang]["name"],
            "name_en": LANGUAGE_CONFIG[lang]["name_en"],
            "code": LANGUAGE_CONFIG[lang]["code"],
            "flag": LANGUAGE_CONFIG[lang]["flag"],
        }
    )


# Endpointy użytkowników
@app.post("/users/", response_model=UserRead)
def create_user(user: UserCreate, session: Session = Depends(get_session)):
    existing_user = session.exec(select(User).where(User.email == user.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = User(name=user.name, email=user.email, password_hash=hashed_password)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


@app.get("/users/", response_model=list[UserRead])
def get_users(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    users = session.exec(select(User)).all()
    return users


# ==========================================
# FISZKI Endpoints
# ==========================================


@app.get("/fiszki/groups/", response_model=list[FiszkiGroupRead])
def get_fiszki_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup fiszek, opcjonalnie filtrowanych po języku"""
    query = select(FiszkiGroup)
    if language:
        query = query.where(FiszkiGroup.language == language)
    groups = session.exec(query).all()
    return groups


@app.get("/fiszki/groups/{group_id}", response_model=FiszkiGroupRead)
def get_fiszki_group(group_id: uuid.UUID, session: Session = Depends(get_session)):
    group = session.get(FiszkiGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@app.post("/fiszki/groups/", response_model=FiszkiGroupRead)
def create_fiszki_group(
    group: FiszkiGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = FiszkiGroup(name=group.name, description=group.description)
    session.add(new_group)
    session.commit()
    session.refresh(new_group)
    return new_group


@app.put("/fiszki/groups/{group_id}", response_model=FiszkiGroupRead)
def update_fiszki_group(
    group_id: uuid.UUID,
    group_data: FiszkiGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(FiszkiGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description

    session.add(group)
    session.commit()
    session.refresh(group)
    return group


@app.delete("/fiszki/groups/{group_id}")
def delete_fiszki_group(
    group_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(FiszkiGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.get("/fiszki/", response_model=list[FiszkaRead])
def get_fiszki(group_id: Optional[uuid.UUID] = None, session: Session = Depends(get_session)):
    statement = select(Fiszka)
    if group_id:
        statement = statement.where(Fiszka.group_id == group_id)
    fiszki = session.exec(statement).all()
    return fiszki


@app.post("/fiszki/", response_model=FiszkaRead)
def create_fiszka(
    fiszka: FiszkaCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_fiszka = Fiszka.model_validate(fiszka)
    session.add(new_fiszka)
    session.commit()
    session.refresh(new_fiszka)
    return new_fiszka


@app.put("/fiszki/{fiszka_id}", response_model=FiszkaRead)
def update_fiszka(
    fiszka_id: uuid.UUID,
    fiszka_data: FiszkaUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    fiszka = session.get(Fiszka, fiszka_id)
    if not fiszka:
        raise HTTPException(status_code=404, detail="Fiszka not found")

    fiszka_data_dict = fiszka_data.model_dump(exclude_unset=True)
    for key, value in fiszka_data_dict.items():
        setattr(fiszka, key, value)

    session.add(fiszka)
    session.commit()
    session.refresh(fiszka)
    return fiszka


@app.delete("/fiszki/{fiszka_id}")
def delete_fiszka(
    fiszka_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    fiszka = session.get(Fiszka, fiszka_id)
    if not fiszka:
        raise HTTPException(status_code=404, detail="Fiszka not found")
    session.delete(fiszka)
    session.commit()
    return {"message": "Fiszka deleted successfully"}


@app.post("/fiszki/import")
async def import_fiszki(
    group_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded_content = content.decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(decoded_content))

    expected_headers = {"text_pl", "text_target"}
    if not csv_reader.fieldnames or not expected_headers.issubset(set(csv_reader.fieldnames)):
        # Fallback for old CSVs with text_fr
        if "text_fr" in csv_reader.fieldnames:
             pass # Accept text_fr
        else:
             raise HTTPException(status_code=400, detail=f"CSV must contain headers: {', '.join(expected_headers)}")

    count = 0
    for row in csv_reader:
        fiszka = Fiszka(
            text_pl=row["text_pl"], 
            text_target=row.get("text_target") or row.get("text_fr"), 
            image_url=row.get("image_url"), 
            group_id=group_id
        )
        session.add(fiszka)
        count += 1

    session.commit()
    return {"message": f"Successfully imported {count} fiszki"}


# ==========================================
# TRANSLATE PL -> TARGET Endpoints
# ==========================================


@app.get("/translate-pl-fr/groups/", response_model=list[TranslatePlToTargetGroupRead])
def get_pl_fr_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup tłumaczeń PL->Target, opcjonalnie filtrowanych po języku"""
    query = select(TranslatePlToTargetGroup)
    if language:
        query = query.where(TranslatePlToTargetGroup.language == language)
    groups = session.exec(query).all()
    
    result = []
    for group in groups:
        total = session.exec(select(func.count(TranslatePlToTarget.id)).where(TranslatePlToTarget.group_id == group.id)).one()
        g_read = TranslatePlToTargetGroupRead.model_validate(group)
        g_read.total_items = total
        result.append(g_read)
    return result


@app.post("/translate-pl-fr/groups/", response_model=TranslatePlToTargetGroupRead)
def create_pl_fr_group(
    group: TranslatePlToTargetGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = TranslatePlToTargetGroup(**group.model_dump())
    session.add(new_group)
    session.commit()
    session.refresh(new_group)
    return new_group


@app.post("/translate-pl-fr/import")
async def import_pl_fr(
    group_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded_content = content.decode("utf-8")

    csv_file = io.StringIO(decoded_content)
    sentences = []

    # Reset file pointer
    csv_file.seek(0)
    reader = csv.reader(csv_file)
    rows = list(reader)

    if not rows:
        return {"message": "Empty file"}

    start_idx = 0
    # Simple heuristic: if first row has "text_pl", it's a header
    if rows[0] and "text_pl" in rows[0][0].lower():
        start_idx = 1

    for i in range(start_idx, len(rows)):
        row = rows[i]
        if row and row[0].strip():
            sentences.append(row[0].strip())

    count = 0
    # Retrieve group to know language
    group = session.get(TranslatePlToTargetGroup, group_id)
    language = group.language if group else TargetLanguage.FR

    for text_pl in sentences:
        if not text_pl.strip():
            continue

        # Translate
        text_target = get_translation(text_pl, target_lang="target", language=language)

        item = TranslatePlToTarget(text_pl=text_pl, text_target=text_target, group_id=group_id)
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Imported {count} items with translations"}


@app.get("/translate-pl-fr/items/", response_model=list[TranslatePlToTargetRead])
def get_pl_fr_items(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.exec(select(TranslatePlToTarget).where(TranslatePlToTarget.group_id == group_id)).all()


@app.put("/translate-pl-fr/groups/{group_id}", response_model=TranslatePlToTargetGroupRead)
def update_pl_fr_group(
    group_id: uuid.UUID,
    group_data: TranslatePlToTargetGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(TranslatePlToTargetGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description

    session.add(group)
    session.commit()
    session.refresh(group)
    return group


@app.delete("/translate-pl-fr/groups/{group_id}")
def delete_pl_fr_group(
    group_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(TranslatePlToTargetGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.post("/translate-pl-fr/items/", response_model=TranslatePlToTargetRead)
def create_pl_fr_item(
    item: TranslatePlToTargetCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_item = TranslatePlToTarget.model_validate(item)
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@app.put("/translate-pl-fr/items/{item_id}", response_model=TranslatePlToTargetRead)
def update_pl_fr_item(
    item_id: uuid.UUID,
    item_data: TranslatePlToTargetUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(TranslatePlToTarget, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data_dict = item_data.model_dump(exclude_unset=True)
    for key, value in item_data_dict.items():
        setattr(item, key, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete("/translate-pl-fr/items/{item_id}")
def delete_pl_fr_item(
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(TranslatePlToTarget, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}


@app.post("/translate-pl-fr/items/batch", response_model=list[TranslatePlToTargetRead])
def batch_create_pl_fr_items(
    batch: BatchCreatePlToTarget,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    created_items = []
    for item_data in batch.items:
        # Ensure group_id is set
        db_item = TranslatePlToTarget(
            text_pl=item_data.text_pl,
            text_target=item_data.text_target,
            category=item_data.category,
            group_id=batch.group_id
        )
        session.add(db_item)
        created_items.append(db_item)

    session.commit()
    for item in created_items:
        session.refresh(item)
    return created_items


# ==========================================
# TRANSLATE TARGET -> PL Endpoints
# ==========================================


@app.get("/translate-fr-pl/groups/", response_model=list[TranslateTargetToPlGroupRead])
def get_fr_pl_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup tłumaczeń FR->PL, opcjonalnie filtrowanych po języku"""
    query = select(TranslateTargetToPlGroup)
    if language:
        query = query.where(TranslateTargetToPlGroup.language == language)
    return session.exec(query).all()


@app.post("/translate-fr-pl/groups/", response_model=TranslateTargetToPlGroupRead)
def create_fr_pl_group(
    group: TranslateTargetToPlGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = TranslateTargetToPlGroup(**group.model_dump())
    session.add(new_group)
    session.commit()
    session.refresh(new_group)
    return new_group


@app.post("/translate-fr-pl/import")
async def import_fr_pl(
    group_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    # Logic: Input is PL. Translate PL -> FR.
    # Store: FR as Question (text_fr), PL as Answer (text_pl).
    # Because user said "Dla modelu... TranslateFrPl - pole text_fr, text_pl... Zawsze podajemy zdania po polsku."

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded_content = content.decode("utf-8")

    csv_file = io.StringIO(decoded_content)
    sentences = []

    # Simple reader approach for robustness
    reader = csv.reader(csv_file)
    rows = list(reader)
    if not rows:
        return {"message": "Empty file"}

    # Check if first row is header "text_pl"
    start_idx = 0
    if rows[0] and "text_pl" in rows[0][0].lower():
        start_idx = 1

    count = 0
    
    # Retrieve group to know language
    group = session.get(TranslateTargetToPlGroup, group_id)
    language = group.language if group else TargetLanguage.FR

    for i in range(start_idx, len(rows)):
        row = rows[i]
        if not row:
            continue
        text_pl = row[0]
        if not text_pl.strip():
            continue

        text_target = get_translation(text_pl, target_lang="target", language=language)

        item = TranslateTargetToPl(
            text_target=text_target,  # Question
            text_pl=text_pl,  # Answer
            group_id=group_id,
        )
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Imported {count} items with translations"}


@app.get("/translate-fr-pl/items/", response_model=list[TranslateTargetToPlRead])
def get_fr_pl_items(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.exec(select(TranslateTargetToPl).where(TranslateTargetToPl.group_id == group_id)).all()


@app.put("/translate-fr-pl/groups/{group_id}", response_model=TranslateTargetToPlGroupRead)
def update_fr_pl_group(
    group_id: uuid.UUID,
    group_data: TranslateTargetToPlGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(TranslateTargetToPlGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description

    session.add(group)
    session.commit()
    session.refresh(group)
    return group


@app.delete("/translate-fr-pl/groups/{group_id}")
def delete_fr_pl_group(
    group_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(TranslateTargetToPlGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.post("/translate-fr-pl/items/", response_model=TranslateTargetToPlRead)
def create_fr_pl_item(
    item: TranslateTargetToPlCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_item = TranslateTargetToPl.model_validate(item)
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@app.put("/translate-fr-pl/items/{item_id}", response_model=TranslateTargetToPlRead)
def update_fr_pl_item(
    item_id: uuid.UUID,
    item_data: TranslateTargetToPlUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(TranslateTargetToPl, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data_dict = item_data.model_dump(exclude_unset=True)
    for key, value in item_data_dict.items():
        setattr(item, key, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete("/translate-fr-pl/items/{item_id}")
def delete_fr_pl_item(
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(TranslateTargetToPl, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}


@app.post("/translate-fr-pl/items/batch", response_model=list[TranslateTargetToPlRead])
def batch_create_fr_pl_items(
    batch: BatchCreateTargetToPl,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    created_items = []
    for item_data in batch.items:
        db_item = TranslateTargetToPl(
            text_target=item_data.text_target,
            text_pl=item_data.text_pl,
            category=item_data.category,
            group_id=batch.group_id
        )
        session.add(db_item)
        created_items.append(db_item)

    session.commit()
    for item in created_items:
        session.refresh(item)
    return created_items


# ==========================================
# STUDY Endpoints
# ==========================================

# NOTE: Original '/study/groups' was implicitly for Fiszki.
# We now rename/specialize. We can keep '/study/groups' for Fiszki default or add specific endpoint.
# I will expose specific endpoints for each mode.


@app.get("/study/fiszki/groups", response_model=list[GroupStudyRead])
def get_study_fiszki_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(FiszkiGroup).where(FiszkiGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(Fiszka.id)).where(Fiszka.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(FiszkaProgress.fiszka_id))
            .join(Fiszka)
            .where(Fiszka.group_id == group.id)
            .where(FiszkaProgress.user_id == current_user.id)
            .where(FiszkaProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/fiszki/session", response_model=list[FiszkaRead])
def get_study_fiszki_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import random

    statement = select(Fiszka).where(Fiszka.group_id.in_(request.group_ids))
    fiszki = session.exec(statement).all()

    if not fiszki:
        return []

    learned_ids = set(
        session.exec(
            select(FiszkaProgress.fiszka_id)
            .where(FiszkaProgress.user_id == current_user.id)
            .where(FiszkaProgress.learned == True)
        ).all()
    )

    candidates = []
    for f in fiszki:
        if request.include_learned or f.id not in learned_ids:
            candidates.append(f)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/fiszki/progress")
def update_fiszka_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(FiszkaProgress)
        .where(FiszkaProgress.user_id == current_user.id)
        .where(FiszkaProgress.fiszka_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        # Verify exists
        if not session.get(Fiszka, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = FiszkaProgress(
            user_id=current_user.id, fiszka_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# Translate PL -> Target Language Study
@app.get("/study/translate-pl-fr/groups", response_model=list[GroupStudyRead])
def get_study_pl_to_target_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(TranslatePlToTargetGroup).where(TranslatePlToTargetGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslatePlToTarget.id)).where(TranslatePlToTarget.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslatePlToTargetProgress.item_id))
            .join(TranslatePlToTarget)
            .where(TranslatePlToTarget.group_id == group.id)
            .where(TranslatePlToTargetProgress.user_id == current_user.id)
            .where(TranslatePlToTargetProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/translate-pl-fr/session", response_model=list[TranslatePlToTargetRead])
def get_study_pl_to_target_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import random

    statement = select(TranslatePlToTarget).where(TranslatePlToTarget.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(TranslatePlToTargetProgress.item_id)
            .where(TranslatePlToTargetProgress.user_id == current_user.id)
            .where(TranslatePlToTargetProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/translate-pl-fr/progress")
def update_pl_to_target_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(TranslatePlToTargetProgress)
        .where(TranslatePlToTargetProgress.user_id == current_user.id)
        .where(TranslatePlToTargetProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(TranslatePlToTarget, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = TranslatePlToTargetProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# Translate Target Language -> PL Study
@app.get("/study/translate-fr-pl/groups", response_model=list[GroupStudyRead])
def get_study_target_to_pl_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(TranslateTargetToPlGroup).where(TranslateTargetToPlGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslateTargetToPl.id)).where(TranslateTargetToPl.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslateTargetToPlProgress.item_id))
            .join(TranslateTargetToPl)
            .where(TranslateTargetToPl.group_id == group.id)
            .where(TranslateTargetToPlProgress.user_id == current_user.id)
            .where(TranslateTargetToPlProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/translate-fr-pl/session", response_model=list[TranslateTargetToPlRead])
def get_study_target_to_pl_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import random

    statement = select(TranslateTargetToPl).where(TranslateTargetToPl.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(TranslateTargetToPlProgress.item_id)
            .where(TranslateTargetToPlProgress.user_id == current_user.id)
            .where(TranslateTargetToPlProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/translate-fr-pl/progress")
def update_target_to_pl_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(TranslateTargetToPlProgress)
        .where(TranslateTargetToPlProgress.user_id == current_user.id)
        .where(TranslateTargetToPlProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(TranslateTargetToPl, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = TranslateTargetToPlProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# ==========================================
# GUESS OBJECT (Zgadnij przedmiot) Endpoints
# ==========================================


@app.get("/guess-object/groups/", response_model=list[GuessObjectGroupRead])
def get_guess_object_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup zgadnij przedmiot, opcjonalnie filtrowanych po języku"""
    query = select(GuessObjectGroup)
    if language:
        query = query.where(GuessObjectGroup.language == language)
    groups = session.exec(query).all()

    result = []
    for group in groups:
        total = session.exec(select(func.count(GuessObject.id)).where(GuessObject.group_id == group.id)).one()
        g_read = GuessObjectGroupRead.model_validate(group)
        g_read.total_items = total
        result.append(g_read)
    return result


@app.post("/guess-object/groups/", response_model=GuessObjectGroupRead)
def create_guess_object_group(
    group: GuessObjectGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = GuessObjectGroup(**group.model_dump())
    session.add(new_group)
    session.commit()
    session.refresh(new_group)
    return new_group


@app.put("/guess-object/groups/{group_id}", response_model=GuessObjectGroupRead)
def update_guess_object_group(
    group_id: uuid.UUID,
    group_data: GuessObjectGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(GuessObjectGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description

    session.add(group)
    session.commit()
    session.refresh(group)
    return group


@app.delete("/guess-object/groups/{group_id}")
def delete_guess_object_group(
    group_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(GuessObjectGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.get("/guess-object/items/", response_model=list[GuessObjectRead])
def get_guess_object_items(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.exec(select(GuessObject).where(GuessObject.group_id == group_id)).all()


@app.post("/guess-object/items/", response_model=GuessObjectRead)
def create_guess_object_item(
    item: GuessObjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_item = GuessObject.model_validate(item)
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@app.put("/guess-object/items/{item_id}", response_model=GuessObjectRead)
def update_guess_object_item(
    item_id: uuid.UUID,
    item_data: GuessObjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(GuessObject, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data_dict = item_data.model_dump(exclude_unset=True)
    for key, value in item_data_dict.items():
        setattr(item, key, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete("/guess-object/items/{item_id}")
def delete_guess_object_item(
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(GuessObject, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}


@app.post("/guess-object/items/batch", response_model=list[GuessObjectRead])
def batch_create_guess_object_items(
    batch: BatchCreateGuessObject,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    created_items = []
    for item_data in batch.items:
        db_item = GuessObject(
            description_target=item_data.description_target,
            description_pl=item_data.description_pl,
            answer_target=item_data.answer_target,
            answer_pl=item_data.answer_pl,
            category=item_data.category,
            hint=item_data.hint,
            group_id=batch.group_id,
        )
        session.add(db_item)
        created_items.append(db_item)

    session.commit()
    for item in created_items:
        session.refresh(item)
    return created_items


@app.post("/guess-object/import")
async def import_guess_object(
    group_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded_content = content.decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(decoded_content))

    expected_headers = {"description_target", "answer_target"}
    if not csv_reader.fieldnames or not expected_headers.issubset(set(csv_reader.fieldnames)):
        # Fallback for old CSVs with description_fr
        if "description_fr" in csv_reader.fieldnames and "answer_fr" in csv_reader.fieldnames:
             pass 
        else:
            raise HTTPException(status_code=400, detail=f"CSV must contain headers: {', '.join(expected_headers)}")

    count = 0
    for row in csv_reader:
        item = GuessObject(
            description_target=row.get("description_target") or row.get("description_fr"), 
            answer_target=row.get("answer_target") or row.get("answer_fr"), 
            hint=row.get("hint"), 
            group_id=group_id
        )
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Successfully imported {count} items"}


# AI Generation for Guess Object
def _build_guess_object_prompt(level: str, count: int, language: TargetLanguage) -> str:
    """Buduje prompt do generowania zagadek słownych."""
    lang_config = LANGUAGE_CONFIG[language]
    lang_name = lang_config["name"]
    lang_code = lang_config["code"]

    level_instructions = {
        "A1": "proste przedmioty (owoce, zwierzęta, meble, ubrania), krótkie opisy 1-2 zdania, używaj prostych słów",
        "A2": "przedmioty codzienne (narzędzia, sprzęt kuchenny, środki transportu), opisy 2-3 zdania",
        "B1": "przedmioty i pojęcia bardziej abstrakcyjne, opisy 2-3 zdania ze szczegółami",
        "B2": "pojęcia abstrakcyjne, zawody, instrumenty, złożone opisy z metaforami",
        "C1": "pojęcia filozoficzne, kulturowe, złożone metafory, 3-4 zdania",
        "C2": "zaawansowane pojęcia, idiomy, gry słowne, wyrafinowane opisy",
    }

    instruction = level_instructions.get(level, level_instructions["B1"])

    article_instruction = ""
    if language == TargetLanguage.FR:
        article_instruction = "- Odpowiedź MUSI zawierać rodzajnik (le/la/un/une/l')"
    elif language == TargetLanguage.EN:
        article_instruction = "- Odpowiedź MUSI zawierać przedimek (a/an/the) jeśli to wymagane"

    return f"""Wygeneruj {count} zagadek słownych po {lang_name}u na poziomie {level}.
Cechy:
- {instruction}
- Opis powinien dawać wskazówki, ale nie zdradzać odpowiedzi wprost
{article_instruction}
- Każda zagadka powinna być unikalna
- Dodaj polskie tłumaczenie opisu i odpowiedzi
- Określ kategorię przedmiotu (fruits, animals, furniture, tools, transport, food, nature, abstract, profession, instrument)

Format JSON (bez dodatkowego tekstu):
[{{"description_{lang_code.lower()}": "opis po {lang_name}u", "description_pl": "opis po polsku", "answer_{lang_code.lower()}": "odpowiedź", "answer_pl": "odpowiedź po polsku", "category": "kategoria"}}]"""


def _normalize_guess_object_keys(items: list[dict], lang_code: str) -> list[dict]:
    """Normalizuje klucze zagadek do description_target/answer_target."""
    for item in items:
        if "description_target" not in item:
            if f"description_{lang_code.lower()}" in item:
                item["description_target"] = item[f"description_{lang_code.lower()}"]
            elif "description_fr" in item:
                item["description_target"] = item["description_fr"]

        if "answer_target" not in item:
            if f"answer_{lang_code.lower()}" in item:
                item["answer_target"] = item[f"answer_{lang_code.lower()}"]
            elif "answer_fr" in item:
                item["answer_target"] = item["answer_fr"]
    return items


def generate_guess_object_ai_content(level: str, count: int, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje zagadki słowne synchronicznie."""
    try:
        client = get_openai_client()
        lang_code = LANGUAGE_CONFIG[language]["code"]
        prompt = _build_guess_object_prompt(level, count, language)

        response = client.responses.create(model="gpt-5-nano", input=prompt)
        output_text = clean_json_response(response.output_text)
        items = json.loads(output_text)
        return _normalize_guess_object_keys(items, lang_code)
    except Exception as e:
        print(f"Guess Object Generation Error: {e}")
        return []


async def generate_guess_object_ai_content_async(level: str, count: int, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje zagadki słowne asynchronicznie."""
    try:
        lang_code = LANGUAGE_CONFIG[language]["code"]
        prompt = _build_guess_object_prompt(level, count, language)

        output_text = await call_openai_async(prompt)
        output_text = clean_json_response(output_text)
        items = json.loads(output_text)
        return _normalize_guess_object_keys(items, lang_code)
    except Exception as e:
        print(f"Async Guess Object Generation Error: {e}")
        return []


async def generate_guess_object_parallel(level: str, total_count: int, language: TargetLanguage = TargetLanguage.FR, batch_size: int = 10) -> list[dict]:
    """Generuje zagadki równolegle w mniejszych batchach."""
    if total_count <= batch_size:
        return await generate_guess_object_ai_content_async(level, total_count, language)

    lang_code = LANGUAGE_CONFIG[language]["code"]
    num_batches = (total_count + batch_size - 1) // batch_size
    items_per_batch = total_count // num_batches

    prompts = []
    for i in range(num_batches):
        batch_count = items_per_batch if i < num_batches - 1 else total_count - (items_per_batch * (num_batches - 1))
        prompts.append(_build_guess_object_prompt(level, batch_count, language))

    print(f"Generating {total_count} guess objects in {num_batches} parallel batches...")
    responses = await call_openai_batch_async(prompts)

    all_items = []
    for output_text in responses:
        if output_text:
            try:
                cleaned = clean_json_response(output_text)
                batch_items = json.loads(cleaned)
                all_items.extend(_normalize_guess_object_keys(batch_items, lang_code))
            except json.JSONDecodeError as e:
                print(f"JSON parse error in guess object batch: {e}")

    return all_items


@app.post("/api/ai/generate-guess-object", response_model=list[GeneratedGuessObjectItem])
async def generate_guess_object_endpoint(
    request: GenerateGuessObjectRequest, current_user: User = Depends(get_current_superuser)
):
    """
    Generuje zagadki słowne (Guess Object).
    Dla count > 10 używa równoległego przetwarzania (szybsze).
    """
    if request.count > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 items at once")

    # Użyj równoległego przetwarzania dla większych requestów
    if request.count > 10:
        generated_data = await generate_guess_object_parallel(
            request.level, request.count, current_user.active_language, batch_size=10
        )
    else:
        generated_data = await generate_guess_object_ai_content_async(
            request.level, request.count, current_user.active_language
        )

    items = []
    for item in generated_data:
        d_target = item.get("description_target")
        a_target = item.get("answer_target")
        if d_target and a_target:
            items.append(
                GeneratedGuessObjectItem(
                    description_target=d_target,
                    description_pl=item.get("description_pl"),
                    answer_target=a_target,
                    answer_pl=item.get("answer_pl"),
                    category=item.get("category"),
                    hint=item.get("hint")
                )
            )

    return items


# Guess Object Study Endpoints
@app.get("/study/guess-object/groups", response_model=list[GroupStudyRead])
def get_study_guess_object_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(GuessObjectGroup).where(GuessObjectGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(GuessObject.id)).where(GuessObject.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(GuessObjectProgress.item_id))
            .join(GuessObject)
            .where(GuessObject.group_id == group.id)
            .where(GuessObjectProgress.user_id == current_user.id)
            .where(GuessObjectProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/guess-object/session", response_model=list[GuessObjectRead])
def get_study_guess_object_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = select(GuessObject).where(GuessObject.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(GuessObjectProgress.item_id)
            .where(GuessObjectProgress.user_id == current_user.id)
            .where(GuessObjectProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/guess-object/progress")
def update_guess_object_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(GuessObjectProgress)
        .where(GuessObjectProgress.user_id == current_user.id)
        .where(GuessObjectProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(GuessObject, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = GuessObjectProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# ==========================================
# FILL BLANK (Uzupełnij zdanie) Endpoints
# ==========================================


@app.get("/fill-blank/groups/", response_model=list[FillBlankGroupRead])
def get_fill_blank_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup uzupełnij lukę, opcjonalnie filtrowanych po języku"""
    query = select(FillBlankGroup)
    if language:
        query = query.where(FillBlankGroup.language == language)
    return session.exec(query).all()


@app.post("/fill-blank/groups/", response_model=FillBlankGroupRead)
def create_fill_blank_group(
    group: FillBlankGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = FillBlankGroup(**group.model_dump())
    session.add(new_group)
    session.commit()
    session.refresh(new_group)
    return new_group


@app.put("/fill-blank/groups/{group_id}", response_model=FillBlankGroupRead)
def update_fill_blank_group(
    group_id: uuid.UUID,
    group_data: FillBlankGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(FillBlankGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group_data.name is not None:
        group.name = group_data.name
    if group_data.description is not None:
        group.description = group_data.description

    session.add(group)
    session.commit()
    session.refresh(group)
    return group


@app.delete("/fill-blank/groups/{group_id}")
def delete_fill_blank_group(
    group_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(FillBlankGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.get("/fill-blank/items/", response_model=list[FillBlankRead])
def get_fill_blank_items(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.exec(select(FillBlank).where(FillBlank.group_id == group_id)).all()


@app.post("/fill-blank/items/", response_model=FillBlankRead)
def create_fill_blank_item(
    item: FillBlankCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_item = FillBlank.model_validate(item)
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@app.put("/fill-blank/items/{item_id}", response_model=FillBlankRead)
def update_fill_blank_item(
    item_id: uuid.UUID,
    item_data: FillBlankUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(FillBlank, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item_data_dict = item_data.model_dump(exclude_unset=True)
    for key, value in item_data_dict.items():
        setattr(item, key, value)

    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete("/fill-blank/items/{item_id}")
def delete_fill_blank_item(
    item_id: uuid.UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(FillBlank, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}


@app.post("/fill-blank/items/batch", response_model=list[FillBlankRead])
def batch_create_fill_blank_items(
    batch: BatchCreateFillBlank,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    created_items = []
    for item_data in batch.items:
        db_item = FillBlank(
            sentence_with_blank=item_data.sentence_with_blank,
            sentence_pl=item_data.sentence_pl,
            answer=item_data.answer,
            full_sentence=item_data.full_sentence,
            hint=item_data.hint,
            grammar_focus=item_data.grammar_focus,
            group_id=batch.group_id,
        )
        session.add(db_item)
        created_items.append(db_item)

    session.commit()
    for item in created_items:
        session.refresh(item)
    return created_items


@app.post("/fill-blank/import")
async def import_fill_blank(
    group_id: uuid.UUID,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    decoded_content = content.decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(decoded_content))

    expected_headers = {"sentence_with_blank", "answer"}
    if not csv_reader.fieldnames or not expected_headers.issubset(set(csv_reader.fieldnames)):
        raise HTTPException(status_code=400, detail=f"CSV must contain headers: {', '.join(expected_headers)}")

    count = 0
    for row in csv_reader:
        item = FillBlank(
            sentence_with_blank=row["sentence_with_blank"],
            answer=row["answer"],
            full_sentence=row.get("full_sentence"),
            hint=row.get("hint"),
            grammar_focus=row.get("grammar_focus"),
            group_id=group_id,
        )
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Successfully imported {count} items"}


# AI Generation for Fill Blank
def _get_fill_blank_grammar_config(language: TargetLanguage) -> tuple[dict, dict]:
    """Zwraca konfigurację gramatyki dla danego języka (level_grammar, focus_map)."""
    if language == TargetLanguage.FR:
        level_grammar = {
            "A1": "czasowniki w présent (être, avoir, regularne -er), rodzajniki (le/la/un/une), podstawowe przyimki (à, de, dans)",
            "A2": "passé composé, rodzajniki cząstkowe (du/de la/des), przyimki miejsca (sur, sous, devant)",
            "B1": "imparfait vs passé composé, zaimki y/en, przyimki z krajami (en/au/aux)",
            "B2": "subjonctif présent, zaimki względne (qui/que/dont/où), zgodność participe passé",
            "C1": "wszystkie czasy, subjonctif passé, zaimki złożone, idiomy",
            "C2": "niuanse stylistyczne, wyrażenia literackie, zaawansowana składnia",
        }
        focus_map = {
            "verb": "Skup się na czasownikach i ich odmianach.",
            "article": "Skup się na rodzajnikach (le/la/un/une/du/de la/des).",
            "preposition": "Skup się na przyimkach.",
            "pronoun": "Skup się na zaimkach (y, en, zaimki względne).",
            "agreement": "Skup się na zgodności (rodzaj, liczba, participe passé).",
        }
    else:  # EN
        level_grammar = {
            "A1": "czasowniki w present simple (be, have, regularne), przedimki (a/an/the), podstawowe przyimki (in, on, at)",
            "A2": "past simple, present continuous, przedimki z rzeczownikami policzalnymi i niepoliczalnymi",
            "B1": "present perfect vs past simple, czasowniki modalne (can/could/may/might)",
            "B2": "passive voice, zdania warunkowe (conditionals I, II, III), reported speech",
            "C1": "wszystkie czasy, inwersja, zaawansowane struktury zdaniowe",
            "C2": "niuanse stylistyczne, wyrażenia idiomatyczne, zaawansowana składnia",
        }
        focus_map = {
            "verb": "Skup się na czasownikach i ich formach (tenses).",
            "article": "Skup się na przedimkach (a/an/the/some/any).",
            "preposition": "Skup się na przyimkach.",
            "pronoun": "Skup się na zaimkach (relative, reflexive).",
            "agreement": "Skup się na zgodności (subject-verb agreement, singular/plural).",
        }
    return level_grammar, focus_map


def _build_fill_blank_prompt(level: str, count: int, grammar_focus: Optional[str], language: TargetLanguage) -> str:
    """Buduje prompt do generowania ćwiczeń z lukami."""
    lang_config = LANGUAGE_CONFIG[language]
    lang_name = lang_config["name"]

    level_grammar, focus_map = _get_fill_blank_grammar_config(language)
    grammar_instruction = level_grammar.get(level, level_grammar["B1"])

    focus_instruction = ""
    if grammar_focus:
        focus_instruction = focus_map.get(grammar_focus, "")

    return f"""Wygeneruj {count} ćwiczeń "uzupełnij lukę" po {lang_name}u na poziomie {level}.

Wytyczne dla poziomu {level}: {grammar_instruction}
{focus_instruction}

Zasady:
- Luka oznaczona jako ___ (trzy podkreślniki)
- Każda luka testuje konkretną wiedzę gramatyczną, NIE losowe słowo
- Odpowiedź musi być jednoznaczna
- Hint naprowadza na kategorię gramatyczną
- grammar_focus: verb | article | preposition | pronoun | agreement
- Dodaj polskie tłumaczenie pełnego zdania (sentence_pl)

Format JSON (bez dodatkowego tekstu):
[{{"sentence_with_blank": "zdanie z ___", "sentence_pl": "polskie tłumaczenie", "answer": "odpowiedź", "full_sentence": "pełne zdanie", "hint": "podpowiedź", "grammar_focus": "kategoria"}}]"""


def generate_fill_blank_ai_content(level: str, count: int, grammar_focus: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje ćwiczenia z lukami synchronicznie."""
    try:
        client = get_openai_client()
        prompt = _build_fill_blank_prompt(level, count, grammar_focus, language)

        response = client.responses.create(model="gpt-5-nano", input=prompt)
        output_text = clean_json_response(response.output_text)
        return json.loads(output_text)
    except Exception as e:
        print(f"Fill Blank Generation Error: {e}")
        return []


async def generate_fill_blank_ai_content_async(level: str, count: int, grammar_focus: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje ćwiczenia z lukami asynchronicznie."""
    try:
        prompt = _build_fill_blank_prompt(level, count, grammar_focus, language)
        output_text = await call_openai_async(prompt)
        output_text = clean_json_response(output_text)
        return json.loads(output_text)
    except Exception as e:
        print(f"Async Fill Blank Generation Error: {e}")
        return []


async def generate_fill_blank_parallel(level: str, total_count: int, grammar_focus: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR, batch_size: int = 10) -> list[dict]:
    """Generuje ćwiczenia z lukami równolegle w mniejszych batchach."""
    if total_count <= batch_size:
        return await generate_fill_blank_ai_content_async(level, total_count, grammar_focus, language)

    num_batches = (total_count + batch_size - 1) // batch_size
    items_per_batch = total_count // num_batches

    prompts = []
    for i in range(num_batches):
        batch_count = items_per_batch if i < num_batches - 1 else total_count - (items_per_batch * (num_batches - 1))
        prompts.append(_build_fill_blank_prompt(level, batch_count, grammar_focus, language))

    print(f"Generating {total_count} fill blank items in {num_batches} parallel batches...")
    responses = await call_openai_batch_async(prompts)

    all_items = []
    for output_text in responses:
        if output_text:
            try:
                cleaned = clean_json_response(output_text)
                batch_items = json.loads(cleaned)
                all_items.extend(batch_items)
            except json.JSONDecodeError as e:
                print(f"JSON parse error in fill blank batch: {e}")

    return all_items


@app.post("/api/ai/generate-fill-blank", response_model=list[GeneratedFillBlankItem])
async def generate_fill_blank_endpoint(
    request: GenerateFillBlankRequest, current_user: User = Depends(get_current_superuser)
):
    """
    Generuje ćwiczenia z lukami (Fill Blank).
    Dla count > 10 używa równoległego przetwarzania (szybsze).
    """
    if request.count > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 items at once")

    # Użyj równoległego przetwarzania dla większych requestów
    if request.count > 10:
        generated_data = await generate_fill_blank_parallel(
            request.level, request.count, request.grammar_focus, current_user.active_language, batch_size=10
        )
    else:
        generated_data = await generate_fill_blank_ai_content_async(
            request.level, request.count, request.grammar_focus, current_user.active_language
        )

    items = []
    for item in generated_data:
        if item.get("sentence_with_blank") and item.get("answer"):
            items.append(
                GeneratedFillBlankItem(
                    sentence_with_blank=item["sentence_with_blank"],
                    sentence_pl=item.get("sentence_pl"),
                    answer=item["answer"],
                    full_sentence=item.get("full_sentence", ""),
                    hint=item.get("hint"),
                    grammar_focus=item.get("grammar_focus"),
                )
            )

    return items


# Fill Blank Study Endpoints
@app.get("/study/fill-blank/groups", response_model=list[GroupStudyRead])
def get_study_fill_blank_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(FillBlankGroup).where(FillBlankGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(FillBlank.id)).where(FillBlank.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(FillBlankProgress.item_id))
            .join(FillBlank)
            .where(FillBlank.group_id == group.id)
            .where(FillBlankProgress.user_id == current_user.id)
            .where(FillBlankProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/fill-blank/session", response_model=list[FillBlankRead])
def get_study_fill_blank_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = select(FillBlank).where(FillBlank.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(FillBlankProgress.item_id)
            .where(FillBlankProgress.user_id == current_user.id)
            .where(FillBlankProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/fill-blank/progress")
def update_fill_blank_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(FillBlankProgress)
        .where(FillBlankProgress.user_id == current_user.id)
        .where(FillBlankProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(FillBlank, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = FillBlankProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# ==========================================
# GAMIFICATION Endpoints
# ==========================================


class ScoreRequest(BaseModel):
    is_correct: bool
    is_known: bool
    level: Optional[str] = None
    item_id: Optional[uuid.UUID] = None


class ScoreResponse(BaseModel):
    points_delta: int
    new_total_points: int
    new_combo: int
    multiplier: float
    trigger_mini_game: bool
    message: Optional[str] = None


@app.post("/api/gamification/score", response_model=ScoreResponse)
def calculate_score_endpoint(
    req: ScoreRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Calculate score
    result = calculate_score(
        is_correct=req.is_correct,
        is_known=req.is_known,
        level=req.level,
        current_combo=current_user.current_streak  # Use stored streak as base
    )

    # Update User stats (ensure points don't go below 0)
    new_total = current_user.total_points + result["points_delta"]
    current_user.total_points = max(0, new_total)
    current_user.current_streak = result["new_combo_count"]

    if current_user.current_streak > current_user.highest_combo:
        current_user.highest_combo = current_user.current_streak

    session.add(current_user)
    session.commit()

    return ScoreResponse(
        points_delta=result["points_delta"],
        new_total_points=current_user.total_points,
        new_combo=current_user.current_streak,
        multiplier=result["multiplier"],
        trigger_mini_game=result["trigger_mini_game"],
    )


class WordleStartResponse(BaseModel):
    target_word: str
    language: TargetLanguage


@app.post("/minigame/wordle/start", response_model=WordleStartResponse)
def start_wordle(
    level: Optional[str] = "A1",
    current_user: User = Depends(get_current_user),
):
    # Use user's active language for Wordle
    language = current_user.active_language
    word = generate_wordle_word(level, language)
    return {"target_word": word, "language": language}


class WordleCheckRequest(BaseModel):
    target_word: str
    guess: str


@app.post("/minigame/wordle/check")
def check_wordle(req: WordleCheckRequest):
    result = check_wordle_guess(req.target_word, req.guess)
    return {"result": result}


@app.get("/user/profile/stats")
def get_user_stats(current_user: User = Depends(get_current_user)):
    return {
        "total_points": current_user.total_points,
        "highest_combo": current_user.highest_combo,
        "current_streak": current_user.current_streak,
    }


class ModeStatsResponse(BaseModel):
    total: int
    learned: int


class DashboardStatsResponse(BaseModel):
    """Complete dashboard statistics for student view."""

    # User points and streaks
    total_points: int
    highest_combo: int
    current_streak: int

    # Per-mode progress (with typed structure)
    fiszki: ModeStatsResponse
    translate_pl_fr: ModeStatsResponse
    translate_fr_pl: ModeStatsResponse
    guess_object: ModeStatsResponse
    fill_blank: ModeStatsResponse

    # Summary
    total_learned: int
    total_items: int

    # Level calculation
    level: str
    level_progress: float  # 0-100 percent to next level


def calculate_level(total_points: int) -> tuple[str, float]:
    """Calculate user level based on points."""
    levels = [
        (0, "Debiutant"),
        (100, "Nowicjusz"),
        (300, "Uczeń"),
        (600, "Adept"),
        (1000, "Początkujący"),
        (1500, "Średniozaawansowany"),
        (2500, "Zaawansowany"),
        (4000, "Ekspert"),
        (6000, "Mistrz"),
        (10000, "Legenda"),
    ]

    current_level = levels[0][1]
    next_threshold = levels[1][0] if len(levels) > 1 else levels[0][0]
    prev_threshold = 0

    for i, (threshold, name) in enumerate(levels):
        if total_points >= threshold:
            current_level = name
            prev_threshold = threshold
            if i + 1 < len(levels):
                next_threshold = levels[i + 1][0]
            else:
                next_threshold = threshold  # Max level
        else:
            break

    if next_threshold == prev_threshold:
        progress = 100.0
    else:
        progress = ((total_points - prev_threshold) / (next_threshold - prev_threshold)) * 100

    return current_level, min(progress, 100.0)


@app.get("/user/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive dashboard statistics for the current user, filtered by active language."""
    active_lang = current_user.active_language

    # Fiszki stats - filter by language
    fiszki_total = session.exec(
        select(func.count(Fiszka.id))
        .join(FiszkiGroup, Fiszka.group_id == FiszkiGroup.id)
        .where(FiszkiGroup.language == active_lang)
    ).one()
    fiszki_learned = session.exec(
        select(func.count(FiszkaProgress.fiszka_id))
        .join(Fiszka, FiszkaProgress.fiszka_id == Fiszka.id)
        .join(FiszkiGroup, Fiszka.group_id == FiszkiGroup.id)
        .where(FiszkaProgress.user_id == current_user.id)
        .where(FiszkaProgress.learned == True)
        .where(FiszkiGroup.language == active_lang)
    ).one()

    # Translate PL->Target stats - filter by language
    pl_fr_total = session.exec(
        select(func.count(TranslatePlToTarget.id))
        .join(TranslatePlToTargetGroup, TranslatePlToTarget.group_id == TranslatePlToTargetGroup.id)
        .where(TranslatePlToTargetGroup.language == active_lang)
    ).one()
    pl_fr_learned = session.exec(
        select(func.count(TranslatePlToTargetProgress.item_id))
        .join(TranslatePlToTarget, TranslatePlToTargetProgress.item_id == TranslatePlToTarget.id)
        .join(TranslatePlToTargetGroup, TranslatePlToTarget.group_id == TranslatePlToTargetGroup.id)
        .where(TranslatePlToTargetProgress.user_id == current_user.id)
        .where(TranslatePlToTargetProgress.learned == True)
        .where(TranslatePlToTargetGroup.language == active_lang)
    ).one()

    # Translate Target->PL stats - filter by language
    fr_pl_total = session.exec(
        select(func.count(TranslateTargetToPl.id))
        .join(TranslateTargetToPlGroup, TranslateTargetToPl.group_id == TranslateTargetToPlGroup.id)
        .where(TranslateTargetToPlGroup.language == active_lang)
    ).one()
    fr_pl_learned = session.exec(
        select(func.count(TranslateTargetToPlProgress.item_id))
        .join(TranslateTargetToPl, TranslateTargetToPlProgress.item_id == TranslateTargetToPl.id)
        .join(TranslateTargetToPlGroup, TranslateTargetToPl.group_id == TranslateTargetToPlGroup.id)
        .where(TranslateTargetToPlProgress.user_id == current_user.id)
        .where(TranslateTargetToPlProgress.learned == True)
        .where(TranslateTargetToPlGroup.language == active_lang)
    ).one()

    # Guess Object stats - filter by language
    guess_total = session.exec(
        select(func.count(GuessObject.id))
        .join(GuessObjectGroup, GuessObject.group_id == GuessObjectGroup.id)
        .where(GuessObjectGroup.language == active_lang)
    ).one()
    guess_learned = session.exec(
        select(func.count(GuessObjectProgress.item_id))
        .join(GuessObject, GuessObjectProgress.item_id == GuessObject.id)
        .join(GuessObjectGroup, GuessObject.group_id == GuessObjectGroup.id)
        .where(GuessObjectProgress.user_id == current_user.id)
        .where(GuessObjectProgress.learned == True)
        .where(GuessObjectGroup.language == active_lang)
    ).one()

    # Fill Blank stats - filter by language
    fill_total = session.exec(
        select(func.count(FillBlank.id))
        .join(FillBlankGroup, FillBlank.group_id == FillBlankGroup.id)
        .where(FillBlankGroup.language == active_lang)
    ).one()
    fill_learned = session.exec(
        select(func.count(FillBlankProgress.item_id))
        .join(FillBlank, FillBlankProgress.item_id == FillBlank.id)
        .join(FillBlankGroup, FillBlank.group_id == FillBlankGroup.id)
        .where(FillBlankProgress.user_id == current_user.id)
        .where(FillBlankProgress.learned == True)
        .where(FillBlankGroup.language == active_lang)
    ).one()

    total_learned = fiszki_learned + pl_fr_learned + fr_pl_learned + guess_learned + fill_learned
    total_items = fiszki_total + pl_fr_total + fr_pl_total + guess_total + fill_total

    level, level_progress = calculate_level(current_user.total_points)

    return DashboardStatsResponse(
        total_points=current_user.total_points,
        highest_combo=current_user.highest_combo,
        current_streak=current_user.current_streak,
        fiszki=ModeStatsResponse(total=fiszki_total, learned=fiszki_learned),
        translate_pl_fr=ModeStatsResponse(total=pl_fr_total, learned=pl_fr_learned),
        translate_fr_pl=ModeStatsResponse(total=fr_pl_total, learned=fr_pl_learned),
        guess_object=ModeStatsResponse(total=guess_total, learned=guess_learned),
        fill_blank=ModeStatsResponse(total=fill_total, learned=fill_learned),
        total_learned=total_learned,
        total_items=total_items,
        level=level,
        level_progress=level_progress,
    )


# ==========================================
# Admin: Generate Initial Content
# ==========================================

class GenerateContentRequest(BaseModel):
    group_count: int = 2
    items_per_group: int = 10

class GenerateContentResponse(BaseModel):
    success: bool
    message: str
    groups_created: int
    items_created: int


def get_next_ai_group_index(session: Session, GroupModel, language: TargetLanguage) -> int:
    """Znajdź najwyższy indeks grup 'Ai Generated X' i zwróć następny."""
    groups = session.exec(
        select(GroupModel).where(GroupModel.language == language)
    ).all()

    max_index = 0
    pattern = re.compile(r"Ai Generated (\d+)")

    for group in groups:
        match = pattern.search(group.name)
        if match:
            index = int(match.group(1))
            if index > max_index:
                max_index = index

    return max_index + 1


@app.post("/api/admin/generate-initial-content", response_model=GenerateContentResponse)
async def generate_initial_content_endpoint(
    request: GenerateContentRequest = GenerateContentRequest(),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    """
    Generate initial content for all learning modes (admin only).
    Używa równoległego przetwarzania dla szybszego generowania.
    Generuje treści w aktywnym języku użytkownika (FR lub EN).
    Grupy są nazwane 'Ai Generated X' z kolejnymi numerami.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    # Użyj aktywnego języka użytkownika
    active_lang = current_user.active_language
    lang_config = LANGUAGE_CONFIG[active_lang]
    lang_code = lang_config["code"]

    group_count = request.group_count
    items_per_group = request.items_per_group

    print("\n" + "=" * 50)
    print(f"GENERATING AI CONTENT (B1 level, {lang_code}) - {group_count} groups x {items_per_group} items")
    print("=" * 50)

    groups_created = 0
    items_created = 0

    content_types = [
        ("translate_pl_target", f"Tłumaczenie PL → {lang_code}", TranslatePlToTargetGroup, TranslatePlToTarget),
        ("translate_target_pl", f"Tłumaczenie {lang_code} → PL", TranslateTargetToPlGroup, TranslateTargetToPl),
        ("guess_object", "Zgadnij przedmiot", GuessObjectGroup, GuessObject),
        ("fill_blank", "Uzupełnij lukę", FillBlankGroup, FillBlank),
    ]

    for idx, (content_type, label, GroupModel, ItemModel) in enumerate(content_types, 1):
        print(f"\n[{idx}/4] Generowanie: {label}...", flush=True)

        # Znajdź następny indeks dla grup AI
        next_index = get_next_ai_group_index(session, GroupModel, active_lang)

        # Twórz grupy z kolejnymi numerami
        created_groups = []
        for i in range(group_count):
            group_name = f"Ai Generated {next_index + i}"
            group_desc = f"Wygenerowano automatycznie przez AI (B1, {lang_code})"
            group = GroupModel(name=group_name, description=group_desc, language=active_lang)
            session.add(group)
            session.commit()
            session.refresh(group)
            created_groups.append(group)
            groups_created += 1

        # Generuj zawartość równolegle (wszystkie grupy naraz)
        total_items_needed = items_per_group * len(created_groups)

        try:
            if content_type == "translate_pl_target" or content_type == "translate_target_pl":
                all_items = await generate_ai_content_parallel("B1", total_items_needed, "mixed", active_lang, batch_size=10)
            elif content_type == "guess_object":
                all_items = await generate_guess_object_parallel("B1", total_items_needed, active_lang, batch_size=10)
            elif content_type == "fill_blank":
                all_items = await generate_fill_blank_parallel("B1", total_items_needed, None, active_lang, batch_size=10)
            else:
                all_items = []

            # Rozdziel elementy między grupy
            items_per_group_actual = len(all_items) // len(created_groups) if created_groups else 0
            for i, group in enumerate(created_groups):
                start_idx = i * items_per_group_actual
                end_idx = start_idx + items_per_group_actual if i < len(created_groups) - 1 else len(all_items)
                group_items = all_items[start_idx:end_idx]

                for item in group_items:
                    try:
                        if content_type == "translate_pl_target":
                            if item.get("text_pl") and item.get("text_target"):
                                db_item = ItemModel(
                                    text_pl=item["text_pl"],
                                    text_target=item["text_target"],
                                    category=item.get("category", "mixed"),
                                    group_id=group.id
                                )
                                session.add(db_item)
                                items_created += 1
                        elif content_type == "translate_target_pl":
                            if item.get("text_pl") and item.get("text_target"):
                                db_item = ItemModel(
                                    text_target=item["text_target"],
                                    text_pl=item["text_pl"],
                                    category=item.get("category", "mixed"),
                                    group_id=group.id
                                )
                                session.add(db_item)
                                items_created += 1
                        elif content_type == "guess_object":
                            if item.get("description_target") and item.get("answer_target"):
                                db_item = ItemModel(
                                    description_target=item["description_target"],
                                    description_pl=item.get("description_pl"),
                                    answer_target=item["answer_target"],
                                    answer_pl=item.get("answer_pl"),
                                    category=item.get("category"),
                                    group_id=group.id
                                )
                                session.add(db_item)
                                items_created += 1
                        elif content_type == "fill_blank":
                            if item.get("sentence_with_blank") and item.get("answer"):
                                db_item = ItemModel(
                                    sentence_with_blank=item["sentence_with_blank"],
                                    sentence_pl=item.get("sentence_pl"),
                                    answer=item["answer"],
                                    full_sentence=item.get("full_sentence", ""),
                                    hint=item.get("hint"),
                                    grammar_focus=item.get("grammar_focus"),
                                    group_id=group.id
                                )
                                session.add(db_item)
                                items_created += 1
                    except Exception as e:
                        print(f"    Error adding item: {e}")

                session.commit()

            print(f"  ✓ {label} gotowe ({len(created_groups)} grup)", flush=True)
        except Exception as e:
            print(f"  ✗ Błąd: {e}", flush=True)

    print("\n" + "=" * 50)
    print(f"GENEROWANIE ZAKOŃCZONE! Język: {lang_code}, Grupy: {groups_created}, Elementy: {items_created}")
    print("=" * 50 + "\n", flush=True)

    return GenerateContentResponse(
        success=True,
        message=f"Wygenerowano {groups_created} grup i {items_created} elementów ({lang_code})",
        groups_created=groups_created,
        items_created=items_created
    )


