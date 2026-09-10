from typing import Protocol


class LlmClient(Protocol):
    def complete_json(self, messages: list[dict[str, str]]) -> str:
        raise NotImplementedError


class EmbeddingClient(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Returns one vector per input text, in the same order."""
        raise NotImplementedError


class LlmClientError(RuntimeError):
    pass


class EmbeddingClientError(RuntimeError):
    pass
