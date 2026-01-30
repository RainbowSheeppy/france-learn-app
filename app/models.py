import datetime
import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel, Relationship


class TargetLanguage(str, Enum):
    FR = "fr"
    EN = "en"


class BaseModel(SQLModel):
    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime.datetime = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))
    updated_at: datetime.datetime = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))


class BaseUser(SQLModel):
    name: str
    email: str = Field(unique=True, index=True)


class User(BaseModel, BaseUser, table=True):
    password_hash: str
    is_superuser: bool = Field(default=False)
    total_points: int = Field(default=0)
    current_streak: int = Field(default=0)
    highest_combo: int = Field(default=0)
    active_language: TargetLanguage = Field(default=TargetLanguage.FR)


class UserCreate(BaseUser):
    password: str


class UserRead(BaseModel, BaseUser):
    is_superuser: bool = False


class Token(PydanticBaseModel):
    access_token: str
    token_type: str


class TokenData(PydanticBaseModel):
    email: str | None = None


# Fiszki Group Models
class FiszkiGroupBase(SQLModel):
    name: str
    description: Optional[str] = None
    language: TargetLanguage = Field(default=TargetLanguage.FR, index=True)


class FiszkiGroup(BaseModel, FiszkiGroupBase, table=True):
    __tablename__ = "fiszkigroup"
    fiszki: list["Fiszka"] = Relationship(back_populates="group")


class FiszkiGroupCreate(FiszkiGroupBase):
    pass


class FiszkiGroupRead(BaseModel, FiszkiGroupBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class FiszkiGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[TargetLanguage] = None


# Fiszka Models
class FiszkaBase(SQLModel):
    text_pl: str
    text_fr: str
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fiszkigroup.id")


class Fiszka(BaseModel, FiszkaBase, table=True):
    group: Optional[FiszkiGroup] = Relationship(back_populates="fiszki")


class FiszkaCreate(FiszkaBase):
    pass


class FiszkaRead(BaseModel, FiszkaBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class FiszkaUpdate(SQLModel):
    text_pl: Optional[str] = None
    text_fr: Optional[str] = None
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = None


class BaseProgress(SQLModel):
    last_reviewed: datetime.datetime = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc))


class BaseLearningProgress(BaseProgress):
    learned: bool = Field(default=False)
    # half_learned: bool = Field(default=False) # Only for Fiszki? Assuming yes based on requirement "analogicznie jak fiszki" but modes might differ.
    # Logic for Translation text-only might not need image, but structure is requested "analogous".
    # Fiszki had: learned, half_learned, mistake.
    # User said: "Dostępność i widoczność taka sama jak dla fiszek... progress"
    # So I will replicate fields.


class FiszkaProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    fiszka_id: uuid.UUID = Field(foreign_key="fiszka.id", primary_key=True)


# Translate PL -> FR Models
class TranslatePlFrGroupBase(SQLModel):
    name: str
    description: Optional[str] = None
    language: TargetLanguage = Field(default=TargetLanguage.FR, index=True)


class TranslatePlFrGroup(BaseModel, TranslatePlFrGroupBase, table=True):
    __tablename__ = "translateplfrgroup"
    items: list["TranslatePlFr"] = Relationship(back_populates="group")


class TranslatePlFrGroupCreate(TranslatePlFrGroupBase):
    pass


class TranslatePlFrGroupRead(BaseModel, TranslatePlFrGroupBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TranslatePlFrGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[TargetLanguage] = None


class TranslatePlFrBase(SQLModel):
    text_pl: str
    text_fr: str
    category: Optional[str] = None  # Kategoria: vocabulary, grammar, phrases, idioms, etc.
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translateplfrgroup.id")


class TranslatePlFr(BaseModel, TranslatePlFrBase, table=True):
    __tablename__ = "translateplfr"
    group: Optional[TranslatePlFrGroup] = Relationship(back_populates="items")


class TranslatePlFrCreate(TranslatePlFrBase):
    pass


class TranslatePlFrRead(BaseModel, TranslatePlFrBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TranslatePlFrUpdate(SQLModel):
    text_pl: Optional[str] = None
    text_fr: Optional[str] = None
    category: Optional[str] = None
    group_id: Optional[uuid.UUID] = None


class TranslatePlFrProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="translateplfr.id", primary_key=True)


# Translate FR -> PL Models
class TranslateFrPlGroupBase(SQLModel):
    name: str
    description: Optional[str] = None
    language: TargetLanguage = Field(default=TargetLanguage.FR, index=True)


class TranslateFrPlGroup(BaseModel, TranslateFrPlGroupBase, table=True):
    __tablename__ = "translatefrplgroup"
    items: list["TranslateFrPl"] = Relationship(back_populates="group")


class TranslateFrPlGroupCreate(TranslateFrPlGroupBase):
    pass


class TranslateFrPlGroupRead(BaseModel, TranslateFrPlGroupBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TranslateFrPlGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[TargetLanguage] = None


class TranslateFrPlBase(SQLModel):
    text_fr: str
    text_pl: str
    category: Optional[str] = None  # Kategoria: vocabulary, grammar, phrases, idioms, etc.
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translatefrplgroup.id")


class TranslateFrPl(BaseModel, TranslateFrPlBase, table=True):
    __tablename__ = "translatefrpl"
    group: Optional[TranslateFrPlGroup] = Relationship(back_populates="items")


class TranslateFrPlCreate(TranslateFrPlBase):
    pass


class TranslateFrPlRead(BaseModel, TranslateFrPlBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TranslateFrPlUpdate(SQLModel):
    text_fr: Optional[str] = None
    text_pl: Optional[str] = None
    category: Optional[str] = None
    group_id: Optional[uuid.UUID] = None


class TranslateFrPlProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="translatefrpl.id", primary_key=True)


class GroupStudyRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    language: TargetLanguage = TargetLanguage.FR
    total_items: int
    learned_items: int
    updated_at: datetime.datetime


class ProgressUpdate(BaseModel):
    item_id: uuid.UUID
    learned: bool


class StudySessionRequest(BaseModel):
    group_ids: list[uuid.UUID]
    include_learned: bool = False
    limit: int = 50


class GenerateRequest(PydanticBaseModel):
    level: str
    count: int
    category: Optional[str] = None  # Opcjonalna kategoria: vocabulary, grammar, phrases, idioms


class GeneratedItem(PydanticBaseModel):
    text_pl: str
    text_fr: str
    category: Optional[str] = None


class BatchCreatePlFr(PydanticBaseModel):
    items: list[TranslatePlFrCreate]
    group_id: uuid.UUID


class BatchCreateFrPl(PydanticBaseModel):
    items: list[TranslateFrPlCreate]
    group_id: uuid.UUID


# ==========================================
# Guess Object (Zgadnij przedmiot) Models
# ==========================================


class GuessObjectGroupBase(SQLModel):
    name: str
    description: Optional[str] = None
    language: TargetLanguage = Field(default=TargetLanguage.FR, index=True)


class GuessObjectGroup(BaseModel, GuessObjectGroupBase, table=True):
    __tablename__ = "guessobjectgroup"
    items: list["GuessObject"] = Relationship(back_populates="group")


class GuessObjectGroupCreate(GuessObjectGroupBase):
    pass


class GuessObjectGroupRead(BaseModel, GuessObjectGroupBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class GuessObjectGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[TargetLanguage] = None


class GuessObjectBase(SQLModel):
    description_fr: str  # Opis przedmiotu po francusku
    description_pl: Optional[str] = None  # Opis po polsku (dla admina)
    answer_fr: str  # Odpowiedź (nazwa przedmiotu z rodzajnikiem)
    answer_pl: Optional[str] = None  # Odpowiedź po polsku (dla admina)
    category: Optional[str] = None  # Kategoria: fruits, animals, furniture, etc.
    hint: Optional[str] = None  # Opcjonalna podpowiedź
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="guessobjectgroup.id")


class GuessObject(BaseModel, GuessObjectBase, table=True):
    __tablename__ = "guessobject"
    group: Optional[GuessObjectGroup] = Relationship(back_populates="items")


class GuessObjectCreate(GuessObjectBase):
    pass


class GuessObjectRead(BaseModel, GuessObjectBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class GuessObjectUpdate(SQLModel):
    description_fr: Optional[str] = None
    description_pl: Optional[str] = None
    answer_fr: Optional[str] = None
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = None


class GuessObjectProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="guessobject.id", primary_key=True)


class BatchCreateGuessObject(PydanticBaseModel):
    items: list[GuessObjectCreate]
    group_id: uuid.UUID


class GenerateGuessObjectRequest(PydanticBaseModel):
    level: str
    count: int


class GeneratedGuessObjectItem(PydanticBaseModel):
    description_fr: str
    description_pl: Optional[str] = None
    answer_fr: str
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None


# ==========================================
# Fill Blank (Uzupełnij zdanie) Models
# ==========================================


class FillBlankGroupBase(SQLModel):
    name: str
    description: Optional[str] = None
    language: TargetLanguage = Field(default=TargetLanguage.FR, index=True)


class FillBlankGroup(BaseModel, FillBlankGroupBase, table=True):
    __tablename__ = "fillblankgroup"
    items: list["FillBlank"] = Relationship(back_populates="group")


class FillBlankGroupCreate(FillBlankGroupBase):
    pass


class FillBlankGroupRead(BaseModel, FillBlankGroupBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class FillBlankGroupUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[TargetLanguage] = None


class FillBlankBase(SQLModel):
    sentence_with_blank: str  # Zdanie z luką (oznaczoną jako ___)
    sentence_pl: Optional[str] = None  # Polskie tłumaczenie zdania (dla admina)
    answer: str  # Poprawna odpowiedź
    full_sentence: Optional[str] = None  # Pełne zdanie
    hint: Optional[str] = None  # Podpowiedź
    grammar_focus: Optional[str] = None  # Kategoria gramatyczna (verb, article, preposition, pronoun, agreement)
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fillblankgroup.id")


class FillBlank(BaseModel, FillBlankBase, table=True):
    __tablename__ = "fillblank"
    group: Optional[FillBlankGroup] = Relationship(back_populates="items")


class FillBlankCreate(FillBlankBase):
    pass


class FillBlankRead(BaseModel, FillBlankBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class FillBlankUpdate(SQLModel):
    sentence_with_blank: Optional[str] = None
    sentence_pl: Optional[str] = None
    answer: Optional[str] = None
    full_sentence: Optional[str] = None
    hint: Optional[str] = None
    grammar_focus: Optional[str] = None
    group_id: Optional[uuid.UUID] = None


class FillBlankProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="fillblank.id", primary_key=True)


class BatchCreateFillBlank(PydanticBaseModel):
    items: list[FillBlankCreate]
    group_id: uuid.UUID


class GenerateFillBlankRequest(PydanticBaseModel):
    level: str
    count: int
    grammar_focus: Optional[str] = None  # Opcjonalna kategoria gramatyczna


class GeneratedFillBlankItem(PydanticBaseModel):
    sentence_with_blank: str
    sentence_pl: Optional[str] = None
    answer: str
    full_sentence: str
    hint: Optional[str] = None
    grammar_focus: Optional[str] = None


# AI Verification Models
class AIVerifyRequest(PydanticBaseModel):
    task_type: str  # 'translate_pl_fr', 'translate_fr_pl', 'fill_blank'
    item_id: uuid.UUID
    user_answer: str
    question: str
    expected_answer: str


class AIVerifyResponse(PydanticBaseModel):
    is_correct: bool
    explanation: str  # Wyjaśnienie po polsku
    is_correct: bool
    explanation: str  # Wyjaśnienie po polsku
    answer_added: bool  # Czy dodano jako alternatywę


# ==========================================
# Gamification Models
# ==========================================

class WordleGame(PydanticBaseModel):
    target_word: str
    attempts: list[str] = []
    max_attempts: int = 6
    is_solved: bool = False
    game_over: bool = False


