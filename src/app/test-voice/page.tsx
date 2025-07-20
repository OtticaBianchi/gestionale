'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Pause, Square, RotateCcw, FileText, Save, CheckCircle, Info, X } from 'lucide-react';

const OBVoiceInterface = () => {
  // Stati principali
  const [currentStep, setCurrentStep] = useState('guide');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [showGuide, setShowGuide] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Refs per la gestione audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Timer countdown durante la registrazione
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      setCountdown(60); // Inizia da 60
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            stopRecording();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(60); // Reset quando non registra
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Hydration fix
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
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
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        setCurrentStep('recorded');
        
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setMediaStream(null);
      };
      
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
          mediaRecorderRef.current.start();
          setIsRecording(true);
          setCurrentStep('recording');
          
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
      }, 100);
      
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      let errorMessage = 'Errore sconosciuto';
      if (error?.name === 'NotAllowedError') {
        errorMessage = 'Permesso microfono negato. Controlla le impostazioni del browser.';
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

  const transcribeWithAssemblyAI = async () => {
    if (!audioBlob) return;
    
    setIsTranscribing(true);
    setCurrentStep('transcribing');
    setTranscription('');
    setTranscriptionError('');
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const uploadResponse = await fetch('/api/assemblyai-upload', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(`Upload failed: ${errorData.error || uploadResponse.statusText}`);
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
            // Brand principali
            'Zeiss', 'Essilor', 'Hoya', 'Ray-Ban', 'Oakley', 'Persol', 'Prada', 'Gucci', 'Versace',
            'Tom Ford', 'Armani', 'Dolce e Gabbana', 'Chanel', 'Brunello Cucinelli', 'Swarovski', 'Luxottica',
            'Ultra Limited', 'Serengeti', 'Bollé', 'Miu miu', 'Rudy Project', 'Garmin', 'CEP', 'Craft', 'Umbrail', 
            'Meta', 'Nuance', 'Assoluto', 'Arnette', 'Vogue', 'Bulgari', 'Michael Kors', 'Centro Stile', 'BluOptical',
            
            // Lenti e trattamenti
            'progressive', 'progressivi', 'bifocali', 'multifocali', 'monofocali', 'antiriflesso', 'Office', 'toriche',
            'Crizal', 'Transitions', 'polarizzate', 'fotocromatiche', 'Blue Control', 'DriveSafe', 'A supporto accomodativo',
            'DuraVision', 'Anti Luce Blu', 'UV Protection', 'Eyezen', 'Computer', 'Relax', 'Varilux', 'Varilux', 'MiyoSmart',
            'Mirror', 'A specchio', 'Hoyalux', 'PhotoFusion', 'PhotoFusion X',
            
            // Misure e termini tecnici
            'diottrie', 'centratura', 'distanza pupillare', 'calibro', 'glaucoma',
            'cilindro', 'asse', 'addizione', 'prisma', 'sferico', 'astigmatismo',
            'miopia', 'ipermetropia', 'presbiopia', 'ambliopia', 'strabismo', 'cataratta',
            
            // Materiali e forme
            'acetato', 'titanio', 'metallo', 'plastica', 'nylon', 'TR90', 'alluminio',
            'aviator', 'wayfarer', 'cat eye', 'rotonda', 'quadrata', 'rettangolare',
            'Holbrook', 'Clubmaster', 'Frogskins', 'glasant',
          
            // Parti dell'occhiale
            'montatura', 'lente', 'nasello', 'plaquette', 'terminale', 'flex',
            'cerniera', 'vite', 'stanghetta', 'frontale', 'ponte', 'asta',
            
            // Servizi ottici
            'controllo vista', 'esame visivo', 'refrazione', 'tonometria', 'pachimetria',
            'campo visivo', 'OCT', 'retinografia', 'autorefrazione', 'ortochertologia', 'cheratocono',
          ]
        })
      });
      
      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}));
        throw new Error(`Transcription failed: ${errorData.error || transcribeResponse.statusText}`);
      }
      
      const { text } = await transcribeResponse.json();
      if (!text || text.trim() === '') {
        throw new Error('Trascrizione vuota - prova a parlare più chiaramente');
      }
      
      setTranscription(text);
      setCurrentStep('transcribed');
      
    } catch (error: any) {
      console.error('AssemblyAI error:', error);
      const errorMessage = error?.message || 'Errore sconosciuto durante la trascrizione';
      setTranscriptionError(errorMessage);
      setCurrentStep('transcription_error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const saveVoiceNote = async () => {
    if (!audioBlob) return;
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-note.webm');
    formData.append('addetto_nome', 'OB Voice');
    formData.append('cliente_riferimento', '');
    formData.append('note_aggiuntive', transcription || '');
    formData.append('duration_seconds', recordingDuration.toString());
    
    try {
      const response = await fetch('/api/voice-notes', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Voice note saved:', result);
        setShowSuccessMessage(true);
        setCurrentStep('saved');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Voice note save error:', errorData);
        alert('Errore salvataggio: ' + (errorData.error || 'Errore sconosciuto'));
      }
    } catch (error: any) {
      console.error('❌ Voice note save error:', error);
      alert('Errore salvataggio nota vocale: ' + (error?.message || 'Errore di rete'));
    }
  };

  const resetToNewSession = () => {
    // Stop any playing audio first
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    
    setAudioBlob(null);
    setTranscription('');
    setTranscriptionError('');
    setRecordingDuration(0);
    setIsRecording(false);
    setIsTranscribing(false);
    setCurrentStep('ready');
    setCountdown(60);
    setShowGuide(false);
    setShowSuccessMessage(false);
    
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
    
    audioChunksRef.current = [];
  };

  const playAudio = async () => {
    if (audioBlob && audioRef.current) {
      try {
        const audioUrl = URL.createObjectURL(audioBlob);
        audioRef.current.src = audioUrl;
        
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audioRef.current.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(audioUrl);
          alert('Errore nella riproduzione audio');
        };
        
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
        alert('Errore nella riproduzione audio');
      }
    }
  };

  const reRecord = () => {
    // Stop any playing audio first
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    
    setCurrentStep('ready');
    setAudioBlob(null);
    setTranscription('');
    setTranscriptionError('');
    setRecordingDuration(0);
    setCountdown(60);
    setShowSuccessMessage(false);
  };

  const formatTime = (seconds: number) => {
    return seconds.toString().padStart(2, '0');
  };

  const closeApp = () => {
    // Try to close the window/tab
    window.close();
    // If that doesn't work (some browsers prevent it), show alternative
    setTimeout(() => {
      alert('Puoi chiudere manualmente questa scheda del browser');
    }, 100);
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-br from-gray-50 to-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-6 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">OB Voice</h1>
          <p className="text-blue-100 text-sm">Tu parli, Noi scriviamo</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        
        {/* Guida Iniziale */}
        {showGuide && currentStep === 'guide' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Info className="w-7 h-7 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Come utilizzare OB Voice</h3>
            </div>
            <ul className="space-y-4 text-base text-gray-700">
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">1</span>
                <span className="leading-relaxed">Premi il pulsante di registrazione e parla chiaramente</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">2</span>
                <span className="leading-relaxed">Riascolta l'audio per verificare la qualità</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">3</span>
                <span className="leading-relaxed">Avvia la trascrizione automatica</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5 flex-shrink-0">4</span>
                <span className="leading-relaxed">Salva la nota nel gestionale</span>
              </li>
            </ul>
            <button 
              onClick={() => {
                setShowGuide(false);
                setCurrentStep('ready');
              }}
              disabled={!isHydrated}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 rounded-lg text-lg font-medium transition-colors"
            >
              {isHydrated ? 'Inizia' : 'Caricamento...'}
            </button>
          </div>
        )}

        {/* Pulsante Registrazione con Timer */}
        {!showGuide && (
          <div className="text-center space-y-6">
            <div className="relative inline-block">
              {/* Pulsante Microfono con Timer al Centro */}
              <div className={`relative w-40 h-40 rounded-full border-8 transition-all duration-300 ${
                isRecording 
                  ? 'border-red-500 bg-red-50 shadow-lg animate-pulse' 
                  : audioBlob
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-blue-500 bg-blue-50 hover:bg-blue-100 shadow-md'
              }`}>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  className="w-full h-full rounded-full flex flex-col items-center justify-center"
                >
                  {/* Timer al Centro */}
                  <div className={`text-3xl font-mono font-bold mb-1 ${
                    isRecording ? 'text-red-600' : audioBlob ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {formatTime(isRecording ? countdown : 60)}
                  </div>
                  
                  {/* Icona Microfono */}
                  {isRecording ? (
                    <Square className="w-8 h-8 text-red-600" />
                  ) : (
                    <Mic className={`w-8 h-8 ${audioBlob ? 'text-green-600' : 'text-blue-600'}`} />
                  )}
                </button>
                
                {/* Indicatore Recording */}
                {isRecording && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-ping">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              
              {/* Status Text */}
              <p className="mt-4 text-lg font-medium text-gray-900">
                {isRecording ? 'Registrando...' : 
                 audioBlob ? 'Registrazione completata' : 
                 'Tocca per registrare'}
              </p>
              <p className="text-sm text-gray-500">
                Limite: 60 secondi
              </p>
            </div>
          </div>
        )}

        {/* Controlli Audio */}
        {audioBlob && currentStep !== 'transcribing' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Controlli Audio
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={playAudio}
                disabled={isPlaying}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isPlaying ? 'In riproduzione' : 'Riascolta'}
              </button>
              
              <button 
                onClick={reRecord}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-5 h-5" />
                Ri-registra
              </button>
            </div>
            
            {currentStep === 'recorded' && (
              <button 
                onClick={transcribeWithAssemblyAI}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Avvia Trascrizione
              </button>
            )}
          </div>
        )}

        {/* Stato Trascrizione */}
        {currentStep === 'transcribing' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Trascrizione in corso...</h3>
              <p className="text-sm text-gray-500">Elaborazione del contenuto audio</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
          </div>
        )}

        {/* Errore Trascrizione */}
        {currentStep === 'transcription_error' && (
          <div className="bg-white border border-red-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-sm font-bold">!</span>
              </div>
              <h3 className="font-semibold text-red-800">Errore Trascrizione</h3>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-red-700 text-sm leading-relaxed">{transcriptionError}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={transcribeWithAssemblyAI}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Riprova
              </button>
              
              <button 
                onClick={reRecord}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                <Mic className="w-5 h-5" />
                Ri-registra
              </button>
            </div>
            
            <button 
              onClick={resetToNewSession}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Ricomincia da capo
            </button>
          </div>
        )}

        {/* Risultato Trascrizione */}
        {currentStep === 'transcribed' && transcription && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Trascrizione Completata</h3>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-800 leading-relaxed">{transcription}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={transcribeWithAssemblyAI}
                className="flex items-center justify-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Riprova trascrizione
              </button>
              
              <button 
                onClick={reRecord}
                className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                <Mic className="w-4 h-4" />
                Ri-registra
              </button>
            </div>
            
            <button 
              onClick={saveVoiceNote}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <Save className="w-6 h-6" />
              Salva Nota
            </button>
          </div>
        )}

        {/* Messaggio di Successo */}
        {currentStep === 'saved' && (
          <div className="bg-white border border-green-200 rounded-xl p-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-xl font-bold text-green-800 mb-2">Nota Salvata!</h3>
              <p className="text-green-700 text-sm">
                La tua nota vocale è stata salvata con successo nel gestionale.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button 
                onClick={resetToNewSession}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                <Mic className="w-5 h-5" />
                Nuova Nota
              </button>
              
              <button 
                onClick={closeApp}
                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                <X className="w-5 h-5" />
                Chiudi App
              </button>
            </div>
            
            <p className="text-xs text-gray-500 pt-2">
              La app si chiuderà automaticamente dopo aver salvato la nota
            </p>
          </div>
        )}

        {/* Info Footer */}
        {!showGuide && (
          <div className="text-center pt-4">
            <p className="text-xs text-gray-500">
              OB Voice • OB VisionHub
            </p>
          </div>
        )}

        {/* Audio Element */}
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
};

export default OBVoiceInterface;