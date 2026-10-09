const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const conn = process.argv[2]
const files = [
  '20261007100000_official_flag_and_account_guard.sql',
  '20261007110000_discussion_sliding_expiry.sql',
  '20261007120000_public_curiosity_asks.sql',
]

const results = []
const check = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail })

;(async () => {
  const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const q = async (sql, params) => (await c.query(sql, params)).rows
  const asUser = async (uid) => {
    await c.query('SET LOCAL ROLE authenticated')
    await c.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })])
  }
  const asAdmin = async () => c.query('RESET ROLE')
  const expectError = async (name, fn) => {
    await c.query('SAVEPOINT sp')
    try {
      await fn()
      await c.query('RELEASE SAVEPOINT sp')
      check(name, false, 'no error raised')
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT sp')
      check(name, true, e.message)
    }
    await asAdmin()
  }

  await c.query('BEGIN')
  try {
    for (const f of files) {
      await c.query(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', f), 'utf8'))
    }
    check('migrations apply', true)

    const users = await q("SELECT id FROM users WHERE is_anonymous = false AND COALESCE(is_admin,false) = false AND COALESCE(is_banned,false) = false ORDER BY created_at LIMIT 2")
    const [u1, u2] = users.map((r) => r.id)

    await expectError('user cannot self-grant admin', async () => {
      await asUser(u1)
      await c.query('UPDATE users SET is_admin = true WHERE id = $1', [u1])
    })
    await expectError('user cannot self-grant premium', async () => {
      await asUser(u1)
      await c.query('UPDATE users SET is_premium = true WHERE id = $1', [u1])
    })
    await expectError('user cannot self-grant official', async () => {
      await asUser(u1)
      await c.query('UPDATE users SET is_official = true WHERE id = $1', [u1])
    })
    await c.query('SAVEPOINT pref')
    await asUser(u1)
    await c.query("UPDATE users SET last_active_at = now() WHERE id = $1", [u1])
    await asAdmin()
    await c.query('RELEASE SAVEPOINT pref')
    check('user can still update own last_active_at', true)

    const mkThread = async (creator, createdAgoH, expiresInH, extra = {}) => {
      const rows = await q(
        `INSERT INTO threads (creator_id, title, content, type, category, privacy, created_at, expires_at, moderation_status)
         VALUES ($1, 'test topic', 'opening post', $2, 'general', 'public', now() - ($3::float8 * interval '1 hour'), now() + ($4::float8 * interval '1 hour'), 'visible')
         RETURNING id, created_at, expires_at`,
        [creator, extra.type || 'text', createdAgoH, expiresInH]
      )
      return rows[0]
    }
    const msg = (thread, sender) => q("INSERT INTO messages (thread_id, sender_id, content, type) VALUES ($1, $2, 'hi', 'text') RETURNING id", [thread, sender])
    const hoursUntil = async (id) => Number((await q("SELECT EXTRACT(EPOCH FROM (expires_at - now()))/3600 AS h FROM threads WHERE id = $1", [id]))[0].h)

    const t1 = await mkThread(u1, 10, 38)
    await q('UPDATE threads SET expiry_notified = true WHERE id = $1', [t1.id])
    await msg(t1.id, u2)
    const h1 = await hoursUntil(t1.id)
    const n1 = (await q('SELECT expiry_notified FROM threads WHERE id = $1', [t1.id]))[0].expiry_notified
    check('reply slides expiry to ~48h', h1 > 47.9 && h1 <= 48.01, h1.toFixed(3))
    check('reply resets expiry_notified', n1 === false)

    const t2 = await mkThread(u1, 110, 2)
    await msg(t2.id, u2)
    const h2 = await hoursUntil(t2.id)
    check('no hard cap: 110h-old active thread still slides to 48h', h2 > 47.9 && h2 <= 48.01, h2.toFixed(3))

    const t3 = await mkThread(u1, 110, 100)
    await msg(t3.id, u2)
    const h3 = await hoursUntil(t3.id)
    check('premium-extended expiry never shortened', h3 > 99.9, h3.toFixed(3))

    const tp = await mkThread(u1, 1, 23, { type: 'poll' })
    await msg(tp.id, u2)
    const hp = await hoursUntil(tp.id)
    check('poll threads do not slide', hp < 23.01, hp.toFixed(3))

    const te = await mkThread(u1, 50, -0.01)
    await expectError('reply into expired thread is rejected', () => msg(te.id, u2))

    await c.query('SAVEPOINT ins')
    await asUser(u1)
    const ins = await q("INSERT INTO threads (creator_id, title, content, type, category, privacy, expires_at, is_saved) VALUES ($1, 'x', 'y', 'text', 'general', 'public', NULL, true) RETURNING expires_at, is_saved", [u1])
    await asAdmin()
    await c.query('RELEASE SAVEPOINT ins')
    const insH = (new Date(ins[0].expires_at).getTime() - Date.now()) / 3600000
    check('client insert with no expiry is clamped to 48h', insH > 47.5 && insH < 48.5, insH.toFixed(3))
    check('client insert cannot self-save', ins[0].is_saved === false)

    const official = await mkThread(u2, 1, 47)
    await q('UPDATE users SET is_official = true WHERE id = $1', [u2])
    const offExp = (await q('SELECT expires_at FROM threads WHERE id = $1', [official.id]))[0].expires_at
    check('flagging official makes live threads permanent', offExp === null)
    const offNew = await q("INSERT INTO threads (creator_id, title, content, type, category, privacy, expires_at) VALUES ($1, 'o', 'p', 'text', 'general', 'public', now() + interval '48 hours') RETURNING expires_at", [u2])
    check('official new thread never expires', offNew[0].expires_at === null)
    await msg(official.id, u1)
    check('reply into official thread keeps it permanent', (await q('SELECT expires_at FROM threads WHERE id = $1', [official.id]))[0].expires_at === null)

    const closure = async (id) => (await q('SELECT get_discussion_closure($1) AS j', [id]))[0].j
    check('closure: live thread', (await closure(t1.id)).state === 'live')
    const cl = await closure(te.id)
    check('closure: expired public thread shows topic + post + stats', cl.state === 'closed' && cl.title === 'test topic' && cl.content === 'opening post' && 'participant_count' in cl, JSON.stringify(cl))
    check('closure: missing thread', (await closure('00000000-0000-4000-8000-000000000000')).state === 'missing')
    const tdel = await mkThread(u1, 1, 47)
    await q('UPDATE threads SET deleted_at = now() WHERE id = $1', [tdel.id])
    check('closure: creator-deleted thread hides content', (await closure(tdel.id)).state === 'removed')

    const m = (await msg(t1.id, u1))[0].id
    const beforeCount = (await q('SELECT message_count FROM threads WHERE id = $1', [t1.id]))[0].message_count
    await c.query('SAVEPOINT del')
    await asUser(u2)
    const notMine = (await q('SELECT delete_own_thread_message($1) AS ok', [m]))[0].ok
    await asUser(u1)
    const mine = (await q('SELECT delete_own_thread_message($1) AS ok', [m]))[0].ok
    await asAdmin()
    await c.query('RELEASE SAVEPOINT del')
    const after = (await q('SELECT m.deleted_at, m.content, t.message_count FROM messages m JOIN threads t ON t.id = m.thread_id WHERE m.id = $1', [m]))[0]
    check('cannot delete someone else\'s reply', notMine === false)
    check('can soft-delete own reply (content wiped, count decremented)', mine === true && after.deleted_at && after.content === '' && after.message_count === beforeCount - 1)

    const pr = await q("INSERT INTO prompts (creator_id, question, mode, category, expires_at) VALUES ($1, 'What is the truth?', 'open', 'general', now() + interval '24 hours') RETURNING id", [u1])
    const pid = pr[0].id
    await q("INSERT INTO prompt_responses (prompt_id, content, moderation_status, ip_hash) VALUES ($1, 'an answer', 'passed', 'iphash')", [pid])
    const pAfter = (await q("SELECT response_count, EXTRACT(EPOCH FROM (expires_at - now()))/3600 AS h FROM prompts WHERE id = $1", [pid]))[0]
    check('public ask response slides to 7 days', Number(pAfter.h) > 167.9 && Number(pAfter.h) <= 168.01 && pAfter.response_count === 1, JSON.stringify(pAfter))
    await q("INSERT INTO prompt_responses (prompt_id, content, moderation_status, ip_hash) VALUES ($1, 'blocked one', 'blocked', 'iphash')", [pid])
    const pub = await q('SELECT * FROM get_public_ask_responses($1, NULL, NULL, 30)', [pid])
    check('public responses list excludes blocked', pub.length === 1 && pub[0].content === 'an answer')
    await expectError('ask mode cannot change after creation', () => q("UPDATE prompts SET mode = 'private' WHERE id = $1", [pid]))
    const priv = await q("INSERT INTO prompts (creator_id, question, mode, category, expires_at) VALUES ($1, 'Private one?', 'private', 'general', now() + interval '24 hours') RETURNING id", [u1])
    await expectError('private ask can never become public', () => q("UPDATE prompts SET mode = 'open' WHERE id = $1", [priv[0].id]))
    check('private ask responses are never listed publicly', (await q('SELECT * FROM get_public_ask_responses($1, NULL, NULL, 30)', [priv[0].id])).length === 0)

    const ch = await q("INSERT INTO prompts (creator_id, question, mode, category, expires_at, response_format, options, correct_option_index) VALUES ($1, 'Which is true?', 'open', 'general', now() + interval '24 hours', 'choice', '[\"a\",\"b\",\"c\"]', 2) RETURNING id", [u1])
    await q("INSERT INTO prompt_responses (prompt_id, option_index, moderation_status, ip_hash) VALUES ($1, 0, 'passed', 'x'), ($1, 0, 'passed', 'y'), ($1, 2, 'passed', 'z')", [ch[0].id])
    const ask = (await q('SELECT get_public_ask($1) AS j', [ch[0].id]))[0].j
    check('choice tally counts per option', JSON.stringify(ask.tally) === '[2,0,1]', JSON.stringify(ask.tally))
    check('correct answer hidden while live', ask.correct_option_index === null)
    await q("UPDATE prompts SET expires_at = now() - interval '1 minute' WHERE id = $1", [ch[0].id])
    check('correct answer revealed after close', (await q('SELECT get_public_ask($1) AS j', [ch[0].id]))[0].j.correct_option_index === 2)

    const offPrompt = await q("INSERT INTO prompts (creator_id, question, mode, category, expires_at) VALUES ($1, 'Official ask?', 'open', 'general', now() + interval '24 hours') RETURNING id", [u1])
    await q('UPDATE users SET is_official = false WHERE id = $1', [u1])
    await q('UPDATE users SET is_official = true WHERE id = $1', [u1])
    check('flagging official makes live asks permanent', (await q('SELECT expires_at FROM prompts WHERE id = $1', [offPrompt[0].id]))[0].expires_at === null)

    await q('UPDATE users SET is_official = false WHERE id = $1', [u2])
    const tomb = await mkThread(u2, 400, 10)
    await q("INSERT INTO messages (thread_id, sender_id, content, type, created_at) SELECT $1, $2, 'old reply', 'text', now() - interval '17 days'", [tomb.id, u1])
    await q("UPDATE threads SET expires_at = now() - interval '16 days', deleted_at = now() - interval '15 days' WHERE id = $1", [tomb.id])
    const purge = await q('SELECT * FROM purge_expired_threads(14, 500)')
    const tombRow = (await q('SELECT title, content, redacted_at FROM threads WHERE id = $1', [tomb.id]))[0]
    const tombMsgs = (await q('SELECT COUNT(*)::int AS n FROM messages WHERE thread_id = $1', [tomb.id]))[0].n
    const tombSummary = (await q('SELECT participant_count, perspective_count, viewed_by_creator FROM thread_summaries WHERE thread_id = $1', [tomb.id]))[0]
    check('purge keeps expired public thread as tombstone', tombRow && tombRow.title === 'test topic' && tombRow.content === 'opening post' && tombRow.redacted_at, JSON.stringify(purge))
    check('purge removes tombstone replies', tombMsgs === 0)
    check('purge snapshots stats silently', tombSummary && tombSummary.perspective_count === 1 && tombSummary.viewed_by_creator === true, JSON.stringify(tombSummary))
    check('closure still works after purge', (await closure(tomb.id)).state === 'closed')

    const cleaned = await q('SELECT cleanup_expired_threads() AS n')
    check('cleanup runs', cleaned[0].n >= 1, `cleaned ${cleaned[0].n}`)
  } catch (e) {
    check('UNEXPECTED ERROR', false, e.message)
  } finally {
    await c.query('ROLLBACK')
    await c.end()
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? '  -> ' + r.detail : ''}`)
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed (transaction rolled back)`)
})().catch((e) => { console.error(e); process.exit(1) })
