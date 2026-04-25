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

// Éléments UI
const balanceDisplay = document.getElementById('brundle-balance');
const btnSpin = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const fsMessage = document.getElementById('freespin-message');
const ptBetDisplay = document.getElementById('pt-bet-display');
const paytableContent = document.getElementById('paytable-content');
const winLinesSvg = document.getElementById('win-lines-svg');

// Boutons Auto
const autoSpinCountSelect = document.getElementById('auto-spin-count');
const btnAutoSpin = document.getElementById('btn-auto-spin');
const btnStopAuto = document.getElementById('btn-stop-auto');

let currentBalance = 0;
let freeSpins = 0;
let isSpinning = false;
let isAutoSpinning = false;
let autoSpinsRemaining = 0;
let winLineTimer = null;

// --- CONFIGURATION DE LA MACHINE À SOUS ---
const SYM_CONFIG = {
    cherry:  { file: 'slot_cherry.png',  payout: [0.5, 1, 2], color: '#e74c3c' },
    lemon:   { file: 'slot_lemon.png',   payout: [0.5, 1, 2], color: '#f1c40f' },
    orange:  { file: 'slot_orange.png',  payout: [0.5, 1, 2], color: '#e67e22' },
    grapes:  { file: 'slot_grapes.png',  payout: [0.5, 1, 2], color: '#9b59b6' },
    prunes:  { file: 'slot_prunes.png',  payout: [0.5, 1, 2], color: '#8e44ad' },
    star:    { file: 'slot_star.png',    payout: [1, 2, 5],   color: '#f39c12' },
    bell:    { file: 'slot_bell.png',    payout: [1, 2, 5],   color: '#f1c40f' },
    diamond: { file: 'slot_diamond.png', payout: [2, 5, 10],  color: '#3498db' },
    s67:     { file: 'slot_67.png',      payout: [5, 10, 25], color: '#2ecc71' },
    wild:    { file: 'slot_wild.png',    payout: [0, 0, 0],   color: '#ffffff' },
    scatter: { file: 'slot_chbk.png',    payout: [0, 0, 0],   color: '#e74c3c' } 
};

// Bande RTP 98% (Très généreuse en fruits et Wilds)
const reelTape = [
    'cherry','cherry','cherry', 'lemon','lemon','lemon', 'orange','orange','orange',
    'grapes','grapes', 'prunes','prunes', 'star','star', 'bell','bell', 
    'diamond', 's67', 'wild','wild','wild', 'scatter','scatter'
];

// --- MISE À JOUR DU TABLEAU DES GAINS ---
function updatePaytable() {
    const bet = parseInt(betAmountInput.value) || 0;
    ptBetDisplay.textContent = bet;
    let html = '';
    const displayOrder = ['s67', 'diamond', 'star', 'bell', 'grapes', 'prunes', 'cherry', 'lemon', 'orange'];
    
    displayOrder.forEach(sym => {
        const p = SYM_CONFIG[sym].payout;
        html += `<div class="paytable-row">
                    <img src="slot_symbols/${SYM_CONFIG[sym].file}" class="paytable-sym">
                    <span class="paytable-vals">5x: <b>${p[2]*bet}</b> | 4x: <b>${p[1]*bet}</b> | 3x: <b>${p[0]*bet}</b></span>
                 </div>`;
    });
    paytableContent.innerHTML = html;
}
betAmountInput.addEventListener('input', updatePaytable);

// --- INITIALISATION ---
function initReels() {
    for(let col = 0; col < 5; col++) {
        let html = '';
        for(let row = 0; row < 3; row++) {
            const sym = reelTape[Math.floor(Math.random() * reelTape.length)];
            html += `<div class="symbol" id="sym-${col}-${row}"><img src="slot_symbols/${SYM_CONFIG[sym].file}"></div>`;
        }
        document.getElementById(`strip-${col}`).innerHTML = html;
    }
}

// --- CONNEXION & LOBBY ---
document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('casino-section').classList.remove('hidden');
        document.getElementById('player-name').textContent = user.displayName;
        const userSnap = await getDoc(doc(db, "users", user.uid));
        currentBalance = userSnap.exists() ? userSnap.data().balance : 0;
        balanceDisplay.textContent = currentBalance;
        initReels(); updatePaytable();
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('casino-section').classList.add('hidden');
        document.getElementById('slot-section').classList.add('hidden');
    }
});

document.getElementById('btn-claim-bonus').addEventListener('click', async () => {
    const user = auth.currentUser;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const today = new Date().toISOString().split('T')[0];
    if (userSnap.data().lastClaimDate !== today) {
        currentBalance += 2500;
        await updateDoc(userRef, { balance: currentBalance, lastClaimDate: today });
        balanceDisplay.textContent = currentBalance;
        document.getElementById('bonus-message').textContent = "Jackpot ! +2500 Brundles.";
    }
});

document.getElementById('btn-open-slot').addEventListener('click', () => { document.getElementById('casino-section').classList.add('hidden'); document.getElementById('slot-section').classList.remove('hidden'); });
document.getElementById('btn-back-lobby').addEventListener('click', () => { document.getElementById('slot-section').classList.add('hidden'); document.getElementById('casino-section').classList.remove('hidden'); balanceDisplay.textContent = currentBalance; stopAutoSpin(); });

// --- GESTION DES LIGNES GAGNANTES (SVG) ---
function getSymbolCenter(col, row) {
    // Calcul exact basé sur le CSS : padding 10px, gap 10px, symboles 80x80
    const x = 10 + (col * 80) + (col * 10) + 40; // padding-left + cols_before + gaps_before + half_width
    const y = 10 + (row * 80) + 40; // padding-top + rows_before + half_height
    return { x, y };
}

function drawWinningPaths(paths, color) {
    winLinesSvg.innerHTML = ''; // Nettoyer
    paths.forEach(path => {
        let points = path.map(p => `${getSymbolCenter(p.col, p.row).x},${getSymbolCenter(p.col, p.row).y}`).join(' ');
        winLinesSvg.innerHTML += `<polyline class="win-line" points="${points}" stroke="${color}" stroke-width="6" />`;
        // Mettre en évidence les symboles de ce chemin
        path.forEach(p => {
            const symEl = document.getElementById(`sym-${p.col}-${p.row}`);
            if(symEl) symEl.classList.add('winning-sym');
        });
    });
}

// --- FONCTIONS AUTOSPIN ---
btnAutoSpin.addEventListener('click', () => {
    autoSpinsRemaining = parseInt(autoSpinCountSelect.value);
    isAutoSpinning = true;
    btnAutoSpin.classList.add('hidden');
    btnStopAuto.classList.remove('hidden');
    if (!isSpinning) triggerSpin();
});

btnStopAuto.addEventListener('click', stopAutoSpin);

function stopAutoSpin() {
    isAutoSpinning = false;
    autoSpinsRemaining = 0;
    btnAutoSpin.classList.remove('hidden');
    btnStopAuto.classList.add('hidden');
}

// --- LE MOTEUR DU JEU ---
btnSpin.addEventListener('click', () => {
    stopAutoSpin(); // Clic manuel arrête l'auto
    if (!isSpinning) triggerSpin();
});

async function triggerSpin() {
    if (isSpinning) return;
    const user = auth.currentUser;
    let bet = parseInt(betAmountInput.value);

    if (freeSpins === 0 && (isNaN(bet) || bet <= 0 || bet > currentBalance)) {
        slotMessage.textContent = bet > currentBalance ? "Fonds insuffisants !" : "Mise invalide !";
        stopAutoSpin(); return;
    }

    isSpinning = true;
    btnSpin.disabled = true;
    betAmountInput.disabled = true;
    
    clearTimeout(winLineTimer);
    winLinesSvg.innerHTML = '';
    
    // Enlever les effets de surbrillance/flou
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if(el) { el.classList.remove('winning-sym'); el.classList.remove('dimmed'); }
        }
    }

    if (freeSpins > 0) {
        fsMessage.textContent = `🎰 FREE SPINS : Il t'en reste ${freeSpins} ! (Gains X2)`;
    } else {
        currentBalance -= bet;
        fsMessage.textContent = "";
    }
    
    slotMessage.textContent = isAutoSpinning ? `Auto... (Reste: ${autoSpinsRemaining > 900000 ? '∞' : autoSpinsRemaining})` : "Bonne chance...";
    slotMessage.style.color = "white";

    const finalGrid = [[], [], [], [], []];
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 3; row++) {
            finalGrid[col].push(reelTape[Math.floor(Math.random() * reelTape.length)]);
        }
    }

    // Animation de rotation
    for (let col = 0; col < 5; col++) {
        const strip = document.getElementById(`strip-${col}`);
        let blurHTML = '';
        for(let i=0; i<15; i++) {
            blurHTML += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[reelTape[Math.floor(Math.random() * reelTape.length)]].file}"></div>`;
        }
        let finalHTML = '';
        for(let row=0; row<3; row++) {
            finalHTML += `<div class="symbol" id="sym-${col}-${row}"><img src="slot_symbols/${SYM_CONFIG[finalGrid[col][row]].file}"></div>`;
        }

        strip.style.transition = 'none';
        strip.style.transform = `translateY(0px)`;
        strip.innerHTML = strip.innerHTML + blurHTML + finalHTML;
        strip.offsetHeight; 

        const stopTime = 0.8 + (col * 0.25); // Un peu plus rapide pour plus de fluidité
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-1440px)`;
        
        setTimeout(() => {
            strip.style.transition = 'none';
            strip.style.transform = `translateY(0px)`;
            strip.innerHTML = finalHTML;
        }, stopTime * 1000);
    }

    // Calculs et affichage post-spin
    setTimeout(async () => {
        let totalWin = 0;
        let scatterCount = 0;
        const baseSymbols = ['cherry','lemon','orange','grapes','prunes','star','bell','diamond','s67'];
        
        // Trouver Scatters
        for (let c = 0; c < 5; c++) {
            for (let r = 0; r < 3; r++) {
                if (finalGrid[c][r] === 'scatter') scatterCount++;
            }
        }

        let allWinningPaths = [];

        // Recherche des chemins Multi-Way
        baseSymbols.forEach(symType => {
            let activeNodes = [[], [], [], [], []];
            let length = 0;
            
            for (let c = 0; c < 5; c++) {
                let foundInCol = false;
                for (let r = 0; r < 3; r++) {
                    if (finalGrid[c][r] === symType || finalGrid[c][r] === 'wild') {
                        activeNodes[c].push(r);
                        foundInCol = true;
                    }
                }
                if (foundInCol) length++;
                else break; 
            }
            
            if (length >= 3) {
                let multiplier = SYM_CONFIG[symType].payout[length - 3];
                
                // Construire tous les chemins (Array combinatoire) pour ce symbole
                let pathsForSym = [];
                function buildPath(col, currentPath) {
                    if(col === length) { pathsForSym.push([...currentPath]); return; }
                    activeNodes[col].forEach(row => {
                        currentPath.push({col, row});
                        buildPath(col + 1, currentPath);
                        currentPath.pop();
                    });
                }
                buildPath(0, []);
                
                totalWin += (bet * multiplier * pathsForSym.length);
                allWinningPaths.push({ paths: pathsForSym, color: SYM_CONFIG[symType].color });
            }
        });

        // Application FS
        if (freeSpins > 0) { totalWin *= 2; freeSpins--; }

        if (scatterCount === 3) freeSpins += 10;
        else if (scatterCount === 4) freeSpins += 20;
        else if (scatterCount === 5) freeSpins += 30;

        if (scatterCount >= 3) {
            slotMessage.textContent = `BOOM ! ${scatterCount} SCATTERS ! +${scatterCount === 3 ? 10 : (scatterCount === 4 ? 20 : 30)} FREE SPINS !`;
            slotMessage.style.color = "#f1c40f";
        } else if (totalWin > 0) {
            slotMessage.textContent = `SUPER ! Gain : +${totalWin} Brundles !`;
            slotMessage.style.color = "#2ecc71";
            
            // Assombrir les symboles perdants
            for(let c=0; c<5; c++) {
                for(let r=0; r<3; r++) { document.getElementById(`sym-${c}-${r}`).classList.add('dimmed'); }
            }

            // Afficher les lignes de manière cyclique
            let pathIndex = 0;
            function showNextLine() {
                if(!isSpinning && allWinningPaths.length > 0) { // On stoppe si on a relancé
                    drawWinningPaths(allWinningPaths[pathIndex].paths, allWinningPaths[pathIndex].color);
                    pathIndex = (pathIndex + 1) % allWinningPaths.length;
                    winLineTimer = setTimeout(showNextLine, 1200); // Alterne toutes les 1.2s
                }
            }
            showNextLine();

        } else {
            slotMessage.textContent = "Retente ta chance !";
            slotMessage.style.color = "#e74c3c";
            if(freeSpins === 0) fsMessage.textContent = "";
        }

        currentBalance += totalWin;
        await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });
        
        isSpinning = false;
        btnSpin.disabled = false;
        betAmountInput.disabled = false;
        
        // Relance Auto ou FS (Avec un petit délai pour voir les gains)
        if (freeSpins > 0 || isAutoSpinning) {
            if (isAutoSpinning && freeSpins === 0) autoSpinsRemaining--;
            if (isAutoSpinning && autoSpinsRemaining <= 0 && freeSpins === 0) stopAutoSpin();
            else setTimeout(triggerSpin, totalWin > 0 ? 1500 : 500); // On attend plus longtemps si on a gagné pour voir la ligne
        }

    }, 2000); // Fin d'animation du dernier rouleau
}