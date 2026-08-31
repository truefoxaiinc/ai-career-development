from __future__ import annotations

import signal
import time

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.domains.tasks.service import claim_and_run_one


def main():
    configure_logging(); settings=get_settings()
    if settings.task_mode != "database":
        raise SystemExit("Worker requires TASK_MODE=database")
    stopped=False
    def stop(*_):
        nonlocal stopped; stopped=True
    signal.signal(signal.SIGTERM,stop); signal.signal(signal.SIGINT,stop)
    while not stopped:
        if not claim_and_run_one(): time.sleep(1.0)

if __name__=="__main__": main()
