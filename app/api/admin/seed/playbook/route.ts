/**
 * Playbook CRUD API — Manage thread templates and replies
 *
 * GET    — List playbook threads with replies
 * POST   — Add new thread template
 * PATCH  — Update thread template
 * DELETE — Delete thread template
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase/admin-client';
import { resolveUserFromRequest } from '@/lib/security/request-auth';

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const user = await resolveUserFromRequest(req);
  if (!user) return false;

  const { data: adminData } = await supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (adminData) return true;

  const { data: userData } = await supabaseAdmin.from('users').select('is_admin').eq('id', user.id).single();
  return userData?.is_admin === true;
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const usedOnly = searchParams.get('used') === 'true';

    let query = supabaseAdmin
      .from('seed_playbook_threads')
      .select('*, seed_playbook_replies(*)')
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (usedOnly) query = query.eq('is_used', true);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, content, category, type, pollOptions, creatorPersona, replies } = body;

    if (!title || !content || !creatorPersona) {
      return NextResponse.json({ error: 'title, content, and creatorPersona are required' }, { status: 400 });
    }

    // Insert thread template
    const { data: thread, error: tErr } = await supabaseAdmin
      .from('seed_playbook_threads')
      .insert({
        title,
        content,
        category: category || 'general',
        type: type || 'text',
        poll_options: pollOptions || null,
        creator_persona: creatorPersona,
      })
      .select('id')
      .single();

    if (tErr || !thread) throw tErr || new Error('Failed to create discussion template');

    // Insert replies if provided
    if (replies && Array.isArray(replies)) {
      const replyRows = replies.map((r: any, i: number) => ({
        thread_playbook_id: thread.id,
        persona_tag: r.personaTag || r.persona_tag,
        content: r.content,
        sequence_order: r.sequenceOrder || r.sequence_order || i + 1,
        reply_to_sequence: r.replyToSequence || r.reply_to_sequence || null,
      }));

      const { error: rErr } = await supabaseAdmin.from('seed_playbook_replies').insert(replyRows);
      if (rErr) console.warn('Failed to insert some replies:', rErr.message);
    }

    return NextResponse.json({ success: true, data: { id: thread.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'Discussion template ID is required' }, { status: 400 });

    if (updates.type === 'reply') {
      const { error } = await supabaseAdmin
        .from('seed_playbook_replies')
        .update({ content: updates.content })
        .eq('id', id);
        
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    const allowed = ['title', 'content', 'category', 'type', 'poll_options', 'creator_persona', 'is_used'];
    const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }

    const { error } = await supabaseAdmin
      .from('seed_playbook_threads')
      .update(safeUpdates)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Discussion template ID is required' }, { status: 400 });

    // Cascade deletes replies automatically
    const { error } = await supabaseAdmin.from('seed_playbook_threads').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
