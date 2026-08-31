from conftest import generate_and_approve,manual_job,register_verified,seed_profile

def test_application_requires_human_approval_and_tracks_exact_versions(client):
    register_verified(client);seed_profile(client);job=manual_job(client);resume=generate_and_approve(client,job["id"],"resume");cover=generate_and_approve(client,job["id"],"cover_letter")
    app=client.post("/api/v1/applications",json={"job_id":job["id"],"resume_document_id":resume["id"],"cover_letter_document_id":cover["id"],"notes":"Prepared"}).json()["data"]
    assert app["resume"]["version"]==resume["version"]
    assert client.post(f"/api/v1/applications/{app['id']}/mark-applied",json={"confirmed":True}).status_code==409
    assert client.post(f"/api/v1/applications/{app['id']}/approve",json={"approved":True}).status_code==200
    applied=client.post(f"/api/v1/applications/{app['id']}/mark-applied",json={"confirmed":True})
    assert applied.status_code==200 and applied.json()["data"]["status"]=="Applied"

def test_mock_interview_and_career_intelligence(client):
    register_verified(client);seed_profile(client);job=manual_job(client)
    s=client.post("/api/v1/interviews/sessions",json={"job_id":job["id"],"question_count":5}).json()["data"]
    for q in s["questions"][:3]:
        answer="Situation: a production issue affected users. Task: improve reliability. Action: I used React and TypeScript, measured p95 latency, and shipped a verified fix. Result: the documented checkout p95 fell from 1.8s to 1.19s."
        assert client.post(f"/api/v1/interviews/sessions/{s['id']}/answers",json={"question_id":q["id"],"answer":answer}).status_code==200
    done=client.post(f"/api/v1/interviews/sessions/{s['id']}/complete")
    assert done.status_code==200 and done.json()["data"]["scores"]["overall"]>0
    # Add multiple relevant jobs so the analysis has a real persisted corpus to aggregate.
    for i in range(5):
        client.post("/api/v1/jobs/manual",json={"title":"Staff Frontend Engineer","company":f"Company {i}","location":"Remote","description":"React TypeScript GraphQL Testing Accessibility engineer role with 5+ years experience.","apply_url":f"https://careers.example.com/{i}"})
    gap=client.post("/api/v1/career/gaps",json={"target_role":"Staff Frontend Engineer","sample_size":50})
    assert gap.status_code==201 and gap.json()["data"]["sample_size"]>=5
    roadmap=client.post("/api/v1/career/roadmaps",json={"analysis_id":gap.json()["data"]["id"],"months":4})
    assert roadmap.status_code==201 and len(roadmap.json()["data"]["months"])==4
