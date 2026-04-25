import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXdrKA_9cOVjkadt0vPUfZtFoSmo_urtU",
  authDomain: "chbkcasino.firebaseapp.com",
  projectId: "chbkcasino",
  storageBucket: "chbkcasino.firebasestorage.app",
  messagingSenderId: "782505372980",
  appId: "1:782505372980:web:daab84c9f8ae2367d7c961"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Éléments HTML ---
const loginSection = document.getElementById('login-section');
const casinoSection = document.getElementById('casino-section');
const slotSection = document.getElementById('slot-section');
const authMessage = document.getElementById('auth-message');
const playerNameDisplay = document.getElementById('player-name');
const balanceDisplay = document.getElementById('brundle-balance');
const btnClaimBonus = document.getElementById('btn-claim-bonus');
const bonusMessage = document.getElementById('bonus-message');

// Éléments Slot
const btnOpenSlot = document.getElementById('btn-open-slot');
const btnBackLobby = document.getElementById('btn-back-lobby');
const btnSpin = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const reelsUI = [
    document.getElementById('reel-1'),
    document.getElementById('reel-2'),
    document.getElementById('reel-3'),
    document.getElementById('reel-4'),
    document.getElementById('reel-5')
];

let currentBalance = 0; // On stocke le solde localement pour jouer vite

// --- AUTHENTIFICATION ---
document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginSection.classList.add('hidden');
        casinoSection.classList.remove('hidden');
        slotSection.classList.add('hidden');
        playerNameDisplay.textContent = user.displayName;
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName, balance: 0, lastClaimDate: null });
            currentBalance = 0;
        } else {
            currentBalance = userSnap.data().balance;
        }
        balanceDisplay.textContent = currentBalance;
    } else {
        loginSection.classList.remove('hidden');
        casinoSection.classList.add('hidden');
        slotSection.classList.add('hidden');
    }
});

// --- BONUS QUOTIDIEN ---
btnClaimBonus.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    btnClaimBonus.disabled = true;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const today = new Date().toISOString().split('T')[0];

    if (userData.lastClaimDate === today) {
        bonusMessage.textContent = "Tu as déjà récupéré tes Brundles aujourd'hui !";
        bonusMessage.style.color = "#e74c3c";
    } else {
        currentBalance += 2500;
        await updateDoc(userRef, { balance: currentBalance, lastClaimDate: today });
        balanceDisplay.textContent = currentBalance;
        bonusMessage.textContent = "Jackpot ! 2500 Brundles ajoutés.";
        bonusMessage.style.color = "#2ecc71";
    }
    btnClaimBonus.disabled = false;
});

// --- NAVIGATION CASINO <-> MACHINE A SOUS ---
btnOpenSlot.addEventListener('click', () => {
    casinoSection.classList.add('hidden');
    slotSection.classList.remove('hidden');
    slotMessage.textContent = "Prêt à tenter ta chance ?";
});

btnBackLobby.addEventListener('click', () => {
    slotSection.classList.add('hidden');
    casinoSection.classList.remove('hidden');
    balanceDisplay.textContent = currentBalance; // Met à jour le lobby
});

// --- LOGIQUE DE LA MACHINE À SOUS ---
// C'est ici que tu pourras mettre tes propres symboles plus tard !
const symbols = ['🍒', '🍋', '🍉', '🔔', '💎', '👑']; 

btnSpin.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;

    const bet = parseInt(betAmountInput.value);
    
    // Vérifications
    if (isNaN(bet) || bet <= 0) {
        slotMessage.textContent = "Mise invalide !"; return;
    }
    if (bet > currentBalance) {
        slotMessage.textContent = "Fonds insuffisants !"; return;
    }

    // On bloque le bouton et on déduit la mise locale
    btnSpin.disabled = true;
    currentBalance -= bet;
    slotMessage.textContent = "Ça tourne...";
    slotMessage.style.color = "white";

    // Animation basique des rouleaux (dure 1 seconde)
    let spinInterval = setInterval(() => {
        reelsUI.forEach(reel => {
            reel.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        });
    }, 100);

    // Arrêt de l'animation après 1 seconde et calcul des gains
    setTimeout(async () => {
        clearInterval(spinInterval);
        
        // Résultats finaux
        const results = [];
        for(let i = 0; i < 5; i++) {
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            results.push(randomSymbol);
            reelsUI[i].textContent = randomSymbol;
        }

        // On compte si des symboles sont identiques
        const counts = {};
        results.forEach(sym => counts[sym] = (counts[sym] || 0) + 1);
        const maxMatches = Math.max(...Object.values(counts));

        let winAmount = 0;
        if (maxMatches === 5) { winAmount = bet * 50; slotMessage.textContent = `JACKPOT MEGA ! +${winAmount} Brundles !`; slotMessage.style.color = "#f1c40f"; }
        else if (maxMatches === 4) { winAmount = bet * 10; slotMessage.textContent = `SUPER GAIN ! +${winAmount} Brundles !`; slotMessage.style.color = "#2ecc71"; }
        else if (maxMatches === 3) { winAmount = bet * 3; slotMessage.textContent = `Gagné ! +${winAmount} Brundles !`; slotMessage.style.color = "#3498db"; }
        else { slotMessage.textContent = "Perdu... Essaie encore !"; slotMessage.style.color = "#e74c3c"; }

        // Ajout du gain au solde local
        currentBalance += winAmount;

        // MISE À JOUR DE FIREBASE UNE SEULE FOIS (Optimisation)
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { balance: currentBalance });

        btnSpin.disabled = false;
    }, 1000);
});