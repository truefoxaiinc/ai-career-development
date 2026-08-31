from conftest import generate_and_approve,manual_job,register_verified,seed_profile

def test_job_search_matching_save_and_document_exports(client):
    register_verified(client);seed_profile(client);job=manual_job(client)
    search=client.get("/api/v1/jobs?q=Staff").json()["data"]
    assert search["total"]==1
    match=client.get(f"/api/v1/jobs/{job['id']}/match").json()["data"]
    assert 0<=match["score"]<=100 and match["strong"] and match["missing"]
    assert client.post(f"/api/v1/jobs/{job['id']}/save",json={"note":"Priority"}).status_code==201
    assert len(client.get("/api/v1/jobs/saved").json()["data"])==1
    resume=generate_and_approve(client,job["id"],"resume")
    cover=generate_and_approve(client,job["id"],"cover_letter")
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
