// Calculator Modal Loader
let calculatorModalLoaded = false;

async function loadCalculatorModal() {
    if (calculatorModalLoaded) return;
    
    try {
        // Detect current path (notes/, tasks/, or root)
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Load CSS first and wait for it
        if (!document.querySelector('link[href*="calculator-modal.css"]')) {
            await new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = basePath + 'modals/calculator-modal.css';
                link.onload = resolve;
                document.head.appendChild(link);
            });
        }
        
        // Then inject HTML directly (no fetch needed - avoids CORS)
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
        
        // Load JS if not already loaded - use Promise to wait for script load
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

// Lazy open function with toggle
async function openCalculatorModalLazy() {
    // Load modal first if not loaded
    await loadCalculatorModal();
    
    const modal = document.getElementById('calculatorModal');
    
    // Toggle: if open, close it
    if (modal && modal.classList.contains('show')) {
        if (typeof closeCalculatorModal === 'function') {
            closeCalculatorModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        // Otherwise open it
        if (typeof openCalculatorModal === 'function') {
            openCalculatorModal();
        } else {
            modal.classList.add('show');
        }
    }
}
