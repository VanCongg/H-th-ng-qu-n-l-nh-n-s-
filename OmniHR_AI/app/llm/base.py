# Giao diện chung cho nhà cung cấp LLM và embedding; thêm nhà cung cấp mới thì cài theo giao diện này.

from typing import Protocol


# LLM: nhận danh sách message, trả về chuỗi JSON.
class LlmClient(Protocol):
    def complete_json(self, messages: list[dict[str, str]]) -> str:
        raise NotImplementedError


# Embedding: nhận danh sách văn bản, trả về một vector cho mỗi văn bản.
class EmbeddingClient(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Returns one vector per input text, in the same order."""
        raise NotImplementedError


class LlmClientError(RuntimeError):
    pass


class EmbeddingClientError(RuntimeError):
    pass
