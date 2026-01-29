
from openai import OpenAI
import os
from dotenv import load_dotenv
import json

load_dotenv()

def generate_ai_content_test(level: str, count: int, target_lang: str = "francuski"):
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    prompt = f"""
    Wygeneruj {count} zdań w języku polskim na poziomie {level} oraz ich tłumaczenia na język {target_lang}.
    Zwróć odpowiedź w formacie JSON jako listę obiektów, gdzie każdy obiekt ma klucze 'text_pl' i 'text_target'.
    Przykład:
    [
        {{"text_pl": "Dzień dobry", "text_target": "Bonjour"}},
        {{"text_pl": "Jak się masz?", "text_target": "Comment ça va?"}}
    ]
    Nie dodawaj żadnego innego tekstu, tylko surowy JSON.
    """
    
    try:
        response = client.responses.create(
            model="gpt-5-nano",
            input=prompt
        )
        print("\n\nToken usage info (mocked/if available):", getattr(response, 'usage', 'N/A'))
        print("Output:", response.output_text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_ai_content_test("A1", 3)
