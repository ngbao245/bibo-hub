# Calculator Modal

Basic calculator with keyboard support accessible globally via Alt+C.

## 📋 Overview

Calculator modal provides basic arithmetic operations with keyboard support. Features standard calculator layout and operations (addition, subtraction, multiplication, division).

## 🚀 Features

- **Basic Operations**: +, −, ×, ÷
- **Keyboard Support**: Number keys, operators, Enter, Escape
- **Clear Function**: C button to clear display
- **Backspace**: ⌫ button to delete last digit
- **Decimal Support**: Decimal point for floating numbers
- **Global Access**: Open from any page with Alt+C
- **Toggle Support**: Press Alt+C once to open, again to close

## 📁 File Structure

```
modals/
├── calculator-loader.js    # Dynamic modal loader
├── calculator-modal.js     # Modal logic
├── calculator-modal.css    # Modal styles
└── README.md               # This file
```

## 🔧 Technical Implementation

### Calculator Logic (calculator-modal.js)

**State Management:**
```javascript
let calcDisplay = '0';
let calcOperator = null;
let calcPrevValue = null;
let calcWaitingForOperand = false;
```

**Number Input:**
```javascript
function calcNum(num) {
    const display = document.getElementById('calcDisplay');
    
    if (calcWaitingForOperand) {
        display.value = num;
        calcWaitingForOperand = false;
    } else {
        display.value = display.value === '0' ? num : display.value + num;
    }
}
```

**Operator Input:**
```javascript
function calcOp(op) {
    const display = document.getElementById('calcDisplay');
    const value = parseFloat(display.value);
    
    if (calcPrevValue === null) {
        calcPrevValue = value;
    } else if (calcOperator) {
        const result = performCalculation(calcPrevValue, value, calcOperator);
        display.value = result;
        calcPrevValue = result;
    }
    
    calcWaitingForOperand = true;
    calcOperator = op;
}
```

**Calculation:**
```javascript
function performCalculation(prev, current, operator) {
    switch (operator) {
        case '+': return prev + current;
        case '-': return prev - current;
        case '*': return prev * current;
        case '/': return current !== 0 ? prev / current : 'Error';
        default: return current;
    }
}
```

**Equals:**
```javascript
function calcEquals() {
    const display = document.getElementById('calcDisplay');
    const value = parseFloat(display.value);
    
    if (calcOperator && calcPrevValue !== null) {
        const result = performCalculation(calcPrevValue, value, calcOperator);
        display.value = result;
        calcPrevValue = null;
        calcOperator = null;
        calcWaitingForOperand = true;
    }
}
```

**Clear & Backspace:**
```javascript
function calcClear() {
    document.getElementById('calcDisplay').value = '0';
    calcOperator = null;
    calcPrevValue = null;
    calcWaitingForOperand = false;
}

function calcBackspace() {
    const display = document.getElementById('calcDisplay');
    display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0';
}
```

**Decimal:**
```javascript
function calcDecimal() {
    const display = document.getElementById('calcDisplay');
    
    if (calcWaitingForOperand) {
        display.value = '0.';
        calcWaitingForOperand = false;
    } else if (!display.value.includes('.')) {
        display.value += '.';
    }
}
```

### Modal Loader (calculator-loader.js)

**Dynamic Loading with Toggle:**
```javascript
let calculatorModalLoaded = false;

async function loadCalculatorModal() {
    if (calculatorModalLoaded) return;
    
    try {
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Inject HTML
        const html = `
            <div id="calculatorModal" class="modal">
                <div class="modal-content" style="max-width: 350px;">
                    <div class="modal-header">
                        <span class="modal-title">Calculator</span>
                        <button onclick="closeCalculatorModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="calcDisplay" class="calc-display" readonly value="0">
                        <div class="calc-buttons">
                            <button class="calc-btn calc-clear" onclick="calcClear()">C</button>
                            <button class="calc-btn calc-operator" onclick="calcBackspace()">⌫</button>
                            <button class="calc-btn calc-operator" onclick="calcOp('/')">÷</button>
                            <button class="calc-btn calc-operator" onclick="calcOp('*')">×</button>
                            
                            <button class="calc-btn" onclick="calcNum('7')">7</button>
                            <button class="calc-btn" onclick="calcNum('8')">8</button>
                            <button class="calc-btn" onclick="calcNum('9')">9</button>
                            <button class="calc-btn calc-operator" onclick="calcOp('-')">−</button>
                            
                            <button class="calc-btn" onclick="calcNum('4')">4</button>
                            <button class="calc-btn" onclick="calcNum('5')">5</button>
                            <button class="calc-btn" onclick="calcNum('6')">6</button>
                            <button class="calc-btn calc-operator" onclick="calcOp('+')">+</button>
                            
                            <button class="calc-btn" onclick="calcNum('1')">1</button>
                            <button class="calc-btn" onclick="calcNum('2')">2</button>
                            <button class="calc-btn" onclick="calcNum('3')">3</button>
                            <button class="calc-btn calc-equals" onclick="calcEquals()" style="grid-row: span 2;">=</button>
                            
                            <button class="calc-btn" onclick="calcNum('0')" style="grid-column: span 2;">0</button>
                            <button class="calc-btn" onclick="calcDecimal()">.</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS
        if (!document.querySelector('link[href*="calculator-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'modals/calculator-modal.css';
            document.head.appendChild(link);
        }
        
        // Load JS
        if (typeof openCalculatorModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'modals/calculator-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        calculatorModalLoaded = true;
    } catch (error) {
        console.error('Error loading calculator modal:', error);
    }
}

// Lazy open with toggle
async function openCalculatorModalLazy() {
    await loadCalculatorModal();
    
    const modal = document.getElementById('calculatorModal');
    
    if (modal && modal.classList.contains('show')) {
        if (typeof closeCalculatorModal === 'function') {
            closeCalculatorModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        if (typeof openCalculatorModal === 'function') {
            openCalculatorModal();
        } else {
            modal.classList.add('show');
        }
    }
}
```

### Key Functions

- `openCalculatorModal()`: Open modal
- `closeCalculatorModal()`: Close modal
- `calcNum(num)`: Input number
- `calcOp(op)`: Input operator (+, −, ×, ÷)
- `calcEquals()`: Calculate result
- `calcClear()`: Clear display
- `calcBackspace()`: Delete last digit
- `calcDecimal()`: Input decimal point

## 🎨 Styling

### Key CSS Classes
- `.modal`: Modal container (z-index: 10000)
- `.calc-display`: Display input (readonly)
- `.calc-buttons`: Button grid container
- `.calc-btn`: Standard button
- `.calc-operator`: Operator button (blue)
- `.calc-equals`: Equals button (green, spans 2 rows)
- `.calc-clear`: Clear button (red)

### Layout
```
┌─────────────────────────────┐
│ Calculator                × │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 0                       │ │
│ └─────────────────────────┘ │
│                             │
│ [C] [⌫] [÷] [×]             │
│ [7] [8] [9] [-]             │
│ [4] [5] [6] [+]             │
│ [1] [2] [3] [=]             │
│ [  0  ] [.]     │           │
└─────────────────────────────┘
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles

### Integration
- Loaded via `calculator-loader.js` in all pages
- Registered in `shortcuts-config.js` with Alt+C
- Handled by `global-shortcuts.js`

## 🚀 Usage

### Basic Operations

1. **Open Calculator**: Press `Alt+C` or click "Calculator" in Hub
2. **Enter Numbers**: Click number buttons or use keyboard
3. **Select Operator**: Click +, −, ×, ÷
4. **Enter Second Number**: Click numbers
5. **Calculate**: Click = or press Enter
6. **Clear**: Click C or press Escape

### Example Calculations

**Addition:**
```
7 + 3 = 10
```

**Subtraction:**
```
15 - 8 = 7
```

**Multiplication:**
```
6 × 9 = 54
```

**Division:**
```
20 ÷ 4 = 5
```

**Decimal:**
```
3.14 × 2 = 6.28
```

### Keyboard Shortcuts

- `0-9`: Number input
- `+`: Addition
- `-`: Subtraction
- `*`: Multiplication
- `/`: Division
- `Enter`: Equals
- `Escape`: Clear
- `Backspace`: Delete last digit
- `.`: Decimal point

## ⚙️ Configuration

### Adding Scientific Functions

**Example: Add square root:**
```javascript
function calcSqrt() {
    const display = document.getElementById('calcDisplay');
    const value = parseFloat(display.value);
    display.value = Math.sqrt(value);
}

// Add button in HTML
<button class="calc-btn" onclick="calcSqrt()">√</button>
```

**Example: Add power:**
```javascript
function calcPower() {
    calcOp('^');
}

// In performCalculation
case '^': return Math.pow(prev, current);
```

### Changing Display Precision

**Limit decimal places:**
```javascript
function calcEquals() {
    // ... calculation ...
    const result = performCalculation(calcPrevValue, value, calcOperator);
    display.value = parseFloat(result.toFixed(2)); // 2 decimal places
}
```

## 🐛 Troubleshooting

### Division by zero
- Returns "Error" instead of Infinity
- Clear and try again

### Decimal not working
- Check if decimal already exists in number
- Only one decimal per number allowed

### Keyboard not working
- Verify modal is focused
- Check Console for errors
- Try clicking modal first

### Result too long
- Display may overflow
- Consider limiting decimal places
- Use scientific notation for large numbers

## 📝 Development Notes

### Adding Memory Functions

**Example: Memory store/recall:**
```javascript
let calcMemory = 0;

function calcMemoryStore() {
    const display = document.getElementById('calcDisplay');
    calcMemory = parseFloat(display.value);
}

function calcMemoryRecall() {
    const display = document.getElementById('calcDisplay');
    display.value = calcMemory;
}

function calcMemoryClear() {
    calcMemory = 0;
}
```

### Adding History

**Example: Calculation history:**
```javascript
let calcHistory = [];

function calcEquals() {
    // ... calculation ...
    const result = performCalculation(calcPrevValue, value, calcOperator);
    
    // Save to history
    calcHistory.push(`${calcPrevValue} ${calcOperator} ${value} = ${result}`);
    
    display.value = result;
}

function showHistory() {
    console.log(calcHistory);
}
```

### Performance
- All calculations are instant (< 1ms)
- No API calls required
- Works offline

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../shortcut/GLOBAL-MODAL-POPUP-GUIDE.md`: How to create global modals

## 📞 Support

For issues or questions:
1. Check this README first
2. Verify keyboard shortcuts work
3. Check Console for errors
4. Try clearing and starting over

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript
