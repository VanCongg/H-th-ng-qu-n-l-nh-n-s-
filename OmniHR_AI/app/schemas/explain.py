from pydantic import BaseModel, Field


class ExplainCandidate(BaseModel):
    """One ranked candidate, with the numbers NestJS already computed."""

    employeeId: int
    fullName: str
    score: float
    skillScore: float | None = None
    workloadScore: float | None = None
    availabilityScore: float | None = None
    eligible: bool = True
    matchedSkills: list[str] = Field(default_factory=list)
    missingRequiredSkills: list[str] = Field(default_factory=list)
    missingImportantSkills: list[str] = Field(default_factory=list)
    activeTaskCount: int | None = None
    availableHours: float | None = None
    warnings: list[str] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    taskTitle: str
    requiredSkills: list[str] = Field(default_factory=list)
    candidates: list[ExplainCandidate]


class Explanation(BaseModel):
    employeeId: int
    reason: str


class ExplainResponse(BaseModel):
    """
    Empty `explanations` is a valid answer: NestJS then keeps the sentence it
    built itself, so a missing LLM key never costs the manager an explanation.
    """

    explanations: list[Explanation] = Field(default_factory=list)
    source: str = "llm"
