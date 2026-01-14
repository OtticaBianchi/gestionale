export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/procedures/[slug]/quiz
 * Fetch quiz questions for a specific procedure
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Create admin client for service role operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get procedure ID from slug
    const { data: procedure, error: procedureError } = await adminClient
      .from('procedures')
      .select('id, title, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (procedureError || !procedure) {
      return NextResponse.json(
        { error: 'Procedura non trovata' },
        { status: 404 }
      )
    }

    // Get quiz questions
    const { data: questions, error: questionsError } = await adminClient
      .from('procedure_quiz_questions')
      .select('id, question_number, question_text, difficulty, options')
      .eq('procedure_id', procedure.id)
      .order('question_number', { ascending: true })

    if (questionsError) {
      console.error('Error fetching quiz questions:', questionsError)
      return NextResponse.json(
        { error: 'Errore nel caricamento del quiz' },
        { status: 500 }
      )
    }

    // Check if quiz exists for this procedure
    if (!questions || questions.length === 0) {
      return NextResponse.json(
        {
          has_quiz: false,
          procedure: {
            id: procedure.id,
            title: procedure.title,
            slug: procedure.slug
          }
        },
        { status: 200 }
      )
    }

    // Return quiz data (without revealing correct answers)
    const quizQuestions = questions.map(q => ({
      id: q.id,
      question_number: q.question_number,
      question_text: q.question_text,
      difficulty: q.difficulty,
      options: (q.options as any[]).map((opt, idx) => ({
        index: idx,
        text: opt.text
        // Don't include is_correct in response
      }))
    }))

    return NextResponse.json({
      has_quiz: true,
      procedure: {
        id: procedure.id,
        title: procedure.title,
        slug: procedure.slug
      },
      questions: quizQuestions,
      total_questions: questions.length
    })

  } catch (error) {
    console.error('Error in GET /api/procedures/[slug]/quiz:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
