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

// LOBBY
const balanceDisplayLobby = document.getElementById('brundle-balance');
let currentBalance = 0;

// MACHINE A SOUS
const slotSection = document.getElementById('slot-section');
const balanceDisplaySlot = document.getElementById('slot-brundle-balance');
const btnSpinSlot = document.getElementById('btn-spin');
const betAmountInput = document.getElementById('bet-amount');
const slotMessage = document.getElementById('slot-message');
const fsMessage = document.getElementById('freespin-message');
const ptBetDisplay = document.getElementById('pt-bet-display');
const paytableContent = document.getElementById('paytable-content');
const bigWinOverlay = document.getElementById('big-win-overlay');
const bigWinAmount = document.getElementById('big-win-amount');
const winDisplayContent = document.getElementById('win-display-content');
const winDisplaySection = document.getElementById('win-display-section');
const autoSpinCountSelect = document.getElementById('auto-spin-count');
const btnAutoSpin = document.getElementById('btn-auto-spin');
const btnStopAuto = document.getElementById('btn-stop-auto');

// ROULETTE
const rouletteSection = document.getElementById('roulette-section');
const balanceDisplayRoulette = document.getElementById('roulette-brundle-balance');
const rouletteBoard = document.getElementById('roulette-board');
const btnSpinRoulette = document.getElementById('btn-spin-roulette');
const btnClearRoulette = document.getElementById('btn-clear-roulette');
const rouletteResultDisplay = document.getElementById('roulette-result');
const rouletteNumberSpan = document.getElementById('roulette-number');
const rouletteMessage = document.getElementById('roulette-message');

let freeSpins = 0;
let isSpinningSlot = false;
let isAutoSpinning = false;
let autoSpinsRemaining = 0;
let winLineTimer = null;

// Variables Roulette
let selectedChipValue = 10;
let rouletteBets = {}; // Format: { "32": 50, "red": 100, "even": 10 }
let totalRouletteBet = 0;
let isRouletteSpinning = false;

const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

// --- GESTION DU SOLDE ---
function updateBalanceDisplays(amount) {
    currentBalance = amount;
    balanceDisplayLobby.textContent = currentBalance;
    balanceDisplaySlot.textContent = currentBalance;
    balanceDisplayRoulette.textContent = currentBalance;
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
    } else if (type === 'roulette-tick') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.start(t); osc.stop(t + 0.05);
    }
}

// ==========================================
// ROULETTE LOGIC
// ==========================================

function initRouletteBoard() {
    let html = `<div class="r-cell r-green r-0" data-bet="0">0</div>`;
    
    // Générer les numéros 1 à 36 pour la grille CSS
    for (let col = 1; col <= 12; col++) {
        const n3 = col * 3;
        const n2 = col * 3 - 1;
        const n1 = col * 3 - 2;
        
        html += `<div class="r-cell ${RED_NUMS.includes(n3) ? 'r-red' : 'r-black'}" style="grid-row: 1; grid-column: ${col+1};" data-bet="${n3}">${n3}</div>`;
        html += `<div class="r-cell ${RED_NUMS.includes(n2) ? 'r-red' : 'r-black'}" style="grid-row: 2; grid-column: ${col+1};" data-bet="${n2}">${n2}</div>`;
        html += `<div class="r-cell ${RED_NUMS.includes(n1) ? 'r-red' : 'r-black'}" style="grid-row: 3; grid-column: ${col+1};" data-bet="${n1}">${n1}</div>`;
    }

    // Paris extérieurs
    html += `
        <div class="r-cell r-special r-1st12" data-bet="1st12">1st 12</div>
        <div class="r-cell r-special r-2nd12" data-bet="2nd12">2nd 12</div>
        <div class="r-cell r-special r-3rd12" data-bet="3rd12">3rd 12</div>
        
        <div class="r-cell r-special r-1to18" data-bet="1to18">1 to 18</div>
        <div class="r-cell r-special r-even" data-bet="even">EVEN</div>
        <div class="r-cell r-red-bet" data-bet="red">RED</div>
        <div class="r-cell r-black-bet" data-bet="black">BLACK</div>
        <div class="r-cell r-special r-odd" data-bet="odd">ODD</div>
        <div class="r-cell r-special r-19to36" data-bet="19to36">19 to 36</div>
    `;
    
    rouletteBoard.innerHTML = html;

    // Ajouter les events de clic pour miser
    document.querySelectorAll('.r-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
            if (isRouletteSpinning) return;
            initAudio();
            const betType = e.target.dataset.bet;
            if (!betType) return;
            
            // Vérifier les fonds
            if (currentBalance < selectedChipValue) {
                rouletteMessage.textContent = "Fonds insuffisants pour ce jeton !";
                rouletteMessage.style.color = "#e74c3c";
                return;
            }

            // Ajouter la mise
            if (!rouletteBets[betType]) rouletteBets[betType] = 0;
            rouletteBets[betType] += selectedChipValue;
            totalRouletteBet += selectedChipValue;
            
            updateBalanceDisplays(currentBalance - selectedChipValue);
            updateRouletteSpinButton();
            
            // Afficher le jeton visuellement
            let chipEl = e.target.querySelector('.placed-chip');
            if (!chipEl) {
                chipEl = document.createElement('div');
                chipEl.className = 'placed-chip';
                e.target.appendChild(chipEl);
            }
            chipEl.textContent = formatChipValue(rouletteBets[betType]);
            
            rouletteMessage.textContent = "Faites vos jeux...";
            rouletteMessage.style.color = "#aaa";
            playSound('spin'); // Petit son de clic
        });
    });
}

function formatChipValue(val) {
    if(val >= 1000) return (val/1000) + 'k';
    return val;
}

function updateRouletteSpinButton() {
    btnSpinRoulette.innerHTML = `LANCER LA BILLE ! <br><span style="font-size:0.7em;">(Mise totale : ${totalRouletteBet})</span>`;
    btnClearRoulette.textContent = `Annuler (${totalRouletteBet})`;
}

// Sélection des jetons
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        selectedChipValue = parseInt(e.target.dataset.val);
    });
});

// Annuler paris
btnClearRoulette.addEventListener('click', () => {
    if (isRouletteSpinning || totalRouletteBet === 0) return;
    updateBalanceDisplays(currentBalance + totalRouletteBet);
    rouletteBets = {};
    totalRouletteBet = 0;
    updateRouletteSpinButton();
    document.querySelectorAll('.placed-chip').forEach(c => c.remove());
    rouletteMessage.textContent = "Paris annulés.";
});

// Lancer la Roulette
btnSpinRoulette.addEventListener('click', async () => {
    initAudio();
    if (isRouletteSpinning) return;
    if (totalRouletteBet === 0) {
        rouletteMessage.textContent = "Placez au moins une mise !";
        rouletteMessage.style.color = "#f1c40f";
        return;
    }

    isRouletteSpinning = true;
    btnSpinRoulette.disabled = true;
    btnClearRoulette.disabled = true;
    rouletteMessage.textContent = "Rien ne va plus !";
    rouletteMessage.style.color = "#fff";
    
    rouletteResultDisplay.className = 'roulette-result-display'; // Reset color

    // L'animation du tirage (Défilement des numéros)
    let spins = 0;
    let maxSpins = 30; // Nombre de "bonds" avant de s'arrêter
    let finalNumber = Math.floor(Math.random() * 37); // 0 à 36

    let spinInterval = setInterval(() => {
        let tempNum = Math.floor(Math.random() * 37);
        rouletteNumberSpan.textContent = tempNum;
        playSound('roulette-tick');
        spins++;

        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            finishRouletteSpin(finalNumber);
        }
    }, 100); // 100ms entre chaque numéro
});

async function finishRouletteSpin(winningNumber) {
    const user = auth.currentUser;
    
    // Affichage visuel du résultat
    rouletteNumberSpan.textContent = winningNumber;
    if (winningNumber === 0) rouletteResultDisplay.classList.add('res-green');
    else if (RED_NUMS.includes(winningNumber)) rouletteResultDisplay.classList.add('res-red');
    else rouletteResultDisplay.classList.add('res-black');

    playSound('stop');

    // Calcul des gains
    let winAmount = 0;

    for (const [betType, amount] of Object.entries(rouletteBets)) {
        // Numéro plein (36x la mise)
        if (betType == winningNumber) winAmount += amount * 36;
        
        if (winningNumber !== 0) { // Les paris extérieurs perdent sur 0
            if (betType === 'red' && RED_NUMS.includes(winningNumber)) winAmount += amount * 2;
            if (betType === 'black' && !RED_NUMS.includes(winningNumber)) winAmount += amount * 2;
            if (betType === 'even' && winningNumber % 2 === 0) winAmount += amount * 2;
            if (betType === 'odd' && winningNumber % 2 !== 0) winAmount += amount * 2;
            if (betType === '1to18' && winningNumber >= 1 && winningNumber <= 18) winAmount += amount * 2;
            if (betType === '19to36' && winningNumber >= 19 && winningNumber <= 36) winAmount += amount * 2;
            
            // Douzaines (3x la mise)
            if (betType === '1st12' && winningNumber >= 1 && winningNumber <= 12) winAmount += amount * 3;
            if (betType === '2nd12' && winningNumber >= 13 && winningNumber <= 24) winAmount += amount * 3;
            if (betType === '3rd12' && winningNumber >= 25 && winningNumber <= 36) winAmount += amount * 3;
        }
    }

    if (winAmount > 0) {
        playSound('win');
        rouletteMessage.textContent = `GAGNÉ ! +${winAmount} Brundles !`;
        rouletteMessage.style.color = "#2ecc71";
        updateBalanceDisplays(currentBalance + winAmount);
    } else {
        rouletteMessage.textContent = "Perdu... Retentez votre chance !";
        rouletteMessage.style.color = "#e74c3c";
    }

    // Sauvegarde en BDD
    await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });

    // Reset pour le prochain tour
    rouletteBets = {};
    totalRouletteBet = 0;
    updateRouletteSpinButton();
    document.querySelectorAll('.placed-chip').forEach(c => c.remove());
    
    isRouletteSpinning = false;
    btnSpinRoulette.disabled = false;
    btnClearRoulette.disabled = false;
}


// ==========================================
// SLOT MACHINE LOGIC (Inchangé)
// ==========================================
const PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 2, 2, 2, 1], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1],
    [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0] 
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
    ...Array(20).fill('cherry'), ...Array(18).fill('lemon'), ...Array(15).fill('orange'), 
    ...Array(12).fill('grapes'), ...Array(9).fill('prunes'), ...Array(6).fill('star'),     
    ...Array(6).fill('bell'), ...Array(5).fill('diamond'), ...Array(5).fill('wild'),     
    ...Array(2).fill('s67'), ...Array(2).fill('scatter')
];

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
        if (isSpinningSlot) return;
        let bet = parseInt(betAmountInput.value) || 0;
        const val = e.target.dataset.val;
        if (val === '/2') bet = Math.floor(bet / 2); else if (val === 'x2') bet *= 2; else bet += parseInt(val);
        if (bet < 1) bet = 1; betAmountInput.value = bet; updatePaytable();
    });
});
betAmountInput.addEventListener('input', updatePaytable);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if(!slotSection.classList.contains('hidden') && !btnSpinSlot.disabled && !isSpinningSlot) {
            e.preventDefault(); btnSpinSlot.click();
        } else if (!rouletteSection.classList.contains('hidden') && !btnSpinRoulette.disabled && !isRouletteSpinning) {
            e.preventDefault(); btnSpinRoulette.click();
        }
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

// --- FIREBASE GLOBAL ---
document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

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
        initReels(); updatePaytable(); initRouletteBoard();
    } else {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('casino-section').classList.add('hidden');
        slotSection.classList.add('hidden');
        rouletteSection.classList.add('hidden');
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

// NAVIGATION
document.getElementById('btn-open-slot').addEventListener('click', () => { document.getElementById('casino-section').classList.add('hidden'); slotSection.classList.remove('hidden'); });
document.getElementById('btn-open-roulette').addEventListener('click', () => { document.getElementById('casino-section').classList.add('hidden'); rouletteSection.classList.remove('hidden'); });

document.querySelectorAll('.btn-back-lobby').forEach(btn => {
    btn.addEventListener('click', () => {
        slotSection.classList.add('hidden');
        rouletteSection.classList.add('hidden');
        document.getElementById('casino-section').classList.remove('hidden');
        stopAutoSpin();
    });
});

// --- SLOT LOGIC VISUALS ---
function drawWinningSymbols(symbolCoords) {
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if (el) { el.classList.remove('winning-sym'); el.classList.add('dimmed'); }
        }
    }
    symbolCoords.forEach(p => {
        const symEl = document.getElementById(`sym-${p.col}-${p.row}`);
        if(symEl) { symEl.classList.remove('dimmed'); symEl.classList.add('winning-sym'); }
    });
}

function resetSymbolsVisuals() {
    bigWinOverlay.classList.add('hidden');
    winDisplayContent.innerHTML = '<p class="empty-win-msg">En attente d\'un gain...</p>';
    for(let c=0; c<5; c++) {
        for(let r=0; r<3; r++) {
            const el = document.getElementById(`sym-${c}-${r}`);
            if(el) { el.classList.remove('winning-sym'); el.classList.remove('dimmed'); }
        }
    }
}

// --- FONCTIONS AUTOSPIN SLOT ---
btnAutoSpin.addEventListener('click', () => {
    initAudio(); autoSpinsRemaining = parseInt(autoSpinCountSelect.value);
    isAutoSpinning = true; btnAutoSpin.classList.add('hidden'); btnStopAuto.classList.remove('hidden');
    if (!isSpinningSlot) triggerSpinSlot();
});
btnStopAuto.addEventListener('click', stopAutoSpin);
function stopAutoSpin() { isAutoSpinning = false; autoSpinsRemaining = 0; btnAutoSpin.classList.remove('hidden'); btnStopAuto.classList.add('hidden'); }

btnSpinSlot.addEventListener('click', () => { initAudio(); stopAutoSpin(); if (!isSpinningSlot) triggerSpinSlot(); });

// --- MOTEUR SLOT ---
async function triggerSpinSlot() {
    if (isSpinningSlot) return;
    const user = auth.currentUser;
    let bet = parseInt(betAmountInput.value);

    if (freeSpins === 0 && (isNaN(bet) || bet <= 0 || bet > currentBalance)) {
        slotMessage.textContent = bet > currentBalance ? "Fonds insuffisants !" : "Mise invalide !";
        stopAutoSpin(); return;
    }

    isSpinningSlot = true; btnSpinSlot.disabled = true; betAmountInput.disabled = true;
    document.querySelectorAll('.btn-bet').forEach(btn => btn.disabled = true);
    
    clearTimeout(winLineTimer); resetSymbolsVisuals();

    if (freeSpins > 0) {
        fsMessage.textContent = `🎰 FREE SPINS : IL T'EN RESTE ${freeSpins} ! (GAINS X2)`;
    } else {
        updateBalanceDisplays(currentBalance - bet);
        fsMessage.textContent = "";
    }
    
    slotMessage.textContent = "Ça tourne...";
    slotMessage.style.color = "white";

    const finalGrid = [[], [], [], [], []];
    for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 3; row++) finalGrid[col].push(reelTape[Math.floor(Math.random() * reelTape.length)]);
    }

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
        strip.innerHTML = oldHTML + blurHTML + finalHTML; strip.offsetHeight; 
        const stopTime = 1.0 + (col * 0.5); 
        strip.style.transition = `transform ${stopTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        strip.style.transform = `translateY(-${(3 + blurCount) * 80}px)`;
        
        setTimeout(() => { strip.style.transition = 'none'; strip.style.transform = `translateY(0px)`; strip.innerHTML = finalHTML; playSound('stop'); }, stopTime * 1000);
    }

    setTimeout(() => clearInterval(spinTickInterval), 2900);

    setTimeout(async () => {
        let totalWin = 0; let scatterCount = 0; let allWinningPaths = []; let winGridsHTML = '';
        
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
                if (realPayout > 0) {
                    totalWin += realPayout;
                    allWinningPaths.push(winningSymbolsCoords);
                    let gridHTML = `<div class="win-line-box"><span>Gain : +${realPayout}</span><div class="mini-grid">`;
                    for(let r=0; r<3; r++) {
                        for(let c=0; c<5; c++) {
                            const isActive = winningSymbolsCoords.some(p => p.col === c && p.row === r);
                            gridHTML += `<div class="mini-dot ${isActive ? 'active' : ''}"></div>`;
                        }
                    }
                    gridHTML += `</div></div>`;
                    winGridsHTML += gridHTML;
                }
            }
        });

        if (freeSpins > 0) { totalWin *= 2; freeSpins--; }
        if (scatterCount === 3) freeSpins += 10; else if (scatterCount === 4) freeSpins += 20; else if (scatterCount === 5) freeSpins += 30;

        if (winGridsHTML !== '') winDisplayContent.innerHTML = winGridsHTML;

        if (scatterCount >= 3) {
            playSound('win'); slotMessage.textContent = `BOOM ! ${scatterCount} SCATTERS ! +${scatterCount === 3 ? 10 : (scatterCount === 4 ? 20 : 30)} FREE SPINS !`;
            slotMessage.style.color = "#f1c40f";
        } else if (totalWin > 0) {
            playSound('win');
            bigWinAmount.textContent = `+${totalWin}`; bigWinOverlay.classList.remove('hidden');
            slotMessage.textContent = `SUPER ! Gain : +${totalWin} Brundles !`; slotMessage.style.color = "#2ecc71";
            
            let pathIndex = 0;
            function showNextWinningSet() {
                if(!isSpinningSlot && allWinningPaths.length > 0) { 
                    for(let c=0; c<5; c++) {
                        for(let r=0; r<3; r++) {
                            const el = document.getElementById(`sym-${c}-${r}`);
                            if(el) { el.classList.remove('winning-sym'); el.classList.remove('dimmed'); }
                        }
                    }
                    drawWinningSymbols(allWinningPaths[pathIndex]); 
                    pathIndex = (pathIndex + 1) % allWinningPaths.length;
                    winLineTimer = setTimeout(showNextWinningSet, 1200); 
                }
            }
            showNextWinningSet();
        } else {
            slotMessage.textContent = "Retente ta chance !"; slotMessage.style.color = "#e74c3c";
        }

        updateBalanceDisplays(currentBalance + totalWin);
        await updateDoc(doc(db, "users", user.uid), { balance: currentBalance });
        
        isSpinningSlot = false; btnSpinSlot.disabled = false; betAmountInput.disabled = false;
        document.querySelectorAll('.btn-bet').forEach(btn => btn.disabled = false);
        
        if (freeSpins > 0 || isAutoSpinning) {
            if (isAutoSpinning && freeSpins === 0) autoSpinsRemaining--;
            if (isAutoSpinning && autoSpinsRemaining <= 0 && freeSpins === 0) stopAutoSpin();
            else setTimeout(triggerSpinSlot, totalWin > 0 ? 3000 : 800); 
        } else if (totalWin > 0) {
            setTimeout(() => { if(!isSpinningSlot) bigWinOverlay.classList.add('hidden'); }, 3000);
        }

    }, 3200); 
}