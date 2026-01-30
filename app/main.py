import datetime
import csv
import io
import os
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
from openai import OpenAI

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
    TranslatePlFrGroup,
    TranslatePlFrGroupCreate,
    TranslatePlFrGroupRead,
    TranslatePlFrGroupUpdate,
    TranslatePlFr,
    TranslatePlFrCreate,
    TranslatePlFrRead,
    TranslatePlFrUpdate,
    TranslatePlFrProgress,
    TranslateFrPlGroup,
    TranslateFrPlGroupCreate,
    TranslateFrPlGroupRead,
    TranslateFrPlGroupUpdate,
    TranslateFrPl,
    TranslateFrPlCreate,
    TranslateFrPlRead,
    TranslateFrPlUpdate,
    TranslateFrPlProgress,
    GroupStudyRead,
    ProgressUpdate,
    StudySessionRequest,
    GenerateRequest,
    GeneratedItem,
    BatchCreatePlFr,
    BatchCreateFrPl,
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
import json


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


def seed_generated_content():
    """Generate initial content for all learning modes using AI."""
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("WARNING: OPENAI_API_KEY not set, skipping content generation")
        return

    print("\n" + "=" * 50)
    print("GENERATING INITIAL CONTENT (B1 level)")
    print("=" * 50)

    client = OpenAI(api_key=api_key)

    group_names = [
        ("Zestaw startowy 1", "Podstawowe słownictwo i zwroty B1"),
        ("Zestaw startowy 2", "Rozszerzony zestaw B1"),
    ]

    with Session(engine) as session:
        # ========================================
        # TRANSLATE PL → FR
        # ========================================
        print("\n[1/4] Generowanie: Tłumaczenie PL → FR")
        for i, (name, desc) in enumerate(group_names):
            print(f"  Tworzenie grupy: {name}...")
            group = TranslatePlFrGroup(name=f"PL→FR: {name}", description=desc)
            session.add(group)
            session.commit()
            session.refresh(group)

            print(f"  Generowanie 20 elementów dla grupy '{name}'...")
            try:
                prompt = f"""Wygeneruj 20 par zdań PL-FR na poziomie B1. Mieszanka: słownictwo, gramatyka, zwroty.
Format JSON (bez dodatkowego tekstu):
[{{"text_pl": "...", "text_fr": "...", "category": "mixed"}}]"""
                response = client.responses.create(model="gpt-5-nano", input=prompt)
                output_text = response.output_text.strip()
                if output_text.startswith("```json"):
                    output_text = output_text[7:]
                if output_text.endswith("```"):
                    output_text = output_text[:-3]
                items = json.loads(output_text.strip())

                count = 0
                for item in items:
                    if item.get("text_pl") and item.get("text_fr"):
                        db_item = TranslatePlFr(
                            text_pl=item["text_pl"],
                            text_fr=item["text_fr"],
                            category=item.get("category", "mixed"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        count += 1
                session.commit()
                print(f"  ✓ Dodano {count} elementów do grupy {i+1}/2")
            except Exception as e:
                print(f"  ✗ Błąd generowania: {e}")

        # ========================================
        # TRANSLATE FR → PL
        # ========================================
        print("\n[2/4] Generowanie: Tłumaczenie FR → PL")
        for i, (name, desc) in enumerate(group_names):
            print(f"  Tworzenie grupy: {name}...")
            group = TranslateFrPlGroup(name=f"FR→PL: {name}", description=desc)
            session.add(group)
            session.commit()
            session.refresh(group)

            print(f"  Generowanie 20 elementów dla grupy '{name}'...")
            try:
                prompt = f"""Wygeneruj 20 par zdań FR-PL na poziomie B1. Mieszanka: słownictwo, gramatyka, zwroty.
Format JSON (bez dodatkowego tekstu):
[{{"text_fr": "...", "text_pl": "...", "category": "mixed"}}]"""
                response = client.responses.create(model="gpt-5-nano", input=prompt)
                output_text = response.output_text.strip()
                if output_text.startswith("```json"):
                    output_text = output_text[7:]
                if output_text.endswith("```"):
                    output_text = output_text[:-3]
                items = json.loads(output_text.strip())

                count = 0
                for item in items:
                    if item.get("text_fr") and item.get("text_pl"):
                        db_item = TranslateFrPl(
                            text_fr=item["text_fr"],
                            text_pl=item["text_pl"],
                            category=item.get("category", "mixed"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        count += 1
                session.commit()
                print(f"  ✓ Dodano {count} elementów do grupy {i+1}/2")
            except Exception as e:
                print(f"  ✗ Błąd generowania: {e}")

        # ========================================
        # GUESS OBJECT (Zgadnij)
        # ========================================
        print("\n[3/4] Generowanie: Zgadnij przedmiot")
        for i, (name, desc) in enumerate(group_names):
            print(f"  Tworzenie grupy: {name}...")
            group = GuessObjectGroup(name=f"Zgadnij: {name}", description=desc)
            session.add(group)
            session.commit()
            session.refresh(group)

            print(f"  Generowanie 20 zagadek dla grupy '{name}'...")
            try:
                prompt = """Wygeneruj 20 zagadek słownych po francusku na poziomie B1.
Cechy:
- Przedmioty i pojęcia bardziej abstrakcyjne, opisy 2-3 zdania ze szczegółami
- Opis powinien dawać wskazówki, ale nie zdradzać odpowiedzi wprost
- Odpowiedź MUSI zawierać rodzajnik (le/la/un/une/l')
- Dodaj polskie tłumaczenie opisu i odpowiedzi
- Kategorie: fruits, animals, furniture, tools, transport, food, nature, abstract, profession

Format JSON (bez dodatkowego tekstu):
[{"description_fr": "opis po francusku", "description_pl": "opis po polsku", "answer_fr": "odpowiedź z rodzajnikiem", "answer_pl": "odpowiedź po polsku", "category": "kategoria"}]"""
                response = client.responses.create(model="gpt-5-nano", input=prompt)
                output_text = response.output_text.strip()
                if output_text.startswith("```json"):
                    output_text = output_text[7:]
                if output_text.endswith("```"):
                    output_text = output_text[:-3]
                items = json.loads(output_text.strip())

                count = 0
                for item in items:
                    if item.get("description_fr") and item.get("answer_fr"):
                        db_item = GuessObject(
                            description_fr=item["description_fr"],
                            description_pl=item.get("description_pl"),
                            answer_fr=item["answer_fr"],
                            answer_pl=item.get("answer_pl"),
                            category=item.get("category"),
                            group_id=group.id
                        )
                        session.add(db_item)
                        count += 1
                session.commit()
                print(f"  ✓ Dodano {count} zagadek do grupy {i+1}/2")
            except Exception as e:
                print(f"  ✗ Błąd generowania: {e}")

        # ========================================
        # FILL BLANK (Uzupełnij)
        # ========================================
        print("\n[4/4] Generowanie: Uzupełnij lukę")
        for i, (name, desc) in enumerate(group_names):
            print(f"  Tworzenie grupy: {name}...")
            group = FillBlankGroup(name=f"Uzupełnij: {name}", description=desc)
            session.add(group)
            session.commit()
            session.refresh(group)

            print(f"  Generowanie 20 ćwiczeń dla grupy '{name}'...")
            try:
                prompt = """Wygeneruj 20 ćwiczeń "uzupełnij lukę" po francusku na poziomie B1.

Wytyczne: imparfait vs passé composé, zaimki y/en, przyimki z krajami (en/au/aux)

Zasady:
- Luka oznaczona jako ___ (trzy podkreślniki)
- Każda luka testuje konkretną wiedzę gramatyczną
- Odpowiedź musi być jednoznaczna
- Hint naprowadza na kategorię gramatyczną
- grammar_focus: verb | article | preposition | pronoun | agreement
- Dodaj polskie tłumaczenie pełnego zdania

Format JSON (bez dodatkowego tekstu):
[{"sentence_with_blank": "zdanie z ___", "sentence_pl": "polskie tłumaczenie", "answer": "odpowiedź", "full_sentence": "pełne zdanie FR", "hint": "podpowiedź", "grammar_focus": "kategoria"}]"""
                response = client.responses.create(model="gpt-5-nano", input=prompt)
                output_text = response.output_text.strip()
                if output_text.startswith("```json"):
                    output_text = output_text[7:]
                if output_text.endswith("```"):
                    output_text = output_text[:-3]
                items = json.loads(output_text.strip())

                count = 0
                for item in items:
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
                        count += 1
                session.commit()
                print(f"  ✓ Dodano {count} ćwiczeń do grupy {i+1}/2")
            except Exception as e:
                print(f"  ✗ Błąd generowania: {e}")

    print("\n" + "=" * 50)
    print("GENEROWANIE ZAKOŃCZONE!")
    print("Utworzono: 8 grup (2 na każdy tryb), ~160 elementów")
    print("=" * 50 + "\n")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ============================================================
    # RESET DATABASE ON STARTUP - SET TO False AFTER FIRST DEPLOY
    # ============================================================
    RESET_DB_ON_STARTUP = True  # <-- Change to False to keep data
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


@event.listens_for(TranslatePlFrGroup, "before_update")
def update_translateplfrgroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslatePlFr, "before_update")
def update_translateplfr_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslateFrPlGroup, "before_update")
def update_translatefrplgroup_timestamp(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)


@event.listens_for(TranslateFrPl, "before_update")
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
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

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
    """Tłumaczy tekst używając OpenAI."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
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
def generate_ai_content(level: str, count: int, category: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje pary zdań z opcjonalną kategorią dla wybranego języka."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
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
[{{"text_pl": "...", "text_{lang_code.lower()}": "...", "category": "{cat_name}"}}]"""

        response = client.responses.create(model="gpt-5-nano", input=prompt)

        usage_info = getattr(response, "usage", "N/A")
        print(f"\n\nToken usage: {usage_info}")

        output_text = response.output_text.strip()
        if output_text.startswith("```json"):
            output_text = output_text[7:]
        if output_text.endswith("```"):
            output_text = output_text[:-3]

        # Normalize the response to always use text_fr key for compatibility
        items = json.loads(output_text.strip())
        for item in items:
            # Handle both text_fr and text_en keys, normalize to text_fr
            if f"text_{lang_code.lower()}" in item and "text_fr" not in item:
                item["text_fr"] = item[f"text_{lang_code.lower()}"]
        return items
    except Exception as e:
        print(f"Generation Error: {e}")
        return []


@app.post("/api/ai/generate", response_model=list[GeneratedItem])
def generate_sentences_endpoint(request: GenerateRequest, current_user: User = Depends(get_current_superuser)):
    # Verify count limit to prevent abuse
    if request.count > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 sentences at once")

    generated_data = generate_ai_content(request.level, request.count, request.category, current_user.active_language)

    # Map to GeneratedItem
    items = []
    for item in generated_data:
        # data might use 'text_target' or 'text_fr' depending on AI whim, harmonize here
        t_fr = item.get("text_fr") or item.get("text_target")
        if item.get("text_pl") and t_fr:
            items.append(GeneratedItem(
                text_pl=item.get("text_pl"),
                text_fr=t_fr,
                category=item.get("category", request.category)
            ))

    return items


# Helper for AI Answer Verification
def verify_answer_with_ai(question: str, expected_answer: str, user_answer: str, task_type: str, language: TargetLanguage = TargetLanguage.FR) -> dict:
    """Weryfikuje odpowiedź użytkownika używając AI."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        lang_config = LANGUAGE_CONFIG[language]
        lang_name = lang_config["name"]

        task_descriptions = {
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
        output_text = response.output_text.strip()

        # Clean up JSON if wrapped in markdown
        if output_text.startswith("```json"):
            output_text = output_text[7:]
        if output_text.startswith("```"):
            output_text = output_text[3:]
        if output_text.endswith("```"):
            output_text = output_text[:-3]

        return json.loads(output_text.strip())
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
    valid_types = ["translate_pl_fr", "translate_fr_pl", "fill_blank"]
    if request.task_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid task_type. Must be one of: {valid_types}")
    
    # Call AI verification
    ai_result = verify_answer_with_ai(
        question=request.question,
        expected_answer=request.expected_answer,
        user_answer=request.user_answer,
        task_type=request.task_type
    )
    
    is_correct = ai_result.get("is_correct", False)
    explanation = ai_result.get("explanation", "Brak wyjaśnienia")
    answer_added = False
    
    if is_correct:
        # Add user's answer as alternative and update progress
        item = None
        progress_model = None
        
        if request.task_type == "translate_pl_fr":
            item = session.get(TranslatePlFr, request.item_id)
            progress_model = TranslatePlFrProgress
        elif request.task_type == "translate_fr_pl":
            item = session.get(TranslateFrPl, request.item_id)
            progress_model = TranslateFrPlProgress
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

    expected_headers = {"text_pl", "text_fr"}
    if not csv_reader.fieldnames or not expected_headers.issubset(set(csv_reader.fieldnames)):
        raise HTTPException(status_code=400, detail=f"CSV must contain headers: {', '.join(expected_headers)}")

    count = 0
    for row in csv_reader:
        fiszka = Fiszka(
            text_pl=row["text_pl"], text_fr=row["text_fr"], image_url=row.get("image_url"), group_id=group_id
        )
        session.add(fiszka)
        count += 1

    session.commit()
    return {"message": f"Successfully imported {count} fiszki"}


# ==========================================
# TRANSLATE PL -> FR Endpoints
# ==========================================


@app.get("/translate-pl-fr/groups/", response_model=list[TranslatePlFrGroupRead])
def get_pl_fr_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup tłumaczeń PL->FR, opcjonalnie filtrowanych po języku"""
    query = select(TranslatePlFrGroup)
    if language:
        query = query.where(TranslatePlFrGroup.language == language)
    return session.exec(query).all()


@app.post("/translate-pl-fr/groups/", response_model=TranslatePlFrGroupRead)
def create_pl_fr_group(
    group: TranslatePlFrGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = TranslatePlFrGroup(**group.model_dump())
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
    # Handling plain list of strings or headerless - user said "podajemy tylko zdanie w języku polskim(jedna kolumna)"
    # We'll assume header 'text_pl' OR just read first column if header is missing/simple.

    csv_file = io.StringIO(decoded_content)

    # Robust reading strategy:
    # 1. Read all lines
    # 2. Check if first line looks like a header (contains 'text_pl')
    # 3. If yes, use DictReader or just skip first line and read column.
    # 4. If no, assume data starts immediately.

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
    for text_pl in sentences:
        if not text_pl.strip():
            continue

        # Translate
        text_fr = get_translation(text_pl, target_lang="francuski")

        item = TranslatePlFr(text_pl=text_pl, text_fr=text_fr, group_id=group_id)
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Imported {count} items with translations"}


@app.get("/translate-pl-fr/items/", response_model=list[TranslatePlFrRead])
def get_pl_fr_items(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.exec(select(TranslatePlFr).where(TranslatePlFr.group_id == group_id)).all()


@app.put("/translate-pl-fr/groups/{group_id}", response_model=TranslatePlFrGroupRead)
def update_pl_fr_group(
    group_id: uuid.UUID,
    group_data: TranslatePlFrGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(TranslatePlFrGroup, group_id)
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
    group = session.get(TranslatePlFrGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.post("/translate-pl-fr/items/", response_model=TranslatePlFrRead)
def create_pl_fr_item(
    item: TranslatePlFrCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_item = TranslatePlFr.model_validate(item)
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@app.put("/translate-pl-fr/items/{item_id}", response_model=TranslatePlFrRead)
def update_pl_fr_item(
    item_id: uuid.UUID,
    item_data: TranslatePlFrUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(TranslatePlFr, item_id)
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
    item = session.get(TranslatePlFr, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}


@app.post("/translate-pl-fr/items/batch", response_model=list[TranslatePlFrRead])
def batch_create_pl_fr_items(
    batch: BatchCreatePlFr,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    created_items = []
    for item_data in batch.items:
        # Ensure group_id is set
        db_item = TranslatePlFr(
            text_pl=item_data.text_pl,
            text_fr=item_data.text_fr,
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
# TRANSLATE FR -> PL Endpoints
# ==========================================


@app.get("/translate-fr-pl/groups/", response_model=list[TranslateFrPlGroupRead])
def get_fr_pl_groups(
    session: Session = Depends(get_session),
    language: Optional[TargetLanguage] = None,
):
    """Pobierz listę grup tłumaczeń FR->PL, opcjonalnie filtrowanych po języku"""
    query = select(TranslateFrPlGroup)
    if language:
        query = query.where(TranslateFrPlGroup.language == language)
    return session.exec(query).all()


@app.post("/translate-fr-pl/groups/", response_model=TranslateFrPlGroupRead)
def create_fr_pl_group(
    group: TranslateFrPlGroupCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_group = TranslateFrPlGroup(**group.model_dump())
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
    # Simple extraction logic same as above
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
    for i in range(start_idx, len(rows)):
        row = rows[i]
        if not row:
            continue
        text_pl = row[0]
        if not text_pl.strip():
            continue

        text_fr = get_translation(text_pl, target_lang="francuski")

        item = TranslateFrPl(
            text_fr=text_fr,  # Question
            text_pl=text_pl,  # Answer
            group_id=group_id,
        )
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Imported {count} items with translations"}


@app.get("/translate-fr-pl/items/", response_model=list[TranslateFrPlRead])
def get_fr_pl_items(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.exec(select(TranslateFrPl).where(TranslateFrPl.group_id == group_id)).all()


@app.put("/translate-fr-pl/groups/{group_id}", response_model=TranslateFrPlGroupRead)
def update_fr_pl_group(
    group_id: uuid.UUID,
    group_data: TranslateFrPlGroupUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    group = session.get(TranslateFrPlGroup, group_id)
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
    group = session.get(TranslateFrPlGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    session.delete(group)
    session.commit()
    return {"message": "Group deleted successfully"}


@app.post("/translate-fr-pl/items/", response_model=TranslateFrPlRead)
def create_fr_pl_item(
    item: TranslateFrPlCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    new_item = TranslateFrPl.model_validate(item)
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    return new_item


@app.put("/translate-fr-pl/items/{item_id}", response_model=TranslateFrPlRead)
def update_fr_pl_item(
    item_id: uuid.UUID,
    item_data: TranslateFrPlUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    item = session.get(TranslateFrPl, item_id)
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
    item = session.get(TranslateFrPl, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"message": "Item deleted successfully"}


@app.post("/translate-fr-pl/items/batch", response_model=list[TranslateFrPlRead])
def batch_create_fr_pl_items(
    batch: BatchCreateFrPl,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    created_items = []
    for item_data in batch.items:
        db_item = TranslateFrPl(
            text_fr=item_data.text_fr,
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
def get_study_pl_fr_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(TranslatePlFrGroup).where(TranslatePlFrGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslatePlFr.id)).where(TranslatePlFr.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslatePlFrProgress.item_id))
            .join(TranslatePlFr)
            .where(TranslatePlFr.group_id == group.id)
            .where(TranslatePlFrProgress.user_id == current_user.id)
            .where(TranslatePlFrProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/translate-pl-fr/session", response_model=list[TranslatePlFrRead])
def get_study_pl_fr_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import random

    statement = select(TranslatePlFr).where(TranslatePlFr.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(TranslatePlFrProgress.item_id)
            .where(TranslatePlFrProgress.user_id == current_user.id)
            .where(TranslatePlFrProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/translate-pl-fr/progress")
def update_pl_fr_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(TranslatePlFrProgress)
        .where(TranslatePlFrProgress.user_id == current_user.id)
        .where(TranslatePlFrProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(TranslatePlFr, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = TranslatePlFrProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# Translate Target Language -> PL Study
@app.get("/study/translate-fr-pl/groups", response_model=list[GroupStudyRead])
def get_study_fr_pl_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    language: Optional[TargetLanguage] = None,
):
    # Filter by language - use user's active language if not specified
    active_lang = language or current_user.active_language
    groups = session.exec(select(TranslateFrPlGroup).where(TranslateFrPlGroup.language == active_lang)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslateFrPl.id)).where(TranslateFrPl.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslateFrPlProgress.item_id))
            .join(TranslateFrPl)
            .where(TranslateFrPl.group_id == group.id)
            .where(TranslateFrPlProgress.user_id == current_user.id)
            .where(TranslateFrPlProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, language=group.language, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups


@app.post("/study/translate-fr-pl/session", response_model=list[TranslateFrPlRead])
def get_study_fr_pl_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    import random

    statement = select(TranslateFrPl).where(TranslateFrPl.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(TranslateFrPlProgress.item_id)
            .where(TranslateFrPlProgress.user_id == current_user.id)
            .where(TranslateFrPlProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    random.shuffle(candidates)
    return candidates[: request.limit]


@app.post("/study/translate-fr-pl/progress")
def update_fr_pl_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(TranslateFrPlProgress)
        .where(TranslateFrPlProgress.user_id == current_user.id)
        .where(TranslateFrPlProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(TranslateFrPl, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = TranslateFrPlProgress(
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
    return session.exec(query).all()


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
            description_fr=item_data.description_fr,
            description_pl=item_data.description_pl,
            answer_fr=item_data.answer_fr,
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

    expected_headers = {"description_fr", "answer_fr"}
    if not csv_reader.fieldnames or not expected_headers.issubset(set(csv_reader.fieldnames)):
        raise HTTPException(status_code=400, detail=f"CSV must contain headers: {', '.join(expected_headers)}")

    count = 0
    for row in csv_reader:
        item = GuessObject(
            description_fr=row["description_fr"], answer_fr=row["answer_fr"], hint=row.get("hint"), group_id=group_id
        )
        session.add(item)
        count += 1

    session.commit()
    return {"message": f"Successfully imported {count} items"}


# AI Generation for Guess Object
def generate_guess_object_ai_content(level: str, count: int, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje zagadki słowne w wybranym języku z polskimi tłumaczeniami."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
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

        # Article instruction based on language
        article_instruction = ""
        if language == TargetLanguage.FR:
            article_instruction = "- Odpowiedź MUSI zawierać rodzajnik (le/la/un/une/l')"
        elif language == TargetLanguage.EN:
            article_instruction = "- Odpowiedź MUSI zawierać przedimek (a/an/the) jeśli to wymagane"

        prompt = f"""Wygeneruj {count} zagadek słownych po {lang_name}u na poziomie {level}.
Cechy:
- {instruction}
- Opis powinien dawać wskazówki, ale nie zdradzać odpowiedzi wprost
{article_instruction}
- Każda zagadka powinna być unikalna
- Dodaj polskie tłumaczenie opisu i odpowiedzi
- Określ kategorię przedmiotu (fruits, animals, furniture, tools, transport, food, nature, abstract, profession, instrument)

Format JSON (bez dodatkowego tekstu):
[{{"description_{lang_code.lower()}": "opis po {lang_name}u", "description_pl": "opis po polsku", "answer_{lang_code.lower()}": "odpowiedź", "answer_pl": "odpowiedź po polsku", "category": "kategoria"}}]"""

        response = client.responses.create(model="gpt-5-nano", input=prompt)

        output_text = response.output_text.strip()
        if output_text.startswith("```json"):
            output_text = output_text[7:]
        if output_text.endswith("```"):
            output_text = output_text[:-3]

        # Normalize response keys to description_fr and answer_fr for compatibility
        items = json.loads(output_text.strip())
        for item in items:
            if f"description_{lang_code.lower()}" in item and "description_fr" not in item:
                item["description_fr"] = item[f"description_{lang_code.lower()}"]
            if f"answer_{lang_code.lower()}" in item and "answer_fr" not in item:
                item["answer_fr"] = item[f"answer_{lang_code.lower()}"]
        return items
    except Exception as e:
        print(f"Guess Object Generation Error: {e}")
        return []


@app.post("/api/ai/generate-guess-object", response_model=list[GeneratedGuessObjectItem])
def generate_guess_object_endpoint(
    request: GenerateGuessObjectRequest, current_user: User = Depends(get_current_superuser)
):
    if request.count > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 items at once")

    generated_data = generate_guess_object_ai_content(request.level, request.count, current_user.active_language)

    items = []
    for item in generated_data:
        if item.get("description_fr") and item.get("answer_fr"):
            items.append(
                GeneratedGuessObjectItem(
                    description_fr=item["description_fr"],
                    description_pl=item.get("description_pl"),
                    answer_fr=item["answer_fr"],
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
def generate_fill_blank_ai_content(level: str, count: int, grammar_focus: Optional[str] = None, language: TargetLanguage = TargetLanguage.FR) -> list[dict]:
    """Generuje ćwiczenia z lukami w wybranym języku z polskimi tłumaczeniami."""
    try:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        lang_config = LANGUAGE_CONFIG[language]
        lang_name = lang_config["name"]
        lang_code = lang_config["code"]

        # Language-specific grammar focus
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

        grammar_instruction = level_grammar.get(level, level_grammar["B1"])

        focus_instruction = ""
        if grammar_focus:
            focus_instruction = focus_map.get(grammar_focus, "")

        prompt = f"""Wygeneruj {count} ćwiczeń "uzupełnij lukę" po {lang_name}u na poziomie {level}.

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

        response = client.responses.create(model="gpt-5-nano", input=prompt)

        output_text = response.output_text.strip()
        if output_text.startswith("```json"):
            output_text = output_text[7:]
        if output_text.endswith("```"):
            output_text = output_text[:-3]

        return json.loads(output_text.strip())
    except Exception as e:
        print(f"Fill Blank Generation Error: {e}")
        return []


@app.post("/api/ai/generate-fill-blank", response_model=list[GeneratedFillBlankItem])
def generate_fill_blank_endpoint(
    request: GenerateFillBlankRequest, current_user: User = Depends(get_current_superuser)
):
    if request.count > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 items at once")

    generated_data = generate_fill_blank_ai_content(request.level, request.count, request.grammar_focus, current_user.active_language)

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

    # Translate PL->FR stats - filter by language
    pl_fr_total = session.exec(
        select(func.count(TranslatePlFr.id))
        .join(TranslatePlFrGroup, TranslatePlFr.group_id == TranslatePlFrGroup.id)
        .where(TranslatePlFrGroup.language == active_lang)
    ).one()
    pl_fr_learned = session.exec(
        select(func.count(TranslatePlFrProgress.item_id))
        .join(TranslatePlFr, TranslatePlFrProgress.item_id == TranslatePlFr.id)
        .join(TranslatePlFrGroup, TranslatePlFr.group_id == TranslatePlFrGroup.id)
        .where(TranslatePlFrProgress.user_id == current_user.id)
        .where(TranslatePlFrProgress.learned == True)
        .where(TranslatePlFrGroup.language == active_lang)
    ).one()

    # Translate FR->PL stats - filter by language
    fr_pl_total = session.exec(
        select(func.count(TranslateFrPl.id))
        .join(TranslateFrPlGroup, TranslateFrPl.group_id == TranslateFrPlGroup.id)
        .where(TranslateFrPlGroup.language == active_lang)
    ).one()
    fr_pl_learned = session.exec(
        select(func.count(TranslateFrPlProgress.item_id))
        .join(TranslateFrPl, TranslateFrPlProgress.item_id == TranslateFrPl.id)
        .join(TranslateFrPlGroup, TranslateFrPl.group_id == TranslateFrPlGroup.id)
        .where(TranslateFrPlProgress.user_id == current_user.id)
        .where(TranslateFrPlProgress.learned == True)
        .where(TranslateFrPlGroup.language == active_lang)
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

class GenerateContentResponse(BaseModel):
    success: bool
    message: str
    groups_created: int
    items_created: int


@app.post("/api/admin/generate-initial-content", response_model=GenerateContentResponse)
def generate_initial_content_endpoint(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_superuser),
):
    """Generate initial content for all learning modes (admin only)."""
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    print("\n" + "=" * 50)
    print("GENERATING INITIAL CONTENT (B1 level)")
    print("=" * 50)

    client = OpenAI(api_key=api_key)
    groups_created = 0
    items_created = 0

    group_names = [
        ("Zestaw startowy 1", "Podstawowe słownictwo i zwroty B1"),
        ("Zestaw startowy 2", "Rozszerzony zestaw B1"),
    ]

    # ========================================
    # TRANSLATE PL → FR
    # ========================================
    print("\n[1/4] Generowanie: Tłumaczenie PL → FR")
    for i, (name, desc) in enumerate(group_names):
        print(f"  Tworzenie grupy: {name}...", flush=True)
        group = TranslatePlFrGroup(name=f"PL→FR: {name}", description=desc)
        session.add(group)
        session.commit()
        session.refresh(group)
        groups_created += 1

        print(f"  Generowanie 20 elementów...", flush=True)
        try:
            prompt = f"""Wygeneruj 20 par zdań PL-FR na poziomie B1. Mieszanka: słownictwo, gramatyka, zwroty.
Format JSON (bez dodatkowego tekstu):
[{{"text_pl": "...", "text_fr": "...", "category": "mixed"}}]"""
            response = client.responses.create(model="gpt-5-nano", input=prompt)
            output_text = response.output_text.strip()
            if output_text.startswith("```json"):
                output_text = output_text[7:]
            if output_text.endswith("```"):
                output_text = output_text[:-3]
            items = json.loads(output_text.strip())

            for item in items:
                if item.get("text_pl") and item.get("text_fr"):
                    db_item = TranslatePlFr(
                        text_pl=item["text_pl"],
                        text_fr=item["text_fr"],
                        category=item.get("category", "mixed"),
                        group_id=group.id
                    )
                    session.add(db_item)
                    items_created += 1
            session.commit()
            print(f"  ✓ Grupa {i+1}/2 gotowa", flush=True)
        except Exception as e:
            print(f"  ✗ Błąd: {e}", flush=True)

    # ========================================
    # TRANSLATE FR → PL
    # ========================================
    print("\n[2/4] Generowanie: Tłumaczenie FR → PL", flush=True)
    for i, (name, desc) in enumerate(group_names):
        print(f"  Tworzenie grupy: {name}...", flush=True)
        group = TranslateFrPlGroup(name=f"FR→PL: {name}", description=desc)
        session.add(group)
        session.commit()
        session.refresh(group)
        groups_created += 1

        print(f"  Generowanie 20 elementów...", flush=True)
        try:
            prompt = f"""Wygeneruj 20 par zdań FR-PL na poziomie B1. Mieszanka: słownictwo, gramatyka, zwroty.
Format JSON (bez dodatkowego tekstu):
[{{"text_fr": "...", "text_pl": "...", "category": "mixed"}}]"""
            response = client.responses.create(model="gpt-5-nano", input=prompt)
            output_text = response.output_text.strip()
            if output_text.startswith("```json"):
                output_text = output_text[7:]
            if output_text.endswith("```"):
                output_text = output_text[:-3]
            items = json.loads(output_text.strip())

            for item in items:
                if item.get("text_fr") and item.get("text_pl"):
                    db_item = TranslateFrPl(
                        text_fr=item["text_fr"],
                        text_pl=item["text_pl"],
                        category=item.get("category", "mixed"),
                        group_id=group.id
                    )
                    session.add(db_item)
                    items_created += 1
            session.commit()
            print(f"  ✓ Grupa {i+1}/2 gotowa", flush=True)
        except Exception as e:
            print(f"  ✗ Błąd: {e}", flush=True)

    # ========================================
    # GUESS OBJECT
    # ========================================
    print("\n[3/4] Generowanie: Zgadnij przedmiot", flush=True)
    for i, (name, desc) in enumerate(group_names):
        print(f"  Tworzenie grupy: {name}...", flush=True)
        group = GuessObjectGroup(name=f"Zgadnij: {name}", description=desc)
        session.add(group)
        session.commit()
        session.refresh(group)
        groups_created += 1

        print(f"  Generowanie 20 zagadek...", flush=True)
        try:
            prompt = """Wygeneruj 20 zagadek słownych po francusku na poziomie B1.
Opis 2-3 zdania, odpowiedź z rodzajnikiem (le/la/un/une).
Format JSON:
[{"description_fr": "...", "description_pl": "...", "answer_fr": "...", "answer_pl": "...", "category": "..."}]"""
            response = client.responses.create(model="gpt-5-nano", input=prompt)
            output_text = response.output_text.strip()
            if output_text.startswith("```json"):
                output_text = output_text[7:]
            if output_text.endswith("```"):
                output_text = output_text[:-3]
            items = json.loads(output_text.strip())

            for item in items:
                if item.get("description_fr") and item.get("answer_fr"):
                    db_item = GuessObject(
                        description_fr=item["description_fr"],
                        description_pl=item.get("description_pl"),
                        answer_fr=item["answer_fr"],
                        answer_pl=item.get("answer_pl"),
                        category=item.get("category"),
                        group_id=group.id
                    )
                    session.add(db_item)
                    items_created += 1
            session.commit()
            print(f"  ✓ Grupa {i+1}/2 gotowa", flush=True)
        except Exception as e:
            print(f"  ✗ Błąd: {e}", flush=True)

    # ========================================
    # FILL BLANK
    # ========================================
    print("\n[4/4] Generowanie: Uzupełnij lukę", flush=True)
    for i, (name, desc) in enumerate(group_names):
        print(f"  Tworzenie grupy: {name}...", flush=True)
        group = FillBlankGroup(name=f"Uzupełnij: {name}", description=desc)
        session.add(group)
        session.commit()
        session.refresh(group)
        groups_created += 1

        print(f"  Generowanie 20 ćwiczeń...", flush=True)
        try:
            prompt = """Wygeneruj 20 ćwiczeń "uzupełnij lukę" po francusku na poziomie B1.
Luka jako ___. Odpowiedź jednoznaczna.
Format JSON:
[{"sentence_with_blank": "...", "sentence_pl": "...", "answer": "...", "full_sentence": "...", "hint": "...", "grammar_focus": "verb|article|preposition|pronoun|agreement"}]"""
            response = client.responses.create(model="gpt-5-nano", input=prompt)
            output_text = response.output_text.strip()
            if output_text.startswith("```json"):
                output_text = output_text[7:]
            if output_text.endswith("```"):
                output_text = output_text[:-3]
            items = json.loads(output_text.strip())

            for item in items:
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
            session.commit()
            print(f"  ✓ Grupa {i+1}/2 gotowa", flush=True)
        except Exception as e:
            print(f"  ✗ Błąd: {e}", flush=True)

    print("\n" + "=" * 50)
    print(f"GENEROWANIE ZAKOŃCZONE! Grupy: {groups_created}, Elementy: {items_created}")
    print("=" * 50 + "\n", flush=True)

    return GenerateContentResponse(
        success=True,
        message=f"Wygenerowano {groups_created} grup i {items_created} elementów",
        groups_created=groups_created,
        items_created=items_created
    )


