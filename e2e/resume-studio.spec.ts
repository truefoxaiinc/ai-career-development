import {test,expect} from '@playwright/test';

test('direct access to protected route groups redirects when logged out', async ({page}) => {
 for (const path of ['/dashboard/profile', '/dashboard/jobs/search', '/admin/system', '/onboarding']) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?next=/);
 }
});

test('critical resume studio flow is keyboard accessible',async({page})=>{
 let suggestions:any[]=[];let documents:any[]=[];let approved=false;
 await page.route('**/api/v1/**',async route=>{const url=new URL(route.request().url());const path=url.pathname;let data:any={};
  if(path.endsWith('/auth/session'))data={user:{id:'u1',is_email_verified:true}};
  else if(path.endsWith('/profile'))data={id:'c1',name:'Candidate',headline:'Engineer',location:'',phone:'',links:{},profile_summary:'',profile_completion:60,entries:[]};
  else if(path.endsWith('/resume-studio/overview'))data={resumes:[],max_upload_bytes:10485760,supported_types:['application/pdf']};
  else if(path.endsWith('/resume-studio/resumes')&&route.request().method()==='POST')data={id:'r1',filename:'resume.pdf',mime_type:'application/pdf',size_bytes:100,content_hash:'x',version:1,status:'completed',uploaded_at:new Date().toISOString()};
  else if(path.endsWith('/resumes/r1/facts'))data=[{id:'f1',entry_type:'skill',label:'TypeScript',structured_data:{page:1},confidence:.95,source_location:1,status:'pending'}];
  else if(path.endsWith('/profile/verify'))data={accepted:1};
  else if(path.endsWith('/resumes/r1/suggestions')&&route.request().method()==='POST'){suggestions=[{id:'s1',source_file_id:'r1',category:'grammar_clarity',priority:'medium',explanation:'Make the summary clearer',current_text:'Engineer',suggested_text:'Product engineer',reason:'Clearer wording',status:'pending'}];data={task_id:'t1'};}
  else if(path.endsWith('/resumes/r1/suggestions'))data=suggestions;
  else if(path.endsWith('/suggestions/s1')){suggestions[0].status='applied';data={suggestion:suggestions[0]};}
  else if(path.endsWith('/resume-studio/templates'))data=[{key:'ats',name:'Classic ATS',description:'Parser friendly',accent:'#4f46e5'},{key:'modern',name:'Modern',description:'Contemporary',accent:'#0891b2'},{key:'minimal',name:'Minimal',description:'Quiet',accent:'#52525b'},{key:'professional',name:'Professional',description:'Formal',accent:'#1d4ed8'}];
  else if(path.endsWith('/jobs/saved')||path.endsWith('/jobs/recommendations'))data=[];
  else if(path.endsWith('/resume-studio/target'))data={task_id:'t2',job_id:'j1'};
  else if(path.endsWith('/tasks/t2')){documents=[{id:'d1',document_type:'cover_letter',version:1,title:'Cover Letter',content:'Grounded content',template_key:'ats',approved_at:approved?new Date().toISOString():null,claim_report:{unsupported_claims:0}}];data={status:'succeeded',progress:100,result:{document_id:'d1'}};}
  else if(path.endsWith('/documents')&&route.request().method()==='GET')data=documents;
  else if(path.endsWith('/documents/d1/approve')){approved=true;documents[0].approved_at=new Date().toISOString();data=documents[0];}
  else if(path.includes('/documents/d1/download'))return route.fulfill({status:200,headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="resume.pdf"'},body:'pdf'});
  else data={};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
 });
 await page.context().addCookies([{name:'cp_access',value:'test',domain:'127.0.0.1',path:'/'}]);await page.goto('/dashboard/resume-studio');
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/upload resume/i}).click();(await chooser).setFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-test')});
 await expect(page.getByText('TypeScript')).toBeVisible();await page.getByRole('button',{name:'Confirm'}).click();
 await page.getByRole('combobox',{name:'Source'}).selectOption('manual');await page.getByRole('textbox',{name:'Job title'}).fill('Staff Engineer');await page.getByRole('textbox',{name:'Company'}).fill('Northstar');await page.getByRole('textbox',{name:'Job description'}).fill('We need a TypeScript engineer who builds accessible products and reliable systems.');await page.getByRole('combobox',{name:'Generate'}).selectOption('cover_letter');await page.getByRole('button',{name:/generate grounded draft/i}).click();
 await expect(page.getByText(/Cover Letter · version 1/)).toBeVisible();await page.getByRole('radio',{name:/Modern preview/}).press('Enter');await page.getByRole('button',{name:'Approve'}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'PDF'}).click();expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
});
