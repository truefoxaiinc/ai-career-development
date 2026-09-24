from conftest import generate_and_approve,generate_document,manual_job,register_verified,seed_profile

def test_job_search_matching_save_and_document_exports(client):
    register_verified(client);seed_profile(client);job=manual_job(client)
    search=client.get("/api/v1/jobs?q=Staff").json()["data"]
    assert search["total"]==1
    match=client.get(f"/api/v1/jobs/{job['id']}/match").json()["data"]
    assert 0<=match["score"]<=100 and match["strong"] and match["missing"]
    assert client.post(f"/api/v1/jobs/{job['id']}/save",json={"note":"Priority"}).status_code==201
    assert len(client.get("/api/v1/jobs/saved").json()["data"])==1
    resume=generate_and_approve(client,job["id"],"resume")
    cover=generate_document(client,job["id"],"cover_letter")
    assert cover["claim_report"]["status"] == "blocked"
    assert client.post(f"/api/v1/documents/{cover['id']}/approve").status_code==409
    pdf=client.get(f"/api/v1/documents/{resume['id']}/download?format=pdf")
    docx=client.get(f"/api/v1/documents/{resume['id']}/download?format=docx")
    assert pdf.status_code==200 and pdf.content.startswith(b"%PDF")
    assert docx.status_code==200 and docx.content.startswith(b"PK")

def test_anti_fabrication_blocks_unsupported_edited_claim(client):
    register_verified(client);seed_profile(client);job=manual_job(client);resume=generate_and_approve(client,job["id"],"resume")
    edited=client.post(f"/api/v1/documents/{resume['id']}/versions",json={"content":resume["content"]+"\n• Led 500 engineers at Google and increased revenue by 900%."})
    assert edited.status_code==201
    data=edited.json()["data"]
    assert data["claim_report"]["unsupported_claims"]>=1
    assert client.post(f"/api/v1/documents/{data['id']}/approve").status_code==409
    assert client.post(f"/api/v1/documents/{data['id']}/approve",json={"manual_override":True}).status_code==422
    approved=client.post(f"/api/v1/documents/{data['id']}/approve",json={"manual_override":True,"acknowledged_unsupported_claims":True})
    assert approved.status_code==200
    assert approved.json()["data"]["claim_report"]["manual_approval"] is True
    assert client.get(f"/api/v1/documents/{data['id']}/download?format=pdf").status_code==200
    assert client.delete(f"/api/v1/documents/{data['id']}").status_code==200
    assert client.get(f"/api/v1/documents/{data['id']}").status_code==404


def test_candidate_job_discovery_uses_preferences_and_scores_results(client):
    register_verified(client);seed_profile(client)
    preferences=client.put("/api/v1/preferences",json={
        "target_titles":["Staff Frontend Engineer"],
        "industries":[],
        "locations":["Bengaluru"],
        "work_modes":[],
        "salary_min":None,
        "salary_currency":None,
        "employment_types":[],
        "relocation_willing":False,
        "experience_levels":[],
        "preferred_companies":[],
        "alert_frequency":"weekly",
    })
    assert preferences.status_code==200,preferences.text

    discover=client.post("/api/v1/jobs/discover",json={"limit_per_provider":10,"max_results":20})
    assert discover.status_code==202,discover.text
    task_id=discover.json()["data"]["task_id"]

    task=client.get(f"/api/v1/tasks/{task_id}")
    assert task.status_code==200,task.text
    task_data=task.json()["data"]
    assert task_data["status"]=="succeeded",task_data
    assert task_data["result"]["found"]>=1

    recommendations=client.get("/api/v1/jobs/recommendations").json()["data"]
    assert recommendations
    assert any(job["source"]=="development" for job in recommendations)
    assert all("match" in job for job in recommendations)


def test_candidate_job_discovery_falls_back_to_profile(client):
    register_verified(client)
    seed_profile(client)

    discover = client.post(
        "/api/v1/jobs/discover",
        json={
            "limit_per_provider": 10,
            "max_results": 20,
        },
    )

    assert discover.status_code == 202, discover.text

    task_id = discover.json()["data"]["task_id"]

    task_response = client.get(
        f"/api/v1/tasks/{task_id}"
    )

    assert task_response.status_code == 200, task_response.text

    task = task_response.json()["data"]

    assert task["status"] == "succeeded", task
    assert task["error_code"] is None
    assert task["result"]["found"] >= 1


def test_candidate_job_discovery_syncs_broad_feed_without_preferences(client):
    register_verified(client)

    discover = client.post(
        "/api/v1/jobs/discover",
        json={
            "limit_per_provider": 10,
            "max_results": 20,
        },
    )

    assert discover.status_code == 202, discover.text

    task_id = discover.json()["data"]["task_id"]

    task_response = client.get(
        f"/api/v1/tasks/{task_id}"
    )

    assert task_response.status_code == 200, task_response.text

    task = task_response.json()["data"]

    assert task["status"] == "succeeded", task
    assert task["error_code"] is None
    assert task["result"]["found"] >= 1
