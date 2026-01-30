
import datetime
import uuid
import json
import os
from typing import Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select, func
from sqlalchemy import event
from openai import OpenAI

from ..database import get_session
from ..auth import get_current_superuser, get_current_user
from ..models import User, GroupStudyRead, StudySessionRequest, ProgressUpdate
from ..models_en import (
    FiszkiGroupEn, FiszkaEn, FiszkaEnCreate, FiszkaEnRead, FiszkaEnUpdate, FiszkaEnProgress,
    TranslatePlEnGroup, TranslatePlEn, TranslatePlEnCreate, TranslatePlEnRead, TranslatePlEnUpdate, TranslatePlEnProgress, BatchCreatePlEn,
    TranslateEnPlGroup, TranslateEnPl, TranslateEnPlCreate, TranslateEnPlRead, TranslateEnPlUpdate, TranslateEnPlProgress, BatchCreateEnPl,
    GuessObjectGroupEn, GuessObjectEn, GuessObjectEnCreate, GuessObjectEnRead, GuessObjectEnUpdate, GuessObjectEnProgress, BatchCreateGuessObjectEn,
    FillBlankGroupEn, FillBlankEn, FillBlankEnCreate, FillBlankEnRead, FillBlankEnUpdate, FillBlankEnProgress, BatchCreateFillBlankEn,
)
from ..models import FiszkiGroupBase, FiszkaBase

# We need pydantic models for generation that support English.
# Re-defining here to avoid modifying main.py's models causing conflicts if they are specific.
from pydantic import BaseModel

class GeneratedItemEn(BaseModel):
    text_pl: str
    text_en: str
    category: Optional[str] = None

class GenerateRequestEn(BaseModel):
    level: str
    count: int
    category: Optional[str] = None

router = APIRouter(prefix="/en", tags=["English"])

# ==========================================
# Event Listeners (ensure updated_at works)
# ==========================================
# Note: It's better to register these where models are defined or imported. 
# putting them here is fine as long as this file is imported.

@event.listens_for(FiszkiGroupEn, "before_update")
def update_timestamp_fiszki_en_group(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)

@event.listens_for(FiszkaEn, "before_update")
def update_timestamp_fiszka_en(mapper, connection, target):
    target.updated_at = datetime.datetime.now(datetime.timezone.utc)

# ... (add for others if strictly needed, or trust they default to now() on update if handled by DB, 
# but sqlmodel fields default_factory only works on init usually. 
# standard practice: add listener or update manually)

# ==========================================
# FISZKI ENGLISH
# ==========================================

@router.get("/fiszki/groups/", response_model=list[FiszkiGroupEn])
def get_fiszki_groups_en(session: Session = Depends(get_session)):
    return session.exec(select(FiszkiGroupEn)).all()

@router.post("/fiszki/groups/", response_model=FiszkiGroupEn)
def create_fiszki_group_en(group: FiszkiGroupBase, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    db_group = FiszkiGroupEn.from_orm(group)
    session.add(db_group)
    session.commit()
    session.refresh(db_group)
    return db_group

@router.put("/fiszki/groups/{group_id}", response_model=FiszkiGroupEn)
def update_fiszki_group_en(group_id: uuid.UUID, group_data: FiszkiGroupBase, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(FiszkiGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    for key, value in group_data.dict(exclude_unset=True).items():
        setattr(group, key, value)
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.delete("/fiszki/groups/{group_id}")
def delete_fiszki_group_en(group_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(FiszkiGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    session.delete(group)
    session.commit()
    return {"ok": True}

@router.post("/fiszki/", response_model=FiszkaEnRead)
def create_fiszka_en(fiszka: FiszkaEnCreate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    db_fiszka = FiszkaEn.from_orm(fiszka)
    session.add(db_fiszka)
    session.commit()
    session.refresh(db_fiszka)
    return db_fiszka

@router.get("/fiszki/", response_model=list[FiszkaEnRead])
def get_fiszki_en(group_id: Optional[uuid.UUID] = Query(None), session: Session = Depends(get_session)):
    if group_id:
        return session.exec(select(FiszkaEn).where(FiszkaEn.group_id == group_id)).all()
    return session.exec(select(FiszkaEn)).all()

@router.get("/fiszki/{fiszka_id}", response_model=FiszkaEnRead)
def get_fiszka_en_by_id(fiszka_id: uuid.UUID, session: Session = Depends(get_session)):
    fiszka = session.get(FiszkaEn, fiszka_id)
    if not fiszka: raise HTTPException(404, "Fiszka not found")
    return fiszka

@router.put("/fiszki/{fiszka_id}", response_model=FiszkaEnRead)
def update_fiszka_en(fiszka_id: uuid.UUID, fiszka_data: FiszkaEnUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    fiszka = session.get(FiszkaEn, fiszka_id)
    if not fiszka: raise HTTPException(404, "Fiszka not found")
    for key, value in fiszka_data.dict(exclude_unset=True).items():
        setattr(fiszka, key, value)
    session.add(fiszka)
    session.commit()
    session.refresh(fiszka)
    return fiszka

@router.delete("/fiszki/{fiszka_id}")
def delete_fiszka_en(fiszka_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    fiszka = session.get(FiszkaEn, fiszka_id)
    if not fiszka: raise HTTPException(404, "Fiszka not found")
    session.delete(fiszka)
    session.commit()
    return {"ok": True}

@router.get("/fiszki/groups/{group_id}", response_model=FiszkiGroupEn)
def get_fiszki_group_en_by_id(group_id: uuid.UUID, session: Session = Depends(get_session)):
    group = session.get(FiszkiGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    return group


# ==========================================
# TRANSLATE PL -> EN
# ==========================================

@router.get("/translate-pl-en/groups/", response_model=list[TranslatePlEnGroup])
def get_trans_pl_en_groups(session: Session = Depends(get_session)):
    return session.exec(select(TranslatePlEnGroup)).all()

@router.post("/translate-pl-en/groups/", response_model=TranslatePlEnGroup)
def create_trans_pl_en_group(group: TranslatePlEnGroup, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.get("/translate-pl-en/groups/{group_id}", response_model=TranslatePlEnGroup)
def get_trans_pl_en_group_detail(group_id: uuid.UUID, session: Session = Depends(get_session)):
    return session.get(TranslatePlEnGroup, group_id)

@router.post("/translate-pl-en/batch", response_model=list[TranslatePlEnRead])
def batch_create_trans_pl_en(batch: BatchCreatePlEn, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    created = []
    for item in batch.items:
        item_data = item.model_dump(exclude={'group_id'}) if hasattr(item, 'model_dump') else {k: v for k, v in item.dict().items() if k != 'group_id'}
        db_item = TranslatePlEn(**item_data, group_id=batch.group_id)
        session.add(db_item)
        created.append(db_item)
    session.commit()
    return created

@router.get("/translate-pl-en/items/", response_model=list[TranslatePlEnRead])
def get_trans_pl_en_items(group_id: uuid.UUID = Query(...), session: Session = Depends(get_session)):
    return session.exec(select(TranslatePlEn).where(TranslatePlEn.group_id == group_id)).all()

@router.post("/translate-pl-en/items/", response_model=TranslatePlEnRead)
def create_trans_pl_en_item(item: TranslatePlEnCreate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    db_item = TranslatePlEn.from_orm(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.put("/translate-pl-en/items/{item_id}", response_model=TranslatePlEnRead)
def update_trans_pl_en_item(item_id: uuid.UUID, item_data: TranslatePlEnUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(TranslatePlEn, item_id)
    if not item: raise HTTPException(404, "Item not found")
    for key, value in item_data.dict(exclude_unset=True).items():
        setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/translate-pl-en/items/{item_id}")
def delete_trans_pl_en_item(item_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(TranslatePlEn, item_id)
    if not item: raise HTTPException(404, "Item not found")
    session.delete(item)
    session.commit()
    return {"ok": True}

@router.put("/translate-pl-en/groups/{group_id}", response_model=TranslatePlEnGroup)
def update_trans_pl_en_group(group_id: uuid.UUID, group_data: FiszkiGroupBase, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(TranslatePlEnGroup, group_id)
    if not group: raise HTTPException(404, "Group not found")
    for key, value in group_data.dict(exclude_unset=True).items():
        setattr(group, key, value)
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.delete("/translate-pl-en/groups/{group_id}")
def delete_trans_pl_en_group(group_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(TranslatePlEnGroup, group_id)
    if not group: raise HTTPException(404, "Group not found")
    session.delete(group)
    session.commit()
    return {"ok": True}


# ==========================================
# TRANSLATE EN -> PL
# ==========================================

@router.get("/translate-en-pl/groups/", response_model=list[TranslateEnPlGroup])
def get_trans_en_pl_groups(session: Session = Depends(get_session)):
    return session.exec(select(TranslateEnPlGroup)).all()

@router.post("/translate-en-pl/groups/", response_model=TranslateEnPlGroup)
def create_trans_en_pl_group(group: TranslateEnPlGroup, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.post("/translate-en-pl/batch", response_model=list[TranslateEnPlRead])
def batch_create_trans_en_pl(batch: BatchCreateEnPl, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    created = []
    for item in batch.items:
        item_data = item.model_dump(exclude={'group_id'}) if hasattr(item, 'model_dump') else {k: v for k, v in item.dict().items() if k != 'group_id'}
        db_item = TranslateEnPl(**item_data, group_id=batch.group_id)
        session.add(db_item)
        created.append(db_item)
    session.commit()
    return created

@router.get("/translate-en-pl/items/", response_model=list[TranslateEnPlRead])
def get_trans_en_pl_items(group_id: uuid.UUID = Query(...), session: Session = Depends(get_session)):
    return session.exec(select(TranslateEnPl).where(TranslateEnPl.group_id == group_id)).all()

@router.post("/translate-en-pl/items/", response_model=TranslateEnPlRead)
def create_trans_en_pl_item(item: TranslateEnPlCreate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    db_item = TranslateEnPl.from_orm(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.put("/translate-en-pl/items/{item_id}", response_model=TranslateEnPlRead)
def update_trans_en_pl_item(item_id: uuid.UUID, item_data: TranslateEnPlUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(TranslateEnPl, item_id)
    if not item: raise HTTPException(404, "Item not found")
    for key, value in item_data.dict(exclude_unset=True).items():
        setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/translate-en-pl/items/{item_id}")
def delete_trans_en_pl_item(item_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(TranslateEnPl, item_id)
    if not item: raise HTTPException(404, "Item not found")
    session.delete(item)
    session.commit()
    return {"ok": True}

@router.put("/translate-en-pl/groups/{group_id}", response_model=TranslateEnPlGroup)
def update_trans_en_pl_group(group_id: uuid.UUID, group_data: FiszkiGroupBase, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(TranslateEnPlGroup, group_id)
    if not group: raise HTTPException(404, "Group not found")
    for key, value in group_data.dict(exclude_unset=True).items():
        setattr(group, key, value)
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.delete("/translate-en-pl/groups/{group_id}")
def delete_trans_en_pl_group(group_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(TranslateEnPlGroup, group_id)
    if not group: raise HTTPException(404, "Group not found")
    session.delete(group)
    session.commit()
    return {"ok": True}


# ==========================================
# GUESS OBJECT (ENGLISH)
# ==========================================

@router.get("/guess-object/groups/", response_model=list[GuessObjectGroupEn])
def get_guess_object_en_groups(session: Session = Depends(get_session)):
    return session.exec(select(GuessObjectGroupEn)).all()

@router.post("/guess-object/groups/", response_model=GuessObjectGroupEn)
def create_guess_object_en_group(group: GuessObjectGroupEn, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.put("/guess-object/groups/{group_id}", response_model=GuessObjectGroupEn)
def update_guess_object_en_group(group_id: uuid.UUID, group_data: FiszkiGroupBase, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(GuessObjectGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    for key, value in group_data.dict(exclude_unset=True).items():
        setattr(group, key, value)
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.delete("/guess-object/groups/{group_id}")
def delete_guess_object_en_group(group_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(GuessObjectGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    session.delete(group)
    session.commit()
    return {"ok": True}

@router.get("/guess-object/items/", response_model=list[GuessObjectEnRead])
def get_guess_object_en_items(group_id: uuid.UUID = Query(...), session: Session = Depends(get_session)):
    return session.exec(select(GuessObjectEn).where(GuessObjectEn.group_id == group_id)).all()

@router.post("/guess-object/items/", response_model=GuessObjectEnRead)
def create_guess_object_en_item(item: GuessObjectEnCreate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    db_item = GuessObjectEn.model_validate(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.put("/guess-object/items/{item_id}", response_model=GuessObjectEnRead)
def update_guess_object_en_item(item_id: uuid.UUID, item_data: GuessObjectEnUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(GuessObjectEn, item_id)
    if not item: raise HTTPException(404, "Item not found")
    for key, value in item_data.dict(exclude_unset=True).items():
        if value is not None:
            setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/guess-object/items/{item_id}")
def delete_guess_object_en_item(item_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(GuessObjectEn, item_id)
    if not item: raise HTTPException(404, "Item not found")
    session.delete(item)
    session.commit()
    return {"ok": True}


# ==========================================
# FILL BLANK (ENGLISH)
# ==========================================

@router.get("/fill-blank/groups/", response_model=list[FillBlankGroupEn])
def get_fill_blank_en_groups(session: Session = Depends(get_session)):
    return session.exec(select(FillBlankGroupEn)).all()

@router.post("/fill-blank/groups/", response_model=FillBlankGroupEn)
def create_fill_blank_en_group(group: FillBlankGroupEn, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.put("/fill-blank/groups/{group_id}", response_model=FillBlankGroupEn)
def update_fill_blank_en_group(group_id: uuid.UUID, group_data: FiszkiGroupBase, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(FillBlankGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    for key, value in group_data.dict(exclude_unset=True).items():
        setattr(group, key, value)
    session.add(group)
    session.commit()
    session.refresh(group)
    return group

@router.delete("/fill-blank/groups/{group_id}")
def delete_fill_blank_en_group(group_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    group = session.get(FillBlankGroupEn, group_id)
    if not group: raise HTTPException(404, "Group not found")
    session.delete(group)
    session.commit()
    return {"ok": True}

@router.get("/fill-blank/items/", response_model=list[FillBlankEnRead])
def get_fill_blank_en_items(group_id: uuid.UUID = Query(...), session: Session = Depends(get_session)):
    return session.exec(select(FillBlankEn).where(FillBlankEn.group_id == group_id)).all()

@router.post("/fill-blank/items/", response_model=FillBlankEnRead)
def create_fill_blank_en_item(item: FillBlankEnCreate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    db_item = FillBlankEn.model_validate(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.put("/fill-blank/items/{item_id}", response_model=FillBlankEnRead)
def update_fill_blank_en_item(item_id: uuid.UUID, item_data: FillBlankEnUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(FillBlankEn, item_id)
    if not item: raise HTTPException(404, "Item not found")
    for key, value in item_data.dict(exclude_unset=True).items():
        if value is not None:
            setattr(item, key, value)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/fill-blank/items/{item_id}")
def delete_fill_blank_en_item(item_id: uuid.UUID, session: Session = Depends(get_session), user: User = Depends(get_current_superuser)):
    item = session.get(FillBlankEn, item_id)
    if not item: raise HTTPException(404, "Item not found")
    session.delete(item)
    session.commit()
    return {"ok": True}




# ==========================================
# STUDY ENDPOINTS (ENGLISH)
# ==========================================

# --- FISZKI EN ---

@router.get("/en/study/fiszki/groups", response_model=list[GroupStudyRead])
def get_study_fiszki_groups_en(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    groups = session.exec(select(FiszkiGroupEn)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(FiszkaEn.id)).where(FiszkaEn.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(FiszkaEnProgress.fiszka_id))
            .join(FiszkaEn)
            .where(FiszkaEn.group_id == group.id)
            .where(FiszkaEnProgress.user_id == user.id)
            .where(FiszkaEnProgress.learned == True)
        ).one()
        study_groups.append(GroupStudyRead(
            id=group.id, name=group.name, description=group.description, total_items=total, learned_items=learned, updated_at=group.updated_at
        ))
    return study_groups

@router.post("/en/study/fiszki/session", response_model=list[FiszkaEnRead])
def get_study_fiszki_session_en(request: StudySessionRequest, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    import random
    statement = select(FiszkaEn).where(FiszkaEn.group_id.in_(request.group_ids))
    fiszki = session.exec(statement).all()
    if not fiszki: return []
    
    learned_ids = set(session.exec(select(FiszkaEnProgress.fiszka_id).where(FiszkaEnProgress.user_id == user.id, FiszkaEnProgress.learned == True)).all())
    candidates = [f for f in fiszki if request.include_learned or f.id not in learned_ids]
    
    random.shuffle(candidates)
    return candidates[:request.limit]

@router.post("/en/study/fiszki/progress")
def update_fiszka_progress_en(data: ProgressUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    progress = session.exec(select(FiszkaEnProgress).where(FiszkaEnProgress.user_id == user.id, FiszkaEnProgress.fiszka_id == data.item_id)).first()
    if progress:
        progress.learned = data.learned
        session.add(progress)
    else:
        if not session.get(FiszkaEn, data.item_id): raise HTTPException(404, "Item not found")
        progress = FiszkaEnProgress(user_id=user.id, fiszka_id=data.item_id, learned=data.learned)
        session.add(progress)
    session.commit()
    return {"ok": True}

# --- TRANSLATE PL-EN ---

@router.get("/study/translate-pl-en/groups", response_model=list[GroupStudyRead])
def get_study_pl_en_groups(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    groups = session.exec(select(TranslatePlEnGroup)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslatePlEn.id)).where(TranslatePlEn.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslatePlEnProgress.item_id))
            .join(TranslatePlEn)
            .where(TranslatePlEn.group_id == group.id)
            .where(TranslatePlEnProgress.user_id == user.id)
            .where(TranslatePlEnProgress.learned == True)
        ).one()
        study_groups.append(GroupStudyRead(
            id=group.id, name=group.name, description=group.description, total_items=total, learned_items=learned, updated_at=group.updated_at
        ))
    return study_groups

@router.post("/study/translate-pl-en/session", response_model=list[TranslatePlEnRead])
def get_study_pl_en_session(request: StudySessionRequest, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    import random
    items = session.exec(select(TranslatePlEn).where(TranslatePlEn.group_id.in_(request.group_ids))).all()
    if not items: return []
    learned_ids = set(session.exec(select(TranslatePlEnProgress.item_id).where(TranslatePlEnProgress.user_id == user.id, TranslatePlEnProgress.learned == True)).all())
    candidates = [i for i in items if request.include_learned or i.id not in learned_ids]
    random.shuffle(candidates)
    return candidates[:request.limit]

@router.post("/study/translate-pl-en/progress")
def update_pl_en_progress(data: ProgressUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    progress = session.exec(select(TranslatePlEnProgress).where(TranslatePlEnProgress.user_id == user.id, TranslatePlEnProgress.item_id == data.item_id)).first()
    if progress:
        progress.learned = data.learned
        session.add(progress)
    else:
        if not session.get(TranslatePlEn, data.item_id): raise HTTPException(404, "Item not found")
        progress = TranslatePlEnProgress(user_id=user.id, item_id=data.item_id, learned=data.learned)
        session.add(progress)
    session.commit()
    return {"ok": True}

# --- TRANSLATE EN-PL Study Endpoints ---

@router.get("/translate-en-pl/groups", response_model=list[GroupStudyRead])
def get_study_en_pl_groups(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    groups = session.exec(select(TranslateEnPlGroup)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslateEnPl.id)).where(TranslateEnPl.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslateEnPlProgress.item_id))
            .join(TranslateEnPl, TranslateEnPlProgress.item_id == TranslateEnPl.id)
            .where(TranslateEnPl.group_id == group.id)
            .where(TranslateEnPlProgress.user_id == user.id)
            .where(TranslateEnPlProgress.learned == True)
        ).one()
        study_groups.append(GroupStudyRead(
            id=group.id, name=group.name, description=group.description, total_items=total, learned_items=learned, updated_at=group.updated_at
        ))
    return study_groups

@router.post("/translate-en-pl/session", response_model=list[TranslateEnPlRead])
def get_study_en_pl_session(request: StudySessionRequest, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    import random
    items = session.exec(select(TranslateEnPl).where(TranslateEnPl.group_id.in_(request.group_ids))).all()
    if not items: return []
    learned_ids = set(session.exec(select(TranslateEnPlProgress.item_id).where(TranslateEnPlProgress.user_id == user.id, TranslateEnPlProgress.learned == True)).all())
    candidates = [i for i in items if request.include_learned or i.id not in learned_ids]
    random.shuffle(candidates)
    return candidates[:request.limit]

@router.post("/translate-en-pl/progress")
def update_en_pl_progress(data: ProgressUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    progress = session.exec(select(TranslateEnPlProgress).where(TranslateEnPlProgress.user_id == user.id, TranslateEnPlProgress.item_id == data.item_id)).first()
    if progress:
        progress.learned = data.learned
        session.add(progress)
    else:
        if not session.get(TranslateEnPl, data.item_id): raise HTTPException(404, "Item not found")
        progress = TranslateEnPlProgress(user_id=user.id, item_id=data.item_id, learned=data.learned)
        session.add(progress)
    session.commit()
    return {"ok": True}

# Also add groups endpoint for PL-EN that frontend expects
@router.get("/translate-pl-en/groups", response_model=list[GroupStudyRead])
def get_study_pl_en_groups(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    groups = session.exec(select(TranslatePlEnGroup)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(TranslatePlEn.id)).where(TranslatePlEn.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(TranslatePlEnProgress.item_id))
            .join(TranslatePlEn, TranslatePlEnProgress.item_id == TranslatePlEn.id)
            .where(TranslatePlEn.group_id == group.id)
            .where(TranslatePlEnProgress.user_id == user.id)
            .where(TranslatePlEnProgress.learned == True)
        ).one()
        study_groups.append(GroupStudyRead(
            id=group.id, name=group.name, description=group.description, total_items=total, learned_items=learned, updated_at=group.updated_at
        ))
    return study_groups

@router.post("/translate-pl-en/session", response_model=list[TranslatePlEnRead])
def get_study_pl_en_session_route(request: StudySessionRequest, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    import random
    items = session.exec(select(TranslatePlEn).where(TranslatePlEn.group_id.in_(request.group_ids))).all()
    if not items: return []
    learned_ids = set(session.exec(select(TranslatePlEnProgress.item_id).where(TranslatePlEnProgress.user_id == user.id, TranslatePlEnProgress.learned == True)).all())
    candidates = [i for i in items if request.include_learned or i.id not in learned_ids]
    random.shuffle(candidates)
    return candidates[:request.limit]

@router.post("/translate-pl-en/progress")
def update_pl_en_progress_route(data: ProgressUpdate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    progress = session.exec(select(TranslatePlEnProgress).where(TranslatePlEnProgress.user_id == user.id, TranslatePlEnProgress.item_id == data.item_id)).first()
    if progress:
        progress.learned = data.learned
        session.add(progress)
    else:
        if not session.get(TranslatePlEn, data.item_id): raise HTTPException(404, "Item not found")
        progress = TranslatePlEnProgress(user_id=user.id, item_id=data.item_id, learned=data.learned)
        session.add(progress)
    session.commit()
    return {"ok": True}

# ==========================================
# AI GENERATION FOR ENGLISH
# ==========================================

@router.post("/ai/generate", response_model=list[GeneratedItemEn])
def generate_english_content(request: GenerateRequestEn, user: User = Depends(get_current_superuser)):
    """Generate Polish-English translation pairs using AI."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    client = OpenAI(api_key=api_key)
    
    category_instruction = ""
    if request.category:
        category_map = {
            "vocabulary": "słownictwo (rzeczowniki, przymiotniki, przysłówki)",
            "grammar": "zdania ilustrujące polskie reguły gramatyczne przetłumaczone na angielski",
            "phrases": "popularne zwroty i wyrażenia",
            "idioms": "idiomy i wyrażenia idiomatyczne",
            "verbs": "czasowniki w różnych formach i czasach"
        }
        category_instruction = f"\nKategoria: {category_map.get(request.category, request.category)}"
    
    prompt = f"""Wygeneruj {request.count} par tłumaczeniowych (polski - angielski) do nauki języka angielskiego.
Poziom: {request.level} (CEFR)
{category_instruction}

Wymagania:
- Zdania powinny być praktyczne i naturalne
- Odpowiadać poziomowi {request.level}
- Używać poprawnej gramatyki polskiej i angielskiej

Zwróc JSON array z obiektami:
{{"text_pl": "polskie zdanie", "text_en": "english translation", "category": "kategoria lub null"}}

TYLKO JSON, bez dodatkowego tekstu."""

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Jesteś asystentem do nauki języka angielskiego. Generujesz materiały dla Polaków uczących się angielskiego."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        response_text = completion.choices[0].message.content.strip()
        
        # Parse JSON from response
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        
        items = json.loads(response_text)
        return [GeneratedItemEn(**item) for item in items]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ==========================================
# AI GENERATION FOR GUESS OBJECT (ENGLISH)
# ==========================================

class GeneratedGuessObjectEn(BaseModel):
    description_en: str
    description_pl: str
    answer_en: str
    answer_pl: str
    category: Optional[str] = None

class GenerateGuessObjectEnRequest(BaseModel):
    level: str
    count: int
    category: Optional[str] = None

@router.post("/ai/generate-guess-object", response_model=list[GeneratedGuessObjectEn])
def generate_guess_object_en(request: GenerateGuessObjectEnRequest, user: User = Depends(get_current_superuser)):
    """Generate guess object riddles in English using AI."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    client = OpenAI(api_key=api_key)
    
    category_instruction = ""
    if request.category:
        category_instruction = f"\nCategory focus: {request.category}"
    
    prompt = f"""Generate {request.count} "guess the object" riddles in English at level {request.level} (CEFR).
{category_instruction}

Requirements:
- Each riddle should describe an object without naming it
- The description should be appropriate for the specified level
- Include Polish translations for learners
- Objects should be common and useful for language learning

Return a JSON array with objects:
{{"description_en": "English description without naming the object", "description_pl": "Polish translation of description", "answer_en": "the object name in English", "answer_pl": "the object name in Polish", "category": "category or null"}}

ONLY JSON, no additional text."""

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an English language learning assistant. Generate guess-the-object riddles for Polish speakers learning English."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        response_text = completion.choices[0].message.content.strip()
        
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        
        items = json.loads(response_text)
        return [GeneratedGuessObjectEn(**item) for item in items]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ==========================================
# AI GENERATION FOR FILL BLANK (ENGLISH)
# ==========================================


class GeneratedFillBlankEn(BaseModel):
    sentence_with_blank: str
    sentence_pl: Optional[str] = None
    answer: str
    full_sentence: str
    hint: Optional[str] = None
    grammar_focus: Optional[str] = None

class GenerateFillBlankEnRequest(BaseModel):
    level: str
    count: int
    category: Optional[str] = None

@router.post("/ai/generate-fill-blank", response_model=list[GeneratedFillBlankEn])
def generate_fill_blank_en(request: GenerateFillBlankEnRequest, user: User = Depends(get_current_superuser)):
    """Generate fill-in-the-blank exercises in English using AI."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    client = OpenAI(api_key=api_key)
    
    category_instruction = ""
    if request.category:
        category_map = {
            "vocabulary": "vocabulary (nouns, adjectives, adverbs)",
            "grammar": "grammar exercises (verbs, prepositions, articles)",
            "phrasal_verbs": "phrasal verbs",
            "idioms": "idiomatic expressions",
            "collocations": "common collocations"
        }
        category_instruction = f"\nFocus on: {category_map.get(request.category, request.category)}"
    
    prompt = f"""Generate {request.count} fill-in-the-blank exercises in English at level {request.level} (CEFR).
{category_instruction}

Requirements:
- Each sentence should have exactly one blank marked as ___
- The blank should test specific vocabulary or grammar knowledge
- The answer should be unambiguous
- Include a hint for Polish learners
- Include Polish translation of the sentence (sentence_pl)
- Include the full sentence without blank (full_sentence)
- grammar_focus: verb | article | preposition | pronoun | agreement or other category

Return a JSON array with objects:
{{"sentence_with_blank": "sentence with ___", "sentence_pl": "Polish translation", "answer": "the word that fills the blank", "full_sentence": "full sentence", "hint": "grammatical or contextual hint", "grammar_focus": "category"}}

ONLY JSON, no additional text."""

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an English language learning assistant. Generate fill-in-the-blank exercises for Polish speakers learning English."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        response_text = completion.choices[0].message.content.strip()
        
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            response_text = "\n".join(lines[1:-1])
        
        items = json.loads(response_text)
        return [GeneratedFillBlankEn(**item) for item in items]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

# ==========================================
# STUDY ENDPOINTS (ENGLISH)
# ==========================================

# Guess Object English Study
@router.get("/en/study/guess-object/groups", response_model=list[GroupStudyRead])
def get_study_guess_object_en_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    groups = session.exec(select(GuessObjectGroupEn)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(GuessObjectEn.id)).where(GuessObjectEn.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(GuessObjectEnProgress.item_id))
            .join(GuessObjectEn)
            .where(GuessObjectEn.group_id == group.id)
            .where(GuessObjectEnProgress.user_id == current_user.id)
            .where(GuessObjectEnProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups

@router.post("/en/study/guess-object/session", response_model=list[GuessObjectEnRead])
def get_study_guess_object_en_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = select(GuessObjectEn).where(GuessObjectEn.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(GuessObjectEnProgress.item_id)
            .where(GuessObjectEnProgress.user_id == current_user.id)
            .where(GuessObjectEnProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    import random
    random.shuffle(candidates)
    return candidates[: request.limit]

@router.post("/en/study/guess-object/progress")
def update_guess_object_en_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(GuessObjectEnProgress)
        .where(GuessObjectEnProgress.user_id == current_user.id)
        .where(GuessObjectEnProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(GuessObjectEn, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = GuessObjectEnProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}


# Fill Blank English Study
@router.get("/en/study/fill-blank/groups", response_model=list[GroupStudyRead])
def get_study_fill_blank_en_groups(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    groups = session.exec(select(FillBlankGroupEn)).all()
    study_groups = []
    for group in groups:
        total = session.exec(select(func.count(FillBlankEn.id)).where(FillBlankEn.group_id == group.id)).one()
        learned = session.exec(
            select(func.count(FillBlankEnProgress.item_id))
            .join(FillBlankEn)
            .where(FillBlankEn.group_id == group.id)
            .where(FillBlankEnProgress.user_id == current_user.id)
            .where(FillBlankEnProgress.learned == True)
        ).one()

        study_groups.append(
            GroupStudyRead(
                id=group.id, name=group.name, description=group.description, total_items=total, learned_items=learned, updated_at=group.updated_at
            )
        )
    return study_groups

@router.post("/en/study/fill-blank/session", response_model=list[FillBlankEnRead])
def get_study_fill_blank_en_session(
    request: StudySessionRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    statement = select(FillBlankEn).where(FillBlankEn.group_id.in_(request.group_ids))
    items = session.exec(statement).all()

    if not items:
        return []

    learned_ids = set(
        session.exec(
            select(FillBlankEnProgress.item_id)
            .where(FillBlankEnProgress.user_id == current_user.id)
            .where(FillBlankEnProgress.learned == True)
        ).all()
    )

    candidates = []
    for item in items:
        if request.include_learned or item.id not in learned_ids:
            candidates.append(item)

    import random
    random.shuffle(candidates)
    return candidates[: request.limit]

@router.post("/en/study/fill-blank/progress")
def update_fill_blank_en_progress(
    progress_data: ProgressUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    progress = session.exec(
        select(FillBlankEnProgress)
        .where(FillBlankEnProgress.user_id == current_user.id)
        .where(FillBlankEnProgress.item_id == progress_data.item_id)
    ).first()

    if progress:
        progress.learned = progress_data.learned
        progress.last_reviewed = datetime.datetime.now(datetime.timezone.utc)
        session.add(progress)
    else:
        if not session.get(FillBlankEn, progress_data.item_id):
            raise HTTPException(status_code=404, detail="Item not found")
        progress = FillBlankEnProgress(
            user_id=current_user.id, item_id=progress_data.item_id, learned=progress_data.learned
        )
        session.add(progress)
    session.commit()
    return {"message": "Progress updated"}

