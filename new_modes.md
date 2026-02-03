# Nowe tryby nauki — Dokumentacja implementacji

> **Data:** 2026-02-03
> **Status:** Do implementacji
> **Priorytety:** 1. Mini-dialogi RPG, 2. Znajdź intruza

---

## Spis treści

1. [Mini-dialogi RPG](#1-mini-dialogi-rpg)
   - [Opis funkcjonalności](#11-opis-funkcjonalności)
   - [Baza danych](#12-baza-danych)
   - [API Endpoints](#13-api-endpoints)
   - [Prompty AI](#14-prompty-ai)
   - [Frontend](#15-frontend)
   - [Gamifikacja](#16-gamifikacja)
2. [Znajdź intruza](#2-znajdź-intruza)
   - [Opis funkcjonalności](#21-opis-funkcjonalności)
   - [Baza danych](#22-baza-danych)
   - [API Endpoints](#23-api-endpoints)
   - [Prompty AI](#24-prompty-ai)
   - [Frontend](#25-frontend)
   - [Gamifikacja](#26-gamifikacja)
3. [Migracja bazy danych](#3-migracja-bazy-danych)
4. [Kroki implementacji](#4-kroki-implementacji)
5. [Decision Log](#5-decision-log)

---

# 1. Mini-dialogi RPG

## 1.1 Opis funkcjonalności

Interaktywny tryb nauki przez odgrywanie ról w konwersacjach. Użytkownik prowadzi dialog z NPC (w języku docelowym), prowadzony przez narratora (po polsku).

### Flow użytkownika

```
[Ekran startowy: Historia | Nowa rozmowa]
         │
         ▼ (Nowa rozmowa)
[Wybór poziomu: A1 | A2 | B1 | B2 | C1 | C2]
         │
         ▼
[AI generuje 3 kategorie → użytkownik wybiera]
         │
         ▼
[Dialog: Narrator + NPC + User]
         │
         ▼ (zakończenie)
[Ocena: gramatyka, słownictwo, trafność + punkty]
```

### Kluczowe cechy

- **Narrator (PL):** Daje kontekst, instrukcje, reaguje na dziwne odpowiedzi
- **NPC (FR/EN):** Mówi w języku docelowym
- **Zmienność:** Różna długość dialogów, czasem podchwytliwe sytuacje
- **Adaptacja:** Narrator pomaga więcej/mniej w zależności od poziomu
- **Historia:** Lista poprzednich rozmów + statystyki

---

## 1.2 Baza danych

### Dodaj do `app/models.py`:

```python
from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional


class DialogSession(SQLModel, table=True):
    """Sesja dialogowa użytkownika"""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    language: TargetLanguage  # fr / en
    level: str  # A1, A2, B1, B2, C1, C2
    category: str  # np. "W restauracji"
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: datetime | None = None

    # Wyniki (wypełniane po zakończeniu)
    score_grammar: int | None = None  # 0-100
    score_vocabulary: int | None = None  # 0-100
    score_relevance: int | None = None  # 0-100
    score_total: int | None = None  # 0-100
    points_earned: int | None = None  # punkty do gamifikacji


class DialogMessage(SQLModel, table=True):
    """Pojedyncza wiadomość w dialogu"""
    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="dialogsession.id")
    role: str  # "narrator", "npc", "user", "system"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

---

## 1.3 API Endpoints

### Dodaj do `app/main.py`:

```python
# ============================================
# DIALOG RPG ENDPOINTS
# ============================================

from pydantic import BaseModel


# === Pydantic Models ===

class DialogStartRequest(BaseModel):
    language: str  # "fr" | "en"
    level: str     # "A1" | "A2" | "B1" | "B2" | "C1" | "C2"


class DialogStartResponse(BaseModel):
    session_id: int
    categories: list[str]


class DialogSelectCategoryRequest(BaseModel):
    category: str


class DialogSelectCategoryResponse(BaseModel):
    narrator_intro: str
    npc_name: str
    npc_message: str


class DialogMessageRequest(BaseModel):
    content: str


class DialogEvaluation(BaseModel):
    grammar: int
    vocabulary: int
    relevance: int
    total: int
    feedback: str


class DialogMessageResponse(BaseModel):
    narrator_reaction: str | None
    npc_response: str | None
    is_finished: bool
    evaluation: DialogEvaluation | None


class DialogSessionInfo(BaseModel):
    id: int
    language: str
    level: str
    category: str
    started_at: datetime
    finished_at: datetime | None
    score_total: int | None
    points_earned: int | None


class DialogStats(BaseModel):
    total_sessions: int
    avg_score: float
    best_score: int
    favorite_category: str | None
    total_points_earned: int


class DialogHistoryResponse(BaseModel):
    sessions: list[DialogSessionInfo]
    stats: DialogStats


# === Endpoints ===

@app.post("/api/dialog/start", response_model=DialogStartResponse)
async def dialog_start(
    request: DialogStartRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Rozpocznij nowy dialog - AI generuje 3 kategorie do wyboru"""

    prompt = PROMPT_GENERATE_CATEGORIES.format(
        language="French" if request.language == "fr" else "English",
        level=request.level
    )

    client = get_openai_client()
    response = client.responses.create(model="gpt-5-nano", input=prompt)

    categories = json.loads(clean_json_response(response.output_text))

    # Utwórz sesję (kategoria zostanie uzupełniona po wyborze)
    dialog_session = DialogSession(
        user_id=current_user.id,
        language=request.language,
        level=request.level,
        category=""  # tymczasowo puste
    )
    session.add(dialog_session)
    session.commit()
    session.refresh(dialog_session)

    return DialogStartResponse(
        session_id=dialog_session.id,
        categories=categories
    )


@app.post("/api/dialog/{session_id}/select-category", response_model=DialogSelectCategoryResponse)
async def dialog_select_category(
    session_id: int,
    request: DialogSelectCategoryRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Wybierz kategorię i rozpocznij dialog"""

    dialog_session = session.get(DialogSession, session_id)
    if not dialog_session or dialog_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Zaktualizuj kategorię
    dialog_session.category = request.category
    session.add(dialog_session)

    # Wygeneruj scenariusz
    prompt = PROMPT_START_SCENARIO.format(
        language="French" if dialog_session.language == "fr" else "English",
        level=dialog_session.level,
        category=request.category
    )

    client = get_openai_client()
    response = client.responses.create(model="gpt-5-nano", input=prompt)

    result = json.loads(clean_json_response(response.output_text))

    # Zapisz wiadomości
    narrator_msg = DialogMessage(
        session_id=session_id,
        role="narrator",
        content=result["narrator_intro"]
    )
    npc_msg = DialogMessage(
        session_id=session_id,
        role="npc",
        content=f"{result['npc_name']}: {result['npc_message']}"
    )
    session.add(narrator_msg)
    session.add(npc_msg)
    session.commit()

    return DialogSelectCategoryResponse(
        narrator_intro=result["narrator_intro"],
        npc_name=result["npc_name"],
        npc_message=result["npc_message"]
    )


@app.post("/api/dialog/{session_id}/message", response_model=DialogMessageResponse)
async def dialog_message(
    session_id: int,
    request: DialogMessageRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Wyślij wiadomość i otrzymaj odpowiedź"""

    dialog_session = session.get(DialogSession, session_id)
    if not dialog_session or dialog_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    if dialog_session.finished_at:
        raise HTTPException(status_code=400, detail="Session already finished")

    # Zapisz wiadomość użytkownika
    user_msg = DialogMessage(
        session_id=session_id,
        role="user",
        content=request.content
    )
    session.add(user_msg)
    session.commit()

    # Pobierz historię konwersacji
    messages = session.exec(
        select(DialogMessage)
        .where(DialogMessage.session_id == session_id)
        .order_by(DialogMessage.created_at)
    ).all()

    conversation_history = "\n".join([
        f"[{msg.role.upper()}]: {msg.content}" for msg in messages
    ])

    # Wygeneruj odpowiedź
    prompt = PROMPT_CONTINUE_DIALOG.format(
        language="French" if dialog_session.language == "fr" else "English",
        level=dialog_session.level,
        category=dialog_session.category,
        conversation_history=conversation_history,
        user_message=request.content
    )

    client = get_openai_client()
    response = client.responses.create(model="gpt-5-nano", input=prompt)

    result = json.loads(clean_json_response(response.output_text))

    # Zapisz reakcję narratora jeśli jest
    if result.get("narrator_reaction"):
        narrator_msg = DialogMessage(
            session_id=session_id,
            role="narrator",
            content=result["narrator_reaction"]
        )
        session.add(narrator_msg)

    # Zapisz odpowiedź NPC jeśli jest
    if result.get("npc_response"):
        npc_msg = DialogMessage(
            session_id=session_id,
            role="npc",
            content=result["npc_response"]
        )
        session.add(npc_msg)

    # Jeśli zakończone - zapisz wyniki
    evaluation = None
    if result.get("is_finished") and result.get("evaluation"):
        eval_data = result["evaluation"]

        # Oblicz punkty
        message_count = len([m for m in messages if m.role == "user"]) + 1
        points = calculate_dialog_points(
            score_total=eval_data["total"],
            level=dialog_session.level,
            message_count=message_count
        )

        dialog_session.finished_at = datetime.utcnow()
        dialog_session.score_grammar = eval_data["grammar"]
        dialog_session.score_vocabulary = eval_data["vocabulary"]
        dialog_session.score_relevance = eval_data["relevance"]
        dialog_session.score_total = eval_data["total"]
        dialog_session.points_earned = points

        # Dodaj punkty użytkownikowi
        current_user.total_points = (current_user.total_points or 0) + points
        session.add(current_user)

        evaluation = DialogEvaluation(**eval_data)

    session.add(dialog_session)
    session.commit()

    return DialogMessageResponse(
        narrator_reaction=result.get("narrator_reaction"),
        npc_response=result.get("npc_response"),
        is_finished=result.get("is_finished", False),
        evaluation=evaluation
    )


@app.get("/api/dialog/history", response_model=DialogHistoryResponse)
async def dialog_history(
    language: str | None = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Pobierz historię dialogów + statystyki"""

    query = select(DialogSession).where(
        DialogSession.user_id == current_user.id,
        DialogSession.finished_at.isnot(None)
    )

    if language:
        query = query.where(DialogSession.language == language)

    query = query.order_by(DialogSession.started_at.desc())

    # Pobierz sesje
    all_sessions = session.exec(query).all()
    paginated = all_sessions[offset:offset + limit]

    # Oblicz statystyki
    total = len(all_sessions)
    scores = [s.score_total for s in all_sessions if s.score_total]
    points = [s.points_earned for s in all_sessions if s.points_earned]
    categories = [s.category for s in all_sessions]

    # Ulubiona kategoria
    favorite = None
    if categories:
        from collections import Counter
        favorite = Counter(categories).most_common(1)[0][0]

    stats = DialogStats(
        total_sessions=total,
        avg_score=sum(scores) / len(scores) if scores else 0,
        best_score=max(scores) if scores else 0,
        favorite_category=favorite,
        total_points_earned=sum(points)
    )

    sessions_info = [
        DialogSessionInfo(
            id=s.id,
            language=s.language,
            level=s.level,
            category=s.category,
            started_at=s.started_at,
            finished_at=s.finished_at,
            score_total=s.score_total,
            points_earned=s.points_earned
        )
        for s in paginated
    ]

    return DialogHistoryResponse(sessions=sessions_info, stats=stats)


@app.get("/api/dialog/{session_id}")
async def dialog_get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Pobierz szczegóły sesji wraz z wiadomościami"""

    dialog_session = session.get(DialogSession, session_id)
    if not dialog_session or dialog_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = session.exec(
        select(DialogMessage)
        .where(DialogMessage.session_id == session_id)
        .order_by(DialogMessage.created_at)
    ).all()

    return {
        "session": dialog_session,
        "messages": messages
    }
```

---

## 1.4 Prompty AI

### Dodaj do `app/main.py` (sekcja promptów):

```python
# ============================================
# DIALOG RPG PROMPTS
# ============================================

PROMPT_GENERATE_CATEGORIES = """You are a language learning assistant. Generate 3 VERY DIFFERENT conversation scenario categories for {language} language practice at {level} level.

Requirements:
- Categories must be diverse (e.g., don't pick 3 restaurant scenarios)
- Appropriate for {level} level complexity
- Practical, real-life situations
- Return ONLY JSON array with 3 strings in Polish

Examples of good diversity:
- ["W aptece", "Zgubiony bagaż na lotnisku", "Rozmowa z sąsiadem"]
- ["Reklamacja w sklepie", "Pytanie o drogę", "Rezerwacja stolika"]

Return JSON array only, no explanation:"""


PROMPT_START_SCENARIO = """You are a narrator for a language learning RPG game.

Language: {language}
Level: {level}
Category: {category}

Create an opening scene:
1. NARRATOR text (in Polish): Set the scene, give context, provide helpful information the user might need (e.g., "Wiesz, że apteka jest otwarta do 18:00")
2. NPC opening line (in {language}): The first thing the NPC says to the user

Adjust complexity to {level}:
- A1-A2: Simple vocabulary, short sentences, helpful narrator hints
- B1-B2: More complex situations, less narrator help
- C1-C2: Nuanced situations, minimal help, idiomatic expressions

Return JSON only:
{{
    "narrator_intro": "Polish text setting the scene and giving hints...",
    "npc_name": "Name or description like 'Sprzedawca' or 'Marie'",
    "npc_message": "First line in {language}..."
}}"""


PROMPT_CONTINUE_DIALOG = """You are managing a language learning RPG dialogue.

Language: {language}
Level: {level}
Category: {category}
Conversation so far:
{conversation_history}

User's latest response: "{user_message}"

Evaluate and continue:
1. Is the response linguistically strange/nonsensical? If yes, narrator reacts in Polish
2. Should the conversation continue or end naturally? (typically 3-6 exchanges)
3. If continuing, what does the NPC say next?
4. If ending, provide final evaluation

Consider making it sometimes tricky (NPC misunderstands, asks follow-up, changes topic slightly).

Adjust to {level}:
- A1-A2: Forgiving evaluation, simple NPC responses, helpful narrator
- B1-B2: Moderate evaluation, natural NPC responses
- C1-C2: Strict evaluation, complex NPC responses, minimal narrator help

Return JSON:
{{
    "narrator_reaction": "Polish text if user said something weird/incorrect, null otherwise",
    "npc_response": "Next NPC line in {language}, null if finished",
    "is_finished": true/false,
    "evaluation": null or {{
        "grammar": 0-100,
        "vocabulary": 0-100,
        "relevance": 0-100,
        "total": 0-100,
        "feedback": "Polish summary of performance - what was good, what could be improved"
    }}
}}"""
```

---

## 1.5 Frontend

### 1.5.1 Nowe pliki do utworzenia:

```
frontend/src/
├── pages/student/DialogPage.tsx
├── components/dialog/
│   ├── DialogChat.tsx
│   ├── DialogMessage.tsx
│   ├── DialogHistory.tsx
│   ├── DialogEvaluation.tsx
│   ├── CategorySelector.tsx
│   ├── LevelSelector.tsx
│   └── TypingIndicator.tsx
```

### 1.5.2 `frontend/src/pages/student/DialogPage.tsx`

```tsx
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LevelSelector from "@/components/dialog/LevelSelector";
import CategorySelector from "@/components/dialog/CategorySelector";
import DialogChat from "@/components/dialog/DialogChat";
import DialogHistory from "@/components/dialog/DialogHistory";
import DialogEvaluation from "@/components/dialog/DialogEvaluation";
import api from "@/lib/api";

type Screen = "start" | "history" | "level" | "category" | "chat" | "evaluation";

interface Evaluation {
  grammar: number;
  vocabulary: number;
  relevance: number;
  total: number;
  feedback: string;
}

export default function DialogPage() {
  const { language } = useLanguage();
  const [screen, setScreen] = useState<Screen>("start");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [level, setLevel] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [pointsEarned, setPointsEarned] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const handleStartNew = () => {
    setScreen("level");
  };

  const handleLevelSelect = async (selectedLevel: string) => {
    setLevel(selectedLevel);
    setLoading(true);

    try {
      const response = await api.post("/api/dialog/start", {
        language,
        level: selectedLevel,
      });

      setSessionId(response.data.session_id);
      setCategories(response.data.categories);
      setScreen("category");
    } catch (error) {
      console.error("Failed to start dialog:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = async (category: string) => {
    setSelectedCategory(category);
    setLoading(true);

    try {
      await api.post(`/api/dialog/${sessionId}/select-category`, {
        category,
      });
      setScreen("chat");
    } catch (error) {
      console.error("Failed to select category:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDialogFinish = (eval_: Evaluation, points: number) => {
    setEvaluation(eval_);
    setPointsEarned(points);
    setScreen("evaluation");
  };

  const handleBackToStart = () => {
    setScreen("start");
    setSessionId(null);
    setLevel("");
    setCategories([]);
    setSelectedCategory("");
    setEvaluation(null);
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Dialog RPG</h1>

      {screen === "start" && (
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h2 className="text-xl mb-4">Ćwicz konwersacje w życiowych sytuacjach</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Rozmawiaj z wirtualnymi postaciami, a narrator pomoże Ci zrozumieć kontekst.
            </p>
            <div className="flex gap-4">
              <Button onClick={handleStartNew} className="flex-1">
                🎭 Nowa rozmowa
              </Button>
              <Button onClick={() => setScreen("history")} variant="outline" className="flex-1">
                📜 Historia
              </Button>
            </div>
          </Card>
        </div>
      )}

      {screen === "history" && (
        <DialogHistory
          language={language}
          onBack={handleBackToStart}
          onSelectSession={(id) => {
            setSessionId(id);
            // TODO: load session details
          }}
        />
      )}

      {screen === "level" && (
        <LevelSelector
          onSelect={handleLevelSelect}
          onBack={handleBackToStart}
          loading={loading}
        />
      )}

      {screen === "category" && (
        <CategorySelector
          categories={categories}
          onSelect={handleCategorySelect}
          onBack={() => setScreen("level")}
          loading={loading}
        />
      )}

      {screen === "chat" && sessionId && (
        <DialogChat
          sessionId={sessionId}
          level={level}
          category={selectedCategory}
          onFinish={handleDialogFinish}
          onBack={handleBackToStart}
        />
      )}

      {screen === "evaluation" && evaluation && (
        <DialogEvaluation
          evaluation={evaluation}
          pointsEarned={pointsEarned}
          onNewDialog={handleStartNew}
          onHistory={() => setScreen("history")}
        />
      )}
    </div>
  );
}
```

### 1.5.3 `frontend/src/components/dialog/DialogMessage.tsx`

```tsx
interface DialogMessageProps {
  role: "narrator" | "npc" | "user";
  content: string;
  npcName?: string;
}

export default function DialogMessage({ role, content, npcName }: DialogMessageProps) {
  if (role === "narrator") {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg mx-4 my-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-amber-600">🎭</span>
          <span className="font-semibold text-amber-700 dark:text-amber-400">Narrator</span>
        </div>
        <p className="text-gray-700 dark:text-gray-300">{content}</p>
      </div>
    );
  }

  if (role === "npc") {
    return (
      <div className="flex gap-3 mx-4 my-2">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <span>👤</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[70%]">
          {npcName && (
            <p className="font-medium text-sm text-blue-600 dark:text-blue-400 mb-1">{npcName}</p>
          )}
          <p className="text-gray-800 dark:text-gray-200">{content}</p>
        </div>
      </div>
    );
  }

  // user
  return (
    <div className="flex justify-end mx-4 my-2">
      <div className="bg-blue-500 text-white p-3 rounded-2xl rounded-tr-none max-w-[70%]">
        <p>{content}</p>
      </div>
    </div>
  );
}
```

### 1.5.4 `frontend/src/components/dialog/TypingIndicator.tsx`

```tsx
export default function TypingIndicator() {
  return (
    <div className="flex gap-3 mx-4 my-2">
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
        <span>👤</span>
      </div>
      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl rounded-tl-none">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
        </div>
      </div>
    </div>
  );
}
```

### 1.5.5 `frontend/src/components/dialog/DialogChat.tsx`

```tsx
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DialogMessage from "./DialogMessage";
import TypingIndicator from "./TypingIndicator";
import api from "@/lib/api";

interface Message {
  role: "narrator" | "npc" | "user";
  content: string;
}

interface Evaluation {
  grammar: number;
  vocabulary: number;
  relevance: number;
  total: number;
  feedback: string;
}

interface DialogChatProps {
  sessionId: number;
  level: string;
  category: string;
  onFinish: (evaluation: Evaluation, points: number) => void;
  onBack: () => void;
}

export default function DialogChat({ sessionId, level, category, onFinish, onBack }: DialogChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async () => {
    try {
      const response = await api.get(`/api/dialog/${sessionId}`);
      const loadedMessages = response.data.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Failed to load session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Dodaj wiadomość użytkownika od razu
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await api.post(`/api/dialog/${sessionId}/message`, {
        content: userMessage,
      });

      const { narrator_reaction, npc_response, is_finished, evaluation } = response.data;

      // Dodaj reakcję narratora jeśli jest
      if (narrator_reaction) {
        setMessages((prev) => [...prev, { role: "narrator", content: narrator_reaction }]);
      }

      // Dodaj odpowiedź NPC jeśli jest
      if (npc_response) {
        setMessages((prev) => [...prev, { role: "npc", content: npc_response }]);
      }

      // Jeśli zakończone
      if (is_finished && evaluation) {
        // Pobierz punkty z sesji
        const sessionResponse = await api.get(`/api/dialog/${sessionId}`);
        const points = sessionResponse.data.session.points_earned || 0;
        onFinish(evaluation, points);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return <div className="text-center py-8">Ładowanie...</div>;
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 dark:bg-gray-800">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">Poziom: {level}</span>
            <span className="mx-2">•</span>
            <span className="text-sm text-gray-500">{category}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            ✕
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {messages.map((msg, index) => (
          <DialogMessage key={index} role={msg.role} content={msg.content} />
        ))}
        {sending && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Napisz odpowiedź..."
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()}>
            Wyślij
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 1.5.6 `frontend/src/components/dialog/DialogEvaluation.tsx`

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Evaluation {
  grammar: number;
  vocabulary: number;
  relevance: number;
  total: number;
  feedback: string;
}

interface DialogEvaluationProps {
  evaluation: Evaluation;
  pointsEarned: number;
  onNewDialog: () => void;
  onHistory: () => void;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-28 text-sm">{label}</span>
      <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-12 text-right font-medium">{score}%</span>
    </div>
  );
}

export default function DialogEvaluation({
  evaluation,
  pointsEarned,
  onNewDialog,
  onHistory,
}: DialogEvaluationProps) {
  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <span className="text-4xl">🎉</span>
        <h2 className="text-2xl font-bold mt-2">Rozmowa zakończona!</h2>
      </div>

      <div className="space-y-3 mb-6">
        <ScoreBar label="Gramatyka" score={evaluation.grammar} />
        <ScoreBar label="Słownictwo" score={evaluation.vocabulary} />
        <ScoreBar label="Trafność" score={evaluation.relevance} />
        <hr className="my-2" />
        <ScoreBar label="ŁĄCZNIE" score={evaluation.total} />
      </div>

      <div className="text-center mb-6">
        <span className="text-2xl font-bold text-green-600">
          +{pointsEarned} punktów 🏆
        </span>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
        <p className="text-gray-700 dark:text-gray-300">{evaluation.feedback}</p>
      </div>

      <div className="flex gap-4">
        <Button onClick={onHistory} variant="outline" className="flex-1">
          📜 Historia
        </Button>
        <Button onClick={onNewDialog} className="flex-1">
          🎭 Nowa rozmowa
        </Button>
      </div>
    </Card>
  );
}
```

### 1.5.7 `frontend/src/components/dialog/LevelSelector.tsx`

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const LEVELS = [
  { id: "A1", name: "A1 - Początkujący", desc: "Proste słowa i zdania" },
  { id: "A2", name: "A2 - Podstawowy", desc: "Codzienne sytuacje" },
  { id: "B1", name: "B1 - Średniozaawansowany", desc: "Swobodna rozmowa" },
  { id: "B2", name: "B2 - Wyższy średni", desc: "Złożone tematy" },
  { id: "C1", name: "C1 - Zaawansowany", desc: "Płynna komunikacja" },
  { id: "C2", name: "C2 - Biegły", desc: "Poziom natywny" },
];

interface LevelSelectorProps {
  onSelect: (level: string) => void;
  onBack: () => void;
  loading: boolean;
}

export default function LevelSelector({ onSelect, onBack, loading }: LevelSelectorProps) {
  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        ← Wstecz
      </Button>

      <h2 className="text-xl font-bold mb-4">Wybierz poziom trudności</h2>

      <div className="grid gap-3">
        {LEVELS.map((level) => (
          <Card
            key={level.id}
            className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => !loading && onSelect(level.id)}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{level.name}</h3>
                <p className="text-sm text-gray-500">{level.desc}</p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="text-center mt-4 text-gray-500">
          Generowanie scenariuszy...
        </div>
      )}
    </div>
  );
}
```

### 1.5.8 `frontend/src/components/dialog/CategorySelector.tsx`

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CategorySelectorProps {
  categories: string[];
  onSelect: (category: string) => void;
  onBack: () => void;
  loading: boolean;
}

export default function CategorySelector({
  categories,
  onSelect,
  onBack,
  loading
}: CategorySelectorProps) {
  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        ← Wstecz
      </Button>

      <h2 className="text-xl font-bold mb-4">Wybierz scenariusz</h2>

      <div className="grid gap-3">
        {categories.map((category, index) => (
          <Card
            key={index}
            className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onClick={() => !loading && onSelect(category)}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{category}</h3>
              <span className="text-2xl">→</span>
            </div>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="text-center mt-4 text-gray-500">
          Przygotowywanie scenariusza...
        </div>
      )}
    </div>
  );
}
```

### 1.5.9 `frontend/src/components/dialog/DialogHistory.tsx`

```tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import api from "@/lib/api";

interface Session {
  id: number;
  language: string;
  level: string;
  category: string;
  started_at: string;
  score_total: number | null;
  points_earned: number | null;
}

interface Stats {
  total_sessions: number;
  avg_score: number;
  best_score: number;
  favorite_category: string | null;
  total_points_earned: number;
}

interface DialogHistoryProps {
  language: string;
  onBack: () => void;
  onSelectSession: (id: number) => void;
}

export default function DialogHistory({ language, onBack, onSelectSession }: DialogHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [language]);

  const loadHistory = async () => {
    try {
      const response = await api.get(`/api/dialog/history?language=${language}`);
      setSessions(response.data.sessions);
      setStats(response.data.stats);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Ładowanie...</div>;
  }

  return (
    <div>
      <Button variant="ghost" onClick={onBack} className="mb-4">
        ← Wstecz
      </Button>

      {/* Stats */}
      {stats && stats.total_sessions > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold mb-3">📊 Statystyki</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Rozmów:</span>
              <span className="ml-2 font-medium">{stats.total_sessions}</span>
            </div>
            <div>
              <span className="text-gray-500">Średni wynik:</span>
              <span className="ml-2 font-medium">{stats.avg_score.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-gray-500">Najlepszy:</span>
              <span className="ml-2 font-medium">{stats.best_score}%</span>
            </div>
            <div>
              <span className="text-gray-500">Punkty:</span>
              <span className="ml-2 font-medium">{stats.total_points_earned} 🏆</span>
            </div>
            {stats.favorite_category && (
              <div className="col-span-2">
                <span className="text-gray-500">Ulubiona kategoria:</span>
                <span className="ml-2 font-medium">{stats.favorite_category}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Sessions list */}
      <h2 className="text-xl font-bold mb-4">Historia rozmów</h2>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Brak zapisanych rozmów. Rozpocznij swoją pierwszą!
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.id}
              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              onClick={() => onSelectSession(session.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{session.category}</h3>
                  <p className="text-sm text-gray-500">
                    {session.level} • {new Date(session.started_at).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <div className="text-right">
                  {session.score_total !== null && (
                    <span className="font-bold text-lg">{session.score_total}%</span>
                  )}
                  {session.points_earned !== null && (
                    <p className="text-sm text-green-600">+{session.points_earned} pkt</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 1.5.10 Routing — dodaj do `frontend/src/App.tsx`:

```tsx
import DialogPage from "@/pages/student/DialogPage";

// W routes:
<Route path="/dialog" element={<DialogPage />} />
```

### 1.5.11 Nawigacja — dodaj link w menu studenta:

```tsx
<Link to="/dialog">🎭 Dialog RPG</Link>
```

---

## 1.6 Gamifikacja

### Dodaj do `app/gamification.py`:

```python
def calculate_dialog_points(
    score_total: int,
    level: str,
    message_count: int
) -> int:
    """
    Oblicza punkty za ukończony dialog.

    Bazowe punkty: score_total / 2 (max 50 punktów)
    Mnożnik poziomu:
        A1: x1.0, A2: x1.2, B1: x1.5, B2: x1.8, C1: x2.0, C2: x2.5
    Bonus za długość: +2 punkty za każdą wymianę powyżej 3
    """
    LEVEL_MULTIPLIERS = {
        "A1": 1.0,
        "A2": 1.2,
        "B1": 1.5,
        "B2": 1.8,
        "C1": 2.0,
        "C2": 2.5
    }

    base_points = score_total / 2
    multiplier = LEVEL_MULTIPLIERS.get(level, 1.0)
    length_bonus = max(0, (message_count - 3) * 2)

    total = int(base_points * multiplier + length_bonus)
    return min(total, 150)  # cap na 150 punktów za dialog
```

---

# 2. Znajdź intruza

## 2.1 Opis funkcjonalności

Tryb quizowy gdzie użytkownik dostaje 4 słowa i musi znaleźć 2 intruzy (słowa niepasujące do kategorii).

### Kluczowe cechy

- **Format:** 4 słowa, 2 pasują do kategorii, 2 to intruzy
- **Podpowiedź:** Kategoria wyświetlana w języku docelowym
- **Struktura:** Grupy → elementy (jak inne tryby)
- **Generowanie:** Admin przez AI lub CSV
- **Tłumaczenia:** Widoczne tylko po sprawdzeniu

---

## 2.2 Baza danych

### Dodaj do `app/models.py`:

```python
class FindIntruderGroup(SQLModel, table=True):
    """Grupa zestawów 'znajdź intruza'"""
    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str | None = None
    language: TargetLanguage  # fr / en
    level: str  # A1, A2, B1, B2, C1, C2
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FindIntruderItem(SQLModel, table=True):
    """Pojedynczy zestaw: 4 słowa, 2 intruzy"""
    id: int | None = Field(default=None, primary_key=True)
    group_id: int = Field(foreign_key="findintrudergroup.id")

    # 2 słowa pasujące do kategorii
    word1: str
    word1_translation: str
    word2: str
    word2_translation: str

    # 2 intruzy
    word3: str
    word3_translation: str
    word4: str
    word4_translation: str

    # Podpowiedź kategorii (w języku docelowym)
    category_hint: str  # np. "les fruits"


class FindIntruderProgress(SQLModel, table=True):
    """Postęp użytkownika"""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    item_id: int = Field(foreign_key="findintruderitem.id")
    completed: bool = False
    correct: bool = False
    attempts: int = 0
    last_attempt_at: datetime | None = None
```

---

## 2.3 API Endpoints

### Dodaj do `app/main.py`:

```python
# ============================================
# FIND INTRUDER ENDPOINTS
# ============================================

# === Pydantic Models ===

class FindIntruderGroupCreate(BaseModel):
    name: str
    description: str | None = None
    language: str
    level: str


class FindIntruderItemCreate(BaseModel):
    word1: str
    word1_translation: str
    word2: str
    word2_translation: str
    word3: str
    word3_translation: str
    word4: str
    word4_translation: str
    category_hint: str


class FindIntruderAnswerRequest(BaseModel):
    selected_indices: list[int]  # indeksy 0-3, użytkownik wybiera 2


class FindIntruderGenerateRequest(BaseModel):
    count: int
    level: str


# === Admin Endpoints ===

@app.get("/api/find-intruder/groups")
async def get_find_intruder_groups(
    language: str | None = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Pobierz grupy znajdź intruza"""
    query = select(FindIntruderGroup)
    if language:
        query = query.where(FindIntruderGroup.language == language)

    groups = session.exec(query.order_by(FindIntruderGroup.created_at.desc())).all()
    return groups


@app.post("/api/find-intruder/groups")
async def create_find_intruder_group(
    request: FindIntruderGroupCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Utwórz grupę (admin)"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin only")

    group = FindIntruderGroup(**request.dict())
    session.add(group)
    session.commit()
    session.refresh(group)
    return group


@app.delete("/api/find-intruder/groups/{group_id}")
async def delete_find_intruder_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Usuń grupę (admin)"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin only")

    group = session.get(FindIntruderGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Usuń elementy i postęp
    items = session.exec(
        select(FindIntruderItem).where(FindIntruderItem.group_id == group_id)
    ).all()

    for item in items:
        session.exec(
            delete(FindIntruderProgress).where(FindIntruderProgress.item_id == item.id)
        )
        session.delete(item)

    session.delete(group)
    session.commit()
    return {"status": "deleted"}


@app.get("/api/find-intruder/groups/{group_id}/items")
async def get_find_intruder_items(
    group_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Pobierz elementy grupy"""
    items = session.exec(
        select(FindIntruderItem).where(FindIntruderItem.group_id == group_id)
    ).all()
    return items


@app.post("/api/find-intruder/groups/{group_id}/items")
async def create_find_intruder_item(
    group_id: int,
    request: FindIntruderItemCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Dodaj element (admin)"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin only")

    item = FindIntruderItem(group_id=group_id, **request.dict())
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.delete("/api/find-intruder/items/{item_id}")
async def delete_find_intruder_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Usuń element (admin)"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin only")

    item = session.get(FindIntruderItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    session.exec(delete(FindIntruderProgress).where(FindIntruderProgress.item_id == item_id))
    session.delete(item)
    session.commit()
    return {"status": "deleted"}


@app.post("/api/find-intruder/groups/{group_id}/generate")
async def generate_find_intruder_items(
    group_id: int,
    request: FindIntruderGenerateRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Generuj elementy przez AI (admin)"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin only")

    group = session.get(FindIntruderGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    prompt = PROMPT_GENERATE_INTRUDERS.format(
        count=request.count,
        language="French" if group.language == "fr" else "English",
        level=request.level
    )

    client = get_openai_client()
    response = client.responses.create(model="gpt-5-nano", input=prompt)

    items_data = json.loads(clean_json_response(response.output_text))

    created = []
    for item_data in items_data:
        item = FindIntruderItem(group_id=group_id, **item_data)
        session.add(item)
        created.append(item)

    session.commit()

    for item in created:
        session.refresh(item)

    return created


# === Student Endpoints ===

@app.get("/api/find-intruder/groups/{group_id}/study")
async def study_find_intruder(
    group_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Pobierz elementy do nauki (z losową kolejnością słów)"""
    items = session.exec(
        select(FindIntruderItem).where(FindIntruderItem.group_id == group_id)
    ).all()

    # Pobierz postęp użytkownika
    progress_map = {}
    progresses = session.exec(
        select(FindIntruderProgress).where(
            FindIntruderProgress.user_id == current_user.id,
            FindIntruderProgress.item_id.in_([i.id for i in items])
        )
    ).all()

    for p in progresses:
        progress_map[p.item_id] = p

    result = []
    for item in items:
        # Losowa kolejność słów (indeksy 0-3)
        import random
        indices = [0, 1, 2, 3]
        random.shuffle(indices)

        words = [
            {"index": 0, "word": item.word1},
            {"index": 1, "word": item.word2},
            {"index": 2, "word": item.word3},
            {"index": 3, "word": item.word4},
        ]

        shuffled_words = [words[i] for i in indices]

        progress = progress_map.get(item.id)

        result.append({
            "id": item.id,
            "category_hint": item.category_hint,
            "words": shuffled_words,
            "completed": progress.completed if progress else False,
            "correct": progress.correct if progress else None,
        })

    return result


@app.post("/api/find-intruder/items/{item_id}/answer")
async def answer_find_intruder(
    item_id: int,
    request: FindIntruderAnswerRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Sprawdź odpowiedź"""
    item = session.get(FindIntruderItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Poprawne intruzy to indeksy 2 i 3
    correct_indices = {2, 3}
    selected_set = set(request.selected_indices)

    is_correct = selected_set == correct_indices

    # Pobierz lub utwórz postęp
    progress = session.exec(
        select(FindIntruderProgress).where(
            FindIntruderProgress.user_id == current_user.id,
            FindIntruderProgress.item_id == item_id
        )
    ).first()

    if not progress:
        progress = FindIntruderProgress(
            user_id=current_user.id,
            item_id=item_id
        )

    progress.attempts += 1
    progress.last_attempt_at = datetime.utcnow()

    if is_correct:
        progress.completed = True
        progress.correct = True

    session.add(progress)

    # Oblicz punkty
    points = 0
    if is_correct:
        points = calculate_intruder_points(True, progress.attempts)
        current_user.total_points = (current_user.total_points or 0) + points
        session.add(current_user)

    session.commit()

    return {
        "correct": is_correct,
        "points": points,
        "correct_indices": list(correct_indices),
        "words_with_translations": [
            {"word": item.word1, "translation": item.word1_translation, "is_intruder": False},
            {"word": item.word2, "translation": item.word2_translation, "is_intruder": False},
            {"word": item.word3, "translation": item.word3_translation, "is_intruder": True},
            {"word": item.word4, "translation": item.word4_translation, "is_intruder": True},
        ]
    }
```

---

## 2.4 Prompty AI

### Dodaj do `app/main.py`:

```python
PROMPT_GENERATE_INTRUDERS = """Generate {count} "find the intruder" word sets for {language} language learning at {level} level.

Each set has:
- 2 words that belong to a category (word1, word2)
- 2 intruder words that DON'T belong (word3, word4)
- A category hint in {language} (e.g., "les fruits" for French, "fruits" for English)

Requirements:
- Words appropriate for {level} level
- Clear distinction between category words and intruders
- Intruders should be somewhat tricky but fair (not obviously wrong like mixing nouns with verbs)
- Include Polish translations for all words
- Category hint must be in {language}, not Polish

Good example (French, A2):
{{
    "word1": "pomme",
    "word1_translation": "jabłko",
    "word2": "orange",
    "word2_translation": "pomarańcza",
    "word3": "voiture",
    "word3_translation": "samochód",
    "word4": "maison",
    "word4_translation": "dom",
    "category_hint": "les fruits"
}}

Return JSON array only:
[
    {{ ... }},
    ...
]

Generate exactly {count} varied sets (different categories):"""
```

---

## 2.5 Frontend

### 2.5.1 Nowe pliki:

```
frontend/src/
├── pages/
│   ├── student/
│   │   └── FindIntruderStudyPage.tsx
│   └── admin/
│       └── FindIntruderAdmin.tsx
├── components/admin/
│   ├── FindIntruderGroupDialog.tsx
│   └── GenerateFindIntruderDialog.tsx
```

### 2.5.2 `frontend/src/pages/student/FindIntruderStudyPage.tsx`

```tsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import api from "@/lib/api";

interface Word {
  index: number;
  word: string;
}

interface Item {
  id: number;
  category_hint: string;
  words: Word[];
  completed: boolean;
}

interface AnswerResult {
  correct: boolean;
  points: number;
  correct_indices: number[];
  words_with_translations: Array<{
    word: string;
    translation: string;
    is_intruder: boolean;
  }>;
}

export default function FindIntruderStudyPage() {
  const { groupId } = useParams();
  const [items, setItems] = useState<Item[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [groupId]);

  const loadItems = async () => {
    try {
      const response = await api.get(`/api/find-intruder/groups/${groupId}/study`);
      setItems(response.data.filter((item: Item) => !item.completed));
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentItem = items[currentIndex];

  const toggleSelect = (index: number) => {
    if (result) return; // Już sprawdzone

    if (selected.includes(index)) {
      setSelected(selected.filter((i) => i !== index));
    } else if (selected.length < 2) {
      setSelected([...selected, index]);
    }
  };

  const handleCheck = async () => {
    if (selected.length !== 2) return;

    try {
      const response = await api.post(
        `/api/find-intruder/items/${currentItem.id}/answer`,
        { selected_indices: selected.map((i) => currentItem.words[i].index) }
      );
      setResult(response.data);
      setTotalPoints((prev) => prev + response.data.points);
    } catch (error) {
      console.error("Failed to check answer:", error);
    }
  };

  const handleNext = () => {
    setSelected([]);
    setResult(null);
    setCurrentIndex((prev) => prev + 1);
  };

  if (loading) {
    return <div className="text-center py-8">Ładowanie...</div>;
  }

  if (items.length === 0 || currentIndex >= items.length) {
    return (
      <div className="container mx-auto p-4 max-w-2xl text-center">
        <Card className="p-8">
          <span className="text-4xl">🎉</span>
          <h2 className="text-2xl font-bold mt-4">Gratulacje!</h2>
          <p className="text-gray-600 mt-2">Ukończyłeś wszystkie zadania!</p>
          <p className="text-xl font-bold text-green-600 mt-4">
            Zdobyte punkty: {totalPoints} 🏆
          </p>
        </Card>
      </div>
    );
  }

  const getWordStyle = (wordIndex: number) => {
    const originalIndex = currentItem.words[wordIndex].index;

    if (result) {
      const isIntruder = result.correct_indices.includes(originalIndex);
      const wasSelected = selected.includes(wordIndex);

      if (isIntruder && wasSelected) {
        return "border-green-500 bg-green-50 dark:bg-green-900/20";
      } else if (isIntruder && !wasSelected) {
        return "border-orange-500 bg-orange-50 dark:bg-orange-900/20 animate-pulse";
      } else if (!isIntruder && wasSelected) {
        return "border-red-500 bg-red-50 dark:bg-red-900/20";
      }
      return "border-gray-200";
    }

    if (selected.includes(wordIndex)) {
      return "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300";
    }

    return "border-gray-200 hover:border-gray-400";
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Znajdź intruza</h1>
        <div className="text-sm">
          {currentIndex + 1}/{items.length} • 🏆 {totalPoints} pkt
        </div>
      </div>

      {/* Card */}
      <Card className="p-6">
        <div className="text-center mb-6">
          <span className="text-sm text-gray-500">Podpowiedź:</span>
          <p className="text-lg font-semibold">🏷️ {currentItem.category_hint}</p>
        </div>

        <p className="text-center mb-6 text-gray-600">
          Znajdź 2 słowa, które <strong>NIE</strong> pasują:
        </p>

        {/* Words grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {currentItem.words.map((word, index) => (
            <button
              key={index}
              onClick={() => toggleSelect(index)}
              disabled={!!result}
              className={`p-4 border-2 rounded-lg text-center transition-all ${getWordStyle(index)}`}
            >
              <p className="font-semibold text-lg">{word.word}</p>
              {result && (
                <p className="text-sm text-gray-500 mt-1">
                  ({result.words_with_translations.find((w) => w.word === word.word)?.translation})
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Result message */}
        {result && (
          <div className={`text-center mb-4 p-3 rounded-lg ${
            result.correct
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}>
            {result.correct ? (
              <span>✅ Dobrze! +{result.points} punktów</span>
            ) : (
              <span>❌ Niepoprawnie. Spróbuj jeszcze raz!</span>
            )}
          </div>
        )}

        {/* Button */}
        {!result ? (
          <Button
            onClick={handleCheck}
            disabled={selected.length !== 2}
            className="w-full"
          >
            Sprawdź
          </Button>
        ) : result.correct ? (
          <Button onClick={handleNext} className="w-full">
            Dalej →
          </Button>
        ) : (
          <Button
            onClick={() => {
              setSelected([]);
              setResult(null);
            }}
            className="w-full"
          >
            Spróbuj ponownie
          </Button>
        )}
      </Card>
    </div>
  );
}
```

### 2.5.3 Routing — dodaj:

```tsx
import FindIntruderStudyPage from "@/pages/student/FindIntruderStudyPage";

<Route path="/find-intruder/:groupId/study" element={<FindIntruderStudyPage />} />
```

### 2.5.4 Admin panel — analogicznie do innych trybów (FiszkaAdmin, TranslateAdmin)

Skopiuj strukturę z istniejących plików admin, dostosowując pola formularza.

---

## 2.6 Gamifikacja

### Dodaj do `app/gamification.py`:

```python
def calculate_intruder_points(correct: bool, attempts: int) -> int:
    """
    Punkty za znajdź intruza:
    - Poprawnie za 1 razem: 10 punktów
    - Poprawnie za 2 razem: 5 punktów
    - Poprawnie za 3+ razem: 2 punkty
    - Niepoprawnie: 0 punktów
    """
    if not correct:
        return 0
    if attempts == 1:
        return 10
    elif attempts == 2:
        return 5
    return 2
```

---

# 3. Migracja bazy danych

### Utwórz plik: `alembic/versions/XXXXXX_add_dialog_and_find_intruder.py`

```python
"""Add dialog RPG and find intruder tables

Revision ID: XXXXXX
Revises: [poprzednia_rewizja]
Create Date: 2026-02-03
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'XXXXXX'
down_revision = '[poprzednia_rewizja]'
branch_labels = None
depends_on = None


def upgrade():
    # Dialog Session
    op.create_table(
        'dialogsession',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('score_grammar', sa.Integer(), nullable=True),
        sa.Column('score_vocabulary', sa.Integer(), nullable=True),
        sa.Column('score_relevance', sa.Integer(), nullable=True),
        sa.Column('score_total', sa.Integer(), nullable=True),
        sa.Column('points_earned', sa.Integer(), nullable=True),
    )
    op.create_index('ix_dialogsession_user_id', 'dialogsession', ['user_id'])

    # Dialog Message
    op.create_table(
        'dialogmessage',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('dialogsession.id'), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_dialogmessage_session_id', 'dialogmessage', ['session_id'])

    # Find Intruder Group
    op.create_table(
        'findintrudergroup',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Find Intruder Item
    op.create_table(
        'findintruderitem',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('findintrudergroup.id'), nullable=False),
        sa.Column('word1', sa.String(), nullable=False),
        sa.Column('word1_translation', sa.String(), nullable=False),
        sa.Column('word2', sa.String(), nullable=False),
        sa.Column('word2_translation', sa.String(), nullable=False),
        sa.Column('word3', sa.String(), nullable=False),
        sa.Column('word3_translation', sa.String(), nullable=False),
        sa.Column('word4', sa.String(), nullable=False),
        sa.Column('word4_translation', sa.String(), nullable=False),
        sa.Column('category_hint', sa.String(), nullable=False),
    )
    op.create_index('ix_findintruderitem_group_id', 'findintruderitem', ['group_id'])

    # Find Intruder Progress
    op.create_table(
        'findintruderprogress',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('findintruderitem.id'), nullable=False),
        sa.Column('completed', sa.Boolean(), default=False),
        sa.Column('correct', sa.Boolean(), default=False),
        sa.Column('attempts', sa.Integer(), default=0),
        sa.Column('last_attempt_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_findintruderprogress_user_id', 'findintruderprogress', ['user_id'])


def downgrade():
    op.drop_table('findintruderprogress')
    op.drop_table('findintruderitem')
    op.drop_table('findintrudergroup')
    op.drop_table('dialogmessage')
    op.drop_table('dialogsession')
```

---

# 4. Kroki implementacji

## Krok po kroku — Mini-dialogi RPG

### Backend

1. **models.py** — dodaj klasy `DialogSession` i `DialogMessage`
2. **main.py** — dodaj prompty AI (sekcja komentarzem `# DIALOG RPG PROMPTS`)
3. **main.py** — dodaj Pydantic models dla dialogów
4. **main.py** — dodaj endpointy (`/api/dialog/...`)
5. **gamification.py** — dodaj `calculate_dialog_points()`
6. **Migracja** — `alembic revision --autogenerate -m "add dialog tables"`
7. **Test lokalny** — `alembic upgrade head`, test endpointów przez `/docs`

### Frontend

8. **Utwórz folder** `frontend/src/components/dialog/`
9. **Utwórz komponenty:**
   - `TypingIndicator.tsx`
   - `DialogMessage.tsx`
   - `LevelSelector.tsx`
   - `CategorySelector.tsx`
   - `DialogChat.tsx`
   - `DialogEvaluation.tsx`
   - `DialogHistory.tsx`
10. **Utwórz stronę** `frontend/src/pages/student/DialogPage.tsx`
11. **Dodaj routing** w `App.tsx`
12. **Dodaj link** w menu studenta

---

## Krok po kroku — Znajdź intruza

### Backend

1. **models.py** — dodaj `FindIntruderGroup`, `FindIntruderItem`, `FindIntruderProgress`
2. **main.py** — dodaj prompt `PROMPT_GENERATE_INTRUDERS`
3. **main.py** — dodaj Pydantic models
4. **main.py** — dodaj endpointy (`/api/find-intruder/...`)
5. **gamification.py** — dodaj `calculate_intruder_points()`
6. **Migracja** — (razem z dialogami w jednej migracji)

### Frontend

7. **Utwórz stronę** `frontend/src/pages/student/FindIntruderStudyPage.tsx`
8. **Utwórz panel admin** `frontend/src/pages/admin/FindIntruderAdmin.tsx` (wzoruj na innych)
9. **Dodaj routing**
10. **Dodaj linki** w menu

---

## Deployment

1. **Commit wszystkich zmian**
2. **Push do main** — Railway automatycznie deployuje
3. **Sprawdź logi** — Railway uruchomi migracje

---

# 5. Decision Log

| # | Decyzja | Alternatywy | Powód |
|---|---------|-------------|-------|
| 1 | Mini-dialogi jako priorytet | Znajdź intruza najpierw | Najciekawszy tryb dla użytkownika |
| 2 | AI generuje scenariusze w locie | Pre-generowane / ręczne | Nieskończona różnorodność |
| 3 | Manualny wybór poziomu A1-C2 | Automatyczny / dynamiczny | Prostota, kontrola użytkownika |
| 4 | 3 losowe kategorie do wyboru | Sztywne / bez kategorii | Różnorodność + kontrola |
| 5 | Dialog niezależny od fiszek | Integracja ze słownictwem | Prostota implementacji |
| 6 | Ocena punktowa po zakończeniu | Po każdej odpowiedzi | Płynność dialogu |
| 7 | Pełna integracja z gamifikacją | Osobny system | Spójność aplikacji |
| 8 | 4 słowa, 2 intruzy | 4/1 lub 5-6/1 | Ciekawsza mechanika |
| 9 | Grupy + AI generowanie | Tylko AI w locie | Spójność z innymi trybami |
| 10 | Podpowiedź w języku docelowym | Po polsku | Immersja językowa |
| 11 | Tłumaczenia tylko po sprawdzeniu | Zawsze widoczne | Nauka bez podglądania |
| 12 | gpt-5-nano | Droższe modele | Spójność z projektem |

---

# Koniec dokumentacji

**Ostatnia aktualizacja:** 2026-02-03
**Autor:** Claude (brainstorming session)
