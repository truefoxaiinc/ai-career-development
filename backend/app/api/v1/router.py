from fastapi import APIRouter

from app.domains.admin.router import router as admin_router
from app.domains.applications.router import router as applications_router
from app.domains.auth.router import router as auth_router
from app.domains.career.router import router as career_router
from app.domains.documents.router import router as documents_router
from app.domains.interviews.router import router as interviews_router
from app.domains.jobs.router import router as jobs_router
from app.domains.notifications.router import router as notifications_router
from app.domains.privacy.router import router as privacy_router
from app.domains.profiles.router import router as profiles_router
from app.domains.tasks.router import router as tasks_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(profiles_router)
router.include_router(jobs_router)
router.include_router(documents_router)
router.include_router(applications_router)
router.include_router(interviews_router)
router.include_router(career_router)
router.include_router(notifications_router)
router.include_router(privacy_router)
router.include_router(tasks_router)
router.include_router(admin_router)
