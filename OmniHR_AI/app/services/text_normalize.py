import re
import unicodedata


def normalize(value: str) -> str:
    """Lowercase, strip Vietnamese diacritics, collapse whitespace.

    Shared by the rule-based planner (intent matching) and the RAG
    service (retrieval tokenization) so both agree on what "the same
    word" means.
    """
    value = value.replace("đ", "d").replace("Đ", "D")
    without_accents = "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"\s+", " ", without_accents.lower()).strip()
