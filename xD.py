from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

response = client.responses.create(
    model="gpt-5-nano",
    input="Napisz mi jedno zdanie o tym jak działa AI."
)

print(response.output_text)