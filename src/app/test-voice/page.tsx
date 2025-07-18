'use client';

import { useState, useRef } from 'react';
import { Mic, MicOff, Play, RotateCcw } from 'lucide-react';

export default function VoiceTestPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      if (isRecording) {
        stopRecording();
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia non supportato su questo browser/protocollo. Usa HTTPS.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      setMediaStream(stream);
      
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/wav';
        }
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setMediaStream(null);
      };
      
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
          mediaRecorderRef.current.start();
          setIsRecording(true);
          
          const startTime = Date.now();
          timerRef.current = setInterval(() => {
            const duration = (Date.now() - startTime) / 1000;
            setRecordingDuration(duration);
            
            // Auto-stop at 60 seconds
            if (duration >= 60) {
              stopRecording();
            }
          }, 100);
        }
      }, 500);
      
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      let errorMessage = 'Errore sconosciuto';
      if (error?.name === 'NotAllowedError') {
        errorMessage = 'Permesso microfono negato. Vai in Safari > Preferenze > Siti web > Microfono';
      } else if (error?.name === 'NotFoundError') {
        errorMessage = 'Microfono non trovato';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      alert('Errore accesso microfono: ' + errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      }
    }
  };

  const transcribeWithAssemblyAI = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setTranscription('');
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const uploadResponse = await fetch('/api/assemblyai-upload', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const { audioUrl } = await uploadResponse.json();
      
      const transcribeResponse = await fetch('/api/assemblyai-transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          audioUrl,
          wordBoost: [
            'Zeiss', 'Essilor', 'Varilux', 'Ray-Ban', 'Oakley',
            'progressive', 'bifocali', 'antiriflesso', 'diottrie',
            'Crizal', 'Transitions', 'polarizzate', 'centratura',
            'DriveSafe', 'DuraVision', 'Holbrook', 'Aviator'
          ]
        })
      });
      
      if (!transcribeResponse.ok) {
        throw new Error('Transcription failed');
      }
      
      const { text } = await transcribeResponse.json();
      setTranscription(text);
      
      return text;
      
    } catch (error: any) {
      console.error('AssemblyAI error:', error);
      setTranscription(`ERRORE: ${error?.message || 'Errore sconosciuto'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const saveVoiceNote = async () => {
    if (!audioBlob) return;
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-note.webm');
    formData.append('addetto_nome', 'Test User');
    formData.append('cliente_riferimento', 'Test Cliente');
    formData.append('note_aggiuntive', 'Test note');
    formData.append('duration_seconds', recordingDuration.toString());
    
    try {
      const response = await fetch('/api/voice-notes', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Voice note saved:', result);
        alert('Nota vocale salvata con successo!');
        
        // Reset app per nuova sessione
        resetToNewSession();
      } else {
        const error = await response.json();
        console.error('❌ Voice note save error:', error);
        alert('Errore salvataggio: ' + error.error);
      }
    } catch (error) {
      console.error('❌ Voice note save error:', error);
      alert('Errore salvataggio nota vocale');
    }
  };

  const resetToNewSession = () => {
    // Reset tutti gli stati per una nuova sessione
    setAudioBlob(null);
    setTranscription('');
    setRecordingDuration(0);
    setIsRecording(false);
    setIsTranscribing(false);
    
    // Cleanup eventuali timer o stream attivi
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    
    // Reset audio chunks
    audioChunksRef.current = [];
  };

  const playAudio = () => {
    if (audioBlob && audioRef.current) {
      audioRef.current.src = URL.createObjectURL(audioBlob);
      audioRef.current.play();
    }
  };

  const resetTest = () => {
    setAudioBlob(null);
    setTranscription('');
    setRecordingDuration(0);
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎤 OB Voice - Test Note Vocali
          </h1>
          <p className="text-gray-600">
            Sistema voice notes per addetti vendita • Limite: 60 secondi
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Recording Panel */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Registrazione</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium mb-2">🎯 Workflow:</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <div>1. ✅ Registrazione audio (max 60s)</div>
                <div>2. ✅ Riascolto e conferma qualità</div>
                <div>3. ✅ Trascrizione messaggio</div>
                <div>4. ✅ Salvataggio in database</div>
              </div>
            </div>
            
            <div className="flex flex-col items-center space-y-4">
              <button
                onClick={startRecording}
                className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-2xl font-bold transition-all ${
                  isRecording 
                    ? 'bg-red-600 scale-110 shadow-lg animate-pulse' 
                    : 'bg-red-500 hover:bg-red-600 shadow-md'
                }`}
              >
                {isRecording ? <MicOff /> : <Mic />}
              </button>
              
              <div className="text-center">
                <div className="text-sm text-gray-600">
                  {isRecording ? 'Registrazione in corso...' : 'Clicca per registrare'}
                </div>
                {isRecording && (
                  <div className="text-2xl font-bold text-gray-700">
                    {recordingDuration.toFixed(1)}s
                    {recordingDuration > 50 && (
                      <span className="text-sm ml-2">STOP imminente!</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {audioBlob && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">🎵 Riascolta l'audio:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={playAudio}
                      className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={resetTest}
                      className="bg-red-500 text-white p-2 rounded-md hover:bg-red-600"
                      title="Cancella e registra di nuovo"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 mb-3">
                  Durata: {recordingDuration.toFixed(1)}s
                </div>
                
                <div className="bg-white border border-gray-200 rounded-md p-3">
                  <p className="text-sm text-gray-700 mb-3">
                    ✅ <strong>Se la registrazione si sente bene:</strong>
                  </p>
                  <button
                    onClick={() => transcribeWithAssemblyAI(audioBlob)}
                    disabled={isTranscribing}
                    className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:opacity-50 mb-3"
                  >
                    {isTranscribing ? 'Trascrizione...' : '📝 Trascrivi'}
                  </button>
                  
                  {transcription && (
                    <div className="mb-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-sm text-green-600 font-medium mb-2">
                          Trascrizione:
                        </div>
                        <div className="text-green-900 text-sm">
                          "{transcription}"
                        </div>
                      </div>
                      
                      <button
                        onClick={saveVoiceNote}
                        className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 mt-3"
                      >
                        💾 Salva
                      </button>
                    </div>
                  )}
                </div>
                
                <audio ref={audioRef} className="hidden" />
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Informazioni</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">📱 Sistema Voice Notes:</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>• Registrazione rapida richieste clienti</div>
                  <div>• Trascrizione automatica del messaggio</div>
                  <div>• Salvataggio per elaborazione manager</div>
                  <div>• Limite massimo: 60 secondi</div>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium mb-2">💡 Consigli:</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• Parla chiaramente e lentamente</div>
                  <div>• Menziona sempre il nome del cliente</div>
                  <div>• Descrivi brevemente la richiesta</div>
                  <div>• Controlla la trascrizione prima di salvare</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}