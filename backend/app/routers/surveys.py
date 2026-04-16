from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import verify_researcher_token
from app.models import Answer, Miner, Question, QuestionType, SurveyResponse
from app.schemas import SurveyResponseOut, SurveySubmit

router = APIRouter(prefix="/surveys", tags=["surveys"])


def _validate_answer(q: Question, item) -> None:
    if q.question_type == QuestionType.likert_5:
        if item.likert_value is None:
            raise HTTPException(status_code=400, detail=f"Question {q.id} requires likert_value 1-5")
        if item.bool_value is not None or item.text_value is not None:
            raise HTTPException(status_code=400, detail=f"Question {q.id}: only likert_value allowed")
    elif q.question_type == QuestionType.yes_no:
        if item.bool_value is None:
            raise HTTPException(status_code=400, detail=f"Question {q.id} requires bool_value")
        if item.likert_value is not None or item.text_value is not None:
            raise HTTPException(status_code=400, detail=f"Question {q.id}: only bool_value allowed")
    else:
        if item.text_value is None or not str(item.text_value).strip():
            raise HTTPException(status_code=400, detail=f"Question {q.id} requires text_value")
        if item.likert_value is not None or item.bool_value is not None:
            raise HTTPException(status_code=400, detail=f"Question {q.id}: only text_value allowed")


@router.post("/responses", response_model=SurveyResponseOut)
def submit_survey(payload: SurveySubmit, db: Session = Depends(get_db)):
    if payload.miner_id is not None:
        if not db.get(Miner, payload.miner_id):
            raise HTTPException(status_code=404, detail="Miner not found")

    questions = {q.id: q for q in db.query(Question).all()}
    if not questions:
        raise HTTPException(status_code=503, detail="No survey questions configured")

    seen: set[int] = set()
    for a in payload.answers:
        if a.question_id in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate answer for question {a.question_id}")
        seen.add(a.question_id)
        q = questions.get(a.question_id)
        if not q:
            raise HTTPException(status_code=400, detail=f"Unknown question_id {a.question_id}")
        _validate_answer(q, a)

    missing = set(questions.keys()) - seen
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing answers for questions: {sorted(missing)}")

    sr = SurveyResponse(miner_id=payload.miner_id, notes=payload.notes)
    db.add(sr)
    db.flush()

    for a in payload.answers:
        db.add(
            Answer(
                response_id=sr.id,
                question_id=a.question_id,
                likert_value=a.likert_value,
                bool_value=a.bool_value,
                text_value=a.text_value,
            )
        )
    db.commit()
    db.refresh(sr)
    return sr


@router.get("/responses", response_model=list[SurveyResponseOut], dependencies=[Depends(verify_researcher_token)])
def list_responses(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    q = db.query(SurveyResponse).order_by(SurveyResponse.submitted_at.desc())
    return q.offset(skip).limit(min(limit, 500)).all()
