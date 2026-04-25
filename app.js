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

const autoSpinCountSelect = document.getElementById('auto-spin-count');
const btnAutoSpin = document.getElementById('btn-auto-spin');
const btnStopAuto = document.getElementById('btn-stop-auto');

let currentBalance = 0;
let freeSpins = 0;
let isSpinning = false;
let isAutoSpinning = false;
let autoSpinsRemaining = 0;
let winLineTimer = null;

// --- MOTEUR AUDIO (Web Audio API) ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.body.addEventListener('click', initAudio, { once: true });

function playSound(type) {
    if(!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'spin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        gain.gain.setValueAtTime(0.02, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t); osc.stop(t + 0.05);
    } else if (type === 'stop') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.setValueAtTime(450, t + 0.1);
        osc.frequency.setValueAtTime(600, t + 0.2);
        osc.frequency.setValueAtTime(900, t + 0.3);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
    }
}

// --- LES 25 LIGNES DE PAIEMENT ---
const PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 0, 1],
    [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
    [0, 2, 2, 2, 0], [2, 0, 0, 0, 2], [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [0, 2, 0, 2, 0],
    [2, 0, 2, 0, 2], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 1, 2, 0], [2, 0, 1, 0, 2]
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

// Bande RTP v12 : RARETÉ FIXEE (Beaucoup de fruits, Wild et Scatter très rares)
const reelTape = [
    'cherry','cherry','cherry','cherry','cherry',
    'lemon','lemon','lemon','lemon','lemon',
    'orange','orange','orange','orange',
    'grapes','grapes','grapes',
    'prunes','prunes',
    'star','bell', 
    'diamond', 's67', 'wild', 'scatter'
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

// --- GESTION DES SYMBOLES GAGNANTS (Glow Vert + Respiration) ---
function drawWinningSymbols(symbolCoords) {
    // 1. On assombrit tous les symboles avant d'illuminer la nouvelle ligne
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if (el) { el.classList.remove('winning-sym'); el.classList.add('dimmed'); }
        }
    }

    // 2. On illumine les symboles de ce chemin gagnant
    symbolCoords.forEach(p => {
        const symEl = document.getElementById(`sym-${p.col}-${p.row}`);
        if(symEl) {
            symEl.classList.remove('dimmed');
            symEl.classList.add('winning-sym');
        }
    });
}

// --- FONCTIONS AUTOSPIN ---
btnAutoSpin.addEventListener('click', () => {
    initAudio(); 
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
    initAudio(); 
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

    let spinTickInterval = setInterval(() => playSound('spin'), 120);

    // Animation de rotation
    for (let col = 0; col < 5; col++) {
        const strip = document.getElementById(`strip-${col}`);
        
        let oldHTML = strip.innerHTML.replace(/id="sym-\d-\d"/g, '');
        
        let blurHTML = '';
        let blurCount = 15 + (col * 5); 
        for(let i=0; i<blurCount; i++) {
            blurHTML += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[reelTape[Math.floor(Math.random() * reelTape.length)]].file}"></div>`;
        }
        let finalHTML = '';
        for(let row=0; row<3; row++) {
            finalHTML += `<div class="symbol" id="sym-${col}-${row}"><img src="slot_symbols/${SYM_CONFIG[finalGrid[col][row]].file}"></div>`;
        }

        strip.style.transition = 'none';
        strip.style.transform = `translateY(0px)`;
        strip.innerHTML = oldHTML + blurHTML + finalHTML;
        strip.offsetHeight; 

        const stopTime = 1.0 + (col * 0.5); 
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-${(3 + blurCount) * 80}px)`;
        
        setTimeout(() => {
            strip.style.transition = 'none';
            strip.style.transform = `translateY(0px)`;
            strip.innerHTML = finalHTML;
            playSound('stop'); 
        }, stopTime * 1000);
    }

    setTimeout(() => clearInterval(spinTickInterval), 2900);

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

            for(let col = 0; col < 5; col++) {
                let row = line[col];
                let sym = finalGrid[col][row];

                if (sym === 'scatter') break; 

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

            if (firstSym === null && matchCount > 0) firstSym = 's67'; 

            if (matchCount >= 3 && firstSym) {
                let multiplier = SYM_CONFIG[firstSym].payout[matchCount - 3];
                let realPayout = Math.round(bet * multiplier);
                
                if (realPayout > 0) {
                    totalWin += realPayout;
                    allWinningPaths.push(winningSymbolsCoords);
                }
            }
        });

        // Application FS
        if (freeSpins > 0) { totalWin *= 2; freeSpins--; }

        if (scatterCount === 3) freeSpins += 10;
        else if (scatterCount === 4) freeSpins += 20;
        else if (scatterCount === 5) freeSpins += 30;

        if (scatterCount >= 3) {
            playSound('win');
            slotMessage.textContent = `BOOM ! ${scatterCount} SCATTERS ! +${scatterCount === 3 ? 10 : (scatterCount === 4 ? 20 : 30)} FREE SPINS !`;
            slotMessage.style.color = "#f1c40f";
        } else if (totalWin > 0) {
            playSound('win');
            slotMessage.textContent = `SUPER ! Gain : +${totalWin} Brundles !`;
            slotMessage.style.color = "#2ecc71";
            
            // Lancer l'animation des symboles gagnants
            let pathIndex = 0;
            function showNextWinningSet() {
                if(!isSpinning && allWinningPaths.length > 0) { 
                    drawWinningSymbols(allWinningPaths[pathIndex]);
                    pathIndex = (pathIndex + 1) % allWinningPaths.length;
                    winLineTimer = setTimeout(showNextWinningSet, 1200); 
                }
            }
            showNextWinningSet();

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
        
        // Relance Auto ou FS
        if (freeSpins > 0 || isAutoSpinning) {
            if (isAutoSpinning && freeSpins === 0) autoSpinsRemaining--;
            if (isAutoSpinning && autoSpinsRemaining <= 0 && freeSpins === 0) stopAutoSpin();
            else setTimeout(triggerSpin, totalWin > 0 ? 2500 : 800); 
        }

    }, 3200); 
}