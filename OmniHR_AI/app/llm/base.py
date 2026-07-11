from typing import Protocol


class LlmClient(Protocol):
    def complete_json(self, messages: list[dict[str, str]]) -> str:
        raise NotImplementedError


class LlmClientError(RuntimeError):
    pass
