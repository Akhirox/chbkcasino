// Importation des outils Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Ta configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBXdrKA_9cOVjkadt0vPUfZtFoSmo_urtU",
  authDomain: "chbkcasino.firebaseapp.com",
  projectId: "chbkcasino",
  storageBucket: "chbkcasino.firebasestorage.app",
  messagingSenderId: "782505372980",
  appId: "1:782505372980:web:daab84c9f8ae2367d7c961"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider(); // On prépare le fournisseur Google

// Récupération des éléments HTML
const loginSection = document.getElementById('login-section');
const casinoSection = document.getElementById('casino-section');
const authMessage = document.getElementById('auth-message');
const playerNameDisplay = document.getElementById('player-name');

// 1. Se connecter avec Google (Fenêtre Pop-up)
document.getElementById('btn-google-login').addEventListener('click', () => {
    authMessage.textContent = "Ouverture de Google...";
    
    signInWithPopup(auth, provider)
        .then((result) => {
            authMessage.textContent = "";
            console.log("Connexion réussie !");
        })
        .catch((error) => {
            authMessage.textContent = "Erreur : La connexion a échoué.";
            console.error(error);
        });
});

// 2. Se déconnecter
document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// 3. Surveiller l'état de l'utilisateur
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Connecté : on cache le bouton, on affiche le casino
        loginSection.classList.add('hidden');
        casinoSection.classList.remove('hidden');
        
        // On récupère le prénom Google du joueur pour l'afficher
        playerNameDisplay.textContent = user.displayName;
        
        // Solde temporaire avant l'étape 3
        document.getElementById('brundle-balance').textContent = "0"; 
    } else {
        // Déconnecté : on remet l'écran de base
        loginSection.classList.remove('hidden');
        casinoSection.classList.add('hidden');
    }
});