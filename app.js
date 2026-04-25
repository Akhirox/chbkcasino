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

const balanceDisplay = document.getElementById('brundle-balance');
const btnSpin = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const fsMessage = document.getElementById('freespin-message');
const ptBetDisplay = document.getElementById('pt-bet-display');
const paytableContent = document.getElementById('paytable-content');
const winLinesSvg = document.getElementById('win-lines-svg');

const autoSpinCountSelect = document.getElementById('auto-spin-count');
const btnAutoSpin = document.getElementById('btn-auto-spin');
const btnStopAuto = document.getElementById('btn-stop-auto');

let currentBalance = 0;
let freeSpins = 0;
let isSpinning = false;
let isAutoSpinning = false;
let autoSpinsRemaining = 0;
let winLineTimer = null;

// --- LES 25 LIGNES DE PAIEMENT (Basées sur ta capture) ---
// Format : index du tableau = colonne, valeur = ligne (0=haut, 1=milieu, 2=bas)
const PAYLINES = [
    [1, 1, 1, 1, 1], // Ligne 1 : Tout au milieu
    [0, 0, 0, 0, 0], // Ligne 2 : Tout en haut
    [2, 2, 2, 2, 2], // Ligne 3 : Tout en bas
    [0, 1, 2, 1, 0], // Ligne 4 : V
    [2, 1, 0, 1, 2], // Ligne 5 : V inversé
    [0, 0, 1, 0, 0], // Ligne 6
    [2, 2, 1, 2, 2], // Ligne 7
    [1, 0, 0, 0, 1], // Ligne 8
    [1, 2, 2, 2, 1], // Ligne 9
    [1, 0, 1, 0, 1], // Ligne 10
    [1, 2, 1, 2, 1], // Ligne 11
    [0, 1, 0, 1, 0], // Ligne 12
    [2, 1, 2, 1, 2], // Ligne 13
    [1, 1, 0, 1, 1], // Ligne 14
    [1, 1, 2, 1, 1], // Ligne 15
    [0, 2, 2, 2, 0], // Ligne 16
    [2, 0, 0, 0, 2], // Ligne 17
    [0, 1, 2, 2, 2], // Ligne 18
    [2, 1, 0, 0, 0], // Ligne 19
    [0, 2, 0, 2, 0], // Ligne 20
    [2, 0, 2, 0, 2], // Ligne 21
    [0, 0, 2, 0, 0], // Ligne 22
    [2, 2, 0, 2, 2], // Ligne 23
    [0, 2, 1, 2, 0], // Ligne 24
    [2, 0, 1, 0, 2]  // Ligne 25
];

// --- HAUTE VOLATILITÉ : Multiplicateurs de la mise TOTALE ---
const SYM_CONFIG = {
    cherry:  { file: 'slot_cherry.png',  payout: [0.1, 0.5, 2],  color: '#e74c3c' },
    lemon:   { file: 'slot_lemon.png',   payout: [0.1, 0.5, 2],  color: '#f1c40f' },
    orange:  { file: 'slot_orange.png',  payout: [0.2, 0.8, 3],  color: '#e67e22' },
    grapes:  { file: 'slot_grapes.png',  payout: [0.2, 0.8, 3],  color: '#9b59b6' },
    prunes:  { file: 'slot_prunes.png',  payout: [0.3, 1, 4],    color: '#8e44ad' },
    star:    { file: 'slot_star.png',    payout: [0.5, 2, 10],   color: '#f39c12' },
    bell:    { file: 'slot_bell.png',    payout: [0.5, 2, 10],   color: '#f1c40f' },
    diamond: { file: 'slot_diamond.png', payout: [2, 10, 50],    color: '#3498db' },
    s67:     { file: 'slot_67.png',      payout: [10, 50, 200],  color: '#2ecc71' },
    wild:    { file: 'slot_wild.png',    payout: [0, 0, 0],      color: '#ffffff' },
    scatter: { file: 'slot_chbk.png',    payout: [0, 0, 0],      color: '#e74c3c' } 
};

// Bande RTP
const reelTape = [
    'cherry','cherry','cherry','lemon','lemon','lemon', 'orange','orange','orange',
    'grapes','grapes', 'prunes','prunes', 'star','star', 'bell','bell', 
    'diamond', 's67', 'wild','wild', 'scatter','scatter'
];

function updatePaytable() {
    const bet = parseInt(betAmountInput.value) || 0;
    ptBetDisplay.textContent = bet;
    let html = '';
    const displayOrder = ['s67', 'diamond', 'star', 'bell', 'grapes', 'prunes', 'cherry', 'lemon', 'orange'];
    
    displayOrder.forEach(sym => {
        const p = SYM_CONFIG[sym].payout;
        html += `<div class="paytable-row">
                    <img src="slot_symbols/${SYM_CONFIG[sym].file}" class="paytable-sym">
                    <span class="paytable-vals">5x: <b>${Math.round(p[2]*bet)}</b> | 4x: <b>${Math.round(p[1]*bet)}</b> | 3x: <b>${Math.round(p[0]*bet)}</b></span>
                 </div>`;
    });
    paytableContent.innerHTML = html;
}
betAmountInput.addEventListener('input', updatePaytable);

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

// --- SVG GESTION LIGNES ---
function getSymbolCenter(col, row) {
    const x = 10 + (col * 80) + (col * 10) + 40; 
    const y = 10 + (row * 80) + 40; 
    return { x, y };
}

function drawWinningPaths(lineData) {
    while (winLinesSvg.firstChild) { winLinesSvg.removeChild(winLinesSvg.firstChild); }
    
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if (el) { el.classList.remove('winning-sym'); el.classList.add('dimmed'); }
        }
    }

    // Trace la ligne continue sur les 5 rouleaux
    let points = lineData.fullLine.map(p => `${getSymbolCenter(p.col, p.row).x},${getSymbolCenter(p.col, p.row).y}`).join(' ');
    let polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('class', 'win-line');
    polyline.setAttribute('points', points);
    polyline.setAttribute('stroke', lineData.color);
    polyline.setAttribute('stroke-width', '6');
    winLinesSvg.appendChild(polyline);

    // Illumine uniquement les symboles qui ont gagné
    lineData.winningSymbols.forEach(p => {
        const symEl = document.getElementById(`sym-${p.col}-${p.row}`);
        if(symEl) {
            symEl.classList.remove('dimmed');
            symEl.classList.add('winning-sym');
        }
    });
}

// --- AUTOSPIN ---
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

// --- MOTEUR DE JEU ---
btnSpin.addEventListener('click', () => {
    stopAutoSpin(); 
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
    while (winLinesSvg.firstChild) { winLinesSvg.removeChild(winLinesSvg.firstChild); }
    
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

        const stopTime = 0.8 + (col * 0.25); 
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-1440px)`;
        
        setTimeout(() => {
            strip.style.transition = 'none';
            strip.style.transform = `translateY(0px)`;
            strip.innerHTML = finalHTML;
        }, stopTime * 1000);
    }

    setTimeout(async () => {
        let totalWin = 0;
        let scatterCount = 0;
        let allWinningPaths = [];
        
        // 1. Comptage des Scatters
        for (let c = 0; c < 5; c++) {
            for (let r = 0; r < 3; r++) {
                if (finalGrid[c][r] === 'scatter') scatterCount++;
            }
        }

        // 2. Vérification des 25 Lignes
        PAYLINES.forEach(line => {
            let firstSym = null;
            let matchCount = 0;
            let winningSymbolsCoords = [];
            let fullLineCoords = [];

            for(let col = 0; col < 5; col++) {
                let row = line[col];
                let sym = finalGrid[col][row];
                fullLineCoords.push({col, row});

                if (sym === 'scatter') break; // Le scatter ne paie pas sur les lignes

                if (firstSym === null) {
                    if (sym !== 'wild') firstSym = sym;
                    matchCount++;
                    winningSymbolsCoords.push({col, row});
                } else {
                    if (sym === firstSym || sym === 'wild') {
                        matchCount++;
                        winningSymbolsCoords.push({col, row});
                    } else {
                        break;
                    }
                }
            }

            if (firstSym === null && matchCount > 0) firstSym = 's67'; // Cas full wilds

            if (matchCount >= 3 && firstSym) {
                let multiplier = SYM_CONFIG[firstSym].payout[matchCount - 3];
                let realPayout = Math.round(bet * multiplier);
                
                if (realPayout > 0) {
                    totalWin += realPayout;
                    allWinningPaths.push({
                        fullLine: fullLineCoords,
                        winningSymbols: winningSymbolsCoords,
                        color: SYM_CONFIG[firstSym].color
                    });
                }
            }
        });

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
            
            // Animation des lignes
            let pathIndex = 0;
            function showNextLine() {
                if(!isSpinning && allWinningPaths.length > 0) { 
                    drawWinningPaths(allWinningPaths[pathIndex]);
                    pathIndex = (pathIndex + 1) % allWinningPaths.length;
                    winLineTimer = setTimeout(showNextLine, 1200); 
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
        
        if (freeSpins > 0 || isAutoSpinning) {
            if (isAutoSpinning && freeSpins === 0) autoSpinsRemaining--;
            if (isAutoSpinning && autoSpinsRemaining <= 0 && freeSpins === 0) stopAutoSpin();
            else setTimeout(triggerSpin, totalWin > 0 ? 1800 : 500); 
        }

    }, 2000); 
}