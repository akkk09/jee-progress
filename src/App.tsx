import { useEffect, useMemo, useRef, useState } from "react";
import { syllabus, subjects, type Subject } from "./data";

type PYQYear = "2024" | "2025" | "2026";
type PYQRecord = { attempted: boolean; total: number; correct: number };
type Progress = Record<string, { completed: boolean; pyq: Record<PYQYear, PYQRecord> }>;
type Lecture = {
  id: string; title: string; subject: Subject; chapterId: string; url: string;
  watchedMinutes: number; durationMinutes: number; completed: boolean;
  priority: "low" | "medium" | "high"; plannedDate: string;
};
type StudySession = { id: string; date: string; startedAt: string; seconds: number; subject: Subject; chapterId: string };
type PlanTask = { id: string; date: string; title: string; subject: Subject | ""; chapterId: string; completed: boolean };
type MockAttempt = { id: string; name: string; date: string; score: number; totalMarks: number; accuracy: number; mathematics: number; physics: number; chemistry: number; notes: string };
type AppState = {
  examDate: string; examName: string; lectures: Lecture[]; progress: Progress;
  studySeconds: number; sessions: StudySession[]; tasks: PlanTask[]; mocks: MockAttempt[]; theme: "dark" | "light";
};

const PYQ_YEARS: PYQYear[] = ["2024", "2025", "2026"];
const TOTAL_MODULES = syllabus.length;
const emptyPyq = (): Record<PYQYear, PYQRecord> => ({
  "2024": { attempted: false, total: 0, correct: 0 },
  "2025": { attempted: false, total: 0, correct: 0 },
  "2026": { attempted: false, total: 0, correct: 0 },
});
const initialProgress = (): Progress => Object.fromEntries(
  syllabus.map(c => [c.id, { completed: false, pyq: emptyPyq() }])
);
const makeDefaultState = (): AppState => ({
  examDate: "2027-01-24", examName: "JEE Main 2027", lectures: [],
  progress: initialProgress(), studySeconds: 0, sessions: [], tasks: [], mocks: [], theme: "dark"
});

const migrateProgress = (raw: any): Progress => {
  const defaults = initialProgress();
  return Object.fromEntries(syllabus.map(c => {
    const old = raw?.[c.id] ?? {};
    const pyq = emptyPyq();
    for (const year of PYQ_YEARS) {
      const value = old.pyq?.[year];
      if (typeof value === "boolean") pyq[year].attempted = value;
      else if (value) pyq[year] = { ...pyq[year], ...value };
    }
    return [c.id, { completed: Boolean(old.completed), pyq }];
  }));
};
const load = (userId: string): AppState => {
  try {
    const saved = localStorage.getItem(`jee-progress:${userId}`);
    if (!saved) return makeDefaultState();
    const parsed = JSON.parse(saved);
    return { ...makeDefaultState(), ...parsed, progress: migrateProgress(parsed.progress) };
  } catch { return makeDefaultState(); }
};
const dateKey = (d = new Date()) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h ? `${h}h ${m}m` : `${m}m ${s}s`;
};
const formatLongTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date + "T00:00:00").getTime() - Date.now()) / 86400000));
const chapterName = (id: string) => syllabus.find(c => c.id === id)?.name ?? "Unknown chapter";
const subjectChapters = (subject: Subject) => syllabus.filter(c => c.subject === subject);
const percent = (a: number, b: number) => b ? Math.round((a / b) * 100) : 0;
const hashPassword = (password: string) => {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) { hash ^= password.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
};
type Account = { id: string; email: string; passwordHash: string };
const getAccounts = (): Account[] => {
  try { return JSON.parse(localStorage.getItem("jee-progress:accounts") ?? "[]"); } catch { return []; }
};

function App() {
  const [user, setUser] = useState<Account | null>(() => {
    const id = localStorage.getItem("jee-progress:session");
    return getAccounts().find(a => a.id === id) ?? null;
  });
  const [state, setState] = useState<AppState>(() => user ? load(user.id) : makeDefaultState());
  const [page, setPage] = useState<"dashboard"|"lectures"|"syllabus"|"pyqs"|"mocks"|"settings">("dashboard");
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [filter, setFilter] = useState<Subject | "All">("All");
  const [lectureForm, setLectureForm] = useState({ title:"", subject:"Mathematics" as Subject, chapterId:syllabus[0].id, url:"", watchedMinutes:"", durationMinutes:"", priority:"medium" as Lecture["priority"], plannedDate:"" });
  const [running, setRunning] = useState(false);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionSubject, setSessionSubject] = useState<Subject>("Mathematics");
  const [sessionChapter, setSessionChapter] = useState(syllabus[0].id);
  const [taskForm, setTaskForm] = useState({ title:"", subject:"" as Subject | "", chapterId:"", date:dateKey() });
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) localStorage.setItem(`jee-progress:${user.id}`, JSON.stringify(state)); }, [state, user]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setState(s => ({...s, studySeconds:s.studySeconds+1})), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);
  const completedModules = syllabus.filter(c => state.progress[c.id]?.completed).length;
  const pyqDone = syllabus.reduce((n,c) => n + PYQ_YEARS.filter(y => state.progress[c.id]?.pyq[y]?.attempted).length, 0);
  const lectureMinutes = state.lectures.reduce((n,l) => n + l.watchedMinutes, 0);
  const completedLectures = state.lectures.filter(l => l.completed).length;
  const subjectStats = useMemo(() => subjects.map(subject => {
    const chapters = subjectChapters(subject);
    return { subject, done:chapters.filter(c=>state.progress[c.id]?.completed).length, total:chapters.length };
  }), [state.progress]);
  const filteredLectures = state.lectures.filter(l => filter === "All" || l.subject === filter);

  const startTimer = () => {
    setSessionStart(Date.now()); setRunning(true);
  };
  const stopTimer = () => {
    const seconds = sessionStart ? Math.max(1, Math.round((Date.now()-sessionStart)/1000)) : 1;
    const session: StudySession = { id:crypto.randomUUID(), date:dateKey(), startedAt:new Date().toISOString(), seconds, subject:sessionSubject, chapterId:sessionChapter };
    setState(s => ({...s, sessions:[session,...s.sessions]}));
    setSessionStart(null); setRunning(false);
  };
  const updateProgress = (chapterId:string, patch:Partial<Progress[string]>) =>
    setState(s=>({...s, progress:{...s.progress,[chapterId]:{...s.progress[chapterId],...patch}}}));
  const addLecture = () => {
    if (!lectureForm.title.trim() || !lectureForm.url.trim()) return;
    const l: Lecture = { id:crypto.randomUUID(), title:lectureForm.title.trim(), subject:lectureForm.subject, chapterId:lectureForm.chapterId,
      url:lectureForm.url.trim(), watchedMinutes:Number(lectureForm.watchedMinutes)||0, durationMinutes:Number(lectureForm.durationMinutes)||0,
      completed:false, priority:lectureForm.priority, plannedDate:lectureForm.plannedDate };
    setState(s=>({...s,lectures:[l,...s.lectures]}));
    setLectureForm(f=>({...f,title:"",url:"",watchedMinutes:"",durationMinutes:""}));
  };
  const updateLecture = (id:string, patch:Partial<Lecture>) =>
    setState(s=>({...s,lectures:s.lectures.map(l=>l.id===id?{...l,...patch}:l)}));
  const deleteLecture = (id:string) => setState(s=>({...s,lectures:s.lectures.filter(l=>l.id!==id)}));
  const addTask = () => {
    if (!taskForm.title.trim()) return;
    setState(s=>({...s,tasks:[{id:crypto.randomUUID(),date:taskForm.date,title:taskForm.title.trim(),subject:taskForm.subject,chapterId:taskForm.chapterId,completed:false},...s.tasks]}));
    setTaskForm(f=>({...f,title:""}));
  };
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download=`jee-progress-${dateKey()}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importData = (file:File) => {
    const reader=new FileReader();
    reader.onload=()=>{ try { const parsed=JSON.parse(String(reader.result)); setState({...makeDefaultState(),...parsed,progress:migrateProgress(parsed.progress)}); } catch { window.alert("That backup file is not valid JEE Progress data."); } };
    reader.readAsText(file);
  };
  const logout=()=>{setRunning(false);localStorage.removeItem("jee-progress:session");setUser(null);setState(makeDefaultState());};
  const reset=()=>{if(window.confirm("Reset all JEE Progress data for this account?")){setRunning(false);setState(makeDefaultState());}};
  const openChapter=(id:string)=>{setSelectedChapter(id);setPage("syllabus");};
  const nav=(p:typeof page)=>{setSelectedChapter(null);setPage(p);};

  const attention = useMemo(()=>syllabus.map(c=>{
    const p=state.progress[c.id]; const pyqs=PYQ_YEARS.map(y=>p.pyq[y]);
    const attempted=pyqs.filter(x=>x.attempted).length;
    const total=pyqs.reduce((n,x)=>n+x.total,0), correct=pyqs.reduce((n,x)=>n+x.correct,0);
    const accuracy=total?correct/total:0;
    const score=(p.completed?0:2)+(3-attempted)*0.7+(total&&accuracy<.7?1:0);
    return {c,score,attempted,total,correct,accuracy};
  }).sort((a,b)=>b.score-a.score).slice(0,5),[state.progress]);

  if(!user) return <AuthScreen onLogin={account=>{localStorage.setItem("jee-progress:session",account.id);setUser(account);setState(load(account.id));}} />;

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span>J</span><div><strong>JEE Progress</strong><small>your prep dashboard</small></div></div>
      <nav>{[
        ["dashboard","Dashboard"],["lectures","Lectures"],["syllabus","Syllabus"],["pyqs","PYQs"],["mocks","Mocks"],["settings","Settings"]
      ].map(([id,label])=><button key={id} className={page===id?"nav active":"nav"} onClick={()=>nav(id as typeof page)}>{label}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="account"><span>{user.email}</span><button className="danger-link" onClick={logout}>Log out</button></div>
      </div>
    </aside>
    <main>
      <header><div><p className="eyebrow">{state.examName}</p><h1>{selectedChapter && page==="syllabus" ? chapterName(selectedChapter) : ({dashboard:"Dashboard",lectures:"Lectures",syllabus:"Syllabus",pyqs:"PYQs",mocks:"Full-syllabus mocks",settings:"Settings"} as Record<string,string>)[page]}</h1></div><div className="countdown"><b>{daysUntil(state.examDate)}</b><span>days left</span></div></header>

      {page==="dashboard" && <Dashboard days={daysUntil(state.examDate)} stats={subjectStats} completedModules={completedModules} pyqDone={pyqDone} lectureMinutes={lectureMinutes} attention={attention} state={state} running={running} startTimer={startTimer} stopTimer={stopTimer} sessionSubject={sessionSubject} setSessionSubject={setSessionSubject} sessionChapter={sessionChapter} setSessionChapter={setSessionChapter} nav={nav} />}

      {page==="lectures" && <section>
        <div className="card form-card"><div className="section-title"><div><h2>Add lecture</h2><p className="muted">Track links and time watched. Videos always open externally.</p></div></div>
          <div className="form-grid lecture-form">
            <input placeholder="Lecture title" value={lectureForm.title} onChange={e=>setLectureForm({...lectureForm,title:e.target.value})}/>
            <select value={lectureForm.subject} onChange={e=>{const subject=e.target.value as Subject;setLectureForm({...lectureForm,subject,chapterId:subjectChapters(subject)[0].id});}}>{subjects.map(s=><option key={s}>{s}</option>)}</select>
            <select value={lectureForm.chapterId} onChange={e=>setLectureForm({...lectureForm,chapterId:e.target.value})}>{subjectChapters(lectureForm.subject).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input placeholder="YouTube / lecture link" type="url" value={lectureForm.url} onChange={e=>setLectureForm({...lectureForm,url:e.target.value})}/>
            <input placeholder="Duration (min)" type="number" min="0" value={lectureForm.durationMinutes} onChange={e=>setLectureForm({...lectureForm,durationMinutes:e.target.value})}/>
            <input placeholder="Watched (min)" type="number" min="0" value={lectureForm.watchedMinutes} onChange={e=>setLectureForm({...lectureForm,watchedMinutes:e.target.value})}/>
            <select value={lectureForm.priority} onChange={e=>setLectureForm({...lectureForm,priority:e.target.value as Lecture["priority"]})}><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select>
            <input type="date" value={lectureForm.plannedDate} onChange={e=>setLectureForm({...lectureForm,plannedDate:e.target.value})}/>
            <button className="primary" onClick={addLecture}>+ Add lecture</button>
          </div>
        </div>
        <div className="toolbar"><div className="tabs">{["All",...subjects].map(s=><button key={s} className={filter===s?"selected":""} onClick={()=>setFilter(s as Subject|"All")}>{s}</button>)}</div><span>{filteredLectures.length} lectures</span></div>
        {filteredLectures.length===0?<div className="card empty-state"><h2>No lectures yet</h2><p>Add a lecture above, then use the queue to record progress.</p></div>:
        <div className="list">{filteredLectures.map(l=><div className="card lecture" key={l.id}>
          <input type="checkbox" checked={l.completed} onChange={()=>updateLecture(l.id,{completed:!l.completed})}/>
          <div className="lecture-main"><div><span className={`priority ${l.priority}`}>{l.priority}</span><span className="tag">{l.subject}</span><button className="inline-link" onClick={()=>openChapter(l.chapterId)}>{chapterName(l.chapterId)}</button></div>
            <h3 className={l.completed?"done":""}>{l.title}</h3><a href={l.url} target="_blank" rel="noreferrer">Open lecture ↗</a>
            {l.durationMinutes>0 && <div className="mini-progress"><div><span>{l.watchedMinutes}/{l.durationMinutes} min</span><span>{percent(l.watchedMinutes,l.durationMinutes)}%</span></div><i style={{width:`${Math.min(100,percent(l.watchedMinutes,l.durationMinutes))}%`}}/></div>}
          </div>
          <div className="lecture-controls"><label>Watched <input type="number" min="0" value={l.watchedMinutes} onChange={e=>updateLecture(l.id,{watchedMinutes:Math.max(0,Number(e.target.value))})}/></label>
            <label>Plan <input type="date" value={l.plannedDate} onChange={e=>updateLecture(l.id,{plannedDate:e.target.value})}/></label><button className="danger-link" onClick={()=>deleteLecture(l.id)}>Delete</button>
          </div>
        </div>)}</div>}
      </section>}

      {page==="syllabus" && (selectedChapter ? <ChapterView chapterId={selectedChapter} state={state} updateProgress={updateProgress} lectures={state.lectures} openLecture={()=>nav("lectures")} /> :
        <section><div className="stats-row"><Stat label="Modules completed" value={`${completedModules}/${TOTAL_MODULES}`} /><Stat label="Lectures completed" value={`${completedLectures}/${state.lectures.length}`} /><Stat label="PYQs attempted" value={`${pyqDone}/${TOTAL_MODULES*3}`} /></div>
          {subjects.map(subject=><div className="card subject-block" key={subject}><div className="subject-head"><h2>{subject}</h2><span>{subjectStats.find(s=>s.subject===subject)!.done}/{subjectStats.find(s=>s.subject===subject)!.total}</span></div>
            {subjectChapters(subject).map(c=><button className="chapter-row clickable" key={c.id} onClick={()=>openChapter(c.id)}><input type="checkbox" checked={state.progress[c.id]?.completed??false} onChange={e=>{e.stopPropagation();updateProgress(c.id,{completed:e.target.checked})}} onClick={e=>e.stopPropagation()}/><span>{c.name}</span><small>{state.lectures.filter(l=>l.chapterId===c.id&&l.completed).length} lectures · {PYQ_YEARS.filter(y=>state.progress[c.id]?.pyq[y]?.attempted).length}/3 PYQ years</small></button>)}
          </div>)}
        </section>)}

      {page==="mocks" && <MocksPage state={state} setState={setState} />}

      {page==="pyqs" && <section><div className="card"><div className="section-title"><div><h2>Past 3 years</h2><p className="muted">Check a year when attempted; add question counts and correct answers for accuracy.</p></div><b>{pyqDone}/{TOTAL_MODULES*3}</b></div></div>
        {subjects.map(subject=><div className="card subject-block" key={subject}><h2>{subject}</h2><div className="pyq-head"><span>Chapter</span><span>2024</span><span>2025</span><span>2026</span></div>
          {subjectChapters(subject).map(c=><div className="pyq-row" key={c.id}><button className="chapter-link" onClick={()=>openChapter(c.id)}>{c.name}</button>{PYQ_YEARS.map(year=><PYQCell key={year} value={state.progress[c.id].pyq[year]} onChange={v=>updateProgress(c.id,{pyq:{...state.progress[c.id].pyq,[year]:v}})}/>)}</div>)}
        </div>)}
      </section>}

      {page==="settings" && <SettingsPage state={state} setState={setState} exportData={exportData} importRef={importRef} importData={importData} reset={reset} />}
    </main>
  </div>;
}

function Dashboard({days,stats,completedModules,pyqDone,lectureMinutes,attention,state,running,startTimer,stopTimer,sessionSubject,setSessionSubject,sessionChapter,setSessionChapter,nav}:{days:number;stats:{subject:Subject;done:number;total:number}[];completedModules:number;pyqDone:number;lectureMinutes:number;attention:any[];state:AppState;running:boolean;startTimer:()=>void;stopTimer:()=>void;sessionSubject:Subject;setSessionSubject:(s:Subject)=>void;sessionChapter:string;setSessionChapter:(s:string)=>void;nav:(p:any)=>void}) {
  const totalStudy=state.sessions.reduce((n,s)=>n+s.seconds,0);
  return <section><div className="hero-grid">
    <div className="card hero"><span className="eyebrow">JEE COUNTDOWN</span><strong>{days}</strong><span>days remaining</span></div>
    <div className="card timer"><span className="eyebrow">STUDY TIMER</span><strong>{formatTime(state.studySeconds)}</strong><div className="timer-config"><select value={sessionSubject} onChange={e=>{const s=e.target.value as Subject;setSessionSubject(s);setSessionChapter(subjectChapters(s)[0].id)}}>{subjects.map(s=><option key={s}>{s}</option>)}</select><select value={sessionChapter} onChange={e=>setSessionChapter(e.target.value)}>{subjectChapters(sessionSubject).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><button className={running?"stop":"primary"} onClick={running?stopTimer:startTimer}>{running?"Stop & save":"Start study session"}</button></div>
  </div><div className="stats-row"><Stat label="Modules" value={`${completedModules}/${TOTAL_MODULES}`} /><Stat label="PYQ years" value={`${pyqDone}/${TOTAL_MODULES*3}`} /><Stat label="Lecture minutes" value={String(lectureMinutes)} /></div>
  <div className="dashboard-grid"><div className="card"><div className="section-title"><h2>Subject progress</h2><button className="inline-link" onClick={()=>nav("syllabus")}>Open syllabus →</button></div>{stats.map(s=><div className="progress-line" key={s.subject}><div><span>{s.subject}</span><b>{s.done}/{s.total}</b></div><div className="bar"><i style={{width:`${percent(s.done,s.total)}%`}}/></div></div>)}<p className="muted total-study">Total saved study time: {formatLongTime(totalStudy)}</p></div>
  <div className="card"><div className="section-title"><h2>Needs attention</h2><button className="inline-link" onClick={()=>nav("syllabus")}>View chapters →</button></div><div className="attention-grid">{attention.map(x=><button className="attention-item" key={x.c.id} onClick={()=>nav("syllabus")}><span>{x.c.subject}</span><strong>{x.c.name}</strong><small>{x.c.completed?"Module complete":"Module incomplete"} · {x.attempted}/3 PYQ years</small></button>)}</div></div></div>
  </section>;
}
function ChapterView({chapterId,state,updateProgress,lectures,openLecture}:{chapterId:string;state:AppState;updateProgress:(id:string,p:Partial<Progress[string]>)=>void;lectures:Lecture[];openLecture:()=>void}) {
  const c=syllabus.find(x=>x.id===chapterId)!; const p=state.progress[c.id]; const ls=lectures.filter(l=>l.chapterId===c.id);
  const attempted=p?PYQ_YEARS.filter(y=>p.pyq[y].attempted).length:0; const total=p?PYQ_YEARS.reduce((n,y)=>n+p.pyq[y].total,0):0; const correct=p?PYQ_YEARS.reduce((n,y)=>n+p.pyq[y].correct,0):0;
  return <section><button className="back-link" onClick={openLecture}>← Back to lectures</button><div className="chapter-hero card"><div><span className="tag">{c.subject}</span><h2>{c.name}</h2><p className="muted">Keep module, lectures and PYQs together for this chapter.</p></div><label className="module-check"><input type="checkbox" checked={p.completed} onChange={e=>updateProgress(c.id,{completed:e.target.checked})}/> Module complete</label></div>
    <div className="stats-row"><Stat label="Lectures" value={`${ls.filter(l=>l.completed).length}/${ls.length}`} /><Stat label="PYQ years" value={`${attempted}/3`} /><Stat label="PYQ accuracy" value={total?`${percent(correct,total)}%`:"—"} /></div>
    <div className="card"><div className="section-title"><h2>Lectures</h2><button className="inline-link" onClick={openLecture}>Manage lectures →</button></div>{ls.length?<div className="list compact">{ls.map(l=><div className="simple-row" key={l.id}><span>{l.completed?"✓":"○"}</span><div><strong>{l.title}</strong><small>{l.watchedMinutes}{l.durationMinutes?"/"+l.durationMinutes:""} min watched</small></div><a href={l.url} target="_blank" rel="noreferrer">Open ↗</a></div>)}</div>:<p className="muted">No lectures linked to this chapter yet.</p>}</div>
    <div className="card"><div className="section-title"><h2>PYQs</h2><span className="muted">Attempted + score</span></div>{PYQ_YEARS.map(y=><div className="pyq-detail" key={y}><label><input type="checkbox" checked={p.pyq[y].attempted} onChange={e=>updateProgress(c.id,{pyq:{...p.pyq,[y]:{...p.pyq[y],attempted:e.target.checked}}})}/> {y}</label><input type="number" min="0" placeholder="Total" value={p.pyq[y].total||""} onChange={e=>updateProgress(c.id,{pyq:{...p.pyq,[y]:{...p.pyq[y],total:Math.max(0,Number(e.target.value))}}})}/><input type="number" min="0" placeholder="Correct" value={p.pyq[y].correct||""} onChange={e=>updateProgress(c.id,{pyq:{...p.pyq,[y]:{...p.pyq[y],correct:Math.max(0,Number(e.target.value))}}})}/></div>)}</div>
  </section>;
}
function PYQCell({value,onChange}:{value:PYQRecord;onChange:(v:PYQRecord)=>void}) {
  return <div className="pyq-cell"><input type="checkbox" checked={value.attempted} onChange={e=>onChange({...value,attempted:e.target.checked})}/>{value.total>0&&<small>{value.correct}/{value.total}</small>}</div>;
}
function MocksPage({state,setState}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>}) {
  const [form,setForm]=useState({name:"",date:dateKey(),score:"",totalMarks:"300",notes:""});
  const attempts=[...state.mocks].sort((a,b)=>b.date.localeCompare(a.date));
  const scored=attempts.filter(m=>m.totalMarks>0);
  const best=scored.length?Math.max(...scored.map(m=>m.score)):0;
  const average=scored.length?Math.round(scored.reduce((n,m)=>n+(m.score/m.totalMarks*100),0)/scored.length):0;
  const add=()=>{if(form.score==="") return; const score=Math.max(0,Number(form.score)||0), totalMarks=Math.max(1,Number(form.totalMarks)||300); const attempt:MockAttempt={id:crypto.randomUUID(),name:form.name.trim()||"Full Syllabus Mock",date:form.date,score,totalMarks,accuracy:(score/totalMarks)*100,mathematics:0,physics:0,chemistry:0,notes:form.notes.trim()}; setState(s=>({...s,mocks:[attempt,...s.mocks]})); setForm(f=>({...f,name:"",score:"",notes:""}));};
  const remove=(id:string)=>setState(s=>({...s,mocks:s.mocks.filter(m=>m.id!==id)}));
  const trend=[...attempts].slice(0,8).reverse();
  return <section><div className="stats-row"><Stat label="Mocks" value={String(attempts.length)} /><Stat label="Best" value={scored.length?`${best}/${scored.find(m=>m.score===best)?.totalMarks}`:"—"} /><Stat label="Avg %" value={scored.length?`${average}%`:"—"} /></div>
    <div className="card form-card"><div className="section-title"><div><h2>Log a mock</h2><p className="muted">Record the score. Accuracy is calculated automatically.</p></div></div><div className="form-grid mock-form"><input placeholder="Mock name (optional)" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/><input type="number" min="0" placeholder="Score" value={form.score} onChange={e=>setForm({...form,score:e.target.value})}/><input type="number" min="1" placeholder="Total marks" value={form.totalMarks} onChange={e=>setForm({...form,totalMarks:e.target.value})}/><input placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/><button className="primary" onClick={add}>+ Add mock</button></div></div>
    {attempts.length>0 && <div className="card"><div className="section-title"><div><h2>Score trend</h2><p className="muted">Latest 8 attempts</p></div><span className="muted">Latest: {attempts[0].score}/{attempts[0].totalMarks}</span></div><div className="mock-trend">{trend.map(m=><div className="mock-point" key={m.id}><span>{m.score}</span><i style={{height:`${Math.max(8,Math.min(140,(m.score/Math.max(m.totalMarks,1))*140))}px`}}/><small>{new Date(m.date+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></div>)}</div></div>}
    <div className="card"><div className="section-title"><h2>History</h2><span className="muted">{attempts.length} attempts</span></div>{attempts.length===0?<p className="muted">Your mock results will appear here.</p>:<div className="mock-history">{attempts.map(m=><div className="mock-row" key={m.id}><div><strong>{m.name}</strong><small>{new Date(m.date+"T00:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}</small></div><div className="mock-score"><strong>{m.score}/{m.totalMarks}</strong><small>{Math.round(m.accuracy)}%</small></div><div className="mock-notes">{m.notes||"—"}</div><button className="danger-link" onClick={()=>remove(m.id)}>Delete</button></div>)}</div>}</div>
  </section>;
}
function PlanPage({state,setState,taskForm,setTaskForm,addTask}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;taskForm:any;setTaskForm:any;addTask:()=>void}) {
  const dates=[0,1,2,3,4,5,6].map(i=>{const d=new Date();d.setDate(d.getDate()+i);return dateKey(d);});
  return <section><div className="card form-card"><h2>Add task</h2><div className="form-grid plan-form"><input placeholder="e.g. Finish Rotational Motion L07" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})}/><select value={taskForm.subject} onChange={e=>{const s=e.target.value as Subject|"";setTaskForm({...taskForm,subject:s,chapterId:s?subjectChapters(s)[0].id:""})}}><option value="">Any subject</option>{subjects.map(s=><option key={s}>{s}</option>)}</select>{taskForm.subject&&<select value={taskForm.chapterId} onChange={e=>setTaskForm({...taskForm,chapterId:e.target.value})}>{subjectChapters(taskForm.subject).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}<input type="date" value={taskForm.date} onChange={e=>setTaskForm({...taskForm,date:e.target.value})}/><button className="primary" onClick={addTask}>+ Add task</button></div></div>
    <div className="week-grid">{dates.map(d=><div className={d===dateKey()?"card day-card today":"card day-card"} key={d}><div className="day-head"><strong>{new Date(d+"T00:00:00").toLocaleDateString(undefined,{weekday:"short"})}</strong><small>{d}</small></div>{state.tasks.filter(t=>t.date===d).map(t=><label className={t.completed?"task done-task":"task"} key={t.id}><input type="checkbox" checked={t.completed} onChange={()=>setState(s=>({...s,tasks:s.tasks.map(x=>x.id===t.id?{...x,completed:!x.completed}:x)}))}/><span>{t.title}</span></label>)}{!state.tasks.some(t=>t.date===d)&&<p className="muted">No tasks</p>}</div>)}</div>
  </section>;
}
function HistoryPage({state}:{state:AppState}) {
  const byDate=Object.entries(state.sessions.reduce<Record<string,StudySession[]>>((acc,session)=>{ (acc[session.date]??=[]).push(session); return acc; },{})).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14);
  const last7=[0,1,2,3,4,5,6].map(i=>{const d=new Date();d.setDate(d.getDate()-i);const key=dateKey(d);return {key,seconds:state.sessions.filter(s=>s.date===key).reduce((n,s)=>n+s.seconds,0)}}).reverse();
  return <section><div className="card"><div className="section-title"><h2>Last 7 days</h2><span className="muted">saved study sessions</span></div><div className="history-bars">{last7.map(x=><div key={x.key}><div className="history-bar" style={{height:`${Math.max(6,Math.min(130,x.seconds/120))}px`}}/><small>{new Date(x.key+"T00:00:00").toLocaleDateString(undefined,{weekday:"short"})}</small><span>{formatLongTime(x.seconds)}</span></div>)}</div></div>
    <div className="card"><h2>Recent sessions</h2>{byDate.length?byDate.map(([date,sessions])=><div className="history-day" key={date}><div><strong>{new Date(date+"T00:00:00").toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</strong><span>{formatLongTime(sessions.reduce((n,s)=>n+s.seconds,0))}</span></div>{sessions.map(s=><div className="simple-row" key={s.id}><span>{new Date(s.startedAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</span><div><strong>{s.subject}</strong><small>{chapterName(s.chapterId)}</small></div><b>{formatLongTime(s.seconds)}</b></div>)}</div>):<p className="muted">No saved sessions yet. Start the study timer from the dashboard.</p>}</div>
  </section>;
}
function SettingsPage({state,setState,exportData,importRef,importData,reset}:{state:AppState;setState:React.Dispatch<React.SetStateAction<AppState>>;exportData:()=>void;importRef:React.RefObject<HTMLInputElement|null>;importData:(f:File)=>void;reset:()=>void}) {
  return <section><div className="settings-grid"><div className="card"><h2>Appearance</h2><label className="setting-row">Theme<select value={state.theme} onChange={e=>setState(s=>({...s,theme:e.target.value as "dark"|"light"}))}><option value="dark">Dark</option><option value="light">Light</option></select></label></div>
    <div className="card"><h2>Exam</h2><label className="setting-row">Exam name<input value={state.examName} onChange={e=>setState(s=>({...s,examName:e.target.value}))}/></label><label className="setting-row">Exam date<input type="date" value={state.examDate} onChange={e=>setState(s=>({...s,examDate:e.target.value}))}/></label></div>
    <div className="card"><h2>Backup</h2><p className="muted">Export your local data before clearing browser storage or changing devices.</p><div className="button-row"><button className="primary" onClick={exportData}>Export JSON</button><button className="secondary" onClick={()=>importRef.current?.click()}>Import JSON</button><input ref={importRef} hidden type="file" accept=".json,application/json" onChange={e=>e.target.files?.[0]&&importData(e.target.files[0])}/></div></div>
    <div className="card danger-card"><h2>Reset</h2><p className="muted">This clears this account's lectures, progress, plans and study history.</p><button className="danger-button" onClick={reset}>Reset all data</button></div></div></section>;
}
function AuthScreen({onLogin}:{onLogin:(account:Account)=>void}) {
  const [mode,setMode]=useState<"login"|"signup">("login"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
  const submit=()=>{const e=email.trim().toLowerCase();if(!e||password.length<4){setMessage("Enter an email and a password with at least 4 characters.");return;}const accounts=getAccounts(),existing=accounts.find(a=>a.email===e);if(mode==="signup"){if(existing){setMessage("An account with that email already exists.");return;}const a={id:crypto.randomUUID(),email:e,passwordHash:hashPassword(password)};localStorage.setItem("jee-progress:accounts",JSON.stringify([...accounts,a]));onLogin(a);}else{if(!existing||existing.passwordHash!==hashPassword(password)){setMessage("Invalid email or password.");return;}onLogin(existing);}};
  return <div className="auth-page"><div className="auth-card"><span className="brand-mark">J</span><p className="eyebrow">PRIVATE STUDY TRACKER</p><h1>JEE Progress</h1><p className="auth-copy">Log in to access your personal JEE dashboard.</p><div className="auth-tabs"><button className={mode==="login"?"selected":""} onClick={()=>{setMode("login");setMessage("")}}>Log in</button><button className={mode==="signup"?"selected":""} onClick={()=>{setMode("signup");setMessage("")}}>Create account</button></div><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/><button className="primary auth-submit" onClick={submit}>{mode==="login"?"Log in":"Create account"}</button>{message&&<p className="auth-message">{message}</p>}</div></div>;
}
function Stat({label,value}:{label:string;value:string}){return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;}
export default App;
