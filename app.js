// Importation des outils Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// NOUVEAU : Importation des outils de Base de données (Firestore)
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const db = getFirestore(app); // On lance la base de données
const provider = new GoogleAuthProvider();

// Éléments HTML
const loginSection = document.getElementById('login-section');
const casinoSection = document.getElementById('casino-section');
const authMessage = document.getElementById('auth-message');
const playerNameDisplay = document.getElementById('player-name');
const balanceDisplay = document.getElementById('brundle-balance');
const btnClaimBonus = document.getElementById('btn-claim-bonus');
const bonusMessage = document.getElementById('bonus-message');

// --- CONNEXION / DÉCONNEXION ---
document.getElementById('btn-google-login').addEventListener('click', () => {
    authMessage.textContent = "Ouverture de Google...";
    signInWithPopup(auth, provider).catch((error) => {
        authMessage.textContent = "Erreur : La connexion a échoué.";
        console.error(error);
    });
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth);
});

// --- SURVEILLANCE DE L'ÉTAT DU JOUEUR ET CHARGEMENT DES DONNÉES ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Connecté : Interface
        loginSection.classList.add('hidden');
        casinoSection.classList.remove('hidden');
        playerNameDisplay.textContent = user.displayName;
        balanceDisplay.textContent = "..."; // En attente du serveur
        bonusMessage.textContent = "";

        // On cherche le joueur dans la base de données
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // C'EST SA PREMIÈRE CONNEXION ! On lui crée un profil.
            await setDoc(userRef, {
                name: user.displayName,
                balance: 0,
                lastClaimDate: null // Jamais réclamé
            });
            balanceDisplay.textContent = "0";
        } else {
            // C'EST UN HABITUÉ ! On affiche son solde.
            const userData = userSnap.data();
            balanceDisplay.textContent = userData.balance;
        }

    } else {
        // Déconnecté
        loginSection.classList.remove('hidden');
        casinoSection.classList.add('hidden');
    }
});

// --- LE BONUS QUOTIDIEN (LES 2500 BRUNDLES) ---
btnClaimBonus.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    btnClaimBonus.disabled = true; // On désactive le bouton le temps de calculer
    bonusMessage.textContent = "Vérification...";
    bonusMessage.style.color = "white";

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    // On récupère la date d'aujourd'hui sous format "AAAA-MM-JJ" (ex: 2024-05-18)
    const today = new Date().toISOString().split('T')[0];

    if (userData.lastClaimDate === today) {
        // Il a déjà réclamé aujourd'hui !
        bonusMessage.textContent = "Tu as déjà récupéré tes Brundles aujourd'hui ! Reviens demain.";
        bonusMessage.style.color = "#e74c3c"; // Rouge
    } else {
        // C'est bon, on lui donne l'argent !
        const newBalance = userData.balance + 2500;
        
        await updateDoc(userRef, {
            balance: newBalance,
            lastClaimDate: today
        });

        // On met à jour l'affichage
        balanceDisplay.textContent = newBalance;
        bonusMessage.textContent = "Jackpot ! 2500 Brundles ajoutés à ton compte.";
        bonusMessage.style.color = "#2ecc71"; // Vert
    }

    btnClaimBonus.disabled = false; // On réactive le bouton
});