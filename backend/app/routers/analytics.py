from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import verify_researcher_token
from app.models import Answer, Miner, Question, QuestionSection, QuestionType, SurveyResponse
from app.schemas import DashboardSummary, SectionSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=DashboardSummary, dependencies=[Depends(verify_researcher_token)])
def dashboard_summary(db: Session = Depends(get_db)):
    total_responses = db.scalar(select(func.count()).select_from(SurveyResponse)) or 0
    total_miners = db.scalar(select(func.count()).select_from(Miner)) or 0

    by_province: dict[str, int] = defaultdict(int)
    for row in db.execute(select(Miner.province, func.count()).group_by(Miner.province)):
        by_province[row[0]] = int(row[1])

    section_summaries: list[SectionSummary] = []
    for section in QuestionSection:
        qids = [q.id for q in db.query(Question).filter(Question.section == section, Question.question_type == QuestionType.likert_5).all()]
        if not qids:
            section_summaries.append(SectionSummary(section=section.value, mean_likert=None, response_count=0))
            continue
        stmt = (
            select(func.avg(Answer.likert_value), func.count())
            .where(Answer.question_id.in_(qids), Answer.likert_value.isnot(None))
        )
        avg_val, cnt = db.execute(stmt).one()
        section_summaries.append(
            SectionSummary(
                section=section.value,
                mean_likert=float(avg_val) if avg_val is not None else None,
                response_count=int(cnt or 0),
            )
        )

    return DashboardSummary(
        total_responses=total_responses,
        total_miners=total_miners,
        by_province=dict(by_province),
        section_summaries=section_summaries,
    )
