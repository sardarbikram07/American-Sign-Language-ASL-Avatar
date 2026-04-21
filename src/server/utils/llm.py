import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from google.api_core.exceptions import ResourceExhausted

from utils.store import Store

load_dotenv()


class LLM:
    def __init__(self):
        self.api_keys = []
        # Load all available Google API keys
        for i in range(1, 10):  # Support up to 9 keys
            key = os.getenv(f"GOOGLE_API_KEY_{i}")
            if key and key.strip() and not key.startswith("YOUR_") and not key.endswith("_API_KEY_HERE"):
                self.api_keys.append(key)
        
        # Fallback to the original key if no numbered keys
        if not self.api_keys:
            key = os.getenv("GOOGLE_API_KEY")
            if key:
                self.api_keys.append(key)
        
        if not self.api_keys:
            raise ValueError("No Google API keys found in environment variables")
        
        print(f"Loaded {len(self.api_keys)} API keys for fallback")
        self.current_key_index = 0
        self.llm = self._create_llm()

    def _create_llm(self):
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=self.api_keys[self.current_key_index],
        )

    def _switch_key(self):
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        self.llm = self._create_llm()
        print(f"Switched to API key {self.current_key_index + 1}")

    def _invoke_with_fallback(self, prompt_template, inputs):
        max_retries = len(self.api_keys)
        for attempt in range(max_retries):
            try:
                chain = prompt_template | self.llm
                response = chain.invoke(inputs)
                print(f"Successfully used API key {self.current_key_index + 1}")
                return response
            except Exception as e:
                error_msg = str(e).lower()
                # Check if it's a quota/rate limit error
                if 'quota' in error_msg or 'rate limit' in error_msg or 'resourceexhausted' in error_msg or '429' in error_msg:
                    print(f"Rate limit hit with key {self.current_key_index + 1} (attempt {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:  # Don't switch on the last attempt
                        self._switch_key()
                        continue
                # For other errors, don't retry
                print(f"Non-retryable error with key {self.current_key_index + 1}: {str(e)[:200]}...")
                raise e

    llm = None  # Will be set in __init__

    EXPRESSIVE_PROMPT = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are meant to convert text from English to ASL Gloss grammar. Do not change meaning or move periods. I will send you a phrase, please rephrase it "
                "it to follow ASL grammar order: object, then subject, then verb. Remove words like IS and ARE that are not present in ASL. "
                "Replace I with ME. Do not add classifiers. Everything should be English text. Please output nothing but the rephrased phrase.",
            ),
            ("human", "{transcription}"),
        ]
    )

    CORRECTION_PROMPT = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are an intelligent spell checker for sign language recognition transcripts. Your task is to correct obvious spelling errors while preserving the original meaning and context.\n\n"
                "Guidelines:\n"
                "- Fix clear typos and misspelled words (e.g., 'teh' → 'the', 'recieve' → 'receive')\n"
                "- Correct homophones only when the context clearly indicates an error (e.g., 'their' vs 'there' vs 'they're')\n"
                "- Do NOT change words that could be correct in context or proper nouns\n"
                "- Preserve the original capitalization and punctuation\n"
                "- If the text is already correct, return it unchanged\n"
                "- Output ONLY the corrected text with no explanations or additional content\n\n"
                "Examples:\n"
                "- Input: 'hllo wrld' → Output: 'hello world'\n"
                "- Input: 'I went to the store' → Output: 'I went to the store' (no change needed)\n"
                "- Input: 'recieve my package' → Output: 'receive my package'",
            ),
            ("human", "{text}"),
        ]
    )

    def gloss(self, transcription):

        raw_transcription = " ".join(transcription)
        response = self._invoke_with_fallback(
            self.EXPRESSIVE_PROMPT,
            {
                "transcription": raw_transcription,
            }
        )

        print(response.content.strip())

        return response.content.strip().split()

    def correct(self, text):

        response = self._invoke_with_fallback(self.CORRECTION_PROMPT, {"text": text})
        return response.content.strip()
