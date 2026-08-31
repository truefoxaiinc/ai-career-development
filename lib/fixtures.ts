import type {Application,ApplicationStatus,Billing,InterviewGroup,JobMatch,Profile} from './types';
export const profile:Profile={name:'Maya Rao',role:'Senior Product Engineer',location:'Bengaluru, India',completeness:82,skills:[
  {name:'TypeScript',verified:true},{name:'React',verified:true},{name:'Next.js',verified:true},{name:'Accessibility',verified:true},{name:'Node.js',verified:true},{name:'System design',verified:false},{name:'GraphQL',verified:false},{name:'PostgreSQL',verified:true}
]};
export const jobMatch:JobMatch={id:'JOB-2841',company:'Northstar Labs',role:'Staff Frontend Engineer',location:'Bengaluru · Hybrid',score:78,strong:[
  {label:'React',verified:true},{label:'TypeScript',verified:true},{label:'Design systems',verified:true},{label:'Accessibility',verified:true}
],partial:[{label:'Next.js',verified:true},{label:'Mentoring'},{label:'Performance'}],missing:[{label:'GraphQL federation'},{label:'Staff-level scope'}]};
export const statuses:ApplicationStatus[]=['Recommended','Saved','Resume Generated','Applied','Screening','Interview','Technical Interview','Offer','Rejected'];
export const applications:Application[]=[
  {id:'APP-1042',company:'Northstar Labs',role:'Staff Frontend Engineer',score:78,status:'Resume Generated',updated:'Today',location:'Bengaluru'},
  {id:'APP-1038',company:'Kite Systems',role:'Senior Product Engineer',score:86,status:'Applied',updated:'1d ago',location:'Remote'},
  {id:'APP-1031',company:'Atlas Grid',role:'Frontend Platform Engineer',score:73,status:'Screening',updated:'2d ago',location:'Hyderabad'},
  {id:'APP-1019',company:'Clearline',role:'Senior UI Engineer',score:81,status:'Interview',updated:'3d ago',location:'Bengaluru'},
  {id:'APP-1007',company:'Relay Works',role:'Product Engineer',score:69,status:'Saved',updated:'5d ago',location:'Remote'},
  {id:'APP-0998',company:'Fieldnote',role:'Frontend Infrastructure Engineer',score:91,status:'Technical Interview',updated:'6d ago',location:'Pune'}
];
export const interviewGroups:InterviewGroup[]=[
  {category:'General',questions:['Walk me through the work you want to do next and why.','What are you optimizing for in your next team?']},
  {category:'Resume-Based',questions:['Tell me about the checkout latency work at Clearline.','What changed after the UI platform migration?']},
  {category:'Job-Specific Technical',questions:['How would you design a frontend platform used by multiple product teams?','How would you introduce GraphQL federation into an existing frontend architecture?']},
  {category:'Behavioral',questions:['Tell me about a time you changed course after difficult feedback.','Describe a disagreement where you influenced without authority.']},
  {category:'Company-Specific',questions:['Why does Northstar Labs fit the problems you want to solve next?']}
];
export const billing:Billing={plan:'Pro',resumeUsed:6,resumeLimit:10,mockUsed:0,mockLimit:5};
