// ═══════════════════════════════════════════════════════
//  HostelCare — Core Application Logic (MongoDB Edition)
// ═══════════════════════════════════════════════════════

const API_BASE = 'http://localhost:5000/api';

// ── API Helper ─────────────────────────────────────────────
const API = {
  getToken() { return localStorage.getItem('hc_token'); },
  setToken(t) { localStorage.setItem('hc_token', t); },
  clearToken() { localStorage.removeItem('hc_token'); },

  async request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(API_BASE + path, opts);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('API error:', err);
      return { ok: false, msg: 'Cannot connect to server. Make sure the backend is running on port 5000.' };
    }
  },

  get(path)        { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body)  { return this.request('PUT', path, body); },
};

// ── In-Memory Cache (loaded fresh from API each page load) ─
const AppCache = {
  complaints: [],
  async loadComplaints() {
    const res = await API.get('/complaints');
    if (res.ok) this.complaints = res.complaints || [];
    return this.complaints;
  },
};

// ── Theme Manager ──────────────────────────────────────────
const ThemeManager = {
  init() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateToggle();
  },
  toggle() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this.updateToggle();
  },
  updateToggle() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-icon').forEach(i => { i.textContent = isDark ? '☀️' : '🌙'; });
  }
};

// ── Notifications ──────────────────────────────────────────
const Notify = {
  container: null,
  init() {
    this.container = document.getElementById('notif-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'notif-container';
      this.container.id = 'notif-container';
      document.body.appendChild(this.container);
    }
  },
  show(title, msg, type = 'info') {
    if (!this.container) this.init();
    const icons = { info: '💬', success: '✅', warning: '⚠️', error: '❌' };
    const el = document.createElement('div');
    el.className = 'notif-toast';
    el.innerHTML = `<div class="notif-icon">${icons[type] || '💬'}</div>
      <div class="notif-text"><strong>${title}</strong><span>${msg}</span></div>`;
    this.container.appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 4500);
  }
};

// ── Auth ───────────────────────────────────────────────────
const Auth = {
  getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('hc_user')) || null; } catch { return null; }
  },
  setCurrentUser(u) { localStorage.setItem('hc_user', JSON.stringify(u)); },
  logout() {
    API.clearToken();
    localStorage.removeItem('hc_user');
    window.location.href = 'login.html';
  },
  requireAuth(role) {
    const u = this.getCurrentUser();
    if (!u || !API.getToken()) { window.location.href = 'login.html'; return null; }
    if (role && u.role !== role) {
      const pages = { student: 'student-dashboard.html', warden: 'warden-dashboard.html' };
      window.location.href = pages[u.role] || 'login.html'; return null;
    }
    return u;
  },
};

// ── Complaint Manager ──────────────────────────────────────
const ComplaintManager = {
  getAll()          { return [...AppCache.complaints]; },
  getById(id)       { return AppCache.complaints.find(c => c.id === id) || null; },
  getByUser(userId) { return AppCache.complaints.filter(c => c.userId === userId); },

  async create(data) {
    const res = await API.post('/complaints', data);
    if (res.ok) AppCache.complaints.unshift(res.complaint);
    return res;
  },
  async update(id, updates) {
    const res = await API.put('/complaints/' + id, updates);
    if (res.ok) {
      const idx = AppCache.complaints.findIndex(c => c.id === id);
      if (idx !== -1) AppCache.complaints[idx] = res.complaint;
    }
    return res;
  },
  async rate(id, rating, feedback) {
    const res = await API.put('/complaints/' + id + '/rate', { rating, feedback });
    if (res.ok) {
      const idx = AppCache.complaints.findIndex(c => c.id === id);
      if (idx !== -1) AppCache.complaints[idx] = res.complaint;
    }
    return res;
  },
};

// ── Technician Pools ───────────────────────────────────────
const TechPool = {
  Electrical:  [{ name:'Ramesh Kumar',phone:'9840156789',specialty:'Electrical & Wiring Expert'},{ name:'Suresh Voltfix',phone:'7042134567',specialty:'Power & Circuit Specialist'},{ name:'Ajay Electricals',phone:'6354189012',specialty:'Switchboards & Fittings'}],
  Plumbing:    [{ name:'Manoj Pipeworks',phone:'9900145678',specialty:'Pipe & Drain Expert'},{ name:'Deepak Plumbers',phone:'8723178901',specialty:'Taps & Geyser Specialist'},{ name:'Ravi Waterfix',phone:'9112056789',specialty:'Sewage & Leak Handler'}],
  Internet:    [{ name:'Ankit Networks',phone:'8000167890',specialty:'WiFi & LAN Technician'},{ name:'Pradeep IT',phone:'7654312345',specialty:'Router & Connectivity Expert'},{ name:'Sanjay Netfix',phone:'9567023456',specialty:'Bandwidth & Cabling'}],
  Furniture:   [{ name:'Vikas Carpentry',phone:'8234156789',specialty:'Woodwork & Repair Expert'},{ name:'Rohit Fixtures',phone:'7456089012',specialty:'Doors & Windows Specialist'},{ name:'Satish Handyman',phone:'9678023456',specialty:'Beds & Almirah Repairs'}],
  Cleanliness: [{ name:'Shyam Housekeeping',phone:'8890156789',specialty:'Sanitation & Pest Control'},{ name:'Gopal Cleaning',phone:'7321056789',specialty:'Deep Cleaning Specialist'},{ name:'Harish Hygiene',phone:'6549023456',specialty:'Waste Management Expert'}],
  Other:       [{ name:'Mukesh General',phone:'9000156789',specialty:'General Maintenance'},{ name:'Pankaj Handyman',phone:'7890134567',specialty:'Miscellaneous Repairs'}]
};
function suggestTechnician(category) {
  const pool = TechPool[category] || TechPool['Other'];
  return { ...pool[Math.floor(Math.random() * pool.length)] };
}

// ── AI Helpers ─────────────────────────────────────────────
const AI = {
  categorize(text) {
    text = text.toLowerCase();
    const rules = [
      { cat:'Electrical',  keywords:['wire','electric','light','socket','fan','switch','spark','bulb','power','wiring','mcb','fuse','outlet','shock','current'] },
      { cat:'Plumbing',    keywords:['water','pipe','leak','tap','drain','flush','toilet','bathroom','sink','clog','overflow','sewage','geyser'] },
      { cat:'Internet',    keywords:['wifi','internet','network','connection','router','slow','bandwidth','lan','cable','broadband','signal','disconnect'] },
      { cat:'Furniture',   keywords:['furniture','chair','table','bed','door','window','almirah','cupboard','shelf','mattress','broken','hinge','lock'] },
      { cat:'Cleanliness', keywords:['clean','dirty','dust','garbage','trash','smell','cockroach','rat','pest','hygiene','sweep','mop','rubbish','insects'] }
    ];
    let best=null, bestScore=0;
    for (const r of rules) {
      const score = r.keywords.filter(k=>text.includes(k)).length;
      if (score>bestScore) { bestScore=score; best=r.cat; }
    }
    return bestScore>0 ? best : null;
  },
  detectPriority(text) {
    text=(text||'').toLowerCase();
    if (['fire','danger','spark','shock','emergency','flood','gas','unsafe','injury','burn','accident'].some(k=>text.includes(k))) return 'High';
    if (['broken','not working','failed','stuck','blocked','no water','no power','overflow','cannot'].some(k=>text.includes(k))) return 'Medium';
    return 'Low';
  },
  chatRespond(msg) {
    msg=msg.toLowerCase();
    const responses=[
      {triggers:['hello','hi','hey','helo'],reply:'👋 Hello! I\'m HostelBot. Describe your hostel issue and I\'ll guide you to the right complaint category!'},
      {triggers:['light','fan','electric','power','socket','bulb','switch','shock','fuse'],reply:'💡 **Electrical Issue?**\nQuick checks:\n1. Check the MCB/fuse box\n2. Try another switch or socket\n3. Check if other rooms are affected\n\nSelect **⚡ Electrical** as category and submit!'},
      {triggers:['water','tap','pipe','leak','drain','toilet','bathroom','geyser'],reply:'🚿 **Plumbing Issue?**\nTry:\n1. Check main water valve\n2. Use bucket temporarily\n3. Avoid using that fixture\n\nSelect **🚿 Plumbing** category!'},
      {triggers:['wifi','internet','network','slow','connection','router','disconnect'],reply:'📶 **Internet Issue?**\nTry:\n1. Restart your device\n2. Forget & reconnect WiFi\n3. Check if neighbours are affected\n\nSelect **📶 Internet** category!'},
      {triggers:['furniture','chair','table','bed','door','window','lock','almirah'],reply:'🪑 **Furniture Issue?**\nDocument the damage with a photo and submit under **🪑 Furniture** with your exact room number!'},
      {triggers:['clean','dirty','trash','smell','pest','cockroach','garbage','rat'],reply:'🧹 **Cleanliness Issue?**\nFor pest/rodent issues, mark **High Priority**! Submit under **🧹 Cleanliness** category.'},
      {triggers:['submit','complain','complaint','report','raise','file'],reply:'📝 **To submit a complaint:**\n1. Select category first\n2. Describe the issue in detail\n3. AI auto-detects priority\n4. Submit — warden assigns a specialist!'},
      {triggers:['status','track','check','progress','update','assigned'],reply:'🔍 Track your complaints under **My Complaints** in the sidebar.\nStatuses: Submitted → Assigned → In Progress → Resolved'},
      {triggers:['technician','tech','who will fix','repair'],reply:'🔧 After you submit, the **Warden** reviews it and assigns a specialist technician based on your complaint category. You\'ll see their name & phone number once assigned!'},
      {triggers:['emergency','urgent','fire','danger','flood'],reply:'🚨 **EMERGENCY!**\n1. Ensure your safety FIRST!\n2. Call warden immediately!\n3. Use keywords like "fire" or "shock" — AI auto-sets **High Priority**!'},
      {triggers:['help','how','what can'],reply:'I can help with:\n⚡ Electrical · 🚿 Plumbing · 📶 Internet\n🪑 Furniture · 🧹 Cleanliness\n\nDescribe your problem and I\'ll guide you!'},
    ];
    for (const r of responses) { if (r.triggers.some(t=>msg.includes(t))) return r.reply; }
    return '🤔 Try describing your issue with keywords like "light not working", "water leak", "wifi slow", "door broken", or "dirty room" and I\'ll guide you!';
  }
};

// ── UI Helpers ─────────────────────────────────────────────
const UI = {
  statusBadge(status) {
    const map={'Submitted':'submitted','Assigned':'assigned','In Progress':'inprogress','Resolved':'resolved'};
    return `<span class="badge badge-${map[status]||'submitted'}">${status}</span>`;
  },
  priorityBadge(p) { return `<span class="badge badge-${(p||'low').toLowerCase()}">${p||'Low'}</span>`; },
  categoryBadge(c) {
    const icons={Electrical:'⚡',Plumbing:'🚿',Internet:'📶',Furniture:'🪑',Cleanliness:'🧹',Other:'📦'};
    return `<span class="badge badge-${(c||'other').toLowerCase()}">${icons[c]||'📦'} ${c||'Other'}</span>`;
  },
  stars(n) { return '★'.repeat(Math.round(n||0))+'☆'.repeat(5-Math.round(n||0)); },
  timeAgo(isoStr) {
    if (!isoStr) return '—';
    const diff=Math.floor((Date.now()-new Date(isoStr))/1000);
    if (diff<60) return 'just now';
    if (diff<3600) return Math.floor(diff/60)+'m ago';
    if (diff<86400) return Math.floor(diff/3600)+'h ago';
    return Math.floor(diff/86400)+'d ago';
  },
  formatDate(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  },
  initSidebar() {
    const toggle=document.getElementById('menu-toggle');
    const sidebar=document.querySelector('.sidebar');
    const overlay=document.getElementById('sidebar-overlay');
    if (toggle&&sidebar) {
      toggle.onclick=()=>{sidebar.classList.toggle('open');overlay?.classList.toggle('show');};
      overlay?.addEventListener('click',()=>{sidebar.classList.remove('open');overlay.classList.remove('show');});
    }
  }
};

// ── Chatbot ────────────────────────────────────────────────
const Chatbot = {
  open: false,
  init() {
    const toggle=document.getElementById('chatbot-toggle');
    const win=document.getElementById('chatbot-window');
    const closeBtn=document.getElementById('chat-close');
    const input=document.getElementById('chat-input');
    const sendBtn=document.getElementById('chat-send');
    if (!toggle) return;
    toggle.onclick=()=>{
      this.open=!this.open; win.classList.toggle('open',this.open);
      if (this.open&&win.querySelector('.chat-messages').children.length===0)
        this.addMsg('bot','👋 Hi! I\'m HostelBot. Describe your problem and I\'ll help you find the right category and quick fix!');
    };
    closeBtn?.addEventListener('click',()=>{this.open=false;win.classList.remove('open');});
    sendBtn?.addEventListener('click',()=>this.send());
    input?.addEventListener('keydown',e=>{if(e.key==='Enter')this.send();});
    document.querySelectorAll('.quick-reply').forEach(btn=>{
      btn.onclick=()=>{if(input){input.value=btn.textContent;this.send();}};
    });
  },
  send() {
    const input=document.getElementById('chat-input');
    const msg=input?.value?.trim(); if (!msg) return;
    this.addMsg('user',msg); input.value='';
    setTimeout(()=>this.addMsg('bot',AI.chatRespond(msg)),500);
  },
  addMsg(type,text) {
    const msgs=document.querySelector('.chat-messages'); if (!msgs) return;
    const el=document.createElement('div'); el.className=`chat-msg ${type}`;
    el.innerHTML=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    msgs.appendChild(el); msgs.scrollTop=msgs.scrollHeight;
  }
};

// ── Global Init ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Notify.init();
  Chatbot.init();
  UI.initSidebar();
  document.querySelectorAll('[data-dark-toggle]').forEach(el=>el.addEventListener('click',()=>ThemeManager.toggle()));
  document.querySelectorAll('[data-logout]').forEach(el=>el.addEventListener('click',()=>Auth.logout()));
});
