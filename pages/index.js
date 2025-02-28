import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/Home.module.css';
import Head from 'next/head';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 60 saniye
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Timer for useEffect
  useEffect(() => {
    let timer = null;
    
    if (isRecording && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, timeLeft]);

  // Scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Use Web Speech API for speech recognition
  const startListening = () => {
    try {
      setError('');
      setTranscript(''); // Clear previous transcription
      
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        setError('Tarayıcınız konuşma tanıma özelliğini desteklemiyor.');
        return;
      }
      
      // If there is a previous recognition instance, clear it first
      if (window.recognition) {
        try {
          window.recognition.stop();
          window.recognition.onend = null;
          window.recognition.onresult = null;
          window.recognition.onerror = null;
        } catch (e) {
          console.log('Error clearing previous recognition instance:', e);
        }
      }
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US'; // Better recognition for English
      recognition.continuous = true;
      recognition.interimResults = true; // Show interim results
      recognition.maxAlternatives = 1;
      
      // Combine all results into an array
      let finalTranscript = '';
      let lastProcessedIndex = 0;
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        
        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            lastProcessedIndex = i + 1;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Show both final and interim results
        setTranscript(finalTranscript + interimTranscript);
        
        // Send automatically when speech pause is detected
        if (finalTranscript && finalTranscript.trim() !== '' && event.results.length > 0 && event.results[event.results.length - 1].isFinal) {
          // Send when the last sentence is complete and there is 1.5 seconds of silence
          clearTimeout(window.autoSendTimeout);
          window.autoSendTimeout = setTimeout(() => {
            if (finalTranscript.trim() !== '') {
              sendMessage(finalTranscript);
              finalTranscript = '';
              setTranscript('');
            }
          }, 1500); // Send after 1.5 seconds of silence
        }
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        
        // Error in network connection, more user-friendly message
        if (event.error === 'network') {
          setError("Network connection issue. Please check your internet connection and try again. Speech recognition works best in Chrome.");
        } else {
          setError(`Speech recognition error: ${event.error}. Speech recognition works best in Chrome.`);
        }
        
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended');
        if (isRecording) {
          // If still recording, restart
          try {
            // Short delay to restart (to avoid resource issues)
            setTimeout(() => {
              try {
                recognition.start();
                console.log('Speech recognition restarted');
              } catch (e) {
                console.error('Speech recognition restart failed:', e);
                setIsRecording(false);
                setError('Speech recognition restart failed. Please refresh the page.');
              }
            }, 300);
          } catch (e) {
            console.error('Speech recognition restart failed:', e);
            setIsRecording(false);
          }
        }
      };
      
      // Store as a global variable so it can be accessed in stopListening
      window.recognition = recognition;
      
      // Short delay to start (to avoid resource issues)
      setTimeout(() => {
        try {
          recognition.start();
          setIsRecording(true);
          setTimeLeft(60); // Reset timer
          console.log('Speech recognition started');
        } catch (e) {
          console.error('Speech recognition start failed:', e);
          setError('Speech recognition start failed. Please refresh the page.');
        }
      }, 100);
    } catch (error) {
      console.error('Speech recognition start failed:', error);
      setError('Speech recognition start failed. Please use manual text input.');
    }
  };

  const stopListening = () => {
    clearTimeout(window.autoSendTimeout);
    if (window.recognition) {
      try {
        window.recognition.stop();
      } catch (e) {
        console.error('Konuşma tanıma durdurulurken hata:', e);
      }
    }
    setIsRecording(false);
  };

  const transcribeAudio = async (audioBlob) => {
    setIsThinking(true);
    
    try {
      // Prepare audio file as FormData
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      // Send audio file to server
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Speech recognition service did not respond');
      }
      
      const data = await response.json();
      setTranscript(data.transcript);
      console.log('Transcript:', data.transcript);
    } catch (error) {
      console.error('Speech recognition error:', error);
      setError('Speech recognition error occurred. Please use manual text input.');
    } finally {
      setIsThinking(false);
    }
  };

  // Message sending function (transcript parameter is optional)
  const sendMessage = async (text = null) => {
    const messageText = text || transcript;
    if (!messageText.trim()) return;
    
    const userMessage = messageText;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    if (!text) { // Clean transcript in manual sending
      setTranscript('');
    }
    
    setIsThinking(true);
    
    try {
      // Fetch operation with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (increased)
      
      let response;
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userMessage }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.log('Request timed out, using fallback response');
          
          // Fallback response in case of timeout
          const fallbackResponse = "I'm still processing your request. Could you please repeat your question or ask something else?";
          
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: fallbackResponse
          }]);
          
          // Speak fallback response
          if ('speechSynthesis' in window) {
            const fallbackUtterance = new SpeechSynthesisUtterance(fallbackResponse);
            fallbackUtterance.lang = 'en-US';
            window.speechSynthesis.speak(fallbackUtterance);
            
            // Speak fallback response after it's read
            fallbackUtterance.onend = () => {
              if (!isRecording) {
                startListening();
              }
            };
          }
          
          setIsThinking(false);
          return; // Exit function
        }
        
        // Throw other fetch errors
        throw fetchError;
      }
      
      // Read the response once and assign to a variable
      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Error parsing response');
      }
      
      const aiResponse = responseData.response;
      const responseLanguage = responseData.language || 'en';
      
      if (!aiResponse) {
        throw new Error('Invalid API response');
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      
      // Text-to-speech
      if ('speechSynthesis' in window) {
        // Stop speech (if ongoing)
        window.speechSynthesis.cancel();
        
        // Split long responses into smaller chunks
        const splitResponse = (text, maxLength = 100) => {
          // Split by sentences first
          const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
          const chunks = [];
          
          let currentChunk = '';
          for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= maxLength) {
              currentChunk += sentence;
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = sentence;
            }
          }
          
          if (currentChunk) chunks.push(currentChunk);
          return chunks;
        };
        
        const textChunks = splitResponse(aiResponse);
        let chunkIndex = 0;
        
        // Function to speak the next chunk
        const speakNextChunk = () => {
          if (chunkIndex < textChunks.length) {
            const chunk = textChunks[chunkIndex];
            const utterance = new SpeechSynthesisUtterance(chunk);
            
            // Set language-specific settings
            utterance.lang = responseLanguage === 'en' ? 'en-US' : 'tr-TR';
            utterance.rate = 1.0;  // Normal speed
            utterance.pitch = 1.0; // Normal pitch
            utterance.volume = 1.0; // Full volume
            
            // When this chunk ends, speak the next one
            utterance.onend = () => {
              chunkIndex++;
              if (chunkIndex < textChunks.length) {
                speakNextChunk();
              } else {
                // All chunks spoken, restart listening
                if (!isRecording) {
                  startListening();
                }
              }
            };
            
            // Select voice
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              if (responseLanguage === 'en') {
                const englishVoice = voices.find(voice => 
                  voice.lang.includes('en') && voice.name.includes('Female')
                );
                utterance.voice = englishVoice || voices.find(voice => voice.lang.includes('en')) || voices[0];
              } else {
                const turkishVoice = voices.find(voice => 
                  voice.lang.includes('tr') && voice.name.includes('Female')
                );
                utterance.voice = turkishVoice || voices.find(voice => voice.lang.includes('tr')) || voices[0];
              }
            }
            
            window.speechSynthesis.speak(utterance);
          }
        };
        
        // Handle voices loading
        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => {
            speakNextChunk();
          };
        } else {
          speakNextChunk();
        }
      }
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error);
      
      // Show error message
      setError(`Error: ${error.message}`);
      
      // Show error message to user and restart listening
      const errorMessage = "I'm sorry, I'm experiencing a connection issue. Please try again.";
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: errorMessage
      }]);
      
      // Speak error message
      if ('speechSynthesis' in window) {
        const errorUtterance = new SpeechSynthesisUtterance(errorMessage);
        errorUtterance.lang = 'en-US';
        window.speechSynthesis.speak(errorUtterance);
        
        // Speak error message after it's read
        errorUtterance.onend = () => {
          if (!isRecording) {
            startListening();
          }
        };
      }
    } finally {
      setIsThinking(false);
    }
  };

  // Manual input sending function
  const sendManualInput = () => {
    if (!manualInput.trim()) return;
    
    sendMessage(manualInput);
    setManualInput('');
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>SeekVoice</title>
        <meta name="description" content="AI Voice Assistant" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <main className={styles.main}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoContainer}>
            <svg width="30" height="22" viewBox="0 0 378 278" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.logoIcon}>
              <path d="M373.155 23.325C373.152 23.3217 373.148 23.3188 373.143 23.3167C369.148 21.3741 367.429 25.091 365.09 26.9799C364.3 27.5999 363.62 28.4099 362.95 29.1199C357.1 35.3799 350.28 39.4799 341.38 38.9799C339.683 38.8876 338.019 38.8764 336.386 38.949C322.734 39.5556 300.266 33.5464 287.79 27.9699V27.9699C282.25 25.5199 276.66 23.0699 272.8 17.7399C270.09 13.9599 269.36 9.73995 267.99 5.57995C267.14 3.06995 266.27 0.489947 263.39 0.0599467C260.26 -0.440053 259.03 2.19995 257.81 4.39995C252.88 13.3899 250.99 23.3199 251.16 33.3699C251.59 55.9499 261.13 73.9299 280.05 86.7399C282.21 88.1999 282.76 89.6899 282.08 91.8299C280.79 96.2299 279.26 100.51 277.89 104.92C277.04 107.74 275.75 108.36 272.74 107.12C262.35 102.78 253.37 96.3599 245.45 88.5699C231.99 75.5499 219.82 61.1599 204.64 49.8999V49.8999C197.633 44.7181 188.456 39.923 187.607 31.2494C186.665 21.6358 196.931 14.6564 199.91 13.5899C204.16 12.0699 201.38 6.79995 187.68 6.85995C173.99 6.91995 161.44 11.5099 145.47 17.6199V17.6199C140.785 19.4818 135.609 19.2176 130.613 18.5393C118.449 16.8873 105.891 16.7146 92.86 18.1799C63.24 21.4999 39.58 35.5199 22.18 59.4599C1.29003 88.1999 -3.62997 120.88 2.39003 155C8.72003 190.91 27.03 220.68 55.19 243.94C84.37 268.04 117.99 279.85 156.34 277.59C173.108 276.632 191.25 274.742 211.012 264.51C226.553 256.464 245.354 253.074 262.79 254.58V254.58C272.68 255.51 282.2 254.08 289.58 252.56C301.13 250.11 300.33 239.41 296.16 237.43V237.43C278.214 229.069 274.782 211.146 286.255 195.012C298.41 177.92 310.174 153.835 316.26 112.7C317.05 107.24 316.37 103.83 316.26 99.3999C316.2 96.7299 316.8 95.6799 319.87 95.3699C328.35 94.4099 336.59 92.0799 344.15 87.8999C366.09 75.8999 374.93 56.2099 377.02 32.5699C377.33 28.972 376.96 25.2241 373.166 23.3331C373.162 23.331 373.158 23.3283 373.155 23.325V23.325ZM181.96 235.965C181.96 235.967 181.958 235.968 181.956 235.967C149.129 210.139 133.22 201.64 126.65 202.01C120.51 202.35 121.61 209.39 122.96 213.98C124.37 218.51 126.22 221.64 128.81 225.61C130.59 228.25 131.82 232.18 127.03 235.1C116.46 241.68 98.08 232.9 97.21 232.46C75.83 219.87 57.95 203.22 45.34 180.45C38.4604 168.048 33.2099 155.138 29.7372 141.72C27.8891 134.58 27.2399 116.982 34.5 115.68V115.68V115.68C51.0424 112.63 57.9187 111.375 66.1683 126.034C88.2184 165.217 121.809 123.225 142.37 143.64C156.02 157.19 166.34 173.35 176.98 189.13C188.28 205.91 200.46 221.88 215.95 234.97V234.97C220.374 238.689 218.132 246.514 212.364 246.157C202.044 245.519 190.757 242.931 181.964 235.963C181.962 235.962 181.96 235.963 181.96 235.965V235.965ZM197.69 134.65C197.69 131.95 199.84 129.81 202.56 129.81C203.16 129.81 203.72 129.93 204.22 130.12C204.89 130.37 205.51 130.74 205.99 131.3C206.86 132.14 207.35 133.38 207.35 134.65C207.35 137.35 205.2 139.49 202.5 139.49C199.8 139.49 197.69 137.35 197.69 134.65ZM246.545 159.775C246.546 159.774 246.545 159.772 246.544 159.773C243.416 161.041 240.288 162.16 237.28 162.28C232.61 162.5 227.51 160.6 224.73 158.28C220.43 154.68 217.37 152.67 216.06 146.34C215.52 143.64 215.83 139.49 216.31 137.1C217.43 131.95 216.19 128.66 212.57 125.66C209.61 123.21 205.87 122.56 201.75 122.56C200.21 122.56 198.8 121.88 197.75 121.32C196.03 120.45 194.62 118.31 195.97 115.68C196.4 114.84 198.5 112.76 198.99 112.39C204.57 109.2 211.02 110.25 216.99 112.64C222.53 114.9 226.7 119.06 232.71 124.92C238.87 132.02 239.97 134.01 243.47 139.31C246.23 143.5 248.76 147.78 250.48 152.68C251.519 155.718 250.172 158.227 246.547 159.777C246.545 159.778 246.544 159.776 246.545 159.775V159.775Z" fill="#007AFF"/>
            </svg>
            <span className={styles.logoText}>
              Seek<span className={styles.logoHighlight}>Voice</span>
            </span>
          </div>
        </div>
        
        {/* Visualizer */}
        <div className={`${styles.visualizer} ${isRecording ? styles.visualizerActive : ''} ${isSpeaking ? styles.visualizerSpeaking : ''} ${isThinking ? styles.visualizerThinking : ''}`}>
          <div className={styles.waveContainer}>
            <div className={styles.wave}></div>
            <div className={styles.wave}></div>
            <div className={styles.wave}></div>
          </div>
          <div className={styles.innerCircle}>
            <button
              className={`${styles.micButton} ${isRecording ? styles.recording : ''} ${isSpeaking ? styles.speaking : ''} ${isThinking ? styles.thinking : ''}`}
              onClick={isRecording ? stopListening : startListening}
              aria-label={isRecording ? "Stop listening" : "Start listening"}
              disabled={isThinking}
            >
              {isThinking ? (
                <div className={styles.thinkingIndicator}>
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
              ) : isRecording ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              ) : isSpeaking ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12ZM14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 14C13.66 14 14.99 12.66 14.99 11L15 5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14ZM17.3 11C17.3 14 14.76 16.1 12 16.1C9.24 16.1 6.7 14 6.7 11H5C5 14.41 7.72 17.23 11 17.72V21H13V17.72C16.28 17.23 19 14.41 19 11H17.3Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {isThinking && (
          <div className={styles.statusText}>
            AI is thinking...
          </div>
        )}

        {isSpeaking && messages.length > 0 && !isThinking && (
          <div className={styles.statusText}>
            {messages[messages.length - 1].content}
          </div>
        )}

        {isRecording && transcript && (
          <div className={styles.transcript}>
            {transcript}
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        
        {/* Creator info */}
        <div className={styles.creatorInfo}>
          <div className={styles.creatorName}>Yusuf Mescioğlu</div>
          <div className={styles.creatorLinks}>
            <a href="https://github.com/mesci" target="_blank" rel="noopener noreferrer">github.com/mesci</a>
            <a href="https://mesci.dev" target="_blank" rel="noopener noreferrer">mesci.dev</a>
          </div>
        </div>
      </main>
    </div>
  );
}