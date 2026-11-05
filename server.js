const express = require("express");
const app = express();
app.use(express.json({ limit: "50mb" }));

const E = process.env;
const fs = require("fs");
const path = require("path");
const os = require("os");
const PAGE = () => fs.readFileSync(__dirname + "/index.html", "utf8");

app.get("/", (_, res) => res.type("html").send(PAGE()));

const j = async (url, opt) => {
  const r = await fetch(url, opt);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${t.slice(0, 300)}`);
  return d;
};

app.post("/create", async (req, res) => {
  if (!E.APP_PASSWORD || req.headers["x-pass"] !== E.APP_PASSWORD) return res.status(401).send("كلمة السر غلط");
  const { name, host, supabase, files } = req.body;
  if (!/^[a-z0-9-]+$/.test(name || "")) return res.status(400).send("الاسم: حروف إنجليزية صغيرة وأرقام و - فقط");
  if (!files || !files.length) return res.status(400).send("ما اخترت ملفات");
  res.set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  const ev = o => res.write(JSON.stringify(o) + "\n");
  const base = ORI(req);
  let step = "gh";
  try {
    ev({ s: "gh", st: "run", m: "جاري إنشاء الريبو..." });
    const repo = await j("https://api.github.com/user/repos", { method: "POST", headers: GH(), body: JSON.stringify({ name, private: req.body.private !== false, auto_init: true }) });
    const owner = repo.owner.login;
    ev({ s: "gh", st: "ok", m: owner + "/" + name + (repo.private ? " " : " "), u: repo.html_url });
    step = "files"; ev({ s: "files", st: "run", m: `رفع ${files.length} ملف...` });
    const fl = files.map(f => ({ path: f.path, content: inject(f, name, base) }));
    try { await commitFiles(owner, name, fl, "الرفع الأول من المحزم"); } catch { await sleep(2000); await commitFiles(owner, name, fl, "الرفع الأول من المحزم"); }
    ev({ s: "files", st: "ok", m: `${files.length} ملف (commit واحد)` });
    step = "host";
    if (host === "vercel") {
      ev({ s: "host", st: "run", m: "إنشاء مشروع Vercel..." });
      await j(`https://api.vercel.com/v10/projects${TM()}`, { method: "POST", headers: VH(), body: JSON.stringify({ name, gitRepository: { type: "github", repo: `${owner}/${name}` } }) });
      ev({ s: "host", st: "run", m: "بدء النشر..." });
      const dq = TM() ? TM() + "&skipAutoDetectionConfirmation=1" : "?skipAutoDetectionConfirmation=1";
      const dep = await j(`https://api.vercel.com/v13/deployments${dq}`, { method: "POST", headers: VH(), body: JSON.stringify({ name, project: name, gitSource: { type: "github", repo: `${owner}/${name}`, ref: repo.default_branch || "main", repoId: repo.id } }) });
      const id = dep.id || dep.uid; let state = dep.readyState, sent = 0, fin = {};
      for (let i = 0; i < 70 && !["READY", "ERROR", "CANCELED"].includes(state); i++) {
        await sleep(2500);
        try { fin = await j(`https://api.vercel.com/v13/deployments/${id}${TM()}`, { headers: VH() }); state = fin.readyState; } catch {}
        try {
          const evs = await j(`https://api.vercel.com/v3/deployments/${id}/events?builds=1&limit=-1${TQ()}`, { headers: VH() });
          const arr = Array.isArray(evs) ? evs : evs.events || [];
          arr.slice(sent).forEach(x => { const t = x.text || (x.payload && x.payload.text); if (t) ev({ log: String(t).slice(0, 300) }); });
          sent = arr.length;
        } catch {}
        ev({ s: "host", st: "run", m: "Vercel: " + state });
      }
      if (state !== "READY") throw new Error("النشر على Vercel انتهى بحالة " + state + " (راجع السجل)");
      ev({ s: "host", st: "ok", m: "Vercel: جاهز", u: "https://" + ((fin.alias && fin.alias[0]) || dep.url) });
    } else {
      ev({ s: "host", st: "run", m: "إنشاء مشروع Railway..." });
      const p = await rail("mutation($i:ProjectCreateInput!){projectCreate(input:$i){id}}", { i: { name } });
      await rail("mutation($i:ServiceCreateInput!){serviceCreate(input:$i){id}}", { i: { projectId: p.projectCreate.id, name, source: { repo: `${owner}/${name}` } } });
      ev({ s: "host", st: "ok", m: "Railway: تم الإنشاء", u: `https://railway.com/project/${p.projectCreate.id}` });
    }
    if (supabase) {
      step = "db"; ev({ s: "db", st: "run", m: "إنشاء قاعدة Neon..." });
      const proj = { name }; if (E.NEON_ORG_ID) proj.org_id = E.NEON_ORG_ID; if (E.NEON_REGION) proj.region_id = E.NEON_REGION;
      const n = await j("https://console.neon.tech/api/v2/projects", { method: "POST", headers: { ...NH(), "Content-Type": "application/json" }, body: JSON.stringify({ project: proj }) });
      ev({ s: "db", st: "ok", m: "Neon: تم (رابط القاعدة من لوحة الموقع )", u: `https://console.neon.tech/app/projects/${n.project.id}` });
    }
    act(name, "إنشاء الموقع على " + (host === "vercel" ? "Vercel" : "Railway"));
    ev({ done: true });
  } catch (e) { act(name, "فشل إنشاء الموقع: " + clean(e).slice(0, 80), "fail"); ev({ s: step, st: "er", m: clean(e) }); ev({ done: true, err: true }); }
  res.end();
});

const auth = (req, res, next) => (E.APP_PASSWORD && req.headers["x-pass"] === E.APP_PASSWORD ? next() : res.status(401).send("كلمة السر غلط"));
const GH = () => ({ Authorization: `Bearer ${E.GITHUB_TOKEN}`, "User-Agent": "site-builder", "Content-Type": "application/json" });
const NQ = () => (E.NEON_ORG_ID ? `&org_id=${E.NEON_ORG_ID}` : "");
const TQ = () => (E.VERCEL_TEAM_ID ? `&teamId=${E.VERCEL_TEAM_ID}` : "");
const clean = e => String(e.message || e).replace(/https?:\/\/\S+/g, "").slice(0, 300);
const VH = () => ({ Authorization: `Bearer ${E.VERCEL_TOKEN}`, "Content-Type": "application/json" });
const NH = () => ({ Authorization: `Bearer ${E.NEON_API_KEY}` });
const TM = () => (E.VERCEL_TEAM_ID ? `?teamId=${E.VERCEL_TEAM_ID}` : "");
const rail = async (query, variables) => {
  const d = await j("https://backboard.railway.com/graphql/v2", { method: "POST", headers: { Authorization: `Bearer ${E.RAILWAY_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
  if (d.errors) throw new Error(d.errors[0].message);
  return d.data;
};
const railProj = async () => {
  try { return (await rail("query{projects{edges{node{id name createdAt}}}}")).projects.edges; }
  catch (e) { return (await rail("query{me{projects{edges{node{id name createdAt}}}}}")).me.projects.edges; }
};
const ORI = req => { const o = String((req.body && req.body.origin) || ""); return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o) ? o : "https://" + (req.headers["x-forwarded-host"] || req.headers.host); };
const snippet = (origin, n) => `<!--mz--><script>(function(){try{var i=localStorage._vid||(localStorage._vid=Math.random().toString(36).slice(2,10));new Image().src="${origin}/b/${n}?v="+i+"&p="+encodeURIComponent(location.pathname)+"&t="+Date.now()}catch(e){}})()</script><!--/mz-->`;
const VATAG = `<!--mzva--><script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script><script defer src="/_vercel/insights/script.js"></script><!--/mzva-->`;
const withTracker = (html, origin, n) => {
  html = html.replace(/<!--mz-->[\s\S]*?<!--\/mz-->/g, "").replace(/<!--mzva-->[\s\S]*?<!--\/mzva-->/g, "").replace(/<script[^>]*\/b\.js[^>]*><\/script>/g, "");
  const t = snippet(origin, n) + VATAG;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => t + "</body>") : html + t;
};
const inject = (f, n, origin) => {
  if (f.path !== "index.html") return f.content;
  return Buffer.from(withTracker(Buffer.from(f.content, "base64").toString("utf8"), origin, n)).toString("base64");
};

// ===== تخزين دائم (ريبو GitHub خاص) + عداد الزوار + السجلات =====
const DATA_REPO = "muhazzam-data";
const LF = (E.DATA_DIR || E.RAILWAY_VOLUME_MOUNT_PATH || "/tmp") + "/muhazzam.json";
let DB = { v: {}, vis: [], act: [], mon: {}, sys: [] }, dirty = false, dsha, owner;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const own = async () => owner || (owner = (await j("https://api.github.com/user", { headers: GH() })).login);
const ghScopes = async () => { const r = await fetch("https://api.github.com/user", { headers: GH() }); const h = r.headers.get("x-oauth-scopes"); return h === null ? null : h.split(",").map(x => x.trim()).filter(Boolean); };
const dget = async () => { const f = await j(`https://api.github.com/repos/${await own()}/${DATA_REPO}/contents/data.json`, { headers: GH() }); dsha = f.sha; return f; };
(async () => {
  try { DB = Object.assign(DB, JSON.parse(fs.readFileSync(LF, "utf8"))); } catch {}
  if (!E.GITHUB_TOKEN) return;
  try { await j("https://api.github.com/user/repos", { method: "POST", headers: GH(), body: JSON.stringify({ name: DATA_REPO, private: true, auto_init: true }) }); } catch {}
  try { DB = Object.assign(DB, JSON.parse(Buffer.from((await dget()).content, "base64").toString("utf8"))); } catch {}
})();
let st; const save = () => { dirty = true; clearTimeout(st); st = setTimeout(flush, 30000); };
async function flush() {
  if (!dirty) return; dirty = false;
  const txt = JSON.stringify(DB);
  try { fs.writeFileSync(LF, txt); } catch {}
  if (!E.GITHUB_TOKEN) return;
  const put = async () => { const r = await j(`https://api.github.com/repos/${await own()}/${DATA_REPO}/contents/data.json`, { method: "PUT", headers: GH(), body: JSON.stringify({ message: "update", content: Buffer.from(txt).toString("base64"), sha: dsha }) }); dsha = r.content.sha; };
  try { await put(); } catch { try { await dget(); await put(); } catch { dirty = true; } }
}
process.on("SIGTERM", () => { flush().finally(() => process.exit(0)); });
const act = (s, x, st) => { DB.act.unshift({ t: Date.now(), s, x, st: st || "ok" }); DB.act.length = Math.min(DB.act.length, 300); save(); };

async function commitFiles(owner, repo, files, message) {
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const br = (await j(api, { headers: GH() })).default_branch;
  const ref = await j(`${api}/git/ref/heads/${br}`, { headers: GH() });
  const cm = await j(`${api}/git/commits/${ref.object.sha}`, { headers: GH() });
  const tree = [];
  for (const f of files) {
    const b = await j(`${api}/git/blobs`, { method: "POST", headers: GH(), body: JSON.stringify({ content: f.content, encoding: "base64" }) });
    tree.push({ path: f.path.replace(/^\/+/, ""), mode: "100644", type: "blob", sha: b.sha });
  }
  const t = await j(`${api}/git/trees`, { method: "POST", headers: GH(), body: JSON.stringify({ base_tree: cm.tree.sha, tree }) });
  const nc = await j(`${api}/git/commits`, { method: "POST", headers: GH(), body: JSON.stringify({ message, tree: t.sha, parents: [ref.object.sha] }) });
  await j(`${api}/git/refs/heads/${br}`, { method: "PATCH", headers: GH(), body: JSON.stringify({ sha: nc.sha }) });
  return nc.sha;
}

const loc = t => new Date(t + 3 * 3600e3).toISOString();
const series = n => {
  const v = DB.v[n] || { h: {} }, now = Date.now(), h = [], d = [];
  for (let i = 23; i >= 0; i--) { const k = loc(now - i * 3600e3).slice(0, 13), b = (v.h || {})[k]; h.push({ l: k.slice(11) + ":00", hits: b ? b.h : 0, uv: b ? b.u.length : 0 }); }
  for (let i = 6; i >= 0; i--) {
    const k = loc(now - i * 864e5).slice(0, 10); let hits = 0; const ids = {};
    Object.keys(v.h || {}).forEach(x => { if (x.slice(0, 10) === k) { hits += v.h[x].h; v.h[x].u.forEach(u => (ids[u] = 1)); } });
    d.push({ l: k.slice(5), hits, uv: Object.keys(ids).length });
  }
  return { h, d };
};
const dev = u => (/iPhone|iPad/.test(u) ? "iPhone/iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac/.test(u) ? "Mac" : "أخرى");
app.get("/b.js", (_, res) => res.type("js").set("Access-Control-Allow-Origin", "*").send('(function(){var s=document.currentScript;if(!s)return;var i;try{i=localStorage._vid||(localStorage._vid=Math.random().toString(36).slice(2,10))}catch(e){i="x"}new Image().src=new URL(s.src).origin+"/b/"+s.getAttribute("data-site")+"?v="+i+"&p="+encodeURIComponent(location.pathname)+"&t="+Date.now()})()'));
app.get("/b/:name", (req, res) => {
  const n = req.params.name, ua = req.headers["user-agent"] || "";
  if (/^[a-z0-9-]{1,60}$/.test(n) && !/bot|crawl|spider|headless|lighthouse/i.test(ua)) {
    const id = String(req.query.v || "x").replace(/[^a-z0-9]/gi, "").slice(0, 12) || "x";
    if (id === "selftest") { DB.vis.unshift({ t: Date.now(), s: n, p: "/test", d: "اختبار" }); DB.vis.length = Math.min(DB.vis.length, 300); save(); return res.set("Access-Control-Allow-Origin", "*").status(204).end(); }
    const v = DB.v[n] || (DB.v[n] = { hits: 0, uv: 0, ids: {}, h: {} });
    v.hits = (v.hits || 0) + 1; v.ids = v.ids || {}; v.h = v.h || {};
    if (!v.ids[id]) { v.ids[id] = 1; v.uv = (v.uv || 0) + 1; if (Object.keys(v.ids).length > 20000) v.ids = {}; }
    const k = loc(Date.now()).slice(0, 13), b = v.h[k] || (v.h[k] = { h: 0, u: [] });
    b.h++; if (!b.u.includes(id) && b.u.length < 5000) b.u.push(id);
    const old = loc(Date.now() - 8 * 864e5).slice(0, 13); Object.keys(v.h).forEach(x => { if (x < old) delete v.h[x]; });
    DB.vis.unshift({ t: Date.now(), s: n, p: String(req.query.p || "/").slice(0, 80), d: dev(ua) }); DB.vis.length = Math.min(DB.vis.length, 300);
    save();
  }
  res.set("Access-Control-Allow-Origin", "*").status(204).end();
});
["/logo.png", "/apple-touch-icon.png", "/apple-touch-icon-precomposed.png", "/favicon.ico"].forEach(u => app.get(u, (_, res) => res.sendFile(path.join(__dirname, "logo.png"))));
app.get("/manifest.webmanifest", (_, res) => res.type("application/manifest+json").json({ name: "المحزم", short_name: "المحزم", lang: "ar", dir: "rtl", start_url: "/", display: "standalone", background_color: "#434e3d", theme_color: "#434e3d", icons: [{ src: "/logo.png", sizes: "512x512", type: "image/png" }] }));

async function collect() {
  const sites = {}, errors = {};
  const get = n => sites[n] || (sites[n] = { name: n });
  await Promise.all([
    (async () => {
      if (!E.GITHUB_TOKEN) return;
      const r = await j("https://api.github.com/user/repos?per_page=100&sort=created&affiliation=owner", { headers: GH() });
      const hide = (E.HIDE_REPOS || "").split(",").map(z => z.trim()).filter(Boolean);
      r.filter(x => x.name !== DATA_REPO && !hide.includes(x.name)).forEach(x => (get(x.name).github = { url: x.html_url, private: x.private, created: x.created_at, size: x.size }));
    })().catch(e => (errors.GitHub = e.message)),
    (async () => {
      if (!E.VERCEL_TOKEN) return;
      const tm = E.VERCEL_TEAM_ID ? `&teamId=${E.VERCEL_TEAM_ID}` : "";
      const r = await j(`https://api.vercel.com/v9/projects?limit=100${tm}`, { headers: VH() });
      r.projects.forEach(p => {
        const d = (p.latestDeployments || [])[0], al = p.targets && p.targets.production && p.targets.production.alias;
        get(p.name).vercel = { url: "https://" + ((al && al[0]) || (d && d.url) || p.name + ".vercel.app"), state: d ? d.readyState : "NONE", created: p.createdAt };
      });
    })().catch(e => (errors.Vercel = e.message)),
    (async () => {
      if (!E.NEON_API_KEY) return;
      const r = await j(`https://console.neon.tech/api/v2/projects?limit=100${NQ()}`, { headers: NH() });
      r.projects.forEach(p => (get(p.name).neon = { id: p.id, url: `https://console.neon.tech/app/projects/${p.id}`, region: p.region_id, created: p.created_at, usage: { cpu: p.cpu_used_sec, active: p.active_time_seconds, transfer: p.data_transfer_bytes, written: p.written_data_bytes } }));
    })().catch(e => (errors.Neon = e.message)),
    (async () => {
      if (!E.RAILWAY_TOKEN) return;
      const eg = await railProj();
      eg.forEach(e => (get(e.node.name).railway = { id: e.node.id, url: `https://railway.com/project/${e.node.id}`, created: e.node.createdAt }));
    })().catch(e => (errors.Railway = e.message)),
  ]);
  return { sites: Object.values(sites), errors };
}

app.get("/api/check", auth, (_, res) => res.json({ ok: true, env: { GITHUB: !!E.GITHUB_TOKEN, VERCEL: !!E.VERCEL_TOKEN, RAILWAY: !!E.RAILWAY_TOKEN, NEON: !!E.NEON_API_KEY } }));
app.get("/api/sites", auth, async (_, res) => {
  const c = await collect();
  c.sites.forEach(x => { const m = DB.mon[x.name]; x.probe = m && m.length ? m[m.length - 1] : null; });
  res.json(c);
});

app.get("/api/ping", auth, async (_, res) => {
  const t = async (name, has, f) => {
    const t0 = Date.now();
    if (!has) return { name, ok: false, ms: 0, at: t0, error: "المفتاح غير مضاف في متغيرات Railway" };
    try { await f(); return { name, ok: true, ms: Date.now() - t0, at: Date.now() }; } catch (e) { return { name, ok: false, ms: Date.now() - t0, at: Date.now(), error: clean(e) }; }
  };
  let SC;
  const out = await Promise.all([
    t("GitHub", E.GITHUB_TOKEN, async () => { const r = await fetch("https://api.github.com/user", { headers: GH() }); if (!r.ok) throw new Error(r.status + " " + r.statusText); const h = r.headers.get("x-oauth-scopes"); SC = h === null ? null : h.split(",").map(x => x.trim()).filter(Boolean); }),
    t("Vercel", E.VERCEL_TOKEN, () => j("https://api.vercel.com/v2/user", { headers: VH() })),
    t("Railway", E.RAILWAY_TOKEN, () => railProj()),
    t("Neon", E.NEON_API_KEY, () => j(`https://console.neon.tech/api/v2/projects?limit=1${NQ()}`, { headers: NH() })),
    t("تخزين النظام (GitHub)", E.GITHUB_TOKEN, () => dget()),
  ]);
  out[0].scopes = SC;
  res.json(out);
});

app.get("/api/health/:name", auth, async (req, res) => {
  const n = req.params.name, sr = series(n), vis = DB.v[n] || {};
  const out = { problems: [], series: sr, visits: { today: sr.d[6].uv, total: vis.uv || 0, hitsToday: sr.d[6].hits, peak: Math.max(0, ...sr.h.map(x => x.hits)) } };
  try {
    const p = await j(`https://api.vercel.com/v9/projects/${encodeURIComponent(n)}${TM()}`, { headers: VH() });
    const d = (p.latestDeployments || [])[0];
    const dm = await j(`https://api.vercel.com/v9/projects/${encodeURIComponent(n)}/domains${TM()}`, { headers: VH() });
    const domains = (dm.domains || []).map(x => ({ name: x.name, verified: x.verified }));
    const url = "https://" + ((domains.find(x => x.verified) || {}).name || (d && d.url) || n + ".vercel.app");
    const t0 = Date.now(); let status = 0;
    let live = null;
    try { const rr = await fetch(url, { signal: AbortSignal.timeout(8000) }); status = rr.status; if (status === 200) live = /<!--mz-->|\/b\.js/.test((await rr.text()).slice(0, 400000)); } catch {}
    out.vercel = { state: d ? d.readyState : "NONE", url, status, ms: Date.now() - t0, domains, live };
    if (!d) out.problems.push({ t: "ما فيه أي نشر بعد", l: "w" });
    else if (d.readyState === "ERROR") out.problems.push({ t: "فشل آخر نشر على Vercel (افتح Deployments في Vercel وشوف الـ Logs)", l: "e" });
    if (status === 0) out.problems.push({ t: "الموقع ما يستجيب (انتهت المهلة أو فيه خلل في الدومين)", l: "e" });
    else if (status === 401 || status === 403) out.problems.push({ t: "الموقع محمي بحماية Vercel، لو تبيه عام عطّل Deployment Protection من إعدادات المشروع", l: "w" });
    else if (status === 404) out.problems.push({ t: "الموقع يرجع 404، تأكد إن index.html في أول الملفات", l: "e" });
    else if (status >= 500) out.problems.push({ t: "الموقع يرجع خطأ سيرفر " + status, l: "e" });
  } catch { out.vercel = null; }
  try {
    if (E.NEON_API_KEY) {
      const r = await j(`https://console.neon.tech/api/v2/projects?limit=100${NQ()}`, { headers: NH() });
      const np = r.projects.find(x => x.name === n);
      if (np) out.neon = { region: np.region_id, pg: np.pg_version, last: np.compute_last_active_at };
    }
  } catch {}
  try { const f = await j(`https://api.github.com/repos/${await own()}/${n}/contents/index.html`, { headers: GH() }); const t = Buffer.from(f.content, "base64").toString("utf8"); const m = t.match(/(https?:\/\/[^"'\s<>]+?)\/b(?:\.js|\/)/); out.tracker = { inRepo: /<!--mz-->|\/b\.js/.test(t), va: /_vercel\/insights/.test(t), origin: m ? m[1] : null }; } catch { out.tracker = { inRepo: null }; }
  res.json(out);
});

app.post("/api/site/:name/domain", auth, async (req, res) => {
  const { action, domain } = req.body, n = encodeURIComponent(req.params.name);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain || "")) return res.status(400).send("اسم الدومين غير صحيح");
  try {
    if (action === "remove") {
      await j(`https://api.vercel.com/v9/projects/${n}/domains/${domain}${TM()}`, { method: "DELETE", headers: VH() });
      act(req.params.name, "حذف دومين " + domain); return res.json({ note: "تم حذف الدومين" });
    }
    const r = await j(`https://api.vercel.com/v10/projects/${n}/domains${TM()}`, { method: "POST", headers: VH(), body: JSON.stringify({ name: domain }) });
    act(req.params.name, "إضافة دومين " + domain);
    res.json({ note: r.verified ? "تم ربط الدومين" : "⏳ انضاف، بقي تضبط DNS عند مزود الدومين: للدومين الرئيسي سجل A بقيمة 76.76.21.21، وللنطاق الفرعي سجل CNAME بقيمة cname.vercel-dns.com" });
  } catch (e) { res.status(500).send(e.message.replace(/https?:\/\/\S+/g, "").slice(0, 300)); }
});

app.delete("/api/site/:name", auth, async (req, res) => {
  const n = req.params.name, parts = (req.body && req.body.parts) || [], log = [];
  const s = (await collect()).sites.find(x => x.name === n);
  if (!s) return res.status(404).send("الموقع غير موجود");
  const step = async (k, f) => {
    if (!parts.includes(k) || !s[k]) return;
    try { await f(); log.push("تم حذف " + k); } catch (e) { let m = clean(e); if (k === "github" && /403|admin rights/.test(m)) { const sc = await ghScopes().catch(() => null); m = (sc === null ? "مفتاح GitHub من نوع Fine-grained (ما يحذف)" : sc.includes("delete_repo") ? "المفتاح فيه delete_repo لكن GitHub رفض الحذف (تأكد إنك مالك الريبو)" : "صلاحيات مفتاحك الحالي: " + sc.join(", ") + " (ينقصه delete_repo)") + ". سوّ مفتاح جديد من https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=almuhazzam وحدّث GITHUB_TOKEN في Railway وانتظر إعادة النشر"; } log.push("" + k + ": " + m); }
  };
  await step("vercel", () => j(`https://api.vercel.com/v9/projects/${encodeURIComponent(n)}${TM()}`, { method: "DELETE", headers: VH() }));
  await step("railway", () => rail("mutation($id:String!){projectDelete(id:$id)}", { id: s.railway.id }));
  await step("neon", () => j(`https://console.neon.tech/api/v2/projects/${s.neon.id}`, { method: "DELETE", headers: NH() }));
  await step("github", () => j(`https://api.github.com/repos/${s.github.url.split("/")[3]}/${n}`, { method: "DELETE", headers: GH() }));
  act(n, "حذف: " + parts.join(", ")); res.send(log.join("\n") || "ما اخترت شيء");
});

app.post("/api/site/:name/tracker", auth, async (req, res) => {
  const n = req.params.name, origin = ORI(req);
  try {
    const u = `https://api.github.com/repos/${await own()}/${n}/contents/index.html`;
    const f = await j(u, { headers: GH() });
    const h = withTracker(Buffer.from(f.content, "base64").toString("utf8"), origin, n);
    await j(u, { method: "PUT", headers: GH(), body: JSON.stringify({ message: "عداد الزوار", content: Buffer.from(h).toString("base64"), sha: f.sha }) });
    act(n, "تركيب عداد الزوار");
    res.json({ note: "تم تركيب العداد (" + origin + ")، Vercel يعيد النشر خلال دقيقة" });
  } catch (e) { res.status(500).send(/404/.test(e.message) ? "ما لقيت index.html في أول الريبو" : clean(e)); }
});

app.post("/api/site/:name/visibility", auth, async (req, res) => {
  try {
    const me = await j("https://api.github.com/user", { headers: GH() });
    await j(`https://api.github.com/repos/${me.login}/${req.params.name}`, { method: "PATCH", headers: GH(), body: JSON.stringify({ private: !!req.body.private }) });
    act(req.params.name, "تحويل الريبو إلى " + (req.body.private ? "خاص" : "عام"));
    res.json({ ok: true });
  } catch (e) { res.status(500).send(clean(e)); }
});

app.get("/api/site/:name/env", auth, async (req, res) => {
  try {
    const r = await j(`https://api.vercel.com/v9/projects/${encodeURIComponent(req.params.name)}/env?decrypt=true${TQ()}`, { headers: VH() });
    res.json((r.envs || []).map(x => ({ id: x.id, key: x.key, value: x.value, target: x.target, type: x.type })));
  } catch (e) { res.status(500).send(clean(e)); }
});
app.post("/api/site/:name/env", auth, async (req, res) => {
  const { key, value } = req.body;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key || "")) return res.status(400).send("اسم المتغير غير صحيح");
  try {
    await j(`https://api.vercel.com/v10/projects/${encodeURIComponent(req.params.name)}/env?upsert=true${TQ()}`, { method: "POST", headers: VH(), body: JSON.stringify({ key, value: String(value || ""), type: "encrypted", target: ["production", "preview", "development"] }) }); act(req.params.name, "إضافة/تعديل متغير " + key);
    res.json({ ok: true });
  } catch (e) { res.status(500).send(clean(e)); }
});
app.delete("/api/site/:name/env/:id", auth, async (req, res) => {
  try { await j(`https://api.vercel.com/v9/projects/${encodeURIComponent(req.params.name)}/env/${encodeURIComponent(req.params.id)}${TM()}`, { method: "DELETE", headers: VH() }); act(req.params.name, "حذف متغير"); res.json({ ok: true }); }
  catch (e) { res.status(500).send(clean(e)); }
});

app.post("/api/site/:name/files", auth, async (req, res) => {
  const n = req.params.name, { files, message } = req.body, base = ORI(req);
  const ok = (files || []).filter(f => f.path && !f.path.includes("..") && !/^\/?\.git\//.test(f.path));
  if (!ok.length) return res.status(400).send("ما اخترت ملفات");
  try {
    const sha = await commitFiles(await own(), n, ok.map(f => ({ path: f.path, content: inject(f, n, base) })), (message || "تحديث من المحزم").slice(0, 200));
    act(n, `تحديث ${ok.length} ملف في GitHub: ${(message || "").slice(0, 50)}`);
    res.json({ sha, t: Date.now() });
  } catch (e) { act(n, "فشل تحديث الملفات: " + (message || "").slice(0, 50), "fail"); res.status(500).send(clean(e)); }
});

app.get("/api/site/:name/file", auth, async (req, res) => {
  const p = String(req.query.path || "").replace(/^\/+/, "");
  if (!p || p.includes("..") || /^\.git\//.test(p)) return res.status(400).send("مسار غير صحيح");
  try {
    const f = await j(`https://api.github.com/repos/${await own()}/${encodeURIComponent(req.params.name)}/contents/${p.split("/").map(encodeURIComponent).join("/")}`, { headers: GH() });
    if (Array.isArray(f) || !f.content) return res.json({ exists: false });
    res.json({ exists: true, content: String(f.content).replace(/\n/g, ""), size: f.size });
  } catch (e) { if (/-> 404/.test(e.message)) return res.json({ exists: false }); res.status(500).send(clean(e)); }
});

app.get("/api/site/:name/deploy", auth, async (req, res) => {
  try {
    const r = await j(`https://api.vercel.com/v6/deployments?limit=1&projectId=${encodeURIComponent(req.params.name)}${TQ()}`, { headers: VH() });
    const d = (r.deployments || [])[0];
    if (!d) return res.json({ state: "NONE", logs: [], n: 0 });
    let arr = [];
    try { const e = await j(`https://api.vercel.com/v3/deployments/${d.uid}/events?builds=1&limit=-1${TQ()}`, { headers: VH() }); arr = Array.isArray(e) ? e : e.events || []; } catch {}
    const after = req.query.id === d.uid ? +req.query.after || 0 : 0;
    res.json({ id: d.uid, state: d.state || d.readyState, url: d.url, created: d.created || d.createdAt, n: arr.length, logs: arr.slice(after).map(x => x.text || (x.payload && x.payload.text)).filter(Boolean).map(t => String(t).slice(0, 300)) });
  } catch (e) { res.status(500).send(clean(e)); }
});

const MC = {};
const memo = async (k, ttl, f) => { const c = MC[k]; if (c && Date.now() - c.t < ttl) return c.v; const v = await f(); MC[k] = { t: Date.now(), v }; return v; };
const VA = (p, params) => j(`https://api.vercel.com/v1/query/web-analytics/${p}?` + new URLSearchParams({ ...params, ...(E.VERCEL_TEAM_ID ? { teamId: E.VERCEL_TEAM_ID } : {}) }), { headers: VH() });
const vaSeries = (rows, step, n, lab) => {
  const m = {}; (rows || []).forEach(r => { m[Math.floor(new Date(r.timestamp).getTime() / step)] = r; });
  const now = Date.now(), out = [];
  for (let i = n - 1; i >= 0; i--) { const t = (Math.floor(now / step) - i) * step, r = m[Math.floor(t / step)]; out.push({ l: lab(t), hits: r ? r.pageviews || 0 : 0, uv: r ? r.visitors || 0 : 0 }); }
  return out;
};
const slug = () => memo("slug", 36e5, async () => E.VERCEL_TEAM_SLUG || (await j("https://api.vercel.com/v2/user", { headers: VH() })).user.username);
const GIB = 1073741824;
const ds = (a, n) => { if (!a || a.length <= n) return a || []; const st = a.length / n, o = []; for (let i = 0; i < n; i++) o.push(a[Math.floor(i * st)]); return o; };
const pct = (v, l) => (l ? Math.round((v / l) * 1000) / 10 : null);

app.get("/api/activity", auth, async (_, res) => {
  const out = { visits: DB.vis.slice(0, 60), updates: DB.act.slice(0, 60), hourly: [], diag: [] };
  const L = { READY: "ok", ERROR: "fail", CANCELED: "fail" };
  try {
    const r = await j(`https://api.vercel.com/v6/deployments?limit=30${TQ()}`, { headers: VH() });
    (r.deployments || []).forEach(d => out.updates.push({ t: d.created || d.createdAt, s: d.name, x: d.meta && d.meta.githubCommitMessage ? String(d.meta.githubCommitMessage).slice(0, 80) : "نشر جديد", st: L[d.state || d.readyState] || "run" }));
  } catch {}
  out.updates.sort((a, b) => b.t - a.t); out.updates = out.updates.slice(0, 60);
  try {
    const { sites } = await memo("sites", 15000, collect);
    await Promise.all(sites.filter(x => x.vercel).map(async x => {
      const d = { site: x.name, beacon: (DB.v[x.name] || {}).hits || 0, vercel: 0 };
      try {
        const now = Date.now();
        const r = await memo("vh:" + x.name, 60000, () => VA("visits/aggregate", { projectId: x.name, by: "hour", since: now - 72 * 3600e3, until: now, limit: 100 }));
        (r.data || []).filter(y => y.pageviews > 0).forEach(y => { d.vercel += y.pageviews; out.hourly.push({ t: new Date(y.timestamp).getTime(), s: x.name, pv: y.pageviews, uv: y.visitors }); });
      } catch (e) { d.error = clean(e); }
      out.diag.push(d);
    }));
  } catch {}
  out.hourly.sort((a, b) => b.t - a.t); out.hourly = out.hourly.slice(0, 60);
  res.json(out);
});

const rq = (e, s, d, ms) => rail("query($e:String!,$s:String!,$d:DateTime!){metrics(environmentId:$e,serviceId:$s,startDate:$d,measurements:[" + ms + "],sampleRateSeconds:600){measurement values{ts value}}}", { e, s, d });
async function railUsage(id) {
  const d = await rail("query($id:String!){project(id:$id){environments{edges{node{id name}}}services{edges{node{id name}}}}}", { id });
  const envs = d.project.environments.edges.map(e => e.node), env = envs.find(e => e.name === "production") || envs[0];
  const since = new Date(Date.now() - 24 * 3600e3).toISOString(), out = [];
  const pick = (m, k) => { const r = (m.metrics || []).find(x => x.measurement === k); return r ? r.values.map(x => x.value) : []; };
  const last = a => (a.length ? a[a.length - 1] : null);
  for (const sv of d.project.services.edges.map(e => e.node)) {
    const m = await rq(env.id, sv.id, since, "CPU_USAGE,CPU_LIMIT,MEMORY_USAGE_GB,MEMORY_LIMIT_GB");
    let dk = [];
    for (const k of ["DISK_USAGE_GB", "EPHEMERAL_DISK_USAGE_GB"]) { try { dk = pick(await rq(env.id, sv.id, since, k), k); if (dk.length) break; } catch {} }
    const cpu = pick(m, "CPU_USAGE"), mem = pick(m, "MEMORY_USAGE_GB");
    out.push({ service: sv.name, cpu: last(cpu), cpuLimit: last(pick(m, "CPU_LIMIT")), mem: last(mem), memLimit: last(pick(m, "MEMORY_LIMIT_GB")), disk: last(dk), hCpu: ds(cpu, 48), hMem: ds(mem, 48), hDisk: ds(dk, 48) });
  }
  return out;
}

async function probe(n, url) {
  const t0 = Date.now(); let st = 0, b = 0;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); st = r.status; b = (await r.arrayBuffer()).byteLength; } catch {}
  const rec = { t: Date.now(), ms: Date.now() - t0, s: st, b };
  const a = DB.mon[n] || (DB.mon[n] = []); a.push(rec); if (a.length > 288) a.shift();
  return rec;
}
let lastCpu = { c: process.cpuUsage(), t: process.hrtime.bigint() };
const diskInfo = () => { try { const f = fs.statfsSync(E.DATA_DIR || "/"); return { total: f.blocks * f.bsize, free: f.bavail * f.bsize }; } catch { return null; } };
function sampleSys() {
  const c = process.cpuUsage(), t = process.hrtime.bigint();
  const p = ((c.user + c.system - lastCpu.c.user - lastCpu.c.system) / (Number(t - lastCpu.t) / 1000)) * 100; lastCpu = { c, t };
  const dk = diskInfo();
  DB.sys = DB.sys || []; DB.sys.push({ t: Date.now(), cpu: +p.toFixed(1), rss: process.memoryUsage().rss, free: os.freemem(), total: os.totalmem(), disk: dk ? dk.total - dk.free : null });
  if (DB.sys.length > 288) DB.sys.shift();
}
async function monitor() {
  sampleSys();
  try { const { sites } = await collect(); for (const x of sites) if (x.vercel) await probe(x.name, x.vercel.url); } catch {}
  save();
}
setTimeout(monitor, 20000); setInterval(monitor, 5 * 60e3);

async function siteStats(s) {
  const n = s.name, now = Date.now(), o = { name: n, url: s.vercel ? s.vercel.url : null, src: {}, res: {}, cpu: null, mem: null, disk: null, db: null, note: null };
  const bv = DB.v[n] || {}, bs = series(n), last = DB.vis.find(x => x.s === n && x.d !== "اختبار");
  o.src.beacon = { hits: bv.hits || 0, total: bv.uv || 0, last: last ? last.t : null };
  let vs = null;
  if (s.vercel && E.VERCEL_TOKEN) {
    const v = (o.src.vercel = {});
    try { v.dash = `https://vercel.com/${await slug()}/${n}/analytics`; } catch {}
    try { const pr = await memo("pr:" + n, 60000, () => j(`https://api.vercel.com/v9/projects/${encodeURIComponent(n)}${TM()}`, { headers: VH() })); v.enabled = pr.webAnalytics ? !!pr.webAnalytics.enabledAt : undefined; } catch {}
    try {
      const [h, d, c] = await memo("va:" + n, 60000, () => Promise.all([
        VA("visits/aggregate", { projectId: n, by: "hour", since: now - 25 * 3600e3, until: now, limit: 100 }),
        VA("visits/aggregate", { projectId: n, by: "day", since: now - 7 * 864e5, until: now, limit: 100 }),
        VA("visits/count", { projectId: n })]));
      vs = { h: vaSeries(h.data, 3600e3, 24, t => loc(t).slice(11, 13) + ":00"), d: vaSeries(d.data, 864e5, 7, t => loc(t).slice(5, 10)), total: c.data || {} };
      v.ok = true; v.pageviews = vs.total.pageviews || 0; v.visitors = vs.total.visitors || 0;
    } catch (e) { v.error = clean(e); }
  }
  const vz = vs && (vs.total.visitors > 0 || vs.h.some(x => x.hits) || vs.d.some(x => x.hits));
  const useV = vs && (vz || !(bv.hits > 0));
  o.primary = useV ? "vercel" : "beacon";
  o.series = useV ? { h: vs.h, d: vs.d } : bs;
  o.totals = useV ? { today: vs.d[6].uv, total: vs.total.visitors || 0, hitsToday: vs.d[6].hits } : { today: bs.d[6].uv, total: bv.uv || 0, hitsToday: bs.d[6].hits };
  const mon = DB.mon[n] || [];
  o.mon = mon.slice(-60);
  o.uptime = mon.length ? Math.round((mon.filter(x => x.s > 0 && x.s < 500).length / mon.length) * 100) : null;
  const lm = mon[mon.length - 1]; o.res.probe = lm ? { ms: lm.ms, kb: Math.round(lm.b / 1024), s: lm.s, t: lm.t } : null;
  if (s.railway) {
    try {
      o.res.railway = await memo("rw:" + n, 30000, () => railUsage(s.railway.id));
      const x = o.res.railway[0];
      if (x) {
        o.cpu = { v: x.cpu || 0, limit: x.cpuLimit, pct: pct(x.cpu || 0, x.cpuLimit), hist: x.hCpu };
        o.mem = { v: (x.mem || 0) * GIB, limit: x.memLimit ? x.memLimit * GIB : null, pct: pct(x.mem || 0, x.memLimit), hist: x.hMem.map(v => v * GIB) };
        if (x.disk != null) o.disk = { v: x.disk * GIB, hist: x.hDisk.map(v => v * GIB) };
      }
    } catch (e) { o.res.railway = { err: clean(e) }; }
  }
  if (!o.disk && s.github && s.github.size != null) o.disk = { v: s.github.size * 1024, label: "حجم ملفات الموقع في المستودع" };
  if (!s.railway) o.note = s.vercel ? "موقع ثابت على Vercel: لا يوجد خادم يعمل، فلا تقيس المنصة المعالج أو الذاكرة." : "الموقع غير مستضاف.";
  if (s.neon) {
    try {
      const [r, br] = await memo("ne:" + n, 60000, () => Promise.all([j(`https://console.neon.tech/api/v2/projects/${s.neon.id}/endpoints`, { headers: NH() }), j(`https://console.neon.tech/api/v2/projects/${s.neon.id}/branches`, { headers: NH() }).catch(() => ({}))]));
      const e = (r.endpoints || [])[0] || {}, b = (br.branches || [])[0] || {};
      o.db = { state: e.current_state, min: e.autoscaling_limit_min_cu, max: e.autoscaling_limit_max_cu, size: b.logical_size };
    } catch (e) { o.db = { err: clean(e) }; }
  }
  return o;
}
app.get("/api/stats", auth, async (req, res) => {
  try {
    const { sites } = await memo("sites", 15000, collect);
    const want = req.query.name ? sites.filter(x => x.name === req.query.name) : sites;
    res.json(await Promise.all(want.map(siteStats)));
  } catch (e) { res.status(500).send(clean(e)); }
});
app.get("/api/resources", auth, async (_, res) => {
  const c0 = process.cpuUsage(), t0 = process.hrtime.bigint(); await sleep(400);
  const cu = process.cpuUsage(c0), dt = Number(process.hrtime.bigint() - t0) / 1000;
  res.json({ server: { cpu: +(((cu.user + cu.system) / dt) * 100).toFixed(1), load: +os.loadavg()[0].toFixed(2), cores: os.cpus().length, rss: process.memoryUsage().rss, hostTotal: os.totalmem(), hostFree: os.freemem(), disk: diskInfo() }, hist: (DB.sys || []).slice(-96) });
});

app.get("/api/neon/:id/uri", auth, async (req, res) => {
  try {
    const r = await j(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(req.params.id)}/connection_uri?database_name=neondb&role_name=neondb_owner`, { headers: NH() });
    res.json({ uri: r.uri });
  } catch (e) { res.status(500).send(e.message); }
});

app.listen(E.PORT || 3000, () => console.log("running"));
