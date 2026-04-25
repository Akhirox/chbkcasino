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

const balanceDisplayLobby = document.getElementById('brundle-balance');
const balanceDisplaySlot = document.getElementById('slot-brundle-balance');
const btnSpin = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const fsMessage = document.getElementById('freespin-message');
const ptBetDisplay = document.getElementById('pt-bet-display');
const paytableContent = document.getElementById('paytable-content');
const bigWinOverlay = document.getElementById('big-win-overlay');
const bigWinAmount = document.getElementById('big-win-amount');
const lineVisualizer = document.getElementById('line-visualizer');
const vizGrid = document.querySelector('.viz-grid');

const autoSpinCountSelect = document.getElementById('auto-spin-count');
const btnAutoSpin = document.getElementById('btn-auto-spin');
const btnStopAuto = document.getElementById('btn-stop-auto');

let currentBalance = 0;
let freeSpins = 0;
let isSpinning = false;
let isAutoSpinning = false;
let autoSpinsRemaining = 0;
let winLineTimer = null;

// --- LES 21 LIGNES (O=0, M=1, B=2) ---
const PAYLINES = [
    [1, 1, 1, 1, 1], // 1: M-M-M-M-M
    [0, 0, 0, 0, 0], // 2: O-O-O-O-O
    [2, 2, 2, 2, 2], // 3: B-B-B-B-B
    [0, 1, 2, 1, 0], // 4: O-M-B-M-O
    [2, 1, 0, 1, 2], // 5: B-M-O-M-B
    [0, 0, 1, 0, 0], // 6: O-O-M-O-O
    [2, 2, 1, 2, 2], // 7: B-B-M-B-B
    [1, 0, 0, 0, 1], // 8: M-O-O-O-M
    [1, 2, 2, 2, 1], // 9: M-B-B-B-M
    [1, 0, 1, 0, 1], // 10: M-O-M-O-M
    [1, 2, 1, 2, 1], // 11: M-B-M-B-M
    [0, 1, 0, 1, 0], // 12: O-M-O-M-O
    [2, 1, 2, 1, 2], // 13: B-M-B-M-B
    [1, 1, 0, 1, 1], // 14: M-M-O-M-M
    [1, 1, 2, 1, 1], // 15: M-M-B-M-M
    [0, 2, 2, 2, 0], // 16: O-B-B-B-O
    [2, 0, 0, 0, 2], // 17: B-O-O-O-B
    [0, 1, 2, 2, 2], // 18: O-M-B-B-B
    [2, 1, 0, 0, 0], // 19: B-M-O-O-O
    [0, 2, 1, 2, 0], // 20: O-B-M-B-O
    [2, 0, 1, 0, 2]  // 21: B-O-M-O-B
];

const SYM_CONFIG = {
    cherry:  { file: 'slot_cherry.png',  payout: [0.1, 0.3, 1] },
    lemon:   { file: 'slot_lemon.png',   payout: [0.1, 0.3, 1] },
    orange:  { file: 'slot_orange.png',  payout: [0.2, 0.5, 2] },
    grapes:  { file: 'slot_grapes.png',  payout: [0.2, 0.5, 2] },
    prunes:  { file: 'slot_prunes.png',  payout: [0.3, 0.8, 4] },
    star:    { file: 'slot_star.png',    payout: [0.5, 2, 10] },
    bell:    { file: 'slot_bell.png',    payout: [0.5, 2, 10] },
    diamond: { file: 'slot_diamond.png', payout: [2, 10, 50] },
    s67:     { file: 'slot_67.png',      payout: [10, 50, 200] },
    wild:    { file: 'slot_wild.png',    payout: [0, 0, 0] },
    scatter: { file: 'slot_chbk.png',    payout: [0, 0, 0] } 
};

const reelTape = [
    'cherry','cherry','cherry','cherry','cherry','cherry',
    'lemon','lemon','lemon','lemon','lemon',
    'orange','orange','orange','orange',
    'grapes','grapes','grapes',
    'prunes','prunes',
    'star','star','bell','bell', 
    'diamond','diamond', 's67', 'wild','wild', 'scatter','scatter' 
];

// --- GESTION DU SOLDE ---
function updateBalanceDisplays(amount) {
    currentBalance = amount;
    balanceDisplayLobby.textContent = currentBalance;
    balanceDisplaySlot.textContent = currentBalance;
}

// --- MOTEUR AUDIO ---
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
    osc.connect(gain); gain.connect(audioCtx.destination);
    if (type === 'spin') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, t); osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        gain.gain.setValueAtTime(0.02, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t); osc.stop(t + 0.05);
    } else if (type === 'stop') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
    } else if (type === 'win') {
        osc.type = 'square'; osc.frequency.setValueAtTime(300, t); osc.frequency.setValueAtTime(450, t + 0.1); osc.frequency.setValueAtTime(600, t + 0.2); osc.frequency.setValueAtTime(900, t + 0.3);
        gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
    }
}

// --- INITIALISATION GRILLE DE VIZ ---
function initVizGrid() {
    vizGrid.innerHTML = '';
    for(let r=0; r<3; r++) {
        for(let c=0; c<5; c++) {
            const dot = document.createElement('div');
            dot.className = 'viz-dot';
            dot.id = `viz-${c}-${r}`;
            vizGrid.appendChild(dot);
        }
    }
}
initVizGrid();

// --- LOGIQUE AFFICHAGE ---
function drawWinningSymbols(symbolCoords, payline) {
    lineVisualizer.classList.remove('hidden');
    // On éteint tout d'abord
    document.querySelectorAll('.viz-dot').forEach(d => d.classList.remove('active'));
    
    // On allume le tracé de la ligne complète
    payline.forEach((row, col) => {
        document.getElementById(`viz-${col}-${row}`).classList.add('active');
    });

    // On s'occupe des symboles réels sur les rouleaux
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if (el) { el.style.opacity = '0.2'; el.style.filter = 'grayscale(100%)'; el.style.transform = 'scale(1)'; el.style.boxShadow = 'none'; el.style.zIndex = '1'; }
        }
    }
    symbolCoords.forEach(p => {
        const symEl = document.getElementById(`sym-${p.col}-${p.row}`);
        if(symEl) {
            symEl.style.transition = '0.3s ease'; symEl.style.opacity = '1'; symEl.style.filter = 'none'; symEl.style.transform = 'scale(1.15)'; symEl.style.background = 'rgba(46, 204, 113, 0.25)'; symEl.style.boxShadow = '0 0 25px #2ecc71'; symEl.style.borderRadius = '15px'; symEl.style.zIndex = '10';
        }
    });
}

function resetSymbolsVisuals() {
    bigWinOverlay.classList.add('hidden');
    lineVisualizer.classList.add('hidden');
    document.querySelectorAll('.viz-dot').forEach(d => d.classList.remove('active'));
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if(el) { el.style.opacity = '1'; el.style.filter = 'none'; el.style.transform = 'scale(1)'; el.style.background = 'transparent'; el.style.boxShadow = 'none'; }
        }
    }
}

// --- LOGIQUE JEU ---
function updatePaytable() {
    let bet = parseInt(betAmountInput.value);
    if(isNaN(bet) || bet < 1) bet = 1;
    ptBetDisplay.textContent = bet;
    let html = '';
    const displayOrder = ['s67', 'diamond', 'star', 'bell', 'grapes', 'prunes', 'cherry', 'lemon', 'orange'];
    displayOrder.forEach(sym => {
        const p = SYM_CONFIG[sym].payout;
        html += `<div class="paytable-row"><img src="slot_symbols/${SYM_CONFIG[sym].file}" class="paytable-sym"><span class="paytable-vals">5x: <b>${Math.max(1, Math.floor(p[2]*bet))}</b> | 4x: <b>${Math.max(1, Math.floor(p[1]*bet))}</b> | 3x: <b>${Math.max(1, Math.floor(p[0]*bet))}</b></span></div>`;
    });
    paytableContent.innerHTML = html;
}

document.querySelectorAll('.btn-bet').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (isSpinning) return;
        let bet = parseInt(betAmountInput.value) || 0;
        const val = e.target.dataset.val;
        if (val === '/2') bet = Math.floor(bet / 2); else if (val === 'x2') bet *= 2; else bet += parseInt(val);
        if (bet < 1) bet = 1; betAmountInput.value = bet; updatePaytable();
    });
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !document.getElementById('slot-section').classList.contains('hidden')) {
        e.preventDefault(); if (!btnSpin.disabled && !isSpinning) btnSpin.click();
    }
});

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

// --- FIREBASE & CONNEXION ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('casino-section').classList.remove('hidden');
        document.getElementById('player-name').textContent = user.displayName;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName, balance: 0, lastClaimDate: null });
            updateBalanceDisplays(0);
        } else {
            updateBalanceDisplays(userSnap.data().balance);
        }
        initReels(); updatePaytable();
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('casino-section').classList.add('hidden');
        document.getElementById('slot-section').classList.add('hidden');
    }
});

document.getElementById('btn-claim-bonus').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const today = new Date().toISOString().split('T')[0];
    if (userSnap.data().lastClaimDate !== today) {
        updateBalanceDisplays(currentBalance + 2500);
        await updateDoc(userRef, { balance: currentBalance, lastClaimDate: today });
        document.getElementById('bonus-message').textContent = "Jackpot ! +2500 Brundles.";
        document.getElementById('bonus-message').style.color = "#2ecc71";
    }
});

document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));
document.getElementById('btn-open-slot').addEventListener('click', () => { document.getElementById('casino-section').classList.add('hidden'); document.getElementById('slot-section').classList.remove('hidden'); });
document.getElementById('btn-back-lobby').addEventListener('click', () => { document.getElementById('slot-section').classList.add('hidden'); document.getElementById('casino-section').classList.remove('hidden'); stopAutoSpin(); });

// --- MOTEUR DE JEU ---
btnSpin.addEventListener('click', () => { initAudio(); stopAutoSpin(); if (!isSpinning) triggerSpin(); });
btnAutoSpin.addEventListener('click', () => { initAudio(); autoSpinsRemaining = parseInt(autoSpinCountSelect.value); isAutoSpinning = true; btnAutoSpin.classList.add('hidden'); btnStopAuto.classList.remove('hidden'); if (!isSpinning) triggerSpin(); });
btnStopAuto.addEventListener('click', stopAutoSpin);

function stopAutoSpin() { isAutoSpinning = false; autoSpinsRemaining = 0; btnAutoSpin.classList.remove('hidden'); btnStopAuto.classList.add('hidden'); }

async function triggerSpin() {
    if (isSpinning) return;
    const user = auth.currentUser;
    let bet = parseInt(betAmountInput.value);
    if (freeSpins === 0 && (isNaN(bet) || bet <= 0 || bet > currentBalance)) {
        slotMessage.textContent = bet > currentBalance ? "Fonds insuffisants !" : "Mise invalide !";
        stopAutoSpin(); return;
    }
    isSpinning = true; btnSpin.disabled = true; betAmountInput.disabled = true;
    document.querySelectorAll('.btn-bet').forEach(btn => btn.disabled = true);
    clearTimeout(winLineTimer); resetSymbolsVisuals();
    if (freeSpins > 0) fsMessage.textContent = `🎰 FREE SPINS : IL T'EN RESTE ${freeSpins} ! (GAINS X2)`;
    else { updateBalanceDisplays(currentBalance - bet); fsMessage.textContent = ""; }
    slotMessage.textContent = "Bonne chance...";
    const finalGrid = [[], [], [], [], []];
    for (let col = 0; col < 5; col++) { for (let row = 0; row < 3; row++) { finalGrid[col].push(reelTape[Math.floor(Math.random() * reelTape.length)]); } }
    let spinTickInterval = setInterval(() => playSound('spin'), 120);
    for (let col = 0; col < 5; col++) {
        const strip = document.getElementById(`strip-${col}`);
        let oldHTML = strip.innerHTML.replace(/id="sym-\d-\d"/g, '');
        let blurCount = 15 + (col * 5); 
        let blurHTML = '';
        for(let i=0; i<blurCount; i++) blurHTML += `<div class="symbol"><img src="slot_symbols/${SYM_CONFIG[reelTape[Math.floor(Math.random() * reelTape.length)]].file}"></div>`;
        let finalHTML = '';
        for(let row=0; row<3; row++) finalHTML += `<div class="symbol" id="sym-${col}-${row}"><img src="slot_symbols/${SYM_CONFIG[finalGrid[col][row]].file}"></div>`;
        strip.style.transition = 'none'; strip.style.transform = `translateY(0px)`;
        strip.innerHTML = oldHTML + blurHTML + finalHTML;
        strip.offsetHeight; 
        const stopTime = 1.0 + (col * 0.5); 
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-${(3 + blurCount) * 80}px)`;
        setTimeout(() => { strip.style.transition = 'none'; strip.style.transform = `translateY(0px)`; strip.innerHTML = finalHTML; playSound('stop'); }, stopTime * 1000);
    }
    setTimeout(() => clearInterval(spinTickInterval), 2900);
    setTimeout(async () => {
        let totalWin = 0; let scatterCount = 0; let allWinningPaths = [];
        for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) if (finalGrid[c][r] === 'scatter') scatterCount++;
        PAYLINES.forEach((line, index) => {
            let firstSym = null; let matchCount = 0; let winningSymbolsCoords = [];
            for(let col = 0; col < 5; col++) {
                let row = line[col]; let sym = finalGrid[col][row];
                if (sym === 'scatter') break;
                if (firstSym === null) { if (sym !== 'wild') firstSym = sym; matchCount++; winningSymbolsCoords.push({col, row}); }
                else { if (sym === firstSym || sym === 'wild') { matchCount++; winningSymbolsCoords.push({col, row}); } else break; }
            }
            if (firstSym === null && matchCount > 0) firstSym = 's67';
            if (matchCount >= 3 && firstSym) {
                let realPayout = Math.floor(bet * SYM_CONFIG[firstSym].payout[matchCount - 3]);
                if (realPayout > 0) { totalWin += realPayout; allWinningPaths.push({coords: winningSymbolsCoords, payline: line}); }
            }
        });
        if (freeSpins > 0) { totalWin *= 2; freeSpins--; }
        if (scatterCount === 3) freeSpins += 10; else if (scatterCount === 4) freeSpins += 20; else if (scatterCount === 5) freeSpins += 30;
        if (scatterCount >= 3) { playSound('win'); slotMessage.textContent = `BOOM ! ${scatterCount} SCATTERS ! +${scatterCount === 3 ? 10 : (scatterCount === 4 ? 20 : 30)} FREE SPINS !`; }
        else if (totalWin > 0) {
            playSound('win'); bigWinAmount.textContent = `+${totalWin}`; bigWinOverlay.classList.remove('hidden');
            let pathIndex = 0;
            function showNextWinningSet() {
                if(!isSpinning && allWinningPaths.length > 0) {
                    resetSymbolsVisuals(); lineVisualizer.classList.remove('hidden');
                    drawWinningSymbols(allWinningPaths[pathIndex].coords, allWinningPaths[pathIndex].payline);
                    pathIndex = (pathIndex + 1) % allWinningPaths.length;
                    winLineTimer = setTimeout(showNextWinningSet, 1200);
                }
            }
            showNextWinningSet();
        } else { slotMessage.textContent = "Retente ta chance !"; }
        updateBalanceDisplays(currentBalance + totalWin);
        await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });
        isSpinning = false; btnSpin.disabled = false; betAmountInput.disabled = false;
        document.querySelectorAll('.btn-bet').forEach(btn => btn.disabled = false);
        if (freeSpins > 0 || isAutoSpinning) {
            if (isAutoSpinning && freeSpins === 0) autoSpinsRemaining--;
            if (isAutoSpinning && autoSpinsRemaining <= 0 && freeSpins === 0) stopAutoSpin();
            else setTimeout(triggerSpin, totalWin > 0 ? 3000 : 800);
        } else if (totalWin > 0) { setTimeout(() => { if(!isSpinning) bigWinOverlay.classList.add('hidden'); resetSymbolsVisuals(); }, 3000); }
    }, 3200);
}