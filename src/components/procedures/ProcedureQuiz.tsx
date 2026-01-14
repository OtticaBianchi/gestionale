'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type QuizQuestion = {
  id: string
  question_number: number
  question_text: string
  difficulty: 'easy' | 'medium' | 'hard'
  options: {
    index: number
    text: string
  }[]
}

type QuizStatus = {
  is_passed: boolean
  total_attempts: number
  consecutive_failures: number
  requires_manager_review: boolean
  last_attempt_at: string | null
  last_passed_at: string | null
}

type ProcedureQuizProps = {
  procedureSlug: string
  procedureTitle: string
  onQuizPassed?: () => void
}

export default function ProcedureQuiz({
  procedureSlug,
  procedureTitle,
  onQuizPassed
}: ProcedureQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [status, setStatus] = useState<QuizStatus | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [canAttempt, setCanAttempt] = useState(true)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizResult, setQuizResult] = useState<any>(null)
  const [startTime, setStartTime] = useState<number | null>(null)

  useEffect(() => {
    fetchQuizData()
  }, [procedureSlug])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (cooldownSeconds > 0) {
      interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            setCanAttempt(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [cooldownSeconds])

  const fetchQuizData = async () => {
    try {
      setLoading(true)

      // Fetch quiz questions
      const questionsRes = await fetch(`/api/procedures/${procedureSlug}/quiz`)
      const questionsData = await questionsRes.json()

      if (!questionsData.has_quiz) {
        // No quiz for this procedure
        setLoading(false)
        return
      }

      setQuestions(questionsData.questions || [])

      // Fetch quiz status
      const statusRes = await fetch(`/api/procedures/${procedureSlug}/quiz/status`)
      const statusData = await statusRes.json()

      setStatus(statusData.status)
      setCanAttempt(statusData.can_attempt)
      setCooldownSeconds(statusData.cooldown_remaining_seconds || 0)

    } catch (error) {
      console.error('Error fetching quiz data:', error)
      toast.error('Errore nel caricamento del quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleStartQuiz = () => {
    setShowQuiz(true)
    setStartTime(Date.now())
    setQuizResult(null)
    setSelectedAnswers({})
  }

  const handleAnswerSelect = (questionNumber: number, optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionNumber]: optionIndex
    }))
  }

  const handleSubmitQuiz = async () => {
    // Validate all questions answered
    const allAnswered = questions.every(q => selectedAnswers[q.question_number] !== undefined)

    if (!allAnswered) {
      toast.error('Rispondi a tutte le domande prima di inviare')
      return
    }

    try {
      setSubmitting(true)

      const timeSpentSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : null

      const response = await fetch(`/api/procedures/${procedureSlug}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: selectedAnswers,
          time_spent_seconds: timeSpentSeconds
        })
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.cooldown_remaining_seconds) {
          setCooldownSeconds(result.cooldown_remaining_seconds)
          setCanAttempt(false)
          toast.error(result.error || 'Devi aspettare prima di riprovare')
        } else {
          toast.error(result.error || 'Errore nella sottomissione del quiz')
        }
        return
      }

      setQuizResult(result)

      if (result.passed) {
        toast.success('🎉 Quiz superato! Procedura confermata come letta')
        if (onQuizPassed) {
          onQuizPassed()
        }
      } else {
        if (result.requires_manager_review) {
          toast.error('Hai esaurito i tentativi. Contatta Valentina o Marco per un colloquio formativo.')
        } else {
          toast.error(`Quiz non superato. Tentativi rimasti: ${3 - result.consecutive_failures}`)
          setCooldownSeconds(3600) // 1 hour
          setCanAttempt(false)
        }
      }

      // Refresh status
      await fetchQuizData()
      setShowQuiz(false)

    } catch (error) {
      console.error('Error submitting quiz:', error)
      toast.error('Errore nell\'invio del quiz')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCooldownTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'hard':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return '🟢 Facile'
      case 'medium':
        return '🟡 Media'
      case 'hard':
        return '🔴 Difficile'
      default:
        return difficulty
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!questions || questions.length === 0) {
    return null // No quiz for this procedure
  }

  // Already passed
  if (status?.is_passed) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900 mb-1">
              Quiz Superato ✓
            </h3>
            <p className="text-green-700 text-sm">
              Hai completato con successo il quiz di verifica per questa procedura.
            </p>
            {status.last_passed_at && (
              <p className="text-green-600 text-xs mt-1">
                Superato il {new Date(status.last_passed_at).toLocaleDateString('it-IT')}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Requires admin review
  if (status?.requires_manager_review) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-orange-900 mb-1">
              Revisione Admin Richiesta
            </h3>
            <p className="text-orange-700 text-sm">
              Hai esaurito i 3 tentativi disponibili per questo quiz.
            </p>
            <p className="text-orange-600 text-sm mt-2">
              📚 Prima di riprovare, è necessario un colloquio formativo con <strong>Valentina o Marco</strong> per rivedere insieme la procedura.
            </p>
            <p className="text-orange-500 text-xs mt-2">
              Tentativi effettuati: {status.total_attempts}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">
            Quiz di Verifica Richiesto 📝
          </h3>
          <p className="text-blue-700 text-sm">
            Questa procedura richiede il superamento di un quiz per confermare la lettura.
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p className="text-blue-600">
              • <strong>{questions.length} domande</strong> a risposta multipla
            </p>
            <p className="text-blue-600">
              • Devi rispondere <strong>correttamente a tutte</strong> le domande
            </p>
            <p className="text-blue-600">
              • <strong>3 tentativi</strong> disponibili con <strong>1 ora di pausa</strong> tra un tentativo e l'altro
            </p>
            {status && status.total_attempts > 0 && (
              <p className="text-blue-700 font-medium mt-2">
                Tentativi effettuati: {status.total_attempts}/3
              </p>
            )}
          </div>
        </div>
      </div>

      {!canAttempt && cooldownSeconds > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
          <div className="flex items-center gap-2 text-yellow-800 text-sm">
            <Clock className="w-4 h-4" />
            <span>
              Prossimo tentativo disponibile tra: <strong>{formatCooldownTime(cooldownSeconds)}</strong>
            </span>
          </div>
        </div>
      )}

      {!showQuiz ? (
        <button
          onClick={handleStartQuiz}
          disabled={!canAttempt}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
            canAttempt
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canAttempt ? 'Inizia il Quiz' : 'Attendi prima di riprovare'}
        </button>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-4">
              Rispondi a tutte le domande:
            </h4>

            {questions.map((question, idx) => (
              <div key={question.id} className="mb-6 last:mb-0">
                <div className="flex items-start gap-2 mb-3">
                  <span className="font-bold text-gray-700">Domanda {question.question_number}.</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getDifficultyColor(question.difficulty)}`}>
                    {getDifficultyLabel(question.difficulty)}
                  </span>
                </div>
                <p className="text-gray-800 mb-3">{question.question_text}</p>

                <div className="space-y-2">
                  {question.options.map((option) => {
                    const isSelected = selectedAnswers[question.question_number] === option.index
                    return (
                      <label
                        key={option.index}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.question_number}`}
                          value={option.index}
                          checked={isSelected}
                          onChange={() => handleAnswerSelect(question.question_number, option.index)}
                          className="mt-1 flex-shrink-0"
                        />
                        <span className="text-gray-700">{option.text}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowQuiz(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Annulla
            </button>
            <button
              onClick={handleSubmitQuiz}
              disabled={submitting || Object.keys(selectedAnswers).length !== questions.length}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Invio...
                </>
              ) : (
                'Invia Risposte'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
