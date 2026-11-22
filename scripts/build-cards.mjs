#!/usr/bin/env node
// Builds every card image on the profile README as a self-hosted SVG in assets/.
// Run: GITHUB_TOKEN=$(gh auth token) node scripts/build-cards.mjs
// Edit ACHIEVEMENTS, FEATURED and PROFILE below; everything else comes from the GitHub API.

import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const LOGIN = 'Paradox-73'
const OUT = new URL('../assets/', import.meta.url)

const PROFILE = {
  role: 'ML + full-stack engineer',
  school: 'Integrated M.Tech CSE, IIIT Bangalore',
  focus: 'Deep RL · graph-hybrid systems · privacy-respecting design',
}

// Education, experience and the two lines that are not about code.
const TIMELINE = [
  {
    tone: 'blue', when: 'Jun 2025 — May 2026', title: 'Research Affiliate · IIIT Bangalore',
    detail: 'Predictive autoscaling for Dockerized ML workloads with Prophet + LSTM. Benchmarked 5 scaling policies; the buffered policy held under-provisioning to 8 events at 6% cost overhead.',
  },
  {
    tone: 'purple', when: 'Aug 2023 — Jul 2028', title: 'Integrated M.Tech, Computer Science · IIIT Bangalore',
    detail: 'CGPA 3.26/4.00. Coursework in machine learning, NLP, recommendation systems, databases, NoSQL and operating systems.',
  },
  {
    tone: 'orange', when: 'Off the clock', title: 'Editor and filmmaker',
    detail: 'Editorial Head of 8Bit, the IIIT-B magazine club: led 16 people across 2 editions. Directs short films with an independent group of friends — 6 competition wins.',
  },
]

const ACHIEVEMENTS = [
  { badge: '1st', tone: 'gold', title: 'Winner — Enable Native SSO in eSignet Go for Mobile Apps', event: "MOSIP Decode '26" },
  { badge: 'PAPER', tone: 'gold', title: 'Best Paper — Predictive Autoscaling of Dockerised ML Workloads', event: 'ICRACE 2026 · Springer Nature' },
  { badge: 'T50', tone: 'blue', title: 'Top 50 among 32,000+ teams', event: "Amazon ML Challenge '26" },
  { badge: 'T50', tone: 'purple', title: 'Top 50 out of 26,760 teams', event: "Adobe University Hackathon '26" },
  { badge: 'SEL', tone: 'cyan', title: 'Selected — top 3,000 nationwide, taught by Amazon scientists', event: "Amazon ML Summer School '26" },
  { badge: '3rd', tone: 'bronze', title: 'PokerBots — heads-up Discard Hold’em agent', event: "Synergy, IIIT Bangalore '26" },
  { badge: '3rd', tone: 'bronze', title: 'Liar’s Chatroom — Kaggle hackathon', event: "Synergy, IIIT Bangalore '26" },
  { badge: 'SF', tone: 'green', title: 'National Semi-finalist', event: 'Flipkart GRiD 8.0' },
  { badge: 'JEE', tone: 'cyan', title: 'All India Rank 5,379 of ~1.1M (Main) · 7,763 of ~180K (Advanced)', event: 'JEE 2023' },
]

// `note` overrides the repository description when the result matters more than the blurb.
const FEATURED = [
  { repo: 'Enable_Native_SSO_in_eSignet_Go_for_Mobile_Apps', title: 'Native SSO · eSignet Go', note: "One sign-in across sibling mobile apps via OpenID Connect Native SSO. Winner, MOSIP Decode '26." },
  { repo: 'Predictive-Auto-Scaling-of-Dockerized-ML-Applications', title: 'Predictive Autoscaling', note: 'Prophet + LSTM autoscaling for Dockerized ML: 8 under-provisioning events at 6% cost overhead. Best Paper, ICRACE 2026.' },
  { repo: 'Personal_Media_Intelligence_Hub', title: 'Media Intelligence Hub', note: 'Cross-domain taste engine over 1,250+ records in a 93-feature space. R² 0.59; 72.8% of cross-domain picks within ±0.5 stars.' },
  { repo: 'FedTraffic-RL', title: 'Adaptive Traffic Signals', note: 'DQN signal control in SUMO: median wait down ~80% (250s → 50s), federated-ready through Flower.' },
  { repo: 'MusicBucket', title: 'MusicBucket', note: 'Geographic music discovery. Incremental Supabase sync beat third-party rate limits for a 25-user closed beta.' },
  { repo: 'PokerBots', title: 'PokerBots · Hakari', note: "Heads-up Discard Hold’em agent: expected-value play anchored by an embedded CFR strategy. 3rd, Synergy IIIT-B '26." },
]

// Tokyo-night palette.
const C = {
  bg: '#13141f', panel: '#1f2335', line: '#2f3449', text: '#c0caf5', dim: '#9aa5ce',
  mute: '#565f89', blue: '#7aa2f7', cyan: '#7dcfff', green: '#9ece6a', purple: '#bb9af7',
  orange: '#ff9e64', red: '#f7768e', yellow: '#e0af68', gold: '#e0af68', bronze: '#d08770',
}
const HEAT = ['#2b3048', '#2a4a7c', '#3d6fbd', '#5b92e8', '#8ab4ff']
const SANS = "'Segoe UI',Ubuntu,'Helvetica Neue',Arial,sans-serif"
const MONO = "'JetBrains Mono','Fira Code',ui-monospace,'SFMono-Regular',Consolas,monospace"

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
const num = n => Number(n).toLocaleString('en-US')
const shade = (hex, f) => {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const p = v => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${p((n >> 16) & 255)},${p((n >> 8) & 255)},${p(n & 255)})`
}

// No text metrics in a build script: approximate, then clip with ellipsis.
const widthOf = (s, size, mono) => s.length * size * (mono ? 0.6 : 0.52)
const clip = (s, max, size, mono = false) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (widthOf(s, size, mono) <= max) return s
  const fit = Math.max(1, Math.floor(max / (size * (mono ? 0.6 : 0.52))) - 1)
  return s.slice(0, fit).trimEnd() + '…'
}
const wrap = (s, max, size, lines, mono = false) => {
  const per = Math.max(4, Math.floor(max / (size * (mono ? 0.6 : 0.52))))
  const words = String(s ?? '').replace(/\s+/g, ' ').trim().split(' ')
  const out = ['']
  for (const w of words) {
    const cur = out[out.length - 1]
    if (!cur) out[out.length - 1] = w
    else if ((cur + ' ' + w).length <= per) out[out.length - 1] = cur + ' ' + w
    else if (out.length < lines) out.push(w)
    else { out[out.length - 1] = clip(cur + ' ' + w, max, size, mono); return out }
  }
  return out.filter(Boolean)
}

const card = (w, h, label, body, defs = '', extraCss = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<defs>${defs}</defs>
<style>
  .t{font-family:${SANS}}
  .m{font-family:${MONO}}
  /* Visible by default: a renderer that ignores CSS animation still shows every card. */
  g.fx{animation:in .6s ease-out both}
  @keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
${extraCss}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<rect width="${w}" height="${h}" rx="14" fill="${C.bg}"/>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${C.line}"/>
${body}
</svg>`

const fx = (delay, body) => `<g class="fx" style="animation-delay:${delay}ms">${body}</g>`
const text = (x, y, s, { size = 13, fill = C.text, weight = 400, mono = false, anchor = 'start', ls = 0, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" class="${mono ? 'm' : 't'}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''}${op !== 1 ? ` opacity="${op}"` : ''}>${esc(s)}</text>`
const headline = (x, y, s) => text(x, y, s.toUpperCase(), { size: 11, fill: C.mute, weight: 700, ls: 2.2 })

// ---------- data ----------
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
if (!token) { console.error('Set GITHUB_TOKEN (locally: GITHUB_TOKEN=$(gh auth token) node scripts/build-cards.mjs)'); process.exit(1) }
const headers = { authorization: `bearer ${token}`, 'user-agent': 'profile-card-builder' }

const gql = async (query, variables) => {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }),
  })
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${await r.text()}`)
  const j = await r.json()
  if (j.errors) throw new Error(JSON.stringify(j.errors))
  return j.data
}

// contributionsCollection only ever covers one year, so ask for every year since the account opened.
const YEARS = []
for (let y = 2023; y <= new Date().getUTCFullYear(); y++) YEARS.push(y)

const data = await gql(`query($login:String!){
  user(login:$login){
    name login bio avatarUrl(size:200) location createdAt
    followers{totalCount}
    repositoriesContributedTo(first:1, contributionTypes:[COMMIT,PULL_REQUEST,ISSUE]){totalCount}
    ${YEARS.map(y => `y${y}: contributionsCollection(from:"${y}-01-01T00:00:00Z", to:"${y}-12-31T23:59:59Z"){
      totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions
      contributionCalendar{totalContributions}
    }`).join('\n')}
    repositories(first:100, ownerAffiliations:OWNER, isFork:false, orderBy:{field:STARGAZERS,direction:DESC}){
      totalCount
      nodes{ name description stargazerCount forkCount
        primaryLanguage{name color}
        languages(first:8, orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}
        repositoryTopics(first:4){nodes{topic{name}}}
      }
    }
    contributionsCollection{
      totalCommitContributions totalPullRequestContributions
      contributionCalendar{ totalContributions weeks{ firstDay contributionDays{ date contributionCount weekday } } }
    }
  }
}`, { login: LOGIN })

const u = data.user
const repos = u.repositories.nodes
const lifetime = YEARS.reduce((a, y) => {
  const d = u[`y${y}`]
  a.contributions += d.contributionCalendar.totalContributions
  a.commits += d.totalCommitContributions
  a.prs += d.totalPullRequestContributions
  a.issues += d.totalIssueContributions
  a.reviews += d.totalPullRequestReviewContributions
  return a
}, { contributions: 0, commits: 0, prs: 0, issues: 0, reviews: 0 })
const stars = repos.reduce((a, r) => a + r.stargazerCount, 0)
const cal = u.contributionsCollection.contributionCalendar
const days = cal.weeks.flatMap(w => w.contributionDays)

const langBytes = new Map()
for (const r of repos) for (const e of r.languages.edges) {
  const cur = langBytes.get(e.node.name) || { size: 0, color: e.node.color || C.mute }
  cur.size += e.size
  langBytes.set(e.node.name, cur)
}
const totalBytes = [...langBytes.values()].reduce((a, v) => a + v.size, 0) || 1
const langs = [...langBytes.entries()]
  .map(([name, v]) => ({ name, color: v.color, pct: (v.size / totalBytes) * 100 }))
  .sort((a, b) => b.pct - a.pct)

let longest = 0, run = 0, current = 0
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run) }
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) current++
  else if (i === days.length - 1) continue // an empty today does not end the streak
  else break
}
const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0])

// The public events feed no longer carries commit messages, only the pushed head sha: fetch each head.
const events = await fetch(`https://api.github.com/users/${LOGIN}/events/public?per_page=100`, { headers })
  .then(r => (r.ok ? r.json() : []))
  .catch(() => [])
const heads = []
for (const e of Array.isArray(events) ? events : []) {
  const sha = e.payload?.head
  if (e.type !== 'PushEvent' || !sha) continue
  // One line per repository, newest first: eight pushes to the same repo makes a dull log.
  if (heads.length < 8 && !heads.some(h => h.full === e.repo.name)) heads.push({ full: e.repo.name, sha, at: e.created_at })
}
const commits = (await Promise.all(heads.map(async h => {
  const c = await fetch(`https://api.github.com/repos/${h.full}/commits/${h.sha}`, { headers })
    .then(r => (r.ok ? r.json() : null)).catch(() => null)
  if (!c?.commit) return null
  return { repo: h.full.split('/')[1], sha: h.sha.slice(0, 7), msg: c.commit.message.split('\n')[0], at: h.at }
}))).filter(Boolean)
const ago = iso => {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
  return d <= 0 ? 'today' : d === 1 ? '1d ago' : d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`
}

const avatarData = `data:image/jpeg;base64,${Buffer.from(await fetch(u.avatarUrl).then(r => r.arrayBuffer())).toString('base64')}`

mkdirSync(OUT, { recursive: true })
for (const f of readdirSync(OUT)) if (f.endsWith('.svg')) unlinkSync(new URL(f, OUT))
const write = (name, svg) => { writeFileSync(new URL(name, OUT), svg); console.log(`${name.padEnd(18)} ${(svg.length / 1024).toFixed(1)} KB`) }

// ---------- holographic profile card ----------
{
  const W = 860, H = 186
  const stats = [['Repos', num(u.repositories.totalCount)], ['Contributions', num(cal.totalContributions)], ['Languages', num(langs.length)]]
  const defs = `
    <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6ec7"/><stop offset="18%" stop-color="#bb9af7"/><stop offset="38%" stop-color="#7aa2f7"/>
      <stop offset="58%" stop-color="#7dcfff"/><stop offset="78%" stop-color="#9ece6a"/><stop offset="100%" stop-color="#e0af68"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="50%" stop-color="#fff" stop-opacity=".5"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7dcfff"/><stop offset="50%" stop-color="#bb9af7"/><stop offset="100%" stop-color="#ff6ec7"/>
    </linearGradient>
    <pattern id="foil" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <rect width="7" height="7" fill="none"/><rect width="1.2" height="7" fill="#fff" opacity=".5"/>
    </pattern>
    <clipPath id="cardClip"><rect width="${W}" height="${H}" rx="14"/></clipPath>
    <clipPath id="avClip"><circle cx="82" cy="98" r="42"/></clipPath>`
  const css = `
  .holoWash{animation:hue 16s linear infinite;transform-origin:center}
  @keyframes hue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
  .sheen{animation:sweep 7s ease-in-out infinite}
  @keyframes sweep{0%{transform:translateX(-420px)}55%,100%{transform:translateX(1060px)}}`
  let body = `<g clip-path="url(#cardClip)">
    <g class="holoWash"><rect width="${W}" height="${H}" fill="url(#holo)" opacity=".26"/></g>
    <rect width="${W}" height="${H}" fill="url(#foil)" opacity=".05"/>
    <rect width="${W}" height="${H}" fill="${C.bg}" opacity=".55"/>
    <g class="sheen"><rect x="-120" y="-40" width="150" height="${H + 80}" fill="url(#sheen)" opacity=".16" transform="skewX(-18)"/></g>
    <rect y="${H - 4}" width="${W}" height="4" fill="url(#holo)"/>
  </g>`
  body += fx(60, `<circle cx="82" cy="98" r="47" fill="none" stroke="url(#ring)" stroke-width="2.5" opacity=".9"/>
    <image href="${avatarData}" x="40" y="56" width="84" height="84" clip-path="url(#avClip)"/>`)
  body += fx(150, text(152, 74, u.name, { size: 31, weight: 700 }))
  body += fx(190, text(152, 99, `@${u.login.toLowerCase()}  ·  ${u.location || ''}`, { size: 12.5, fill: C.cyan, mono: true }))
  body += fx(230, text(152, 128, `${PROFILE.role}  ·  ${PROFILE.school}`, { size: 13.5, fill: C.text }))
  body += fx(270, text(152, 150, PROFILE.focus, { size: 12.5, fill: C.dim }))
  stats.forEach(([k, v], i) => {
    const x = W - 66 - (stats.length - 1 - i) * 128
    body += fx(340 + i * 80, `<rect x="${x - 54}" y="62" width="108" height="60" rx="10" fill="#ffffff" opacity=".05"/>
      ${text(x, 97, v, { size: 22, weight: 700, fill: C.text, anchor: 'middle', mono: true })}
      ${text(x, 113, k.toUpperCase(), { size: 9, fill: C.dim, anchor: 'middle', ls: 1.5 })}`)
  })
  body += fx(560, text(W - 66, 146, `★ ${num(stars)} stars · ${num(u.followers.totalCount)} followers`, { size: 10.5, fill: C.mute, anchor: 'middle' }))
  write('holo.svg', card(W, H, `${u.name} — profile card`, body, defs, css))
}

// ---------- achievements ----------
{
  const W = 860, rowH = 46, H = 76 + ACHIEVEMENTS.length * rowH + 14
  const tone = { gold: C.gold, bronze: C.bronze, blue: C.blue, purple: C.purple, cyan: C.cyan, green: C.green }
  let body = headline(30, 38, 'Achievements')
  body += text(W - 30, 38, `${ACHIEVEMENTS.length} wins · hackathons & challenges`, { size: 11, fill: C.mute, anchor: 'end' })
  body += `<line x1="30" y1="54" x2="${W - 30}" y2="54" stroke="${C.line}"/>`
  ACHIEVEMENTS.forEach((a, i) => {
    const y = 76 + i * rowH, col = tone[a.tone] || C.blue
    body += fx(100 + i * 80, `<rect x="30" y="${y}" width="${W - 60}" height="${rowH - 8}" rx="9" fill="${C.panel}" opacity=".8"/>
      <rect x="30" y="${y}" width="${W - 60}" height="${rowH - 8}" rx="9" fill="none" stroke="${col}" stroke-opacity=".28"/>
      <rect x="30" y="${y + 6}" width="4" height="${rowH - 20}" rx="2" fill="${col}"/>
      <rect x="48" y="${y + 8}" width="46" height="22" rx="6" fill="${col}" opacity=".18"/>
      ${text(71, y + 23, a.badge, { size: 11, fill: col, weight: 700, anchor: 'middle', mono: true })}
      ${text(110, y + 24, clip(a.title, 470, 13.5), { size: 13.5, fill: C.text, weight: 600 })}
      ${text(W - 48, y + 24, clip(a.event, 240, 12), { size: 12, fill: C.dim, anchor: 'end' })}`)
  })
  write('achievements.svg', card(W, H, 'Achievements', body))
}

// ---------- contribution skyline (isometric city) ----------
{
  // A sheared grid, not a 45° isometric one: weeks run along x so the city fills the card's width.
  const W = 860, CW = 13.4, DX = 9, DY = 9, MAXH = 62
  const weeks = cal.weeks
  const cols = weeks.length
  const plotW = (cols - 1) * CW + CW + 6 * DX
  const originX = Math.round((W - plotW) / 2 + 6 * DX)
  const originY = 74 + MAXH
  const bottom = originY + 6 * DY + DY
  const H = Math.round(bottom + 104)
  const max = Math.max(...days.map(d => d.contributionCount), 1)
  // Contributions are heavily skewed (median 2, max in the hundreds), so scale heights and
  // colours logarithmically: a linear scale leaves all but a handful of days flat on the plate.
  const rel = n => Math.log1p(n) / Math.log1p(max)
  const level = n => (n === 0 ? 0 : Math.min(4, 1 + Math.floor(rel(n) * 3.999)))
  const heightOf = n => (n === 0 ? 0 : Math.max(4, Math.round(rel(n) * MAXH)))

  let body = headline(30, 38, 'Contribution skyline')
  body += text(W - 30, 38, `${num(cal.totalContributions)} contributions · last 12 months`, { size: 11, fill: C.dim, anchor: 'end' })
  body += `<line x1="30" y1="54" x2="${W - 30}" y2="54" stroke="${C.line}"/>`

  const cell = (col, row) => ({ bx: originX + col * CW - row * DX, by: originY + row * DY })
  // Ground plate under the whole grid.
  const g0 = cell(0, 0), g1 = cell(cols - 1, 0), g2 = cell(cols - 1, 6), g3 = cell(0, 6)
  body += `<polygon points="${g0.bx},${g0.by} ${g1.bx + CW},${g1.by} ${g2.bx + CW - DX},${g2.by + DY} ${g3.bx - DX},${g3.by + DY}" fill="#1b1f30" opacity=".85"/>`

  // Painter's algorithm: back row first, then each column left to right, so near blocks cover far ones.
  for (let row = 0; row <= 6; row++) {
    let blocks = ''
    weeks.forEach((w, col) => {
      const d = w.contributionDays.find(x => x.weekday === row)
      if (!d) return
      const { bx, by } = cell(col, row)
      const h = heightOf(d.contributionCount)
      const lv = level(d.contributionCount)
      const top = HEAT[lv], front = shade(HEAT[lv], 0.58), side = shade(HEAT[lv], 0.38)
      const A = [bx, by - h], B = [bx + CW, by - h], Cc = [bx + CW - DX, by - h + DY], D = [bx - DX, by - h + DY]
      if (h > 0) {
        blocks += `<polygon points="${D[0]},${D[1]} ${Cc[0]},${Cc[1]} ${Cc[0]},${Cc[1] + h} ${D[0]},${D[1] + h}" fill="${front}"/>`
        blocks += `<polygon points="${B[0]},${B[1]} ${Cc[0]},${Cc[1]} ${Cc[0]},${Cc[1] + h} ${B[0]},${B[1] + h}" fill="${side}"/>`
      }
      blocks += `<polygon points="${A[0]},${A[1]} ${B[0]},${B[1]} ${Cc[0]},${Cc[1]} ${D[0]},${D[1]}" fill="${top}"><title>${d.date}: ${d.contributionCount}</title></polygon>`
    })
    body += `<g style="animation:rise .55s ease-out both;animation-delay:${140 + row * 70}ms">${blocks}</g>`
  }

  const first = weeks[0].firstDay, last = weeks[weeks.length - 1].firstDay
  const month = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  body += fx(900, text(W / 2, bottom + 34, `${month(first)}  →  ${month(last)}`, { size: 11.5, fill: C.mute, anchor: 'middle', mono: true }))
  const foot = [
    [`${current}`, 'CURRENT STREAK', C.orange], [`${longest}`, 'LONGEST STREAK', C.blue],
    [num(best.contributionCount), 'BEST DAY', C.green], [num(u.contributionsCollection.totalCommitContributions), 'COMMITS', C.purple],
  ]
  foot.forEach(([v, k, col], i) => {
    const x = W / 2 + (i - 1.5) * 170
    body += fx(950 + i * 70, `${text(x, bottom + 70, v, { size: 20, weight: 700, fill: col, anchor: 'middle', mono: true })}
      ${text(x, bottom + 86, k, { size: 9, fill: C.mute, anchor: 'middle', ls: 1.3 })}`)
  })
  write('skyline.svg', card(W, H, 'Contribution skyline', body))
}

// ---------- all-time statistics ----------
{
  const W = 860, cols = 4, gap = 12, pad = 30
  const tw = Math.round((W - pad * 2 - gap * (cols - 1)) / cols), th = 74
  const tiles = [
    ['Contributions', num(lifetime.contributions), C.green], ['Commits', num(lifetime.commits), C.blue],
    ['Pull requests', num(lifetime.prs), C.purple], ['Issues', num(lifetime.issues), C.orange],
    ['Repositories', num(u.repositories.totalCount), C.cyan], ['Stars earned', num(stars), C.yellow],
    ['Contributed to', num(u.repositoriesContributedTo.totalCount), C.red], ['Longest streak', `${longest}d`, C.text],
  ]
  const rows = Math.ceil(tiles.length / cols)
  const H = 76 + rows * (th + gap) + 10
  const since = new Date(u.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  let body = headline(pad, 38, 'GitHub by the numbers')
  body += text(W - pad, 38, `all-time · since ${since}`, { size: 11, fill: C.dim, anchor: 'end' })
  body += `<line x1="${pad}" y1="54" x2="${W - pad}" y2="54" stroke="${C.line}"/>`
  tiles.forEach(([k, v, col], i) => {
    const x = pad + (i % cols) * (tw + gap), y = 76 + Math.floor(i / cols) * (th + gap)
    body += fx(110 + i * 65, `<rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="10" fill="${C.panel}"/>
      <rect x="${x}" y="${y}" width="${tw}" height="${th}" rx="10" fill="none" stroke="${col}" stroke-opacity=".22"/>
      <rect x="${x + 14}" y="${y + 14}" width="${tw - 28}" height="3" rx="1.5" fill="${col}" opacity=".85"
        style="animation:grow .8s cubic-bezier(.2,.7,.3,1) both;animation-delay:${280 + i * 65}ms;transform-origin:${x + 14}px 0"/>
      ${text(x + 14, y + 48, v, { size: 24, weight: 700, fill: col, mono: true })}
      ${text(x + 14, y + 64, k.toUpperCase(), { size: 9, fill: C.mute, ls: 1.4 })}`)
  })
  write('stats.svg', card(W, H, 'All-time GitHub statistics', body))
}

// ---------- experience and education ----------
{
  const W = 860, pad = 30, rowH = 76
  const H = 76 + TIMELINE.length * rowH + 12
  const tone = { blue: C.blue, purple: C.purple, orange: C.orange, green: C.green }
  let body = headline(pad, 38, 'Experience & education')
  body += text(W - pad, 38, 'IIIT Bangalore', { size: 11, fill: C.dim, anchor: 'end' })
  body += `<line x1="${pad}" y1="54" x2="${W - pad}" y2="54" stroke="${C.line}"/>`
  const lineX = pad + 9, top = 90, bottomY = top + (TIMELINE.length - 1) * rowH
  body += `<line x1="${lineX}" y1="${top}" x2="${lineX}" y2="${bottomY}" stroke="${C.line}" stroke-width="2"
    stroke-dasharray="${bottomY - top}" stroke-dashoffset="${bottomY - top}"
    style="animation:draw 1s ease-out .2s both"/>`
  TIMELINE.forEach((e, i) => {
    const y = top + i * rowH, col = tone[e.tone] || C.blue
    const detail = wrap(e.detail, W - 180, 12, 2)
    body += fx(260 + i * 140, `<circle cx="${lineX}" cy="${y}" r="7" fill="${C.bg}" stroke="${col}" stroke-width="2.5"/>
      <circle cx="${lineX}" cy="${y}" r="2.5" fill="${col}"/>
      ${text(lineX + 24, y + 5, e.title, { size: 14, weight: 700, fill: C.text })}
      ${text(W - pad, y + 5, e.when, { size: 11.5, fill: col, anchor: 'end', mono: true })}
      ${detail.map((l, j) => text(lineX + 24, y + 26 + j * 16, l, { size: 12, fill: C.dim })).join('')}`)
  })
  write('experience.svg', card(W, H, 'Experience and education', body, '', `
  @keyframes draw{to{stroke-dashoffset:0}}`))
}

// ---------- commit mixtape ----------
{
  const W = 860, H = 268, tracks = commits.slice(0, 5)
  // Cassette shell on the left, the commits it "holds" listed as a track list on the right.
  const cx1 = 128, cx2 = 268, reelY = 186, reelR = 31
  const defs = `<linearGradient id="tapeLabel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6ec7" stop-opacity=".9"/><stop offset="50%" stop-color="#bb9af7" stop-opacity=".9"/><stop offset="100%" stop-color="#7aa2f7" stop-opacity=".9"/>
    </linearGradient>`
  const css = `
  .reel{animation:spin 4s linear infinite}
  .reel2{animation:spin 2.6s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}`
  const spokes = (cx, cy, r) => Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3
    return `<line x1="${(cx + Math.cos(a) * 9).toFixed(1)}" y1="${(cy + Math.sin(a) * 9).toFixed(1)}" x2="${(cx + Math.cos(a) * r).toFixed(1)}" y2="${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${C.mute}" stroke-width="3" stroke-linecap="round"/>`
  }).join('')

  let body = headline(30, 38, 'Commit mixtape')
  body += text(W - 30, 38, `side A · ${num(lifetime.commits)} commits recorded`, { size: 11, fill: C.dim, anchor: 'end' })
  body += `<line x1="30" y1="54" x2="${W - 30}" y2="54" stroke="${C.line}"/>`

  body += fx(80, `<rect x="30" y="74" width="336" height="172" rx="12" fill="#232738" stroke="${C.line}"/>
    <rect x="44" y="86" width="308" height="62" rx="6" fill="url(#tapeLabel)" opacity=".85"/>
    ${text(58, 110, 'PARADOX-73', { size: 15, weight: 700, fill: '#14161f', mono: true, ls: 1.5 })}
    ${text(58, 130, 'commit history · 2023–2026', { size: 11, fill: '#14161f', mono: true, op: 0.75 })}
    ${text(338, 110, 'A', { size: 20, weight: 700, fill: '#14161f', mono: true, anchor: 'end' })}
    <rect x="62" y="156" width="272" height="76" rx="8" fill="#15171f"/>
    <rect x="${cx1}" y="178" width="${cx2 - cx1}" height="16" fill="#3a3f55"/>
    <circle cx="48" cy="92" r="3" fill="${C.mute}"/><circle cx="348" cy="92" r="3" fill="${C.mute}"/>
    <circle cx="48" cy="238" r="3" fill="${C.mute}"/><circle cx="348" cy="238" r="3" fill="${C.mute}"/>`)
  body += `<g class="reel" style="transform-origin:${cx1}px ${reelY}px">
      <circle cx="${cx1}" cy="${reelY}" r="${reelR}" fill="#2b3048" stroke="${C.line}"/>
      <circle cx="${cx1}" cy="${reelY}" r="11" fill="#15171f" stroke="${C.mute}" stroke-width="2"/>${spokes(cx1, reelY, reelR - 4)}
    </g>
    <g class="reel2" style="transform-origin:${cx2}px ${reelY}px">
      <circle cx="${cx2}" cy="${reelY}" r="${reelR - 9}" fill="#2b3048" stroke="${C.line}"/>
      <circle cx="${cx2}" cy="${reelY}" r="11" fill="#15171f" stroke="${C.mute}" stroke-width="2"/>${spokes(cx2, reelY, reelR - 13)}
    </g>`

  body += fx(220, text(398, 92, 'TRACK LIST', { size: 10, fill: C.mute, weight: 700, ls: 2 }))
  if (!tracks.length) body += fx(260, text(398, 120, 'no public pushes in the last 90 days', { size: 12, fill: C.mute, mono: true }))
  tracks.forEach((c, i) => {
    const y = 120 + i * 27
    body += fx(260 + i * 70, `${text(398, y, String(i + 1).padStart(2, '0'), { size: 12, fill: C.purple, mono: true })}
      ${text(428, y, clip(c.repo, 150, 12, true), { size: 12, fill: C.cyan, mono: true })}
      ${text(588, y, clip(c.msg, 198, 11.5), { size: 11.5, fill: C.dim })}
      ${text(W - 30, y, ago(c.at), { size: 11, fill: C.mute, anchor: 'end', mono: true })}`)
  })
  body += fx(620, text(398, 246, `${num(lifetime.prs)} pull requests · ${num(lifetime.issues)} issues · ${num(lifetime.contributions)} contributions all-time`, { size: 11, fill: C.mute }))
  write('mixtape.svg', card(W, H, 'Commit mixtape — recent commits as a cassette track list', body, defs, css))
}

// ---------- languages ----------
{
  const W = 860, top = 86, rowH = 30, show = langs.slice(0, 6)
  const H = top + show.length * rowH + 22
  let body = `<rect x="16" y="14" width="${W - 32}" height="26" rx="6" fill="${C.panel}"/>
    <circle cx="36" cy="27" r="5" fill="${C.red}"/><circle cx="54" cy="27" r="5" fill="${C.yellow}"/><circle cx="72" cy="27" r="5" fill="${C.green}"/>
    ${text(W / 2, 32, 'languages.sh', { size: 11.5, fill: C.mute, anchor: 'middle', mono: true })}`
  body += fx(80, `${text(28, 64, '$', { size: 12.5, fill: C.green, mono: true })}${text(44, 64, 'cat languages.txt  # weighted by bytes across public repos', { size: 12.5, fill: C.text, mono: true })}`)
  const barX = 190, barW = W - barX - 90
  show.forEach((l, i) => {
    const y = top + i * rowH, w = Math.max(3, Math.round((l.pct / show[0].pct) * barW))
    body += fx(160 + i * 70, `<circle cx="36" cy="${y + 9}" r="5" fill="${l.color}"/>
      ${text(52, y + 14, clip(l.name, 120, 13, true), { size: 13, fill: C.text, mono: true })}
      <rect x="${barX}" y="${y + 2}" width="${barW}" height="14" rx="7" fill="${C.panel}"/>
      <rect x="${barX}" y="${y + 2}" width="${w}" height="14" rx="7" fill="${l.color}"
        style="animation:grow .9s cubic-bezier(.2,.7,.3,1) both;animation-delay:${260 + i * 90}ms;transform-origin:${barX}px 0"/>
      ${text(W - 28, y + 14, `${l.pct.toFixed(1)}%`, { size: 12.5, fill: C.dim, anchor: 'end', mono: true })}`)
  })
  write('languages.svg', card(W, H, 'Language breakdown', body))
}

// ---------- project cards ----------
FEATURED.forEach(({ repo: name, title, note }, idx) => {
  const r = repos.find(x => x.name === name)
  if (!r) { console.warn(`skipped missing repo ${name}`); return }
  const W = 420, H = 176
  const desc = wrap(note || r.description || 'No description provided.', W - 56, 12, 3)
  const col = r.primaryLanguage?.color || C.blue
  let body = `<defs><linearGradient id="accent${idx}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${col}"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <rect x="0" y="0" width="${W}" height="3" fill="url(#accent${idx})"/>`
  body += fx(60, text(24, 42, clip(title || r.name.replace(/_/g, ' '), W - 80, 15, true), { size: 15, weight: 700, fill: C.blue, mono: true }))
  if (r.stargazerCount > 0) body += fx(90, text(W - 24, 42, `★ ${r.stargazerCount}`, { size: 12, fill: C.yellow, anchor: 'end', mono: true }))
  desc.forEach((l, i) => { body += fx(140 + i * 50, text(24, 68 + i * 17, l, { size: 12, fill: C.dim })) })
  let cx = 24
  for (const t of r.repositoryTopics.nodes.map(n => n.topic.name).slice(0, 3)) {
    const w = Math.round(widthOf(t, 10.5) + 18)
    if (cx + w > W - 24) break
    body += fx(260, `<rect x="${cx}" y="${H - 56}" width="${w}" height="20" rx="10" fill="${C.panel}" stroke="${C.line}"/>
      ${text(cx + w / 2, H - 42, t, { size: 10.5, fill: C.dim, anchor: 'middle' })}`)
    cx += w + 6
  }
  body += fx(300, `<circle cx="30" cy="${H - 21}" r="5" fill="${col}"/>
    ${text(42, H - 17, r.primaryLanguage?.name || 'Mixed', { size: 11.5, fill: C.mute })}`)
  write(`project-${idx + 1}.svg`, card(W, H, `${r.name} repository card`, body))
})

console.log('\nDone. Cards written to assets/.')
