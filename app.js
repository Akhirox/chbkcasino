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

// Éléments HTML
const loginSection = document.getElementById('login-section');
const casinoSection = document.getElementById('casino-section');
const slotSection = document.getElementById('slot-section');
const balanceDisplay = document.getElementById('brundle-balance');
const btnSpin = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const fsMessage = document.getElementById('freespin-message');

let currentBalance = 0;
let freeSpins = 0;
let isSpinning = false;

// --- CONFIGURATION DE LA MACHINE À SOUS ---
// Payouts : Multiplicateurs de la mise pour 3, 4 ou 5 symboles alignés de gauche à droite
const SYM_CONFIG = {
    cherry:  { file: 'slot_cherry.png',  payout: [0.5, 1, 2] },
    lemon:   { file: 'slot_lemon.png',   payout: [0.5, 1, 2] },
    orange:  { file: 'slot_orange.png',  payout: [0.5, 1, 2] },
    grapes:  { file: 'slot_grapes.png',  payout: [0.5, 1, 2] },
    prunes:  { file: 'slot_prunes.png',  payout: [0.5, 1, 2] },
    star:    { file: 'slot_star.png',    payout: [1, 2, 5] },
    bell:    { file: 'slot_bell.png',    payout: [1, 2, 5] },
    diamond: { file: 'slot_diamond.png', payout: [2, 5, 10] },
    s67:     { file: 'slot_67.png',      payout: [5, 10, 25] },
    wild:    { file: 'slot_wild.png',    payout: [0, 0, 0] }, // Remplace les autres
    scatter: { file: 'slot_chbk.png',    payout: [0, 0, 0] }  // Déclenche les tours gratuits
};

// Bande (Reel Tape) pour simuler la rareté (plus il y a de noms, plus c'est fréquent)
const reelTape = [
    'cherry','cherry','cherry','lemon','lemon','lemon','orange','orange','orange',
    'grapes','grapes','prunes','prunes', 
    'star','star','bell','bell', 
    'diamond','diamond', 
    's67', 
    'wild','wild', 
    'scatter'
];

// Initialisation visuelle au démarrage (3 symboles aléatoires par colonne)
function initReels() {
    for(let col = 0; col < 5; col++) {
        let html = '';
        for(let row = 0; row < 3; row++) {
            const sym = reelTape[Math.floor(Math.random() * reelTape.length)];
            html += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[sym].file}"></div>`;
        }
        document.getElementById(`strip-${col}`).innerHTML = html;
    }
}

// --- LOGIQUE AUTH & LOBBY ---
document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginSection.classList.add('hidden');
        casinoSection.classList.remove('hidden');
        document.getElementById('player-name').textContent = user.displayName;
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentBalance = userSnap.exists() ? userSnap.data().balance : 0;
        balanceDisplay.textContent = currentBalance;
        initReels();
    } else {
        loginSection.classList.remove('hidden');
        casinoSection.classList.add('hidden');
        slotSection.classList.add('hidden');
    }
});

document.getElementById('btn-claim-bonus').addEventListener('click', async () => { /* Bonus gardé intact */
    const user = auth.currentUser;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const today = new Date().toISOString().split('T')[0];
    if (userSnap.data().lastClaimDate !== today) {
        currentBalance += 2500;
        await updateDoc(userRef, { balance: currentBalance, lastClaimDate: today });
        balanceDisplay.textContent = currentBalance;
        document.getElementById('bonus-message').textContent = "Jackpot ! +2500 Brundles.";
        document.getElementById('bonus-message').style.color = "#2ecc71";
    }
});

document.getElementById('btn-open-slot').addEventListener('click', () => { casinoSection.classList.add('hidden'); slotSection.classList.remove('hidden'); });
document.getElementById('btn-back-lobby').addEventListener('click', () => { slotSection.classList.add('hidden'); casinoSection.classList.remove('hidden'); balanceDisplay.textContent = currentBalance; });

// --- LE MOTEUR DE LA MACHINE À SOUS ---
btnSpin.addEventListener('click', async () => {
    if (isSpinning) return;
    const user = auth.currentUser;
    let bet = parseInt(betAmountInput.value);

    if (freeSpins > 0) {
        // En Free Spins, on ne paye pas la mise !
        fsMessage.textContent = `🎰 FREE SPINS : Il t'en reste ${freeSpins} ! (Gains X2)`;
    } else {
        if (isNaN(bet) || bet <= 0) { slotMessage.textContent = "Mise invalide !"; return; }
        if (bet > currentBalance) { slotMessage.textContent = "Fonds insuffisants !"; return; }
        currentBalance -= bet;
        fsMessage.textContent = "";
    }

    isSpinning = true;
    btnSpin.disabled = true;
    slotMessage.textContent = "Bonne chance...";
    slotMessage.style.color = "white";

    // Génération du résultat (Tableau 5 colonnes x 3 rangées)
    const finalGrid = [[], [], [], [], []];
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 3; row++) {
            finalGrid[col].push(reelTape[Math.floor(Math.random() * reelTape.length)]);
        }
    }

    // ANIMATION VISUELLE (SMOOTH SCROLL)
    // On construit une longue bande avec : [3 symboles actuels] + [15 symboles de flou] + [3 symboles finaux]
    for (let col = 0; col < 5; col++) {
        const strip = document.getElementById(`strip-${col}`);
        let currentHTML = strip.innerHTML; // Les 3 anciens
        
        let blurHTML = '';
        for(let i=0; i<15; i++) {
            let randomSym = reelTape[Math.floor(Math.random() * reelTape.length)];
            blurHTML += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[randomSym].file}"></div>`;
        }

        let finalHTML = '';
        for(let row=0; row<3; row++) {
            finalHTML += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[finalGrid[col][row]].file}"></div>`;
        }

        // On assemble tout et on réinitialise la position
        strip.style.transition = 'none';
        strip.style.transform = `translateY(0px)`;
        strip.innerHTML = currentHTML + blurHTML + finalHTML;

        // Force le navigateur à appliquer le HTML avant de lancer la transition
        strip.offsetHeight; 

        // On lance l'animation (On décale de 18 symboles vers le haut, chaque symbole = 80px -> 18*80 = 1440)
        // Les colonnes s'arrêtent une par une (col 0 à 1s, col 1 à 1.3s...)
        const stopTime = 1 + (col * 0.3);
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-1440px)`;
        
        // Nettoyage après l'animation de la colonne
        setTimeout(() => {
            strip.style.transition = 'none';
            strip.style.transform = `translateY(0px)`;
            strip.innerHTML = finalHTML; // On ne garde que les 3 bons pour le prochain tour
        }, stopTime * 1000);
    }

    // --- CALCUL DES GAINS (Une fois que tout est arrêté, soit environ 2.2 secondes) ---
    setTimeout(async () => {
        let totalWin = 0;
        let scatterCount = 0;

        // Compter les Scatters
        for (let col = 0; col < 5; col++) {
            for (let row = 0; row < 3; row++) {
                if (finalGrid[col][row] === 'scatter') scatterCount++;
            }
        }

        // Système Multi-Way 243
        const baseSymbols = ['cherry','lemon','orange','grapes','prunes','star','bell','diamond','s67'];
        
        baseSymbols.forEach(symType => {
            let ways = 1;
            let length = 0;
            
            for (let col = 0; col < 5; col++) {
                let countInCol = 0;
                for (let row = 0; row < 3; row++) {
                    // Le Wild sert de joker pour tous les symboles de base
                    if (finalGrid[col][row] === symType || finalGrid[col][row] === 'wild') {
                        countInCol++;
                    }
                }
                
                if (countInCol > 0) {
                    ways *= countInCol; // Ex: 2 cerises col1 x 1 cerise col2 x 3 cerises col3 = 6 chemins (ways) gagnants
                    length++;
                } else {
                    break; // La chaîne est cassée
                }
            }
            
            // On paie à partir de 3 symboles consécutifs (length >= 3)
            if (length >= 3) {
                let multiplier = SYM_CONFIG[symType].payout[length - 3]; // L'index 0 correspond à 3 symboles
                totalWin += (bet * multiplier * ways);
            }
        });

        // Doubler les gains si on est en Free Spins
        if (freeSpins > 0) { totalWin *= 2; freeSpins--; }

        // Mettre à jour les Free Spins si on a trouvé 3+ Scatters
        if (scatterCount >= 3) {
            freeSpins += 10;
            slotMessage.textContent = "BOOM ! 3 SCATTERS ! +10 FREE SPINS !";
            slotMessage.style.color = "#f1c40f";
        } else if (totalWin > 0) {
            slotMessage.textContent = `INCROYABLE ! Gain total : +${totalWin} Brundles !`;
            slotMessage.style.color = "#2ecc71";
        } else {
            slotMessage.textContent = "Dommage... retente ta chance !";
            slotMessage.style.color = "#e74c3c";
            if(freeSpins === 0) fsMessage.textContent = "";
        }

        // On sauvegarde sur Firebase
        currentBalance += totalWin;
        await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });
        
        isSpinning = false;
        btnSpin.disabled = false;
        
        // Si on a des tours gratuits, on relance automatiquement après 1.5 seconde !
        if(freeSpins > 0 && scatterCount < 3) {
            setTimeout(() => { document.getElementById('btn-spin').click(); }, 1500);
        }
    }, 2400); // Temps d'attente max d'animation (1 + 4*0.3 + marge)
});