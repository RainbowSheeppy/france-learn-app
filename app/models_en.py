import datetime
import uuid
from typing import Optional

from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from .models import BaseModel, BaseLearningProgress, FiszkiGroupBase, FiszkaBase, TranslatePlFrGroupBase, TranslatePlFrBase, TranslateFrPlGroupBase, TranslateFrPlBase, GuessObjectGroupBase, GuessObjectBase, FillBlankGroupBase, FillBlankBase

# ==========================================
# English Fiszki Models
# ==========================================

class FiszkiGroupEn(BaseModel, FiszkiGroupBase, table=True):
    __tablename__ = "fiszkigroup_en"
    fiszki: list["FiszkaEn"] = Relationship(back_populates="group")

class FiszkaEnBase(SQLModel):
    text_pl: str
    text_en: str
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fiszkigroup_en.id")

class FiszkaEn(BaseModel, FiszkaEnBase, table=True):
    __tablename__ = "fiszka_en"
    group: Optional[FiszkiGroupEn] = Relationship(back_populates="fiszki")

class FiszkaEnCreate(FiszkaEnBase):
    pass

class FiszkaEnRead(BaseModel, FiszkaEnBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime

class FiszkaEnUpdate(SQLModel):
    text_pl: Optional[str] = None
    text_en: Optional[str] = None
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

class FiszkaEnProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    fiszka_id: uuid.UUID = Field(foreign_key="fiszka_en.id", primary_key=True)


# ==========================================
# Translate PL -> EN Models
# ==========================================

class TranslatePlEnGroup(BaseModel, TranslatePlFrGroupBase, table=True):
    __tablename__ = "translateplengroup"
    items: list["TranslatePlEn"] = Relationship(back_populates="group")

class TranslatePlEnBase(SQLModel):
    text_pl: str
    text_en: str
    category: Optional[str] = None
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translateplengroup.id")

class TranslatePlEn(BaseModel, TranslatePlEnBase, table=True):
    __tablename__ = "translateplen"
    group: Optional[TranslatePlEnGroup] = Relationship(back_populates="items")

class TranslatePlEnCreate(TranslatePlEnBase):
    pass

class TranslatePlEnRead(BaseModel, TranslatePlEnBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime

class TranslatePlEnUpdate(SQLModel):
    text_pl: Optional[str] = None
    text_en: Optional[str] = None
    category: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

class TranslatePlEnProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="translateplen.id", primary_key=True)


# ==========================================
# Translate EN -> PL Models
# ==========================================

class TranslateEnPlGroup(BaseModel, TranslateFrPlGroupBase, table=True):
    __tablename__ = "translateenplgroup"
    items: list["TranslateEnPl"] = Relationship(back_populates="group")

class TranslateEnPlBase(SQLModel):
    text_en: str
    text_pl: str
    category: Optional[str] = None
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translateenplgroup.id")

class TranslateEnPl(BaseModel, TranslateEnPlBase, table=True):
    __tablename__ = "translateenpl"
    group: Optional[TranslateEnPlGroup] = Relationship(back_populates="items")

class TranslateEnPlCreate(TranslateEnPlBase):
    pass

class TranslateEnPlRead(BaseModel, TranslateEnPlBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime

class TranslateEnPlUpdate(SQLModel):
    text_en: Optional[str] = None
    text_pl: Optional[str] = None
    category: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

class TranslateEnPlProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="translateenpl.id", primary_key=True)


# ==========================================
# Guess Object (Zgadnij przedmiot) Models
# ==========================================

class GuessObjectGroupEn(BaseModel, GuessObjectGroupBase, table=True):
    __tablename__ = "guessobjectgroup_en"
    items: list["GuessObjectEn"] = Relationship(back_populates="group")

class GuessObjectEnBase(SQLModel):
    description_en: str
    description_pl: Optional[str] = None
    answer_en: str
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="guessobjectgroup_en.id")

class GuessObjectEn(BaseModel, GuessObjectEnBase, table=True):
    __tablename__ = "guessobject_en"
    group: Optional[GuessObjectGroupEn] = Relationship(back_populates="items")

class GuessObjectEnCreate(GuessObjectEnBase):
    pass

class GuessObjectEnRead(BaseModel, GuessObjectEnBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime

class GuessObjectEnUpdate(SQLModel):
    description_en: Optional[str] = None
    description_pl: Optional[str] = None
    answer_en: Optional[str] = None
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

class GuessObjectEnProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="guessobject_en.id", primary_key=True)


# ==========================================
# Fill Blank (Uzupełnij zdanie) Models
# ==========================================

class FillBlankGroupEn(BaseModel, FillBlankGroupBase, table=True):
    __tablename__ = "fillblankgroup_en"
    items: list["FillBlankEn"] = Relationship(back_populates="group")

class FillBlankEn(BaseModel, FillBlankBase, table=True):
    __tablename__ = "fillblank_en"
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fillblankgroup_en.id")
    group: Optional[FillBlankGroupEn] = Relationship(back_populates="items")
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    # Inherits base fields but table name is specific

class FillBlankEnCreate(FillBlankBase):
    pass

class FillBlankEnRead(BaseModel, FillBlankBase):
    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime

class FillBlankEnUpdate(SQLModel):
    sentence_with_blank: Optional[str] = None
    sentence_pl: Optional[str] = None
    answer: Optional[str] = None
    full_sentence: Optional[str] = None
    hint: Optional[str] = None
    grammar_focus: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

class FillBlankEnProgress(BaseModel, BaseLearningProgress, table=True):
    half_learned: bool = Field(default=False)
    mistake: bool = Field(default=False)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    item_id: uuid.UUID = Field(foreign_key="fillblank_en.id", primary_key=True)


# ==========================================
# Batch Helpers
# ==========================================

class BatchCreatePlEn(BaseModel):
    items: list[TranslatePlEnCreate]
    group_id: uuid.UUID

class BatchCreateEnPl(BaseModel):
    items: list[TranslateEnPlCreate]
    group_id: uuid.UUID

class BatchCreateGuessObjectEn(BaseModel):
    items: list[GuessObjectEnCreate]
    group_id: uuid.UUID

class BatchCreateFillBlankEn(BaseModel):
    items: list[FillBlankEnCreate]
    group_id: uuid.UUID
