# Plan Ujednolicenia Modeli Językowych

## Cel

Połączenie zduplikowanych modeli SQLModel dla języka francuskiego i angielskiego w jeden uniwersalny model z polem `language`. Zmiana nazw pól `text_fr`/`text_en` na `text_target`.

## Korzyści

- Eliminacja ~230 linii zduplikowanego kodu (`models_en.py`)
- Łatwe dodawanie nowych języków (tylko nowa wartość w enum `TargetLanguage`)
- Spójniejsze API i łatwiejsze utrzymanie
- Mniej tabel w bazie danych

---

## Faza 1: Backend - Modele (`app/models.py`)

### 1.1 Fiszka - zmiana pól

**Plik:** `app/models.py`

```python
# PRZED (linia ~82-86):
class FiszkaBase(SQLModel):
    text_pl: str
    text_fr: str  # ← USUŃ
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fiszkigroup.id")

# PO:
class FiszkaBase(SQLModel):
    text_pl: str
    text_target: str  # ← NOWE - język określony przez group.language
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fiszki_group.id")
```

### 1.2 FiszkaUpdate

```python
# PRZED (linia ~103-107):
class FiszkaUpdate(SQLModel):
    text_pl: Optional[str] = None
    text_fr: Optional[str] = None
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

# PO:
class FiszkaUpdate(SQLModel):
    text_pl: Optional[str] = None
    text_target: Optional[str] = None
    image_url: Optional[str] = None
    group_id: Optional[uuid.UUID] = None
```

### 1.3 Translate PL → Target

**Zmień nazwy klas i pól:**

| Stara nazwa | Nowa nazwa |
|-------------|------------|
| `TranslatePlFrGroupBase` | `TranslatePlToTargetGroupBase` |
| `TranslatePlFrGroup` | `TranslatePlToTargetGroup` |
| `TranslatePlFrBase` | `TranslatePlToTargetBase` |
| `TranslatePlFr` | `TranslatePlToTarget` |
| `TranslatePlFrCreate` | `TranslatePlToTargetCreate` |
| `TranslatePlFrRead` | `TranslatePlToTargetRead` |
| `TranslatePlFrUpdate` | `TranslatePlToTargetUpdate` |
| `TranslatePlFrProgress` | `TranslatePlToTargetProgress` |
| `text_fr` | `text_target` |

```python
# PRZED (linia ~158-163):
class TranslatePlFrBase(SQLModel):
    text_pl: str
    text_fr: str
    category: Optional[str] = None
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translateplfrgroup.id")

# PO:
class TranslatePlToTargetBase(SQLModel):
    text_pl: str
    text_target: str
    category: Optional[str] = None
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translate_pl_to_target_group.id")
```

### 1.4 Translate Target → PL

**Zmień nazwy klas i pól:**

| Stara nazwa | Nowa nazwa |
|-------------|------------|
| `TranslateFrPlGroupBase` | `TranslateTargetToPlGroupBase` |
| `TranslateFrPlGroup` | `TranslateTargetToPlGroup` |
| `TranslateFrPlBase` | `TranslateTargetToPlBase` |
| `TranslateFrPl` | `TranslateTargetToPl` |
| `text_fr` | `text_target` |

```python
# PRZED (linia ~223-228):
class TranslateFrPlBase(SQLModel):
    text_fr: str
    text_pl: str
    category: Optional[str] = None
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translatefrplgroup.id")

# PO:
class TranslateTargetToPlBase(SQLModel):
    text_target: str  # pytanie w języku docelowym
    text_pl: str      # odpowiedź po polsku
    category: Optional[str] = None
    alternative_answers: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="translate_target_to_pl_group.id")
```

### 1.5 GuessObject

```python
# PRZED (linia ~335-342):
class GuessObjectBase(SQLModel):
    description_fr: str
    description_pl: Optional[str] = None
    answer_fr: str
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="guessobjectgroup.id")

# PO:
class GuessObjectBase(SQLModel):
    description_target: str
    description_pl: Optional[str] = None
    answer_target: str
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="guess_object_group.id")
```

### 1.6 GuessObjectUpdate

```python
# PRZED (linia ~360-367):
class GuessObjectUpdate(SQLModel):
    description_fr: Optional[str] = None
    description_pl: Optional[str] = None
    answer_fr: Optional[str] = None
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = None

# PO:
class GuessObjectUpdate(SQLModel):
    description_target: Optional[str] = None
    description_pl: Optional[str] = None
    answer_target: Optional[str] = None
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
    group_id: Optional[uuid.UUID] = None
```

### 1.7 GeneratedItem

```python
# PRZED (linia ~287-290):
class GeneratedItem(PydanticBaseModel):
    text_pl: str
    text_fr: str
    category: Optional[str] = None

# PO:
class GeneratedItem(PydanticBaseModel):
    text_pl: str
    text_target: str
    category: Optional[str] = None
```

### 1.8 GeneratedGuessObjectItem

```python
# PRZED (linia ~387-393):
class GeneratedGuessObjectItem(PydanticBaseModel):
    description_fr: str
    description_pl: Optional[str] = None
    answer_fr: str
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None

# PO:
class GeneratedGuessObjectItem(PydanticBaseModel):
    description_target: str
    description_pl: Optional[str] = None
    answer_target: str
    answer_pl: Optional[str] = None
    category: Optional[str] = None
    hint: Optional[str] = None
```

### 1.9 Nazwy tabel (dla spójności)

Zmień `__tablename__` w klasach tabelowych:

| Klasa | Stara nazwa tabeli | Nowa nazwa tabeli |
|-------|-------------------|-------------------|
| `FiszkiGroup` | `fiszkigroup` | `fiszki_group` |
| `TranslatePlToTargetGroup` | `translateplfrgroup` | `translate_pl_to_target_group` |
| `TranslatePlToTarget` | `translateplfr` | `translate_pl_to_target` |
| `TranslateTargetToPlGroup` | `translatefrplgroup` | `translate_target_to_pl_group` |
| `TranslateTargetToPl` | `translatefrpl` | `translate_target_to_pl` |
| `GuessObjectGroup` | `guessobjectgroup` | `guess_object_group` |
| `FillBlankGroup` | `fillblankgroup` | `fill_blank_group` |

**Przykład:**
```python
# PRZED:
class FiszkiGroup(BaseModel, FiszkiGroupBase, table=True):
    __tablename__ = "fiszkigroup"

# PO:
class FiszkiGroup(BaseModel, FiszkiGroupBase, table=True):
    __tablename__ = "fiszki_group"
```

### 1.10 Foreign Keys - zaktualizuj referencje

Po zmianie nazw tabel, zaktualizuj wszystkie `foreign_key` w polach:

```python
# Przykład:
group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fiszki_group.id")
# zamiast
group_id: Optional[uuid.UUID] = Field(default=None, foreign_key="fiszkigroup.id")
```

---

## Faza 2: Usunięcie zbędnych plików

### 2.1 Usuń `app/models_en.py`

```bash
rm app/models_en.py
```

### 2.2 Usuń `app/routers/english.py`

```bash
rm app/routers/english.py
```

### 2.3 Wyczyść `app/routers/__init__.py`

Jeśli zawiera eksport routera angielskiego, usuń go.

---

## Faza 3: Backend - Główny Router (`app/main.py`)

### 3.1 Usuń importy z models_en

**Znajdź i usuń (jeśli istnieją):**
```python
from .models_en import (
    FiszkaEn, FiszkaEnCreate, FiszkaEnRead, ...
)
```

### 3.2 Usuń include router dla english

**Znajdź i usuń:**
```python
from .routers.english import router as english_router
app.include_router(english_router, prefix="/en", tags=["English"])
```

### 3.3 Zaktualizuj nazwy modeli w endpointach

Użyj Find & Replace:

| Znajdź | Zamień na |
|--------|-----------|
| `TranslatePlFrGroup` | `TranslatePlToTargetGroup` |
| `TranslatePlFr` | `TranslatePlToTarget` |
| `TranslateFrPlGroup` | `TranslateTargetToPlGroup` |
| `TranslateFrPl` | `TranslateTargetToPl` |
| `.text_fr` | `.text_target` |
| `"text_fr"` | `"text_target"` |
| `description_fr` | `description_target` |
| `answer_fr` | `answer_target` |

### 3.4 Zaktualizuj URL endpointów (opcjonalnie)

Jeśli chcesz zmienić URL na bardziej generyczne:

| Stary URL | Nowy URL |
|-----------|----------|
| `/translate-pl-fr/` | `/translate-pl-to-target/` |
| `/translate-fr-pl/` | `/translate-target-to-pl/` |

**UWAGA:** To wymaga zmian również w frontendzie!

### 3.5 Zaktualizuj AI generation prompts

W funkcjach generowania treści AI, zmień oczekiwane pola JSON:

```python
# PRZED:
"Zwróć JSON: {\"text_pl\": \"...\", \"text_fr\": \"...\"}"

# PO:
"Zwróć JSON: {\"text_pl\": \"...\", \"text_target\": \"...\"}"
```

Podobnie dla GuessObject:
```python
# PRZED:
"description_fr", "answer_fr"

# PO:
"description_target", "answer_target"
```

---

## Faza 4: Frontend - Typy API (`frontend/src/lib/api.ts`)

### 4.1 Interfejs Fiszka

```typescript
// PRZED (linia ~96-107):
export interface Fiszka {
    id: string
    text_pl: string
    text_fr: string
    image_url: string | null
    learned?: boolean
    half_learned?: boolean
    mistake?: boolean
    group_id: string | null
    created_at?: string
    updated_at?: string
}

// PO:
export interface Fiszka {
    id: string
    text_pl: string
    text_target: string  // ← ZMIANA
    image_url: string | null
    learned?: boolean
    half_learned?: boolean
    mistake?: boolean
    group_id: string | null
    created_at?: string
    updated_at?: string
}
```

### 4.2 FiszkaCreate

```typescript
// PRZED:
export interface FiszkaCreate {
    text_pl: string
    text_fr: string
    image_url?: string | null
    group_id?: string | null
}

// PO:
export interface FiszkaCreate {
    text_pl: string
    text_target: string  // ← ZMIANA
    image_url?: string | null
    group_id?: string | null
}
```

### 4.3 FiszkaUpdate

```typescript
// PRZED:
export interface FiszkaUpdate {
    text_pl?: string
    text_fr?: string
    image_url?: string | null
    group_id?: string | null
}

// PO:
export interface FiszkaUpdate {
    text_pl?: string
    text_target?: string  // ← ZMIANA
    image_url?: string | null
    group_id?: string | null
}
```

### 4.4 TranslateItem

```typescript
// PRZED:
export interface TranslateItem {
    id: string;
    text_pl: string;
    text_fr: string;
    category?: string | null;
    group_id: string | null;
    created_at?: string;
    updated_at?: string;
}

// PO:
export interface TranslateItem {
    id: string;
    text_pl: string;
    text_target: string;  // ← ZMIANA
    category?: string | null;
    group_id: string | null;
    created_at?: string;
    updated_at?: string;
}
```

### 4.5 TranslateItemCreate i TranslateItemUpdate

```typescript
// PRZED:
export interface TranslateItemCreate {
    text_pl: string;
    text_fr: string;
    category?: string | null;
    group_id?: string | null;
}

// PO:
export interface TranslateItemCreate {
    text_pl: string;
    text_target: string;  // ← ZMIANA
    category?: string | null;
    group_id?: string | null;
}
```

### 4.6 GeneratedItem

```typescript
// PRZED:
export interface GeneratedItem {
    text_pl: string;
    text_fr: string;
    category?: string | null;
}

// PO:
export interface GeneratedItem {
    text_pl: string;
    text_target: string;  // ← ZMIANA
    category?: string | null;
}
```

### 4.7 GuessObjectItem

```typescript
// PRZED:
export interface GuessObjectItem {
    id: string
    description_fr: string
    description_pl?: string | null
    answer_fr: string
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id: string | null
    created_at?: string
    updated_at?: string
}

// PO:
export interface GuessObjectItem {
    id: string
    description_target: string  // ← ZMIANA
    description_pl?: string | null
    answer_target: string       // ← ZMIANA
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id: string | null
    created_at?: string
    updated_at?: string
}
```

### 4.8 GuessObjectItemCreate

```typescript
// PRZED:
export interface GuessObjectItemCreate {
    description_fr: string
    description_pl?: string | null
    answer_fr: string
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id?: string | null
}

// PO:
export interface GuessObjectItemCreate {
    description_target: string  // ← ZMIANA
    description_pl?: string | null
    answer_target: string       // ← ZMIANA
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id?: string | null
}
```

### 4.9 GuessObjectItemUpdate i GeneratedGuessObjectItem

Analogiczne zmiany - zamień `_fr` na `_target`.

---

## Faza 5: Frontend - Komponenty

### 5.1 Znajdź wszystkie użycia starych nazw pól

Wykonaj w terminalu:
```bash
grep -rn "text_fr\|description_fr\|answer_fr" frontend/src/
```

### 5.2 Zaktualizuj każdy plik

Dla każdego znalezionego pliku, zamień:
- `text_fr` → `text_target`
- `description_fr` → `description_target`
- `answer_fr` → `answer_target`

**Prawdopodobne pliki do modyfikacji:**
- `frontend/src/pages/student/StudyPage.tsx`
- `frontend/src/pages/student/TranslateStudyPage.tsx`
- `frontend/src/pages/student/GuessObjectStudyPage.tsx`
- `frontend/src/pages/admin/GroupDetailsPage.tsx`
- `frontend/src/pages/admin/TranslatePlFrDetailsPage.tsx`
- `frontend/src/pages/admin/TranslateFrPlDetailsPage.tsx`
- `frontend/src/pages/admin/GuessObjectDetailsPage.tsx`
- `frontend/src/components/admin/FiszkaDialog.tsx`
- `frontend/src/components/admin/TranslateItemDialog.tsx`
- `frontend/src/components/admin/GuessObjectItemDialog.tsx`
- `frontend/src/components/FlipCard.tsx`
- `frontend/src/components/StudyCard.tsx`

---

## Faza 6: Reset Bazy Danych

### Opcja A: Docker (zalecana)

```bash
# 1. Zatrzymaj kontenery
docker-compose down

# 2. Usuń volume z bazą danych
docker volume rm france-learn-app_postgres_data

# 3. Uruchom ponownie
docker-compose up --build
```

### Opcja B: RESET_DB_ON_STARTUP

W `app/main.py` ustaw:
```python
RESET_DB_ON_STARTUP = True
```

Następnie uruchom aplikację - tabele zostaną odtworzone automatycznie.

---

## Weryfikacja

### Test 1: Backend uruchamia się

```bash
docker-compose up --build
```

Sprawdź logi - nie powinno być `ImportError` ani `ModuleNotFoundError`.

### Test 2: API dokumentacja

Otwórz http://localhost:8000/docs i zweryfikuj:
- [ ] Schematy używają `text_target` zamiast `text_fr`
- [ ] Brak endpointów `/en/...`
- [ ] Wszystkie endpointy mają parametr `language` (opcjonalny)

### Test 3: Frontend kompiluje się

```bash
cd frontend
npm run build
```

Nie powinno być błędów TypeScript.

### Test 4: CRUD operacje

1. Utwórz grupę fiszek z `language: "fr"`
2. Dodaj fiszkę z polami `text_pl` i `text_target`
3. Pobierz fiszkę i sprawdź że zwraca `text_target`
4. Powtórz dla `language: "en"`

### Test 5: Nauka działa

1. Zaloguj się jako student
2. Wybierz język (FR lub EN)
3. Rozpocznij sesję nauki
4. Sprawdź że fiszki wyświetlają się poprawnie
5. Oznacz element jako nauczony
6. Sprawdź że progress jest zapisany

---

## Podsumowanie Zmian

| Plik | Akcja | Opis |
|------|-------|------|
| `app/models.py` | MODYFIKUJ | Zmień nazwy pól i klas |
| `app/models_en.py` | USUŃ | Cały plik |
| `app/routers/english.py` | USUŃ | Cały plik |
| `app/main.py` | MODYFIKUJ | Usuń importy EN, zaktualizuj pola |
| `frontend/src/lib/api.ts` | MODYFIKUJ | Zmień typy |
| `frontend/src/pages/**` | MODYFIKUJ | Zmień użycia pól |
| `frontend/src/components/**` | MODYFIKUJ | Zmień użycia pól |

---

## Checklist przed rozpoczęciem

- [ ] Zrób backup repozytorium (`git commit` obecnego stanu)
- [ ] Upewnij się że masz dane testowe (nie produkcyjne)
- [ ] Przeczytaj cały ten dokument
- [ ] Wykonaj globalne wyszukiwanie przed zmianami:
  ```bash
  grep -rn "text_fr\|text_en\|description_fr\|answer_fr" app/ frontend/src/
  ```

---

## Kolejność wykonania

1. ✅ Zmodyfikuj `app/models.py`
2. ✅ Usuń `app/models_en.py`
3. ✅ Usuń `app/routers/english.py`
4. ✅ Zmodyfikuj `app/main.py`
5. ✅ Zmodyfikuj `frontend/src/lib/api.ts`
6. ✅ Zmodyfikuj komponenty frontendowe
7. ✅ Zresetuj bazę danych
8. ✅ Przetestuj aplikację
