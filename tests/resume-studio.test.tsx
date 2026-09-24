import React from 'react';
import {describe,expect,it,vi} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ToastProvider} from '@/components/toast';
import {ResumeUpload} from '@/components/resume-studio/resume-upload';
import {uploadResume} from '@/lib/resume-studio';

function wrapper(node:React.ReactNode){return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><ToastProvider>{node}</ToastProvider></QueryClientProvider>}

describe('Resume Studio upload',()=>{
 it('announces validation errors before uploading',()=>{render(wrapper(<ResumeUpload resumes={[]} maxBytes={5} onSelect={()=>{}}/>));const input=document.querySelector('input[type=file]') as HTMLInputElement;const file=new File(['too large'],'resume.pdf',{type:'application/pdf'});fireEvent.change(input,{target:{files:[file]}});expect(screen.getByRole('alert')).toHaveTextContent('exceeds');});
 it('reports XMLHttpRequest progress and returns normalized data',async()=>{const progress=vi.fn();class FakeXHR{upload:{onprogress?:(e:any)=>void}={};status=202;responseText=JSON.stringify({data:{id:'r1',filename:'resume.pdf',version:1,status:'queued'}});withCredentials=false;onload?:()=>void;onerror?:()=>void;open(){}send(){this.upload.onprogress?.({lengthComputable:true,loaded:5,total:10});this.onload?.()}}vi.stubGlobal('XMLHttpRequest',FakeXHR);const result=await uploadResume(new File(['pdf'],'resume.pdf'),progress);expect(result.id).toBe('r1');expect(progress).toHaveBeenCalledWith(50);expect(progress).toHaveBeenLastCalledWith(100);vi.unstubAllGlobals();});
});
