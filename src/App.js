import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, deleteDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Film, Tv, Star, Search, Home, X, Menu, Heart, Trash2, LogIn, LogOut, UserPlus } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCfzT7R2S4zezUeH7BayyQtKSTZ0fDfMGw",
  authDomain: "skye-movie.firebaseapp.com",
  projectId: "skye-movie",
  storageBucket: "skye-movie.appspot.com",
  messagingSenderId: "622740998651",
  appId: "1:622740998651:web:d89656336aea5994c3a35e",
  measurementId: "G-GXEW4WYS30"
};

// --- App ID (from Canvas environment, fallback for local dev) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'skye-movie-dev';

// --- Initialize Firebase ---
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    // import { setLogLevel } from "firebase/firestore"; // Import if you want to use it
    // setLogLevel('debug'); // Uncomment for Firestore debugging
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

// --- API Keys & Base URLs ---
const TMDB_API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const PLAYER_BASE_URL_MOVIE = 'https://player.mappletv.uk/watch/movie';
const PLAYER_BASE_URL_TV = 'https://player.mappletv.uk/watch/tv';

// --- Access Code ---
const ACCESS_CODE_ENV = process.env.REACT_APP_ACCESS_CODE || "1234";
const ACCESS_CODE_DIGITS = ACCESS_CODE_ENV.length;

// --- Auth Modal State ---
const AuthModal = ({ isOpen, onClose, onLoginSuccess, onRegisterSuccess }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        onRegisterSuccess();
      }
      onClose();
    } catch (err) {
      setError(err.message);
      console.error("Auth Error:", err);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-700">{isLoginView ? 'Login' : 'Register'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</p>}
        <form onSubmit={handleAuthAction}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-blue"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-1" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-blue"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-blue hover:bg-sky-blue-dark text-white font-bold py-2 px-4 rounded-md transition-colors duration-300 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLoginView ? 'Login' : 'Create Account')}
          </button>
        </form>
        <button
          onClick={() => { setIsLoginView(!isLoginView); setError('');}}
          className="mt-4 text-sm text-sky-blue hover:text-sky-blue-dark w-full text-center"
        >
          {isLoginView ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
};


function App() {
  const [siteAccessGranted, setSiteAccessGranted] = useState(false); // Renamed from isAuthenticated for clarity
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessError, setAccessError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState('discover');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [discoverMovies, setDiscoverMovies] = useState([]);
  const [discoverTV, setDiscoverTV] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playerContent, setPlayerContent] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notification, setNotification] = useState({ message: '', type: '' });

  // --- Firebase Auth Listener ---
  useEffect(() => {
    if (!auth) {
        console.error("Firebase Auth is not initialized.");
        setNotification({ message: 'Authentication service failed to load.', type: 'error' });
        setIsAuthReady(true);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Site access (via code) is checked independently
        const storedAccessVersion = localStorage.getItem(`skyeMovieAccess_${ACCESS_CODE_ENV}`);
        if (storedAccessVersion === 'granted') {
            setSiteAccessGranted(true);
        } else {
            setSiteAccessGranted(false); // Force code entry if not granted for this code version
        }
      } else {
        // No user signed in with email/pass, attempt anonymous sign-in for session continuity
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { // For specific environments
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth); // Fallback to anonymous
          }
        } catch (error) {
          console.error("Error during anonymous/custom token sign-in:", error);
          setNotification({ message: 'Failed to establish a guest session.', type: 'error' });
        }
        // currentUser will be set by the subsequent onAuthStateChanged call after anonymous sign-in
        // setSiteAccessGranted remains based on localStorage for access code
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      // After sign out, onAuthStateChanged will trigger, and an anonymous user session will likely start.
      // Site access (via code) remains, favorites list will update to anonymous user's (or empty).
      setNotification({ message: 'Logged out successfully.', type: 'success' });
      // setCurrentPage('discover'); // Optionally navigate to a default page
    } catch (error) {
      console.error("Error signing out:", error);
      setNotification({ message: 'Error signing out.', type: 'error' });
    }
  };

  // --- Firestore Path Helper for Favorites ---
  const getFavoritesCollectionPath = useCallback(() => {
    if (!currentUser || !currentUser.uid) return null;
    return `artifacts/${appId}/users/${currentUser.uid}/favorites`;
  }, [currentUser]);


  // --- Fetch Initial Discover Content ---
  const fetchDiscoverContent = useCallback(async () => {
    if (!TMDB_API_KEY) {
        setNotification({ message: 'TMDB API Key is missing.', type: 'error' });
        return;
    }
    setIsLoading(true);
    try {
      const movieResponse = await fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&language=en-US&page=1`);
      if (!movieResponse.ok) throw new Error(`Movies: ${movieResponse.status}`);
      const movieData = await movieResponse.json();
      setDiscoverMovies(movieData.results || []);

      const tvResponse = await fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&language=en-US&page=1`);
      if (!tvResponse.ok) throw new Error(`TV: ${tvResponse.status}`);
      const tvData = await tvResponse.json();
      setDiscoverTV(tvData.results || []);
    } catch (error) {
      console.error("Error fetching discover content:", error);
      setNotification({ message: `Fetch error: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (siteAccessGranted && isAuthReady) { // Content fetched if site access (code) is granted
      fetchDiscoverContent();
    }
  }, [siteAccessGranted, isAuthReady, fetchDiscoverContent]);


  // --- Fetch/Subscribe to Favorites from Firestore ---
  useEffect(() => {
    if (!db || !currentUser || !isAuthReady || !siteAccessGranted) { // Also check siteAccessGranted
      setFavorites([]);
      return;
    }
    const favCollectionPath = getFavoritesCollectionPath();
    if (!favCollectionPath) {
      setFavorites([]);
      return;
    }
    const q = query(collection(db, favCollectionPath));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const favs = [];
      querySnapshot.forEach((doc) => favs.push({ id: doc.id, ...doc.data() }));
      setFavorites(favs);
    }, (error) => {
      console.error("Firestore favorites error:", error);
      setNotification({ message: 'Failed to load favorites.', type: 'error' });
    });
    return () => unsubscribe();
  }, [currentUser, isAuthReady, siteAccessGranted, getFavoritesCollectionPath]);


  // --- Handle Access Code ---
  const handleAccessCodeSubmit = (e) => {
    e.preventDefault();
    if (accessCodeInput === ACCESS_CODE_ENV) {
      setSiteAccessGranted(true);
      setAccessError('');
      localStorage.setItem(`skyeMovieAccess_${ACCESS_CODE_ENV}`, 'granted');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('skyeMovieAccess_') && key !== `skyeMovieAccess_${ACCESS_CODE_ENV}`) {
          localStorage.removeItem(key);
        }
      });
    } else {
      setAccessError(`Invalid code. Hint: ${ACCESS_CODE_DIGITS} digits.`);
      setAccessCodeInput('');
    }
  };

  // --- Handle Search ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
        setNotification({ message: 'Enter search term.', type: 'info' });
        return;
    }
    if (!TMDB_API_KEY) {
        setNotification({ message: 'TMDB API Key missing.', type: 'error' });
        return;
    }
    setIsLoading(true);
    setSearchResults([]);
    setCurrentPage('search');
    try {
      const response = await fetch(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchTerm)}&language=en-US&page=1`);
      if (!response.ok) throw new Error(`Search: ${response.status}`);
      const data = await response.json();
      setSearchResults(data.results || []);
      if (!data.results?.length) setNotification({ message: 'No results found.', type: 'info' });
    } catch (error) {
      console.error("Search error:", error);
      setNotification({ message: `Search failed: ${error.message}`, type: 'error' });
    }
    setIsLoading(false);
  };

  const navigateTo = (page) => {
    setCurrentPage(page);
    setPlayerContent(null);
    setIsMenuOpen(false);
    if (page === 'discover') {
        setSearchTerm('');
        setSearchResults([]);
    }
  };

  const playContent = (type, id, season = null, episode = null) => {
    if (type === 'tv' && (season === null || episode === null)) {
        setPlayerContent({ type: 'tv', id, season: season || 1, episode: episode || 1 });
    } else if (type === 'movie') {
        setPlayerContent({ type: 'movie', id });
    } else {
         setPlayerContent({ type: 'tv', id, season: season, episode: episode });
    }
    setCurrentPage('player');
  };

  const addToFavorites = async (item) => {
    if (!db || !currentUser || !siteAccessGranted) {
        setNotification({ message: 'Login or grant site access to add favorites.', type: 'error' });
        return;
    }
    const favCollectionPath = getFavoritesCollectionPath();
    if (!favCollectionPath) {
        setNotification({ message: 'Error with favorites storage.', type: 'error' });
        return;
    }
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    if (favorites.find(fav => fav.tmdb_id === item.id && fav.media_type === mediaType)) {
        setNotification({ message: `${item.title || item.name} is already in favorites.`, type: 'info' });
        return;
    }
    const favData = {
      tmdb_id: item.id, title: item.title || item.name, poster_path: item.poster_path,
      media_type: mediaType, added_at: new Date().toISOString(), user_uid: currentUser.uid
    };
    try {
      await addDoc(collection(db, favCollectionPath), favData);
      setNotification({ message: `${favData.title} added to favorites!`, type: 'success' });
    } catch (error) {
      console.error("Add to favorites error:", error);
      setNotification({ message: `Failed to add ${favData.title}. ${error.message}`, type: 'error' });
    }
  };

  const removeFromFavorites = async (firestoreDocId) => {
    if (!db || !currentUser || !siteAccessGranted) {
        setNotification({ message: 'Login or grant site access to manage favorites.', type: 'error' });
        return;
    }
    const favCollectionPath = getFavoritesCollectionPath();
    if (!favCollectionPath) {
        setNotification({ message: 'Error with favorites storage.', type: 'error' });
        return;
    }
    try {
      const itemToRemove = favorites.find(f => f.id === firestoreDocId);
      await deleteDoc(doc(db, favCollectionPath, firestoreDocId));
      setNotification({ message: `${itemToRemove ? itemToRemove.title : 'Item'} removed.`, type: 'success' });
    } catch (error) {
      console.error("Remove from favorites error:", error);
      setNotification({ message: `Failed to remove. ${error.message}`, type: 'error' });
    }
  };

  const renderContentCard = (item, isFavoritePage = false) => {
    const tmdbId = isFavoritePage ? item.tmdb_id : item.id;
    const title = item.title || item.name;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const isFav = favorites.some(fav => fav.tmdb_id === tmdbId && fav.media_type === mediaType);
    const firestoreFavDoc = isFav ? favorites.find(fav => fav.tmdb_id === tmdbId && fav.media_type === mediaType) : null;

    return (
      <div key={isFavoritePage ? item.id : item.id}
           className="bg-sky-blue-light rounded-lg shadow-lg overflow-hidden transform hover:scale-105 transition-transform duration-300 flex flex-col">
        <img
          src={item.poster_path ? `${POSTER_BASE_URL}${item.poster_path}` : 'https://placehold.co/500x750/E0F7FA/70B8D8?text=No+Image'}
          alt={title}
          className="w-full h-auto object-cover aspect-[2/3] cursor-pointer"
          onClick={() => playContent(mediaType, tmdbId)}
          onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/500x750/E0F7FA/70B8D8?text=Img+Error'; }}
        />
        <div className="p-3 md:p-4 flex flex-col flex-grow">
          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-1 md:mb-2 truncate h-6 md:h-auto" title={title}>{title}</h3>
          <p className="text-xs md:text-sm text-gray-600 capitalize mb-1">{mediaType}</p>
          {item.vote_average !== undefined && <p className="text-xs md:text-sm text-yellow-600 mb-2">Rating: {Number(item.vote_average).toFixed(1)}/10</p>}
          <div className="mt-auto flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <button
              onClick={() => playContent(mediaType, tmdbId)}
              className="flex-1 bg-sky-blue hover:bg-sky-blue-dark text-white font-semibold py-2 px-2 md:px-3 rounded-md text-xs md:text-sm transition-colors duration-200 flex items-center justify-center"
            > <Film size={14} className="mr-1" /> Play </button>
            {currentUser && siteAccessGranted && ( // Show fav button only if user session and site access
              <>
                {!isFavoritePage && (
                  <button
                    onClick={() => isFav && firestoreFavDoc ? removeFromFavorites(firestoreFavDoc.id) : addToFavorites(item)}
                    className={`flex-1 font-semibold py-2 px-2 md:px-3 rounded-md text-xs md:text-sm transition-colors duration-200 flex items-center justify-center ${isFav ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                  > <Heart size={14} className="mr-1" /> {isFav ? 'Unfavorite' : 'Favorite'} </button>
                )}
                {isFavoritePage && (
                     <button
                        onClick={() => removeFromFavorites(item.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-2 md:px-3 rounded-md text-xs md:text-sm transition-colors duration-200 flex items-center justify-center"
                    > <Trash2 size={14} className="mr-1" /> Remove </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const NotificationBar = () => {
    if (!notification.message) return null;
    const baseStyle = "fixed top-16 left-1/2 transform -translate-x-1/2 p-3 rounded-md text-white shadow-lg z-[60] transition-all duration-300 text-sm";
    let typeStyle = notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-sky-blue';
    return (
      <div className={`${baseStyle} ${typeStyle} animate-fadeInOut`}>
        <span>{notification.message}</span>
        <button onClick={() => setNotification({ message: '', type: '' })} className="ml-3 text-lg font-semibold leading-none hover:text-gray-200">&times;</button>
      </div>
    );
  };

   useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: '', type: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!isAuthReady) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-blue to-sky-blue-dark p-4">
            <h1 className="font-radey text-5xl md:text-7xl text-white mb-6 shadow-text">SkyeMovie</h1>
            <div className="text-white text-xl">Initializing...</div>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mt-4"></div>
        </div>
    );
  }

  if (!siteAccessGranted) { // Site access code screen
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-blue to-sky-blue-dark p-4">
        <h1 className="font-radey text-5xl sm:text-6xl md:text-8xl text-white mb-8 shadow-text">SkyeMovie</h1>
        <form onSubmit={handleAccessCodeSubmit} className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-sm">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-6 text-center">Enter Site Access Code</h2>
          <input type="password" value={accessCodeInput} onChange={(e) => setAccessCodeInput(e.target.value)}
            maxLength={ACCESS_CODE_DIGITS > 0 ? ACCESS_CODE_DIGITS : 10}
            className="w-full p-3 border border-sky-300 rounded-lg mb-4 text-center text-lg sm:text-xl tracking-[0.3em] sm:tracking-[0.5em]"
            placeholder={ACCESS_CODE_DIGITS > 0 ? Array(ACCESS_CODE_DIGITS).fill('•').join('') : "••••"} autoFocus required />
          {accessError && <p className="text-red-500 text-xs sm:text-sm mb-4 text-center">{accessError}</p>}
          <button type="submit" className="w-full bg-sky-blue hover:bg-sky-blue-dark text-white font-bold py-3 rounded-lg transition-colors duration-300 text-base sm:text-lg"> Unlock </button>
        </form>
         {currentUser && <p className="text-xs text-white mt-4 opacity-75">UID: {currentUser.uid} ({(currentUser.isAnonymous ?? true) ? 'Guest' : 'Logged In'})</p>}
      </div>
    );
  }

  // Main App Layout (Site Access Granted)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-sky-blue text-white p-3 md:p-4 shadow-md sticky top-0 z-40">
        <div className="container mx-auto flex justify-between items-center max-w-screen-xl">
          <h1 onClick={() => navigateTo('discover')} className="font-radey text-2xl sm:text-3xl md:text-4xl cursor-pointer hover:opacity-90 transition-opacity">SkyeMovie</h1>
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            <form onSubmit={handleSearch} className="flex">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search movies or TV..."
                className="px-3 py-2 rounded-l-md border-0 text-gray-800 focus:ring-2 focus:ring-sky-blue-light outline-none text-sm w-48 lg:w-64"/>
              <button type="submit" className="bg-sky-blue-dark hover:bg-opacity-80 px-3 py-2 rounded-r-md"> <Search size={18} /> </button>
            </form>
            <nav className="flex space-x-3 lg:space-x-4 items-center">
              <button onClick={() => navigateTo('discover')} className="hover:text-sky-blue-light transition-colors text-sm lg:text-base flex items-center"> <Home size={20} className="mr-1"/> Discover </button>
              <button onClick={() => navigateTo('favorites')} className="hover:text-sky-blue-light transition-colors text-sm lg:text-base flex items-center"> <Star size={20} className="mr-1"/> Favorites </button>
              {currentUser && (currentUser.isAnonymous ?? true) ? (
                <button onClick={() => setIsAuthModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center"> <LogIn size={16} className="mr-1"/> Login/Register </button>
              ) : (
                <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center"> <LogOut size={16} className="mr-1"/> Logout </button>
              )}
            </nav>
          </div>
          <div className="md:hidden flex items-center">
            {currentUser && (currentUser.isAnonymous ?? true) ? (
                <button onClick={() => setIsAuthModalOpen(true)} className="text-white mr-3 p-1 hover:bg-sky-blue-dark rounded-md"><UserPlus size={22}/></button>
            ) : (
                <button onClick={handleLogout} className="text-white mr-3 p-1 hover:bg-sky-blue-dark rounded-md"><LogOut size={22}/></button>
            )}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu"> {isMenuOpen ? <X size={26} /> : <Menu size={26} />} </button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-sky-blue shadow-lg p-4 z-30 border-t border-sky-blue-dark">
            <form onSubmit={handleSearch} className="flex mb-4">
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..."
                className="flex-grow px-3 py-2 rounded-l-md border-0 text-gray-800 focus:ring-2 focus:ring-sky-blue-light outline-none text-sm"/>
              <button type="submit" className="bg-sky-blue-dark hover:bg-opacity-80 px-4 py-2 rounded-r-md"> <Search size={18} /> </button>
            </form>
            <nav className="flex flex-col space-y-3">
              <button onClick={() => navigateTo('discover')} className="text-left hover:text-sky-blue-light transition-colors py-2 text-sm flex items-center"> <Home size={18} className="mr-2"/> Discover </button>
              <button onClick={() => navigateTo('favorites')} className="text-left hover:text-sky-blue-light transition-colors py-2 text-sm flex items-center"> <Star size={18} className="mr-2"/> Favorites </button>
            </nav>
          </div>
        )}
      </header>

      <NotificationBar />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={() => setNotification({ message: 'Logged in successfully!', type: 'success' })}
        onRegisterSuccess={() => setNotification({ message: 'Registered successfully! Please log in.', type: 'success' })}
      />

      <main className="container mx-auto p-3 md:p-6 flex-grow w-full max-w-screen-xl">
        {isLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-sky-blue-dark">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-blue-dark mb-3"></div>
                <p className="text-lg">Loading content...</p>
            </div>
        )}
        {currentPage === 'player' && playerContent && (
          <div className="my-4 md:my-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-3 md:mb-4 capitalize">
              Playing: {playerContent.type === 'movie' ? 'Movie' : `TV Show (S${playerContent.season} E${playerContent.episode})`}
            </h2>
            <div className="aspect-video bg-black rounded-lg shadow-xl overflow-hidden">
              <iframe src={playerContent.type === 'movie' ? `${PLAYER_BASE_URL_MOVIE}/${playerContent.id}` : `${PLAYER_BASE_URL_TV}/${playerContent.id}-${playerContent.season}-${playerContent.episode}`}
                title="Media Player" frameBorder="0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="w-full h-full"></iframe>
            </div>
            <button onClick={() => navigateTo(searchResults.length > 0 && searchTerm ? 'search' : 'discover')}
              className="mt-4 md:mt-6 bg-sky-blue hover:bg-sky-blue-dark text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm">
              &larr; Back to {searchResults.length > 0 && searchTerm ? 'Search Results' : 'Discover'}
            </button>
          </div>
        )}
        {currentPage === 'discover' && !playerContent && (
          <>
            <section className="mb-8 md:mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 mb-4 md:mb-6 border-l-4 border-sky-blue pl-3">Popular Movies</h2>
              {discoverMovies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                  {discoverMovies.map(item => renderContentCard(item))}</div>
              ) : !isLoading && <p className="text-gray-500 pl-3">No movies to display.</p>}
            </section>
            <section>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 mb-4 md:mb-6 border-l-4 border-sky-blue pl-3">Popular TV Shows</h2>
              {discoverTV.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                  {discoverTV.map(item => renderContentCard(item))}</div>
              ) : !isLoading && <p className="text-gray-500 pl-3">No TV shows to display.</p>}
            </section>
          </>
        )}
        {currentPage === 'search' && !playerContent && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 mb-4 md:mb-6 border-l-4 border-sky-blue pl-3">
                {searchResults.length > 0 || isLoading ? `Search Results for "${searchTerm}"` : `No Results for "${searchTerm}"`}
            </h2>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                {searchResults.filter(item => item.media_type === 'movie' || item.media_type === 'tv').map(item => renderContentCard(item))}</div>
            ) : !isLoading && <p className="text-gray-500 pl-3">Try a different search term.</p>}
          </section>
        )}
        {currentPage === 'favorites' && !playerContent && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700 mb-4 md:mb-6 border-l-4 border-sky-blue pl-3">Your Favorites</h2>
            {favorites.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
                {favorites.map(fav => renderContentCard(fav, true))}</div>
            ) : !isLoading && <p className="text-gray-500 pl-3">No favorites yet. Add some using the <Heart size={16} className="inline text-green-500"/> button!</p>}
          </section>
        )}
      </main>
      <footer className="bg-sky-blue-dark text-white text-center p-4 md:p-6 mt-auto">
        <p className="text-sm">&copy; {new Date().getFullYear()} SkyeMovie. All rights reserved.</p>
        {currentUser && <p className="text-xs mt-1 opacity-75">UID: {currentUser.uid} ({(currentUser.isAnonymous ?? true) ? 'Guest' : currentUser.email})</p>}
        <p className="text-xs mt-1 opacity-75">Content by TMDB. Player by Mappletv.</p>
      </footer>
    </div>
  );
}

export default App;

