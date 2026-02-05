// Calculator Modal Logic

function openCalculatorModal() {
    document.getElementById('calculatorModal').classList.add('show');
}

function closeCalculatorModal() {
    document.getElementById('calculatorModal').classList.remove('show');
}

let calcCurrent = '0';
let calcPrevious = '';
let calcOperation = null;

function calcNum(n) {
    calcCurrent = calcCurrent === '0' ? n : calcCurrent + n;
    document.getElementById('calcDisplay').value = calcCurrent;
}

function calcOp(op) {
    if (calcOperation && calcPrevious) {
        calcEquals();
    }
    calcPrevious = calcCurrent;
    calcCurrent = '0';
    calcOperation = op;
}

function calcEquals() {
    if (!calcOperation || !calcPrevious) return;
    const a = parseFloat(calcPrevious);
    const b = parseFloat(calcCurrent);
    let result = 0;
    
    switch(calcOperation) {
        case '+': result = a + b; break;
        case '-': result = a - b; break;
        case '*': result = a * b; break;
        case '/': result = a / b; break;
    }
    
    calcCurrent = result.toString();
    calcPrevious = '';
    calcOperation = null;
    document.getElementById('calcDisplay').value = calcCurrent;
}

function calcClear() {
    calcCurrent = '0';
    calcPrevious = '';
    calcOperation = null;
    document.getElementById('calcDisplay').value = '0';
}

function calcBackspace() {
    calcCurrent = calcCurrent.slice(0, -1) || '0';
    document.getElementById('calcDisplay').value = calcCurrent;
}

function calcDecimal() {
    if (!calcCurrent.includes('.')) {
        calcCurrent += '.';
        document.getElementById('calcDisplay').value = calcCurrent;
    }
}
