import os
import random
from openai import OpenAI
from enum import Enum


# Import TargetLanguage from models (or define inline for standalone use)
class TargetLanguage(str, Enum):
    FR = "fr"
    EN = "en"


# Scoring Constants
POINTS_BASE = {
    "A1": 10,
    "A2": 10,
    "B1": 20,
    "B2": 20,
    "C1": 30,
    "C2": 30,
}
DEFAULT_POINTS = 10
PENALTY_NEW_WORD = 4      # Kara za błąd przy nowym słowie
PENALTY_KNOWN_WORD = 10   # Kara za błąd przy znanym słowie
REVIEW_POINTS = 2         # Punkty za powtórzenie

def calculate_score(
    is_correct: bool,
    is_known: bool,  # czy fiszka/słowo było już w learned=True
    level: str | None = None,
    current_combo: int = 0
) -> dict:
    """
    Calculates points delta and triggers.
    Returns:
        {
            "points_delta": int,
            "new_combo_count": int,
            "is_combo_trigger": bool, # if we just hit a multiplier threshold
            "multiplier": float,
            "trigger_mini_game": bool
        }
    """

    delta = 0
    multiplier = 1.0
    # Determine base multiplier from current combo (before this answer updates it?)
    # Logic: usually combo increases AFTER a correct answer.
    # User requirement: "2 poprawne z rzędu: 1.2x"

    new_combo = current_combo
    trigger_mini_game = False

    if is_correct:
        new_combo += 1

        # Calculate Base Points
        if is_known:
            base = REVIEW_POINTS
        else:
            base = POINTS_BASE.get(level, DEFAULT_POINTS) if level else DEFAULT_POINTS

        # Determine Multiplier
        if new_combo >= 10:
            multiplier = 2.0
        elif new_combo >= 5:
            multiplier = 1.5
        elif new_combo >= 2:
            multiplier = 1.2
        else:
            multiplier = 1.0

        delta = int(base * multiplier)

        # Mini-game trigger (15% chance, simple random for now)
        # In real app, we might want to check "last_minigame_time" to enforce 5 min cooldown.
        # Logic for cooldown should be handled in the caller service, here just probability.
        if random.random() < 0.15:
            trigger_mini_game = True

    else:
        new_combo = 0 # Streak broken
        multiplier = 1.0

        if is_known:
            delta = -PENALTY_KNOWN_WORD
        else:
            delta = -PENALTY_NEW_WORD

    return {
        "points_delta": delta,
        "new_combo_count": new_combo,
        "multiplier": multiplier,
        "trigger_mini_game": trigger_mini_game
    }


# Wordle Logic - Fallback words per language
WORDLE_FALLBACK_WORDS = {
    TargetLanguage.FR: [
        "POMME", "LIVRE", "CHIEN", "CHAT", "TABLE",
        "JOUER", "AIMER", "VIVRE", "ROUGE", "VERTE",
        "GRAND", "PETIT", "NOIRE", "BLANC", "FLEUR",
        "MONDE", "TEMPS", "ECOLE", "PORTE", "ROUTE"
    ],
    TargetLanguage.EN: [
        "APPLE", "HOUSE", "WATER", "LIGHT", "HORSE",
        "CLOUD", "BREAD", "STONE", "GREEN", "WHITE",
        "DREAM", "HAPPY", "SMILE", "PLANT", "RIVER",
        "BEACH", "MUSIC", "HEART", "EARTH", "SPACE"
    ]
}

# Language-specific prompts for Wordle
WORDLE_PROMPTS = {
    TargetLanguage.FR: """Podaj JEDNO łatwe, popularne francuskie słowo składające się DOKŁADNIE z 5 liter.
Słowo powinno być:
- Rzeczownikiem lub przymiotnikiem
- Powszechnie znanym (poziom A1-A2)
- BEZ akcentów (np. ECOLE zamiast ÉCOLE)

Odpowiedz TYLKO samym słowem, wielkimi literami, bez żadnych dodatkowych znaków czy wyjaśnień.
Przykłady poprawnych odpowiedzi: POMME, LIVRE, CHIEN""",

    TargetLanguage.EN: """Podaj JEDNO łatwe, popularne angielskie słowo składające się DOKŁADNIE z 5 liter.
Słowo powinno być:
- Rzeczownikiem lub przymiotnikiem
- Powszechnie znanym (poziom A1-A2)

Odpowiedz TYLKO samym słowem, wielkimi literami, bez żadnych dodatkowych znaków czy wyjaśnień.
Przykłady poprawnych odpowiedzi: APPLE, HOUSE, WATER"""
}


def generate_wordle_word(level: str | None = None, language: TargetLanguage = TargetLanguage.FR) -> str:
    """Generates a 5-letter word using AI, with fallback to static list. Supports multiple languages."""
    fallback_words = WORDLE_FALLBACK_WORDS.get(language, WORDLE_FALLBACK_WORDS[TargetLanguage.FR])

    try:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            print(f"Wordle [{language.value}]: No API key, using fallback")
            return random.choice(fallback_words).upper()

        client = OpenAI(api_key=api_key)
        prompt = WORDLE_PROMPTS.get(language, WORDLE_PROMPTS[TargetLanguage.FR])

        response = client.responses.create(model="gpt-5-nano", input=prompt)
        word = response.output_text.strip().upper()

        # Validate: exactly 5 letters, only A-Z
        if len(word) == 5 and word.isalpha():
            print(f"Wordle [{language.value}]: AI generated word: {word}")
            return word
        else:
            print(f"Wordle [{language.value}]: AI returned invalid word '{word}', using fallback")
            return random.choice(fallback_words).upper()

    except Exception as e:
        print(f"Wordle [{language.value}]: AI error ({e}), using fallback")
        return random.choice(fallback_words).upper()


def check_wordle_guess(target: str, guess: str) -> list[str]:
    """
    Returns a list of statuses for each letter:
    'correct' (green), 'present' (yellow), 'absent' (gray)
    """
    target = target.upper()
    guess = guess.upper()

    result = ["absent"] * 5
    target_letters_count = {}

    # First pass: Correct letters
    for i in range(5):
        if guess[i] == target[i]:
            result[i] = "correct"
        else:
            target_letters_count[target[i]] = target_letters_count.get(target[i], 0) + 1

    # Second pass: Present letters
    for i in range(5):
        if result[i] != "correct":
            char = guess[i]
            if target_letters_count.get(char, 0) > 0:
                result[i] = "present"
                target_letters_count[char] -= 1

    return result
