import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'
import { getLibraryPrompt } from '@/lib/prompts/library'
import { hasThirdPartyPromptFraming } from '@/lib/prompts/safety'
import { PROMPT_CATEGORIES, PROMPT_DURATIONS, PROMPT_RESPONSE_FORMATS, type PromptCategory, type PromptDuration, type PromptResponseFormat } from '@/lib/prompts/types'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeEnumValue, sanitizeSingleLineInput } from '@/lib/security/input-sanitization'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 5
const MAX_OPTION_LENGTH = 80

type ParsedChoice =
  | { ok: true; options: string[]; correctOptionIndex: number }
  | { ok: false; error: string }

function parseChoicePayload(raw: Record<string, unknown>): ParsedChoice {
  const rawOptions = Array.isArray(raw.options) ? raw.options : []
  const options = rawOptions
    .map((option) => sanitizeSingleLineInput(option, { maxLength: MAX_OPTION_LENGTH }))
    .filter(Boolean)

  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return { ok: false, error: `Choose between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.` }
  }

  const correctOptionIndex = Number(raw.correctOptionIndex)
  if (
    !Number.isInteger(correctOptionIndex) ||
    correctOptionIndex < 0 ||
    correctOptionIndex >= options.length
  ) {
    return { ok: false, error: 'Mark which option is the true one.' }
  }

  return { ok: true, options, correctOptionIndex }
}

const ACTIVE_PROMPT_LIMIT = 10

const durationToHours: Record<PromptDuration, number> = {
  '24h': 24,
  '48h': 48,
  '7d': 7 * 24,
}

async function resolveRegisteredCreator(request: NextRequest) {
  const user = await resolveUserFromRequest(request)
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, is_anonymous, is_premium')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.is_anonymous) return null
  return { ...user, isPremium: profile.is_premium ?? false }
}

export async function GET(request: NextRequest) {
  try {
    const creator = await resolveRegisteredCreator(request)
    if (!creator) return NextResponse.json({ error: 'Sign in to manage your asks.' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('prompts')
      .select('id, creator_id, question, mode, category, library_key, response_count, expires_at, is_saved, export_count, response_format, options, created_at')
      .eq('creator_id', creator.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Prompts] Failed to list prompts:', error.message)
      return NextResponse.json({ error: 'Unable to load your asks.' }, { status: 500 })
    }

    return NextResponse.json({ prompts: data ?? [] })
  } catch (error) {
    console.error('[Prompts] Unexpected list failure:', error)
    return NextResponse.json({ error: 'Unable to load your asks.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const creator = await resolveRegisteredCreator(request)
    if (!creator) return NextResponse.json({ error: 'Sign in to create an ask.' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const raw = body as Record<string, unknown>
    const libraryKey = typeof raw.libraryKey === 'string' ? raw.libraryKey : null
    const libraryPrompt = getLibraryPrompt(libraryKey)
    if (!libraryPrompt && (typeof raw.question !== 'string' || raw.question.trim().length > 280)) {
      return NextResponse.json({ error: 'Your question cannot exceed 280 characters.' }, { status: 400 })
    }
    const question = libraryPrompt
      ? libraryPrompt.question
      : sanitizeSingleLineInput(raw.question, { maxLength: 280 })
    const category = libraryPrompt
      ? libraryPrompt.category
      : sanitizeEnumValue(raw.category, PROMPT_CATEGORIES, 'general') as PromptCategory
    const duration = sanitizeEnumValue(raw.duration, PROMPT_DURATIONS, '48h') as PromptDuration

    if (duration === '7d' && !creator.isPremium) {
      return NextResponse.json(
        { error: 'The 7-day duration is a premium feature. Upgrade to keep an ask open for a full week.' },
        { status: 403 }
      )
    }

    if (question.length < 3) {
      return NextResponse.json({ error: 'Your question needs at least 3 characters.' }, { status: 400 })
    }

    if (containsBlockedContent(question).blocked || hasThirdPartyPromptFraming(question)) {
      return NextResponse.json(
        { error: 'Asks need to invite people to share their own experience.' },
        { status: 422 }
      )
    }

    // The client's own responseFormat/options take priority — a creator can
    // start from a library template and still fully rewrite its options, or
    // skip the library and build a choice-format ask entirely from scratch.
    const hasOwnChoicePayload = Array.isArray(raw.options)
    const responseFormat = sanitizeEnumValue(
      raw.responseFormat,
      PROMPT_RESPONSE_FORMATS,
      hasOwnChoicePayload ? 'choice' : (libraryPrompt?.responseFormat ?? 'text')
    ) as PromptResponseFormat

    let options: string[] | null = null
    let correctOptionIndex: number | null = null

    if (responseFormat === 'choice') {
      if (hasOwnChoicePayload) {
        const parsed = parseChoicePayload(raw)
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 })
        }
        options = parsed.options
        correctOptionIndex = parsed.correctOptionIndex
      } else if (libraryPrompt?.options && libraryPrompt.correctOptionIndex !== undefined) {
        options = libraryPrompt.options
        correctOptionIndex = libraryPrompt.correctOptionIndex
      } else {
        return NextResponse.json({ error: 'Choose between 2 and 5 options.' }, { status: 400 })
      }

      for (const option of options) {
        if (containsBlockedContent(option).blocked) {
          return NextResponse.json(
            { error: 'One of your options isn\'t allowed. Please rephrase it.' },
            { status: 422 }
          )
        }
      }
    }

    const { count, error: countError } = await supabaseAdmin
      .from('prompts')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creator.id)
      .is('deleted_at', null)
      .gt('expires_at', new Date().toISOString())

    if (countError) {
      console.error('[Prompts] Failed to check active cap:', countError.message)
      return NextResponse.json({ error: 'Unable to create an ask right now.' }, { status: 500 })
    }

    if ((count ?? 0) >= ACTIVE_PROMPT_LIMIT) {
      return NextResponse.json(
        { error: `You can run up to ${ACTIVE_PROMPT_LIMIT} active asks at once.` },
        { status: 429 }
      )
    }

    const expiresAt = new Date(Date.now() + durationToHours[duration] * 60 * 60 * 1000).toISOString()
    const { data: prompt, error } = await supabaseAdmin
      .from('prompts')
      .insert({
        creator_id: creator.id,
        question,
        // Open mode is intentionally deferred. Keeping this server-side prevents
        // a crafted client request from publishing before its safety flow ships.
        mode: 'private',
        category,
        library_key: libraryPrompt?.key ?? null,
        expires_at: expiresAt,
        response_format: responseFormat,
        options,
        correct_option_index: correctOptionIndex,
      })
      .select('id, creator_id, question, mode, category, library_key, response_count, expires_at, is_saved, export_count, response_format, options, created_at')
      .single()

    if (error || !prompt) {
      console.error('[Prompts] Failed to create prompt:', error?.message)
      return NextResponse.json({ error: 'Unable to create your ask.' }, { status: 500 })
    }

    return NextResponse.json({ prompt }, { status: 201 })
  } catch (error) {
    console.error('[Prompts] Unexpected create failure:', error)
    return NextResponse.json({ error: 'Unable to create your ask.' }, { status: 500 })
  }
}
