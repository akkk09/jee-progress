import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { syllabus, subjects, type Subject } from "./data";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type Lecture = {
  id: string;
  title: string;
  subject: Subject;
  chapterId: string;
  url: string;
  watchedMinutes: number;
  completed: boolean;
};

type Progress = Record<string, { completed: boolean; pyq: Record<"2024" | "2025" | "2026", boolean> }>;
type AppState = {
  examDate: string;
  examName: string;
  lectures: Lecture[];
  progress: Progress;
  studySeconds: number;
};

const PYQ_YEARS = ["2024", "2025", "2026"] as const;
const TOTAL_MODULES = syllabus.length;
const TOTAL_PYQS = TOTAL_MODULES * PYQ_YEARS.length;

const initialProgress = (): Progress =>
  Object.fromEntries(syllabus.map((c) => [c.id, { completed: false, pyq: { "2024": false, "2025": false, "2026": false } }]));

const makeDefaultState = (): AppState => ({
  examDate: "2027-01-24",
  examName: "JEE Main 2027",
  lectures: [],
  progress: initialProgress(),
  studySeconds: 0,
});

const load = (userId: string): AppState => {
  try {
    const saved = localStorage.getItem(`jee-progress:${userId}`);
    if (!saved) return makeDefaultState();
    const parsed = JSON.parse(saved) as AppState;
    const defaults = makeDefaultState();
    const progress = Object.fromEntries(syllabus.map((c) => [c.id, { ...defaults.progress[c.id], ...(parsed.progress?.[c.id] ?? {}), pyq: { ...defaults.progress[c.id].pyq, ...(parsed.progress?.[c.id]?.pyq ?? {}) } }]));
    return { ...defaults, ...parsed, progress };
  } catch {
    return makeDefaultState();
  }
};

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}h ${m}m` : `${m}m ${s}s`;
};

const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date + "T00:00:00").getTime() - Date.now()) / 86400000));

function App() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState<AppState>(makeDefaultState);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null);
      if (data.session?.user) setState(load(data.session.user.id));
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      if (session?.user) setState(load(session.user.id));
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const [page, setPage] = useState<"dashboard" | "lectures" | "syllabus" | "pyqs">("dashboard");
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Subject | "All">("All");
  const [lectureForm, setLectureForm] = useState({ title: "", subject: "Mathematics" as Subject, chapterId: syllabus[0].id, url: "", watchedMinutes: "" });

  useEffect(() => { if (user) localStorage.setItem(`jee-progress:${user.id}`, JSON.stringify(state)); }, [state, user]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setState((s) => ({ ...s, studySeconds: s.studySeconds + 1 }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const chapter = (id: string) => syllabus.find((c) => c.id === id)!;
  const completedModules = syllabus.filter((c) => state.progress[c.id]?.completed).length;
  const pyqDone = syllabus.reduce((n, c) => n + Object.values(state.progress[c.id]?.pyq ?? {}).filter(Boolean).length, 0);
  const filteredLectures = state.lectures.filter((l) => filter === "All" || l.subject === filter);

  const subjectStats = useMemo(() => subjects.map((subject) => {
    const chapters = syllabus.filter((c) => c.subject === subject);
    return { subject, done: chapters.filter((c) => state.progress[c.id]?.completed).length, total: chapters.length };
  }), [state.progress]);

  const updateProgress = (chapterId: string, patch: Partial<Progress[string]>) =>
    setState((s) => ({ ...s, progress: { ...s.progress, [chapterId]: { ...s.progress[chapterId], ...patch } } }));

  const addLecture = () => {
    if (!lectureForm.title.trim() || !lectureForm.url.trim()) return;
    const lecture: Lecture = {
      id: crypto.randomUUID(),
      title: lectureForm.title.trim(),
      subject: lectureForm.subject,
      chapterId: lectureForm.chapterId,
      url: lectureForm.url.trim(),
      watchedMinutes: Number(lectureForm.watchedMinutes) || 0,
      completed: false,
    };
    setState((s) => ({ ...s, lectures: [lecture, ...s.lectures] }));
    setLectureForm((f) => ({ ...f, title: "", url: "", watchedMinutes: "" }));
  };

  const setWatched = (id: string, value: number) =>
    setState((s) => ({ ...s, lectures: s.lectures.map((l) => l.id === id ? { ...l, watchedMinutes: Math.max(0, value) } : l) }));

  const toggleLecture = (id: string) =>
    setState((s) => ({ ...s, lectures: s.lectures.map((l) => l.id === id ? { ...l, completed: !l.completed } : l) }));

  const deleteLecture = (id: string) =>
    setState((s) => ({ ...s, lectures: s.lectures.filter((l) => l.id !== id) }));

  const reset = () => {
    if (window.confirm("Reset all JEE Progress data?")) {
      setState(makeDefaultState());
      setRunning(false);
    }
  };


  if (authLoading) return <div className="auth-page"><div className="auth-card"><span className="brand-mark">J</span><h1>JEE Progress</h1><p>Checking your session…</p></div></div>;
  if (!supabase) return <div className="auth-page"><div className="auth-card"><span className="brand-mark">J</span><h1>Configuration required</h1><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel environment variables.</p></div></div>;
  if (!user) return <AuthScreen />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><span>J</span><div><strong>JEE Progress</strong><small>your prep dashboard</small></div></div>
        <nav>
          {([["dashboard", "Dashboard"], ["lectures", "Lectures"], ["syllabus", "Syllabus"], ["pyqs", "PYQs"]] as const).map(([id, label]) =>
            <button key={id} className={page === id ? "nav active" : "nav"} onClick={() => setPage(id)}>{label}</button>
          )}
        </nav>
        <div className="sidebar-bottom"><div className="account"><span>{user.email}</span><button className="danger-link" onClick={() => supabase.auth.signOut()}>Log out</button></div>
          <label>Exam date</label>
          <input type="date" value={state.examDate} onChange={(e) => setState((s) => ({ ...s, examDate: e.target.value }))} />
          <input value={state.examName} onChange={(e) => setState((s) => ({ ...s, examName: e.target.value }))} />
          <button className="danger-link" onClick={reset}>Reset data</button>
        </div>
      </aside>

      <main>
        <header><div><p className="eyebrow">{state.examName}</p><h1>{page[0].toUpperCase() + page.slice(1)}</h1></div><div className="countdown"><b>{daysUntil(state.examDate)}</b><span>days left</span></div></header>

        {page === "dashboard" && <Dashboard days={daysUntil(state.examDate)} stats={subjectStats} completedModules={completedModules} pyqDone={pyqDone} lectures={state.lectures} studySeconds={state.studySeconds} running={running} setRunning={setRunning} />}
        
        {page === "lectures" && <section>
          <div className="card form-card">
            <h2>Add lecture</h2>
            <div className="form-grid">
              <input placeholder="Lecture title" value={lectureForm.title} onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })} />
              <select value={lectureForm.subject} onChange={(e) => {
                const subject = e.target.value as Subject;
                const first = syllabus.find((c) => c.subject === subject)!;
                setLectureForm({ ...lectureForm, subject, chapterId: first.id });
              }}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
              <select value={lectureForm.chapterId} onChange={(e) => setLectureForm({ ...lectureForm, chapterId: e.target.value })}>{syllabus.filter((c) => c.subject === lectureForm.subject).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input placeholder="YouTube / lecture link" type="url" value={lectureForm.url} onChange={(e) => setLectureForm({ ...lectureForm, url: e.target.value })} />
              <input placeholder="Minutes already watched" type="number" min="0" value={lectureForm.watchedMinutes} onChange={(e) => setLectureForm({ ...lectureForm, watchedMinutes: e.target.value })} />
              <button className="primary" onClick={addLecture}>+ Add lecture</button>
            </div>
          </div>
          <div className="toolbar"><div className="tabs">{["All", ...subjects].map((s) => <button key={s} className={filter === s ? "selected" : ""} onClick={() => setFilter(s as Subject | "All")}>{s}</button>)}</div><span>{filteredLectures.length} lectures</span></div>
          {filteredLectures.length === 0 ? <div className="card empty-state"><h2>No lectures yet</h2><p>Add a lecture above with its link and the time you have already watched.</p></div> : <div className="list">{filteredLectures.map((l) => <div className="card lecture" key={l.id}>
            <div className="check" onClick={() => toggleLecture(l.id)}>{l.completed ? "✓" : ""}</div>
            <div className="lecture-main"><div><span className="tag">{l.subject}</span><span className="muted">{chapter(l.chapterId).name}</span></div><h3 className={l.completed ? "done" : ""}>{l.title}</h3><a href={l.url} target="_blank" rel="noreferrer">Open lecture ↗</a></div>
            <label className="watched">Watched <input type="number" min="0" value={l.watchedMinutes} onChange={(e) => setWatched(l.id, Number(e.target.value))} /> min</label><button className="danger-link" onClick={() => deleteLecture(l.id)}>Delete</button>
          </div>)}</div>}
        </section>}

        {page === "syllabus" && <section>
          <div className="stats-row"><Stat label="Modules completed" value={`${completedModules}/${syllabus.length}`} /><Stat label="Lectures completed" value={`${state.lectures.filter((l) => l.completed).length}/${state.lectures.length}`} /><Stat label="PYQs checked" value={`${pyqDone}/${syllabus.length * 3}`} /></div>
          {subjects.map((subject) => <div className="card subject-block" key={subject}><div className="subject-head"><h2>{subject}</h2><span>{subjectStats.find((s) => s.subject === subject)!.done}/{subjectStats.find((s) => s.subject === subject)!.total}</span></div>{syllabus.filter((c) => c.subject === subject).map((c) => <div className="chapter-row" key={c.id}><input type="checkbox" checked={state.progress[c.id]?.completed ?? false} onChange={(e) => updateProgress(c.id, { completed: e.target.checked })} /><span>{c.name}</span><small>{state.lectures.filter((l) => l.chapterId === c.id && l.completed).length} lectures</small></div>)}</div>)}
        </section>}

        {page === "pyqs" && <section>
          <div className="card"><div className="subject-head"><div><h2>Past 3 years</h2><p className="muted">Check a year once you've attempted that chapter's PYQs.</p></div><b>{pyqDone}/{syllabus.length * 3}</b></div></div>
          {subjects.map((subject) => <div className="card subject-block" key={subject}><h2>{subject}</h2><div className="pyq-head"><span>Chapter</span><span>2024</span><span>2025</span><span>2026</span></div>{syllabus.filter((c) => c.subject === subject).map((c) => <div className="pyq-row" key={c.id}><span>{c.name}</span>{PYQ_YEARS.map((year) => <input key={year} type="checkbox" checked={state.progress[c.id]?.pyq[year] ?? false} onChange={(e) => updateProgress(c.id, { pyq: { ...state.progress[c.id].pyq, [year]: e.target.checked } })} />)}</div>)}</div>)}
        </section>}
      </main>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!supabase || !email || !password) return;
    setBusy(true);
    setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else setMessage(mode === "signup" ? "Account created. Check your email if verification is enabled." : "");
  };

  return <div className="auth-page">
    <div className="auth-card">
      <span className="brand-mark">J</span>
      <p className="eyebrow">PRIVATE STUDY TRACKER</p>
      <h1>JEE Progress</h1>
      <p className="auth-copy">Sign in to access your personal JEE dashboard.</p>
      <div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Log in</button><button className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>Create account</button></div>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button className="primary auth-submit" onClick={submit} disabled={busy}>{busy ? "Working…" : mode === "login" ? "Log in" : "Create account"}</button>
      {message && <p className="auth-message">{message}</p>}
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>; }

function Dashboard({ days, stats, completedModules, pyqDone, lectures, studySeconds, running, setRunning }: { days: number; stats: { subject: Subject; done: number; total: number }[]; completedModules: number; pyqDone: number; lectures: Lecture[]; studySeconds: number; running: boolean; setRunning: (v: boolean) => void }) {
  return <section>
    <div className="hero-grid">
      <div className="card hero"><span className="eyebrow">COUNTDOWN</span><strong>{days}</strong><span>days until JEE</span></div>
      <div className="card timer"><span className="eyebrow">STUDY TIMER</span><strong>{formatTime(studySeconds)}</strong><button className={running ? "stop" : "primary"} onClick={() => setRunning(!running)}>{running ? "Stop timer" : "Start timer"}</button></div>
    </div>
    <div className="stats-row"><Stat label="Modules completed" value={`${completedModules}/${TOTAL_MODULES}`} /><Stat label="PYQs attempted" value={`${pyqDone}/${TOTAL_PYQS}`} /><Stat label="Lecture time watched" value={`${lectures.reduce((n, l) => n + l.watchedMinutes, 0)} min`} /></div>
    <div className="card"><h2>Subject progress</h2>{stats.map((s) => <div className="progress-line" key={s.subject}><div><span>{s.subject}</span><b>{s.done}/{s.total}</b></div><div className="bar"><i style={{ width: `${(s.done / s.total) * 100}%` }} /></div></div>)}</div>
  </section>;
}

export default App;
