import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, signInWithPopup, getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, doc, setDoc } from 'firebase/firestore';
// import { getFunctions, httpsCallable } from 'firebase/functions';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Save, Loader, Image as ImageIcon, Palette, Feather, BookOpen, X, Menu, BrainCircuit, LogOut } from 'lucide-react';
import * as Tone from 'tone';
import { saveImage, getImage } from './utils/db';
import { handlePayment, handleBypassPayment } from './utils/payment';
import PolicyPage from './components/PolicyPage';
import AppFooter from './components/AppFooter';

// --- Firebase Configuration ---
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
    const [currentView, setCurrentView] = useState('home');
    const [gallery, setGallery] = useState([]);
    const [selectedDream, setSelectedDream] = useState(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [notification, setNotification] = useState('');
    const [activePolicy, setActivePolicy] = useState(null);

    // --- Firebase & Payment State ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [hasPaid, setHasPaid] = useState(false);
    const [isLoadingPaymentStatus, setIsLoadingPaymentStatus] = useState(true);

    // --- Audio Refs ---
    const synthRef = useRef(null);
    const noiseRef = useRef(null);
    const reverbRef = useRef(null);
    const playerStateRef = useRef({ isPlaying: false });

   // --- Firebase Initialization and Auth ---
    useEffect(() => {
        try {
            if (!firebaseConfig.apiKey) {
                throw new Error("Firebase configuration is missing.");
            }
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firestoreAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firestoreAuth);

            const unsubscribe = onAuthStateChanged(firestoreAuth, (user) => {
                setUserId(user ? user.uid : null);
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
            setErrorMessage(error.message);
            setIsAuthReady(true);
        }
    }, []);
    // --- Payment Status Checker ---
    useEffect(() => {
      if (isAuthReady && db && userId) {
        setIsLoadingPaymentStatus(true);
        const userDocRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
          setHasPaid(doc.exists() && doc.data().hasPaid === true);
          setIsLoadingPaymentStatus(false);
        });
        return () => unsubscribe();
      } else if (isAuthReady && !userId) {
          setHasPaid(false);
          setIsLoadingPaymentStatus(false);
      }
    }, [isAuthReady, db, userId]);

    // --- Firestore Gallery Listener ---
    useEffect(() => {
        if (isAuthReady && db && userId && hasPaid) {
            const dreamsCollectionPath = `artifacts/${appId}/users/${userId}/dreams`;
            const q = query(collection(db, dreamsCollectionPath));
            const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                const dreamsPromises = querySnapshot.docs.map(async (doc) => {
                    const docData = doc.data();
                    const images = [];
                    for (let i = 0; i < (docData.imageCount || 0); i++) {
                        const localImage = await getImage(`${doc.id}-${i}`);
                        images.push(localImage || `https://placehold.co/512x512/0d0c22/F6F6F6?text=Image+Missing`);
                    }
                    return { id: doc.id, ...docData, images };
                });
                const dreams = await Promise.all(dreamsPromises);
                setGallery(dreams.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
            });
            return () => unsubscribe();
        }
    }, [isAuthReady, db, userId, hasPaid]);
    
    // --- Audio Setup ---
    const setupAudio = useCallback(() => {
        if (!synthRef.current) {
            reverbRef.current = new Tone.Reverb(5).toDestination();
            synthRef.current = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsine' }, envelope: { attack: 2, decay: 1, sustain: 0.4, release: 4 } }).connect(reverbRef.current);
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
        if (Tone.context.state !== 'running') Tone.context.resume();
        stopSound();
        playerStateRef.current.isPlaying = true;
        switch (soundType) {
            case 'Calm': synthRef.current?.triggerAttackRelease(['C4', 'E4', 'G4'], '8n'); noiseRef.current?.start().stop('+4'); break;
            case 'Mysterious': synthRef.current?.triggerAttackRelease(['C3', 'D#3', 'G3', 'A#3'], '4n'); break;
            case 'Ethereal': synthRef.current?.triggerAttackRelease(['C5', 'E5', 'G5', 'B5'], '2n'); break;
            case 'Melancholy': synthRef.current?.triggerAttackRelease(['A3', 'C4', 'E4'], '4n'); break;
            case 'Chaotic': noiseRef.current?.set({ volume: -15 }).start().stop('+2'); synthRef.current?.triggerAttackRelease('C#2', '1n'); break;
            default: synthRef.current?.triggerAttackRelease(['C4', 'G4'], '8n'); break;
        }
    }, [setupAudio, stopSound]);

    useEffect(() => { if (isMuted) stopSound(); }, [isMuted, stopSound]);
    useEffect(() => { if (notification) { const timer = setTimeout(() => setNotification(''), 3000); return () => clearTimeout(timer); } }, [notification]);

    // --- AI Generation ---
    const generateImage = async (prompt, style) => {
        const fullPrompt = `${prompt}, ${style}, digital art, highly detailed, cinematic lighting`;
        const API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
        const apiKey = process.env.REACT_APP_HUGGINGFACE_API_KEY;
        if (!apiKey) throw new Error("Hugging Face API Key is missing.");
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ inputs: fullPrompt }), });
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 503) throw new Error("The image model is loading, please try again in a moment.");
                throw new Error(`Image generation failed: ${errorText}`);
            }
            const imageBlob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });
        } catch (error) {
            console.error("Hugging Face API Error:", error);
            return `https://placehold.co/512x512/0d0c22/c8b6ff?text=Visual+Fallback`;
        }
    };

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
            const imagePromise = generateImage(dreamInput, "surreal, ethereal, dreamlike");
            const textContentPromise = generateTextContent(dreamInput);
            const [image, textContent] = await Promise.all([imagePromise, textContentPromise]);
            const newContent = { text: dreamInput, images: [image], ...textContent };
            setGeneratedContent(newContent);
            if (!isMuted) playSound(textContent.sound || 'Default');
        } catch (error) {
            setErrorMessage(error.message || 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };
    
    // --- Data Handling ---
    const handleSaveDream = async () => {
        if (!generatedContent || !isAuthReady || !db || !userId) return;
        try {
            const dreamsCollectionPath = `artifacts/${appId}/users/${userId}/dreams`;
            const firestoreData = { text: generatedContent.text, poeticSummary: generatedContent.poeticSummary, dreamMeaning: generatedContent.dreamMeaning, colors: generatedContent.colors, keywords: generatedContent.keywords, sound: generatedContent.sound, timestamp: serverTimestamp(), imageCount: generatedContent.images.length };
            const docRef = await addDoc(collection(db, dreamsCollectionPath), firestoreData);
            const imageSavePromises = generatedContent.images.map((imgData, index) => saveImage(`${docRef.id}-${index}`, imgData));
            await Promise.all(imageSavePromises);
            setNotification('Dream saved!');
            setGeneratedContent(null);
            setDreamInput('');
            setCurrentView('gallery');
            stopSound();
        } catch (error) {
            setErrorMessage("Failed to save dream.");
        }
    };
    
    const viewDream = (dream) => {
        setSelectedDream(dream);
        setCurrentView('dream');
        if (!isMuted) playSound(dream.sound || 'Default');
    };
    
    const navigate = (view) => {
        setCurrentView(view);
        setIsMenuOpen(false);
        if (view !== 'dream') { setSelectedDream(null); stopSound(); }
        if (view === 'home') { setGeneratedContent(null); setDreamInput(''); }
    };
    
    // --- Auth Handlers ---
    const handleGoogleSignIn = async () => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            setErrorMessage("Could not sign in with Google.");
        }
    };

    const handleSignOut = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
        } catch (error) {
            setErrorMessage("Failed to sign out.");
        }
    };

    
//     const handlePayment = async () => {
//         if (!auth.currentUser) return setErrorMessage("You must be logged in to pay.");
//         const functions = getFunctions();
//         const createOrder = httpsCallable(functions, 'createOrder');
//         const verifyPayment = httpsCallable(functions, 'verifyPayment');
//         try {
//             const response = await createOrder();
//             const { orderId } = response.data;
//             const options = {
//                 key: process.env.REACT_APP_RAZORPAY_KEY_ID,
//                 amount: "1000",
//                 currency: "INR",
//                 name: "LucidLens Access",
//                 description: "One-time fee for lifetime access.",
//                 order_id: orderId,
//                 handler: async (response) => {
//                     try {
//                         await verifyPayment({ order_id: response.razorpay_order_id, payment_id: response.razorpay_payment_id, signature: response.razorpay_signature });
//                     } catch (error) {
//                         setErrorMessage("Payment verification failed.");
//                     }
//                 },
//                 prefill: { name: auth.currentUser.displayName, email: auth.currentUser.email },
//                 theme: { color: "#C8B6FF" }
//             };
//             new window.Razorpay(options).open();
//         } catch (error) {
//             setErrorMessage("Could not initiate payment.");
//         }
//     };

//     // --- DEVELOPMENT ONLY: Bypass Payment ---
//     const handleBypassPayment = async () => {
//         if (!db || !userId) {
//             setErrorMessage("You must be logged in to bypass payment.");
//             return;
//         }
//         try {
//             const userDocRef = doc(db, 'users', userId);
//             await setDoc(userDocRef, { hasPaid: true }, { merge: true });
//         } catch (error) {
//             console.error("Failed to bypass payment:", error);
//             setErrorMessage("Could not update payment status for testing.");
//         }
//     };
    
    // --- Render Components ---
    const renderHeader = () => (
        <header className="fixed top-0 left-0 right-0 z-50 p-4 md:p-6 flex justify-between items-center bg-midnight-blue/50 backdrop-blur-md">
            <h1 className="text-2xl md:text-3xl font-cormorant text-ethereal-white cursor-pointer" onClick={() => navigate('home')}>LucidLens</h1>
            <nav className="hidden md:flex items-center space-x-6 text-lg">
                <button onClick={() => navigate('home')} className="font-manrope text-ethereal-white/80 hover:text-pale-pink">Home</button>
                <button onClick={() => navigate('gallery')} className="font-manrope text-ethereal-white/80 hover:text-pale-pink">Gallery</button>
                <button onClick={handleSignOut} className="font-manrope text-ethereal-white/80 hover:text-pale-pink flex items-center gap-2"><LogOut size={18} /> Sign Out</button>
            </nav>
            <div className="flex items-center space-x-4">
                <button onClick={() => setIsMuted(!isMuted)} className="text-ethereal-white hover:text-lavender-mist">{isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-ethereal-white"><Menu size={28} /></button>
            </div>
        </header>
    );
    
    const renderMobileMenu = () => (
        <AnimatePresence>
            {isMenuOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-midnight-blue/80 backdrop-blur-lg md:hidden" onClick={() => setIsMenuOpen(false)}>
                    <motion.nav initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }} className="fixed top-24 left-4 right-4 bg-midnight-blue/90 rounded-lg p-8 shadow-2xl flex flex-col items-center space-y-8">
                        <button onClick={() => navigate('home')} className="font-manrope text-3xl text-ethereal-white hover:text-pale-pink">Home</button>
                        <button onClick={() => navigate('gallery')} className="font-manrope text-3xl text-ethereal-white hover:text-pale-pink">Gallery</button>
                        <button onClick={handleSignOut} className="font-manrope text-3xl text-ethereal-white hover:text-pale-pink flex items-center gap-3"><LogOut size={28} /> Sign Out</button>
                    </motion.nav>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderHero = () => (
        <div className="w-full h-full flex flex-col justify-center items-center text-center p-4">
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-6xl font-cormorant text-ethereal-white mb-6">What did you dream last night?</motion.h2>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-2xl flex flex-col items-center">
                <textarea value={dreamInput} onChange={(e) => setDreamInput(e.target.value)} placeholder="Describe a dream..." className="w-full h-32 p-4 bg-black/20 text-ethereal-white font-manrope placeholder-ethereal-white/50 rounded-lg border border-lavender-mist/30 focus:ring-2 focus:ring-lavender-mist outline-none resize-none" disabled={isGenerating} />
                <button onClick={handleVisualize} disabled={isGenerating || !dreamInput.trim()} className="mt-6 px-8 py-3 bg-lavender-mist text-midnight-blue font-bold font-manrope rounded-full shadow-lg hover:bg-pale-pink disabled:bg-gray-600 flex items-center space-x-2">
                    {isGenerating ? (<><Loader className="animate-spin" size={20} /><span>Visualizing...</span></>) : (<span>Visualize</span>)}
                </button>
            </motion.div>
        </div>
    );

    const renderMoodboard = (content, isSavedDream = false) => (
        <motion.div key={isSavedDream ? content.id : 'new-dream'} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-6xl mx-auto p-4 md:p-8">
            <div className="bg-midnight-blue/50 backdrop-blur-xl rounded-2xl shadow-2xl p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 space-y-6">
                        {content.images?.map((img, index) => <motion.img key={index} src={img} alt={`Viz ${index + 1}`} className="w-full h-auto object-cover rounded-lg shadow-lg" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.2 }} />)}
                    </div>
                    <div className="lg:col-span-2 space-y-8 text-ethereal-white flex flex-col">
                        <div className="border-l-2 border-lavender-mist pl-4"><h3 className="font-cormorant text-xl text-pale-pink mb-2 flex items-center"><BookOpen size={18} className="mr-2"/> Your Dream</h3><p className="font-manrope text-ethereal-white/80 italic">{content.text}</p></div>
                        <div><h3 className="font-cormorant text-xl text-pale-pink mb-2 flex items-center"><Feather size={18} className="mr-2"/>Poetic Essence</h3><p className="font-manrope">{content.poeticSummary}</p></div>
                        <div><h3 className="font-cormorant text-xl text-pale-pink mb-2 flex items-center"><BrainCircuit size={18} className="mr-2"/>Interpretation</h3><p className="font-manrope">{content.dreamMeaning}</p></div>
                        <div><h3 className="font-cormorant text-xl text-pale-pink mb-3 flex items-center"><Palette size={18} className="mr-2"/>Color Palette</h3><div className="flex space-x-2">{content.colors?.map((color, index) => <motion.div key={index} className="w-12 h-12 rounded-full border-2 border-white/20" style={{ backgroundColor: color }} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + index * 0.1 }} title={color} />)}</div></div>
                        <div><h3 className="font-cormorant text-xl text-pale-pink mb-3 flex items-center"><ImageIcon size={18} className="mr-2"/>Keywords</h3><div className="flex flex-wrap gap-2">{content.keywords?.map((keyword, index) => <motion.span key={index} className="bg-ethereal-white/10 text-lavender-mist px-3 py-1 rounded-full text-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + index * 0.1 }}>{keyword}</motion.span>)}</div></div>
                        <div className="mt-auto pt-4">{!isSavedDream ? (<button onClick={handleSaveDream} className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-lavender-mist text-midnight-blue font-bold rounded-full shadow-lg hover:bg-pale-pink"><Save size={20} /><span>Save to Gallery</span></button>) : (<button onClick={() => navigate('gallery')} className="w-full px-6 py-3 bg-ethereal-white/10 text-lavender-mist font-bold rounded-full shadow-lg hover:bg-ethereal-white/20">Back to Gallery</button>)}</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderGallery = () => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-7xl mx-auto p-4 md:p-8">
            <h2 className="text-4xl md:text-5xl font-cormorant text-ethereal-white text-center mb-8">Dream Gallery</h2>
            {gallery.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {gallery.map(dream => (
                        <motion.div key={dream.id} onClick={() => viewDream(dream)} className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer shadow-lg" whileHover={{ scale: 1.05, zIndex: 10 }} layoutId={`dream-card-${dream.id}`}>
                            <img src={dream.images[0]} alt="Dream" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-4 text-ethereal-white"><p className="text-sm opacity-80">{dream.timestamp?.seconds ? new Date(dream.timestamp.seconds * 1000).toLocaleDateString() : ''}</p><h3 className="font-cormorant text-xl font-semibold truncate">{dream.poeticSummary || dream.text}</h3></div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-ethereal-white/70 font-manrope mt-10"><p>Your gallery is a blank canvas.</p></div>
            )}
        </motion.div>
    );

    const renderNotification = () => (
        <AnimatePresence>
            {notification && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-pale-pink text-midnight-blue font-semibold rounded-full shadow-lg">
                    {notification}
                </motion.div>
            )}
        </AnimatePresence>
    );

    const renderError = () => (
        <AnimatePresence>
            {errorMessage && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed top-24 left-1/2 -translate-x-1/2 w-11/12 max-w-lg z-50 p-4 bg-red-900/50 border border-red-500/70 rounded-lg text-center backdrop-blur-sm">
                    <p className="font-manrope text-pale-pink">{errorMessage}</p>
                    <button onClick={() => setErrorMessage('')} className="absolute top-1 right-2 text-pale-pink/70 hover:text-pale-pink"><X size={18} /></button>
                </motion.div>
            )}
        </AnimatePresence>
    );





    // --- RENDER LOGIC ---
    if (!isAuthReady || isLoadingPaymentStatus) {
        return <div className="bg-midnight-blue min-h-screen flex items-center justify-center"><Loader className="animate-spin text-lavender-mist" size={48} /></div>;
    }

    //     if (!userId) {
    //     return (
    //         <div className="bg-midnight-blue min-h-screen w-full font-sans text-white flex flex-col">
    //              <div className="fixed inset-0 z-0 opacity-50">
    //                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
    //                 <div className="absolute top-0 left-0 w-72 h-72 bg-lavender-mist rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
    //                 <div className="absolute top-0 right-0 w-72 h-72 bg-pale-pink rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    //                 <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
    //             </div>
    //             <AnimatePresence>{activePolicy && <PolicyPage policy={activePolicy} onClose={() => setActivePolicy(null)} />}</AnimatePresence>
    //             {renderError()}
    //             <div className="relative z-10 flex-grow flex flex-col justify-center items-center text-center p-4">
    //                 <h1 className="text-4xl md:text-5xl font-cormorant text-ethereal-white mb-4">Welcome to LucidLens</h1>
    //                 <p className="text-lg text-ethereal-white/80 mb-8 max-w-md">Visualize your dreams with the power of AI. Sign in to begin.</p>
    //                 <button onClick={handleGoogleSignIn} className="px-6 py-3 bg-white text-black font-bold font-manrope rounded-full shadow-lg hover:bg-gray-200">Sign in with Google</button>
    //             </div>
    //             <AppFooter onPolicyClick={setActivePolicy} />
    //         </div>
    //     );
    // }



    if (!userId) {
        return (
            <div className="bg-midnight-blue min-h-screen flex flex-col">
                <AnimatePresence>{activePolicy && <PolicyPage policy={activePolicy} onClose={() => setActivePolicy(null)} />}</AnimatePresence>
                {renderError()}
                <div className="flex-grow flex flex-col justify-center items-center text-center p-4">
                    <h1 className="text-4xl md:text-5xl font-cormorant text-ethereal-white mb-4">Welcome to LucidLens</h1>
                    <p className="text-lg text-ethereal-white/80 mb-8 max-w-md">Visualize your dreams with the power of AI. Sign in to begin.</p>
                    <button onClick={handleGoogleSignIn} className="px-6 py-3 bg-white text-black font-bold font-manrope rounded-full shadow-lg hover:bg-gray-200">Sign in with Google</button>
                </div>
                <AppFooter onPolicyClick={setActivePolicy} />
            </div>
        );
    }
        // if (!hasPaid) {
    //     return (
    //         <div className="bg-midnight-blue min-h-screen w-full font-sans text-white flex flex-col">
    //             <div className="fixed inset-0 z-0 opacity-50">
    //                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
    //                 <div className="absolute top-0 left-0 w-72 h-72 bg-lavender-mist rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
    //                 <div className="absolute top-0 right-0 w-72 h-72 bg-pale-pink rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
    //                 <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
    //             </div>
    //             <AnimatePresence>{activePolicy && <PolicyPage policy={activePolicy} onClose={() => setActivePolicy(null)} />}</AnimatePresence>
    //             {renderError()}
    //             <div className="relative z-10 flex-grow flex flex-col justify-center items-center text-center p-4">
    //                 <h1 className="text-4xl md:text-5xl font-cormorant text-ethereal-white mb-4">Unlock LucidLens</h1>
    //                 <p className="text-lg text-ethereal-white/80 mb-8">A one-time payment of ₹10 is required for full access.</p>
    //                 <button onClick={() => handlePayment(auth, setErrorMessage)} className="px-8 py-3 bg-lavender-mist text-midnight-blue font-bold font-manrope rounded-full shadow-lg hover:bg-pale-pink">Pay ₹10 to Unlock</button>
    //                 <button onClick={() => handleBypassPayment(db, userId, setErrorMessage)} className="mt-4 px-4 py-2 bg-gray-600 text-white font-manrope rounded-full text-xs">(Dev) Bypass Payment</button>
    //             </div>
    //             <AppFooter onPolicyClick={setActivePolicy} />
    //         </div>
    //     );
    // }

    if (!hasPaid) {
        return (
            <div className="bg-midnight-blue min-h-screen flex flex-col">
                <AnimatePresence>{activePolicy && <PolicyPage policy={activePolicy} onClose={() => setActivePolicy(null)} />}</AnimatePresence>
                {renderError()}
                <div className="flex-grow flex flex-col justify-center items-center text-center p-4">
                    <h1 className="text-4xl md:text-5xl font-cormorant text-ethereal-white mb-4">Unlock LucidLens</h1>
                    <p className="text-lg text-ethereal-white/80 mb-8">A one-time payment of ₹10 is required for full access.</p>
                    {/* <button onClick={handlePayment} className="px-8 py-3 bg-lavender-mist text-midnight-blue font-bold font-manrope rounded-full shadow-lg hover:bg-pale-pink">Pay ₹10 to Unlock</button> */}
                    <button onClick={() => handlePayment(auth, setErrorMessage)} className="px-8 py-3 bg-lavender-mist text-midnight-blue font-bold font-manrope rounded-full shadow-lg hover:bg-pale-pink">Pay ₹10 to Unlock</button>

                    {/* DEVELOPMENT ONLY BUTTON */}
                    {/* <button onClick={handleBypassPayment} className="mt-4 px-4 py-2 bg-gray-600 text-white font-manrope rounded-full text-xs">
                        (Dev) Bypass Payment
                    </button> */}
                    <button onClick={() => handleBypassPayment(db, userId, setErrorMessage)} className="mt-4 px-4 py-2 bg-gray-600 text-white font-manrope rounded-full text-xs">(Dev) Bypass Payment</button>

                </div>
                <AppFooter onPolicyClick={setActivePolicy} />
            </div>
        );
    }
    
    return (
        <div className="bg-midnight-blue min-h-screen w-full font-sans text-white flex flex-col">
            <div className="fixed inset-0 z-0 opacity-50">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                <div className="absolute top-0 left-0 w-72 h-72 bg-lavender-mist rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-0 right-0 w-72 h-72 bg-pale-pink rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>
            <AnimatePresence>{activePolicy && <PolicyPage policy={activePolicy} onClose={() => setActivePolicy(null)} />}</AnimatePresence>
            {renderHeader()}
            {renderMobileMenu()}
            {renderNotification()}
            {renderError()}
            <main className="relative z-10 pt-24 md:pt-32 pb-12 flex flex-col items-center flex-grow">
                <AnimatePresence mode="wait">
                    {currentView === 'home' && (
                        <motion.div key="home" className="w-full h-full flex-grow flex flex-col items-center">
                            {generatedContent ? renderMoodboard(generatedContent, false) : renderHero()}
                        </motion.div>
                    )}
                    {currentView === 'gallery' && (
                         <motion.div key="gallery" className="w-full">
                            {renderGallery()}
                         </motion.div>
                    )}
                    {currentView === 'dream' && selectedDream && (
                        <motion.div key="dream-view" className="w-full">
                            {renderMoodboard(selectedDream, true)}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
            <AppFooter onPolicyClick={setActivePolicy} />
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



