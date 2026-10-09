const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const results = []
const check = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail })

;(async () => {
  const c = new Client({ connectionString: process.argv[2], ssl: { rejectUnauthorized: false } })
  await c.connect()
  const q = async (sql, params) => (await c.query(sql, params)).rows
  const expectError = async (name, expected, fn) => {
    await c.query('SAVEPOINT sp')
    try {
      await fn()
      await c.query('RELEASE SAVEPOINT sp')
      check(name, false, 'no error raised')
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT sp')
      check(name, e.message.includes(expected), e.message)
    }
  }

  await c.query('BEGIN')
  try {
    await c.query(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261009100000_ask_views_and_reactions.sql'), 'utf8'))
    check('migration applies', true)

    const [u] = await q("SELECT id FROM users WHERE is_anonymous = false LIMIT 1")
    const ask = (await q("INSERT INTO prompts (creator_id, question, mode, category, expires_at) VALUES ($1, 'What do you never admit?', 'open', 'general', now() + interval '1 day') RETURNING id", [u.id]))[0].id
    const priv = (await q("INSERT INTO prompts (creator_id, question, mode, category, expires_at) VALUES ($1, 'Private one?', 'private', 'general', now() + interval '1 day') RETURNING id", [u.id]))[0].id

    const view = async (viewer, ip = 'ip1') => (await q('SELECT record_ask_view($1, $2, $3) AS ok', [ask, viewer, ip]))[0].ok
    check('first view counts', (await view('v1')) === true)
    check('repeat view from same browser does not count', (await view('v1')) === false)
    check('second browser counts', (await view('v2')) === true)
    check('view_count is 2', (await q('SELECT view_count FROM prompts WHERE id = $1', [ask]))[0].view_count === 2)
    check('public ask payload exposes view_count', (await q('SELECT get_public_ask($1) AS j', [ask]))[0].j.view_count === 2)

    const answer = async (token, text) => (await q("INSERT INTO prompt_responses (prompt_id, content, moderation_status, ip_hash, sender_token_hash) VALUES ($1, $2, 'passed', 'ip', $3) RETURNING id", [ask, text, token]))[0].id
    const a1 = await answer('alice', 'first answer')
    const a2 = await answer('bob', 'second answer')
    const toggle = async (id, reaction, who) => (await q('SELECT toggle_ask_reaction($1, $2, $3) AS j', [id, reaction, who]))[0].j

    await expectError('lurker cannot react before answering', 'answer_first', () => toggle(a1, 'same', 'carol'))
    await expectError('cannot react to own answer', 'own_answer', () => toggle(a1, 'same', 'alice'))
    await expectError('rejects unknown reaction', 'invalid_reaction', () => toggle(a1, 'love', 'bob'))

    const on = await toggle(a1, 'same', 'bob')
    check('answerer can react (count 1, active)', on.active === true && on.same === 1, JSON.stringify(on))
    const off = await toggle(a1, 'same', 'bob')
    check('second tap removes reaction', off.active === false && off.same === 0, JSON.stringify(off))
    await toggle(a1, 'bold', 'bob')
    await toggle(a1, 'oof', 'bob')
    const totals = (await q('SELECT same_count, bold_count, oof_count, reaction_total FROM prompt_responses WHERE id = $1', [a1]))[0]
    check('multiple reaction types tracked', totals.bold_count === 1 && totals.oof_count === 1 && totals.reaction_total === 2, JSON.stringify(totals))

    const felt = await q("SELECT id FROM get_public_ask_responses($1, 'felt', NULL, NULL, NULL, 30)", [ask])
    check('most felt sorts by reactions', felt[0].id === a1 && felt[1].id === a2)
    const latest = await q("SELECT id FROM get_public_ask_responses($1, 'latest', NULL, NULL, NULL, 30)", [ask])
    check('latest sorts newest first', latest.length === 2)
    const page2 = await q("SELECT id FROM get_public_ask_responses($1, 'felt', NULL, $2, $3, 30)", [ask, 2, a1])
    check('felt keyset cursor returns the next item', page2.length === 1 && page2[0].id === a2)

    const state = (await q('SELECT get_ask_viewer_state($1, $2) AS j', [ask, 'bob']))[0].j
    check('viewer state lists own answers and reactions', state.own_response_ids.includes(a2) && state.reactions.length === 2, JSON.stringify(state))
    const stranger = (await q('SELECT get_ask_viewer_state($1, $2) AS j', [ask, 'zed']))[0].j
    check('stranger viewer state is empty', stranger.reactions.length === 0 && stranger.own_response_ids.length === 0, JSON.stringify(stranger))

    const pa = (await q("INSERT INTO prompt_responses (prompt_id, content, moderation_status, ip_hash, sender_token_hash) VALUES ($1, 'private answer', 'passed', 'ip', 'dave') RETURNING id", [priv]))[0].id
    await q("INSERT INTO prompt_responses (prompt_id, content, moderation_status, ip_hash, sender_token_hash) VALUES ($1, 'mine', 'passed', 'ip', 'erin')", [priv])
    await expectError('private ask answers cannot be reacted to', 'not_found', () => toggle(pa, 'same', 'erin'))
    check('private ask answers are never listed', (await q("SELECT * FROM get_public_ask_responses($1, 'latest', NULL, NULL, NULL, 30)", [priv])).length === 0)

    await q('DELETE FROM prompts WHERE id = $1', [ask])
    const leftover = (await q('SELECT (SELECT COUNT(*) FROM prompt_views WHERE prompt_id = $1)::int AS v, (SELECT COUNT(*) FROM prompt_response_reactions WHERE response_id = $2)::int AS r', [ask, a1]))[0]
    check('deleting an ask removes its views and reactions', leftover.v === 0 && leftover.r === 0, JSON.stringify(leftover))
  } catch (e) {
    check('UNEXPECTED ERROR', false, e.message)
  } finally {
    await c.query('ROLLBACK')
    await c.end()
  }

  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? '  -> ' + r.detail : ''}`)
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed (transaction rolled back)`)
})().catch((e) => { console.error(e); process.exit(1) })
