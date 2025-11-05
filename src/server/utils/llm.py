import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from utils.store import Store

load_dotenv()


class LLM:
    llm = ChatGoogleGenerativeAI(
        model="gemini-flash-lite-latest",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

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
    EXPRESSIVE_CHAIN = EXPRESSIVE_PROMPT | llm

    CORRECTION_PROMPT = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are a spell checker. Correct any spelling errors in the given text. Output only the corrected text, nothing else.",
            ),
            ("human", "{text}"),
        ]
    )
    CORRECTION_CHAIN = CORRECTION_PROMPT | llm

    def gloss(self, transcription):

        raw_transcription = " ".join(transcription)
        response = LLM.EXPRESSIVE_CHAIN.invoke(
            {
                "transcription": raw_transcription,
            }
        )

        print(response.content.strip())

        return response.content.strip().split()

    def correct(self, text):

        response = LLM.CORRECTION_CHAIN.invoke({"text": text})
        return response.content.strip()
