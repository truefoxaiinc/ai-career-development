# AI cost and quality policy — proposed

Measure first: task, model, prompt version, token counts, latency, cost estimate, cache hit and outcome; never log resumes, credentials or sensitive user text. Use deterministic parsing and rules when reliable. Reuse user-confirmed structured profile facts instead of resending whole resumes. Evaluate task-specific models before routing work to cheaper models. Cache with user isolation, input hash, profile revision, prompt/model version and expiry; invalidate on edits and deletion. Bound tokens, retries, timeouts, cost and concurrency. Validate structured outputs and evidence references. Never fabricate candidate experience, dates, qualifications or achievements.

Before implementation inspect existing AI gateway, worker, limits and logs. Establish a baseline and quality evaluation set. No speculative savings percentages or new AI frameworks without evidence.
