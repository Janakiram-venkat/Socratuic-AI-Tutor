import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../services/audioUtils';
import { BASE_SYSTEM_INSTRUCTION } from '../types';

interface Props {
  onXpGain: () => void;
}

const LiveTutor: React.FC<Props> = ({ onXpGain }) => {
  const [connected, setConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  
  // Refs for audio handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startSession = async () => {
    setError(null);
    setStatus('Initializing audio...');
    try {
      const apiKey = process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });

      // 1. Setup Audio Input
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        throw new Error("Microphone access denied. Please allow microphone permissions.");
      }
      streamRef.current = stream;
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // 2. Setup Audio Output
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      // Ensure context is running (sometimes browsers suspend it)
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      setStatus('Connecting to Gemini Live...');

      // 3. Connect Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: BASE_SYSTEM_INSTRUCTION + " You are in a voice conversation. Keep answers concise and conversational. If the student answers correctly, verbally praise them.",
        },
        callbacks: {
          onopen: () => {
            setConnected(true);
            setStatus('');
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              if (sessionRef.current) {
                  sessionRef.current.then(session => {
                      try {
                          session.sendRealtimeInput({ media: pcmBlob });
                      } catch (err) {
                          console.warn("Error sending audio input:", err);
                      }
                  }).catch(e => {
                      // Connection likely closed
                  });
              }
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current && audioContextRef.current.state !== 'closed') {
              setIsSpeaking(true);
              const ctx = audioContextRef.current;
              
              // Smooth playback: ensure next start time is at least now
              const currentTime = ctx.currentTime;
              if (nextStartTimeRef.current < currentTime) {
                  nextStartTimeRef.current = currentTime;
              }

              try {
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  ctx,
                  24000,
                  1
                );
                
                if (ctx.state === 'closed') return;

                const bufferSource = ctx.createBufferSource();
                bufferSource.buffer = audioBuffer;
                bufferSource.connect(ctx.destination);
                bufferSource.start(nextStartTimeRef.current);
                
                // Award XP for engagement on longer responses
                if (audioBuffer.duration > 2) {
                    onXpGain();
                }

                nextStartTimeRef.current += audioBuffer.duration;
                
                bufferSource.onended = () => {
                   if (ctx.state !== 'closed' && ctx.currentTime >= nextStartTimeRef.current - 0.1) {
                       setIsSpeaking(false);
                   }
                };
              } catch (e) {
                console.error("Audio decoding error:", e);
              }
            }
            
            if (msg.serverContent?.interrupted) {
              // Clear the audio queue if interrupted
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              // Note: We can't easily stop already scheduled nodes in standard Web Audio without tracking them all, 
              // but resetting nextStartTime handles the logical flow.
            }
          },
          onclose: () => {
            setConnected(false);
            cleanup();
            setStatus('');
          },
          onerror: (e) => {
            console.error(e);
            setError("Connection error. The session may have timed out.");
            cleanup();
            setStatus('');
          }
        }
      });
      
      sessionPromise.catch(e => {
          console.error("Failed to establish Live session:", e);
          setError("Could not connect to Gemini Live. Please check your network.");
          cleanup();
          setStatus('');
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initialize audio.");
      cleanup();
      setStatus('');
    }
  };

  const cleanup = () => {
    setStatus('');
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    
    if (inputContextRef.current) {
        if (inputContextRef.current.state !== 'closed') {
            inputContextRef.current.close().catch(e => console.warn(e));
        }
        inputContextRef.current = null;
    }
    
    if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
             audioContextRef.current.close().catch(e => console.warn(e));
        }
        audioContextRef.current = null;
    }
    
    sessionRef.current = null;
    setConnected(false);
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-2xl relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-3xl mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-3xl mix-blend-screen animate-pulse delay-1000"></div>
      </div>

      <div className="z-10 max-w-lg w-full">
        <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
           <span className="material-symbols-rounded">graphic_eq</span> Socratic Live Mode
        </h2>
        <p className="text-slate-300 mb-10 text-lg">
          Real-time voice conversation. I'm listening.
        </p>

        {!connected ? (
          <div className="flex flex-col items-center">
            <button
                onClick={startSession}
                disabled={!!status}
                className={`group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-blue-600 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 hover:bg-blue-500 hover:scale-105 ${status ? 'opacity-70 cursor-wait' : ''}`}
            >
                {status || (error ? 'Retry Connection' : 'Start Conversation')}
                <div className="absolute -inset-3 rounded-full bg-blue-400 opacity-20 group-hover:opacity-40 blur-lg transition-opacity duration-200" />
            </button>
            
            {error && (
                <div className="mt-6 flex items-center space-x-2 text-red-300 bg-red-900/30 px-4 py-2 rounded-lg border border-red-800">
                    <span className="material-symbols-rounded">error</span>
                    <span>{error}</span>
                </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-8 animate-fade-in">
            <div className={`relative flex items-center justify-center w-40 h-40 rounded-full border-4 transition-all duration-300 ${isSpeaking ? 'border-green-400 shadow-[0_0_50px_rgba(74,222,128,0.6)] scale-110' : 'border-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.5)]'}`}>
               <div className={`w-32 h-32 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center`}>
                  {isSpeaking ? (
                     <div className="flex space-x-1 items-end h-16">
                        <div className="w-2 bg-green-400 rounded-full animate-[bounce_1s_infinite] h-8"></div>
                        <div className="w-2 bg-green-400 rounded-full animate-[bounce_1.2s_infinite] h-12"></div>
                        <div className="w-2 bg-green-400 rounded-full animate-[bounce_0.8s_infinite] h-6"></div>
                        <div className="w-2 bg-green-400 rounded-full animate-[bounce_1.1s_infinite] h-10"></div>
                     </div>
                  ) : (
                     <span className="material-symbols-rounded text-6xl text-blue-200 animate-pulse">mic</span>
                  )}
               </div>
               
               {/* Ripple effect */}
               {!isSpeaking && <div className="absolute inset-0 rounded-full border border-white/20 animate-ping"></div>}
            </div>

            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10">
              <p className="text-sm font-medium text-blue-200 uppercase tracking-widest flex items-center gap-2">
                {isSpeaking ? (
                    <>
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        AI is speaking...
                    </>
                ) : (
                    <>
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                        Listening to you...
                    </>
                )}
              </p>
            </div>

            <button 
              onClick={cleanup}
              className="mt-8 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-2 rounded-full text-sm font-semibold transition-colors border border-red-500/20"
            >
              End Session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTutor;