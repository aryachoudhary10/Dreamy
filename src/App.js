/* global __initial_auth_token, __app_id, __firebase_config */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Save, Loader, Image as ImageIcon, Palette, Feather, BookOpen, X, Menu, BrainCircuit } from 'lucide-react';
import * as Tone from 'tone';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};
const appId = firebaseConfig.appId;

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [dreamInput, setDreamInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState(null);
    const [currentView, setCurrentView] = useState('home'); // 'home', 'gallery', 'dream'
    const [gallery, setGallery] = useState([]);
    const [selectedDream, setSelectedDream] = useState(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [notification, setNotification] = useState('');

    // --- Firebase State ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // --- Audio Refs for Tone.js ---
    const synthRef = useRef(null);
    const noiseRef = useRef(null);
    const reverbRef = useRef(null);
    const playerStateRef = useRef({ isPlaying: false });

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        if (Object.keys(firebaseConfig).length > 0 && firebaseConfig.apiKey) {
            try {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firestoreAuth = getAuth(app);
                setDb(firestoreDb);
                setAuth(firestoreAuth);

                onAuthStateChanged(firestoreAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        try {
                           // Using anonymous sign-in as a fallback for local dev
                           await signInAnonymously(firestoreAuth);
                        } catch (error) {
                            console.error("Authentication Error:", error);
                            setErrorMessage("Could not connect to the server. Please refresh.");
                        }
                    }
                    setIsAuthReady(true);
                });
            } catch (error) {
                 console.error("Firebase Initialization Error:", error);
                 setErrorMessage("Failed to initialize the application. Please check your Firebase config.");
            }
        } else {
            console.log("Firebase config is missing or incomplete.");
            setErrorMessage("Application configuration is missing.");
        }
    }, []);
    useEffect(() => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
            console.log('Service Worker registered:', registration);
            })
            .catch(error => {
            console.error('Service Worker registration failed:', error);
            });
        });
    }
}, []);
    // --- Firestore Gallery Listener ---
    useEffect(() => {
        if (isAuthReady && db && userId) {
            const dreamsCollectionPath = `artifacts/${appId}/users/${userId}/dreams`;
            const q = query(collection(db, dreamsCollectionPath));
            
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const dreams = [];
                querySnapshot.forEach((doc) => {
                    const docData = doc.data();
                    const images = [];
                    // Try to fetch images from local storage
                    for(let i = 0; i < (docData.imageCount || 0); i++) {
                        const localImage = localStorage.getItem(`${doc.id}-${i}`);
                        images.push(localImage || `https://placehold.co/512x512/0d0c22/F6F6F6?text=Image+Missing`);
                    }

                    dreams.push({ 
                        id: doc.id, 
                        ...docData,
                        images: images
                    });
                });
                // Sort dreams by timestamp, newest first
                setGallery(dreams.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
            }, (error) => {
                console.error("Error fetching gallery:", error);
                setErrorMessage("Could not load your dream gallery.");
            });

            return () => unsubscribe();
        }
    }, [isAuthReady, db, userId]);

    // --- Tone.js Audio Setup ---
    const setupAudio = useCallback(() => {
        if (!synthRef.current) {
            reverbRef.current = new Tone.Reverb(5).toDestination();
            synthRef.current = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'fatsine' },
                envelope: { attack: 2, decay: 1, sustain: 0.4, release: 4 }
            }).connect(reverbRef.current);
            noiseRef.current = new Tone.Noise('pink').set({ volume: -20, fadeOut: 2 }).connect(reverbRef.current);
        }
    }, []);

    const stopSound = useCallback(() => {
        if (playerStateRef.current.isPlaying) {
            synthRef.current?.releaseAll();
            noiseRef.current?.stop();
            playerStateRef.current.isPlaying = false;
        }
    }, []);

    const playSound = useCallback((soundType) => {
        setupAudio();
        if (Tone.context.state !== 'running') {
            Tone.context.resume();
        }
        
        stopSound();
        playerStateRef.current.isPlaying = true;

        switch (soundType) {
            case 'Calm':
                synthRef.current?.triggerAttackRelease(['C4', 'E4', 'G4'], '8n');
                noiseRef.current?.start().stop('+4');
                break;
            case 'Mysterious':
                synthRef.current?.triggerAttackRelease(['C3', 'D#3', 'G3', 'A#3'], '4n');
                break;
            case 'Ethereal':
                synthRef.current?.triggerAttackRelease(['C5', 'E5', 'G5', 'B5'], '2n');
                break;
            case 'Melancholy':
                synthRef.current?.triggerAttackRelease(['A3', 'C4', 'E4'], '4n');
                break;
            case 'Chaotic':
                noiseRef.current?.set({ volume: -15 }).start().stop('+2');
                synthRef.current?.triggerAttackRelease('C#2', '1n');
                break;
            default:
                synthRef.current?.triggerAttackRelease(['C4', 'G4'], '8n');
                break;
        }
    }, [setupAudio, stopSound]);

    useEffect(() => {
        if (isMuted) {
            stopSound();
        }
    }, [isMuted, stopSound]);
    
    // --- Notification Manager ---
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification('');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);


    const generateImage = async (prompt, style) => {
        const fullPrompt = `${prompt}, ${style}, digital art, highly detailed, cinematic lighting`;
        
        // This is a fast, high-quality model perfect for this use case.
        // const API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1-base";
        const API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
        
        // Get your key from the .env file
        const apiKey = process.env.REACT_APP_HUGGINGFACE_API_KEY;

        if (!apiKey) {
            const errorMsg = "Hugging Face API Key is missing. Please check your .env file.";
            console.error(errorMsg);
            setErrorMessage(errorMsg);
            const imageText = encodeURIComponent(prompt.split(' ').slice(0, 5).join(' '));
            return `https://placehold.co/512x512/0d0c22/c8b6ff?text=API+Key+Missing`;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: fullPrompt }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                // Hugging Face might be loading the model, which can take time.
                if (response.status === 503) {
                     throw new Error("The image model is loading on the server, please try again in a moment.");
                }
                throw new Error(`Image generation failed: ${errorText}`);
            }

            // The response from Hugging Face is the image itself (a "blob").
            const imageBlob = await response.blob();
            
            // We need to convert the image blob into a base64 string to display it.
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });

        } catch (error) {
            console.error("Failed to generate image with Hugging Face:", error);
            setErrorMessage(error.message || "Image generation failed. Using a fallback visual.");
            const imageText = encodeURIComponent(prompt.split(' ').slice(0, 5).join(' '));
            return `https://placehold.co/512x512/0d0c22/c8b6ff?text=Visual+Fallback:\n${imageText}`;
        }
    };


    // const generateImage = async (prompt, style) => {
    //     const fullPrompt = `${prompt}, ${style}, digital painting, highly detailed, cinematic lighting`;
        
    //     // This URL points to your local Python server
    //     const API_URL = "http://127.0.0.1:5000/generate";

    //     try {
    //         const response = await fetch(API_URL, {
    //             method: 'POST',
    //             headers: {
    //                 "Content-Type": "application/json",
    //             },
    //             body: JSON.stringify({ prompt: fullPrompt }),
    //         });

    //         if (!response.ok) {
    //              const errorData = await response.json();
    //              throw new Error(`Local server error: ${errorData.error || 'Unknown error'}`);
    //         }

    //         // The response is the image itself (a "blob").
    //         const imageBlob = await response.blob();
            
    //         // Convert the image blob into a base64 string to display it.
    //         return new Promise((resolve, reject) => {
    //             const reader = new FileReader();
    //             reader.onloadend = () => resolve(reader.result);
    //             reader.onerror = reject;
    //             reader.readAsDataURL(imageBlob);
    //         });

    //     } catch (error) {
    //         console.error("Failed to generate image with local server:", error);
    //         setErrorMessage(error.message || "Image generation failed. Is the local server running?");
    //         const imageText = encodeURIComponent(prompt.split(' ').slice(0, 5).join(' '));
    //         return `https://placehold.co/512x512/0d0c22/c8b6ff?text=Local+Server+Error`;
    //     }
    // };
    //
const generateTextContent = async (prompt) => {
    if (!prompt || prompt.trim().length === 0) {
        throw new Error("Prompt is empty.");
    }

    const payload = {
        contents: [{
            role: "user",
            parts: [{
                text: `Analyze the following dream description. Provide a JSON object with a color palette, keywords, a poetic summary, a symbolic interpretation, and a suggested ambient sound.
            Dream: "${prompt.trim()}"

            The JSON object must have this exact structure:
            {
            "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
            "keywords": ["word1", "word2", "word3"],
            "poeticSummary": "A short, poetic summary of the dream's feeling and narrative.",
            "dreamMeaning": "A symbolic or psychological interpretation of the dream's elements.",
            "sound": "One of: Calm, Mysterious, Ethereal, Melancholy, Chaotic"
            }`
            }]
        }],
        generationConfig: { responseMimeType: "application/json" }
    };

    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", response.status, errorText);
            throw new Error("Dream analysis failed. Try again later.");
        }

        const result = await response.json();
        const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            console.warn("No valid response content from Gemini:", result);
            throw new Error("Gemini didn't return any meaningful output.");
        }

        try {
            return JSON.parse(content);
        } catch (err) {
            console.error("Invalid JSON from Gemini:", content, err);
            throw new Error("The AI returned unreadable data.");
        }

    } catch (err) {
        console.error("Unexpected failure in generateTextContent:", err);
        throw err;
    }
};

    const handleVisualize = async () => {
        if (!dreamInput.trim() || isGenerating) return;
        setIsGenerating(true);
        setGeneratedContent(null);
        setCurrentView('home');
        setErrorMessage('');

        try {
            const imagePromises = [
                generateImage(dreamInput, "surreal, ethereal, dreamlike"),
                // generateImage(dreamInput, "abstract, symbolic, soft focus")
            ];
            const textContentPromise = generateTextContent(dreamInput);

            const [images, textContent] = await Promise.all([Promise.all(imagePromises), textContentPromise]);

            const newContent = {
                text: dreamInput,
                images,
                ...textContent,
            };

            setGeneratedContent(newContent);
            if (!isMuted) {
                playSound(textContent.sound || 'Default');
            }

        } catch (error) {
            console.error("Error during visualization:", error);
            setErrorMessage(error.message || 'An unknown error occurred. Please try a different dream description.');
        } finally {
            setIsGenerating(false);
        }
    };

    // --- Saving and Viewing Dreams ---
    const handleSaveDream = async () => {
        if (!generatedContent || !isAuthReady || !db || !userId) return;
        try {
            const dreamsCollectionPath = `artifacts/${appId}/users/${userId}/dreams`;
            
            const firestoreData = {
                text: generatedContent.text || "No text provided.",
                poeticSummary: generatedContent.poeticSummary || "No summary available.",
                dreamMeaning: generatedContent.dreamMeaning,//|| "No interpretation available.",
                colors: generatedContent.colors || [],
                keywords: generatedContent.keywords || [],
                sound: generatedContent.sound || "Default",
                timestamp: serverTimestamp(),
                imageCount: generatedContent.images?.length || 0
            };

            const docRef = await addDoc(collection(db, dreamsCollectionPath), firestoreData);
            
            // Save base64 images to local storage, as Firestore has a 1MB doc limit.
            generatedContent.images.forEach((imgData, index) => {
                try {
                    // Only save to local storage if it's a base64 string
                    if (imgData.startsWith('data:image')) {
                        localStorage.setItem(`${docRef.id}-${index}`, imgData);
                    }
                } catch (e) {
                    console.error("Local storage error:", e);
                    setErrorMessage("Could not save images to device. Storage might be full.");
                    // We don't want to stop the whole process if one image fails to save
                }
            });

            setNotification('Dream saved to your gallery!');
            setGeneratedContent(null);
            setDreamInput('');
            setCurrentView('gallery');
            stopSound();

        } catch (error) {
            console.error("Error saving dream:", error);
            setErrorMessage("Failed to save dream to your gallery.");
        }
    };

    const viewDream = (dream) => {
        setSelectedDream(dream);
        setCurrentView('dream');
        if (!isMuted) {
            playSound(dream.sound || 'Default');
        }
    };
    
    const navigate = (view) => {
        setCurrentView(view);
        setIsMenuOpen(false);
        if (view !== 'dream') {
            setSelectedDream(null);
            stopSound();
        }
        if (view === 'home') {
            setGeneratedContent(null);
            setDreamInput('');
        }
    };

    // --- Render Components ---
    const renderHeader = () => (
        <header className="fixed top-0 left-0 right-0 z-50 p-4 md:p-6 flex justify-between items-center bg-midnight-blue/50 backdrop-blur-md">
            <h1 className="text-2xl md:text-3xl font-cormorant text-ethereal-white cursor-pointer hover:text-pale-pink transition-colors" onClick={() => navigate('home')}>
                LucidLens
            </h1>
            <nav className="hidden md:flex items-center space-x-6 text-lg">
                <button onClick={() => navigate('home')} className="font-manrope text-ethereal-white/80 hover:text-pale-pink transition-colors duration-300">Home</button>
                <button onClick={() => navigate('gallery')} className="font-manrope text-ethereal-white/80 hover:text-pale-pink transition-colors duration-300">Gallery</button>
            </nav>
            <div className="flex items-center space-x-4">
                <button onClick={() => setIsMuted(!isMuted)} className="text-ethereal-white hover:text-lavender-mist transition-colors duration-300">
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-ethereal-white">
                    <Menu size={28} />
                </button>
            </div>
        </header>
    );
    
    const renderMobileMenu = () => (
        <AnimatePresence>
            {isMenuOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 bg-midnight-blue/80 backdrop-blur-lg md:hidden"
                    onClick={() => setIsMenuOpen(false)}
                >
                    <motion.nav 
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed top-24 left-4 right-4 bg-midnight-blue/90 rounded-lg p-8 shadow-2xl flex flex-col items-center space-y-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => navigate('home')} className="font-manrope text-3xl text-ethereal-white hover:text-pale-pink transition-colors duration-300">Home</button>
                        <button onClick={() => navigate('gallery')} className="font-manrope text-3xl text-ethereal-white hover:text-pale-pink transition-colors duration-300">Gallery</button>
                    </motion.nav>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderHero = () => (
        <div className="w-full h-full flex flex-col justify-center items-center text-center p-4">
            <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-4xl md:text-6xl font-cormorant text-ethereal-white mb-6"
            >
                What did you dream last night?
            </motion.h2>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="w-full max-w-2xl flex flex-col items-center"
            >
                <textarea
                    value={dreamInput}
                    onChange={(e) => setDreamInput(e.target.value)}
                    placeholder="Describe a dream... a forgotten melody, a city of glass, a conversation with the moon..."
                    className="w-full h-28 md:h-32 p-4 bg-black/20 text-ethereal-white font-manrope placeholder-ethereal-white/50 rounded-lg border border-lavender-mist/30 focus:ring-2 focus:ring-lavender-mist focus:outline-none transition-all duration-300 shadow-lg focus:shadow-lavender-mist/20 resize-none"
                    disabled={isGenerating}
                />
                <button
                    onClick={handleVisualize}
                    disabled={isGenerating || !dreamInput.trim()}
                    className="mt-6 px-8 py-3 bg-lavender-mist text-midnight-blue font-bold font-manrope rounded-full shadow-lg hover:bg-pale-pink hover:shadow-pale-pink/40 transition-all duration-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center space-x-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader className="animate-spin" size={20} />
                            <span>Visualizing...</span>
                        </>
                    ) : (
                        <span>Visualize</span>
                    )}
                </button>
            </motion.div>
            {!generatedContent && (
                 <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="font-manrope text-ethereal-white/60 mt-8 max-w-md"
                 >
                     LucidLens turns your subconscious into art. Powered by AI, inspired by your dreams.
                 </motion.p>
            )}
        </div>
    );

    const renderMoodboard = (content, isSavedDream = false) => (
        <motion.div
            key={isSavedDream ? content.id : 'new-dream'}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="w-full max-w-6xl mx-auto p-4 md:p-8"
        >
            <div className="bg-midnight-blue/50 backdrop-blur-xl rounded-2xl shadow-2xl shadow-lavender-mist/10 p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-8">
                    {/* Images Column */}
                    <div className="lg:col-span-3 space-y-4 md:space-y-6">
                        {content.images && content.images.map((img, index) => (
                            <motion.img
                                key={index}
                                src={img}
                                alt={`Surreal visualization ${index + 1}`}
                                className="w-full h-auto object-cover rounded-lg shadow-lg bg-midnight-blue"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/512x512/0d0c22/F6F6F6?text=Image+Error`; }}
                            />
                        ))}
                    </div>

                    {/* Details Column */}
                    <div className="lg:col-span-2 space-y-6 md:space-y-8 text-ethereal-white flex flex-col">
                        <div className="border-l-2 border-lavender-mist pl-4">
                            <h3 className="font-cormorant text-xl text-pale-pink mb-2 flex items-center"><BookOpen size={18} className="mr-2"/> Your Dream</h3>
                            <p className="font-manrope text-ethereal-white/80 italic">{content.text}</p>
                        </div>
                        
                        <div>
                            <h3 className="font-cormorant text-xl text-pale-pink mb-2 flex items-center"><Feather size={18} className="mr-2"/>Poetic Essence</h3>
                            <p className="font-manrope text-ethereal-white/90">{content.poeticSummary || "No summary available."}</p>
                        </div>

                        <div>
                            <h3 className="font-cormorant text-xl text-pale-pink mb-2 flex items-center"><BrainCircuit size={18} className="mr-2"/>Dream Interpretation</h3>
                            <p className="font-manrope text-ethereal-white/90">{content.dreamMeaning || "No interpretation available."}</p>
                        </div>

                        {content.colors && content.colors.length > 0 && (
                            <div>
                                <h3 className="font-cormorant text-xl text-pale-pink mb-3 flex items-center"><Palette size={18} className="mr-2"/>Color Palette</h3>
                                <div className="flex space-x-2">
                                    {content.colors.map((color, index) => (
                                        <motion.div
                                            key={index}
                                            className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white/20"
                                            style={{ backgroundColor: color }}
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                                            title={color}
                                        ></motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {content.keywords && content.keywords.length > 0 && (
                            <div>
                                <h3 className="font-cormorant text-xl text-pale-pink mb-3 flex items-center"><ImageIcon size={18} className="mr-2"/>Keywords</h3>
                                <div className="flex flex-wrap gap-2">
                                    {content.keywords.map((keyword, index) => (
                                        <motion.span
                                            key={index}
                                            className="bg-ethereal-white/10 text-lavender-mist px-3 py-1 rounded-full font-manrope text-sm"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
                                        >
                                            {keyword}
                                        </motion.span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-auto pt-4 space-y-3">
                           {!isSavedDream ? (
                                <button onClick={handleSaveDream} className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-lavender-mist text-midnight-blue font-bold font-manrope rounded-full shadow-lg hover:bg-pale-pink hover:shadow-pale-pink/40 transition-all duration-300">
                                    <Save size={20} />
                                    <span>Save to Gallery</span>
                                </button>
                            ) : (
                                <button onClick={() => navigate('gallery')} className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-ethereal-white/10 text-lavender-mist font-bold font-manrope rounded-full shadow-lg hover:bg-ethereal-white/20 transition-all duration-300">
                                    <span>Back to Gallery</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderGallery = () => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-full max-w-7xl mx-auto p-4 md:p-8"
        >
            <h2 className="text-4xl md:text-5xl font-cormorant text-ethereal-white text-center mb-8 md:mb-12">Dream Gallery</h2>
            {gallery.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {gallery.map(dream => (
                        <motion.div
                            key={dream.id}
                            onClick={() => viewDream(dream)}
                            className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer shadow-lg bg-midnight-blue/40"
                            whileHover={{ scale: 1.05, zIndex: 10 }}
                            transition={{ duration: 0.3 }}
                            layoutId={`dream-card-${dream.id}`}
                        >
                            <img src={dream.images[0]} alt="Dream visualization" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-4 text-ethereal-white">
                                <p className="font-manrope text-sm opacity-80">{dream.timestamp?.seconds ? new Date(dream.timestamp.seconds * 1000).toLocaleDateString() : ''}</p>
                                <h3 className="font-cormorant text-xl font-semibold truncate">{dream.poeticSummary || dream.text}</h3>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-ethereal-white/70 font-manrope mt-10">
                    <p className="text-lg">Your gallery is a blank canvas.</p>
                    <p>Visualize a dream to begin your collection.</p>
                </div>
            )}
        </motion.div>
    );

    const renderNotification = () => (
        <AnimatePresence>
            {notification && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.3 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-pale-pink text-midnight-blue font-manrope font-semibold rounded-full shadow-lg"
                >
                    {notification}
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderError = () => (
        <AnimatePresence>
            {errorMessage && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="fixed top-24 left-1/2 -translate-x-1/2 w-11/12 max-w-lg z-50 p-4 bg-red-900/50 border border-red-500/70 rounded-lg text-center backdrop-blur-sm"
                >
                    <p className="font-manrope text-pale-pink">{errorMessage}</p>
                    <button onClick={() => setErrorMessage('')} className="absolute top-1 right-2 text-pale-pink/70 hover:text-pale-pink">
                        <X size={18} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="bg-midnight-blue min-h-screen w-full font-sans text-white overflow-x-hidden">
            <div className="fixed inset-0 z-0 opacity-50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                <div className="absolute top-0 left-0 w-72 h-72 bg-lavender-mist rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-0 right-0 w-72 h-72 bg-pale-pink rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>

            {renderHeader()}
            {renderMobileMenu()}
            {renderNotification()}
            {renderError()}

            <main className="relative z-10 pt-24 md:pt-32 pb-12 flex flex-col items-center min-h-screen">
                <AnimatePresence mode="wait">
                    {currentView === 'home' && (
                        <motion.div
                            key="home"
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full h-full flex-grow flex flex-col items-center"
                        >
                            {generatedContent ? renderMoodboard(generatedContent, false) : renderHero()}
                        </motion.div>
                    )}
                    {currentView === 'gallery' && (
                         <motion.div
                            key="gallery"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="w-full"
                         >
                            {renderGallery()}
                         </motion.div>
                    )}
                    {currentView === 'dream' && selectedDream && (
                        <motion.div
                            key="dream-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="w-full"
                        >
                            {renderMoodboard(selectedDream, true)}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
            
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Manrope:wght@300;400;500;700&display=swap');
                
                :root {
                    --midnight-blue: #0d0c22;
                    --lavender-mist: #C8B6FF;
                    --pale-pink: #FFD6E8;
                    --ethereal-white: #F6F6F6;
                }

                .font-cormorant { font-family: 'Cormorant Garamond', serif; }
                .font-manrope { font-family: 'Manrope', sans-serif; }
                
                .bg-midnight-blue { background-color: var(--midnight-blue); }
                .text-lavender-mist { color: var(--lavender-mist); }
                .text-pale-pink { color: var(--pale-pink); }
                .text-ethereal-white { color: var(--ethereal-white); }
                .bg-lavender-mist { background-color: var(--lavender-mist); }
                .bg-pale-pink { background-color: var(--pale-pink); }
                .text-midnight-blue { color: var(--midnight-blue); }
                .border-lavender-mist { border-color: var(--lavender-mist); }
                .shadow-lavender-mist\\/20 { box-shadow: 0 0 15px 5px rgba(200, 182, 255, 0.2); }
                .shadow-pale-pink\\/40 { box-shadow: 0 0 20px 8px rgba(255, 214, 232, 0.4); }

                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }

                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
            `}</style>
        </div>
    );
}
