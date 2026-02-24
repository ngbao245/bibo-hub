// Savings Modal Loader
let savingsModalLoaded = false;

async function loadSavingsModal() {
    if (savingsModalLoaded) return;

    try {
        const basePath = window.location.pathname.includes('/notes/') ||
                         window.location.pathname.includes('/tasks/') ? '../' : './';

        const html = `
            <div id="savingsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">💰 Savings Tracker</span>
                        <button onclick="closeSavingsModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">

                        <!-- Loading State -->
                        <div id="savingsLoadingState" style="display: none;">
                            <div class="savings-skeleton">
                                <div class="skeleton-line skeleton-title"></div>
                                <div class="skeleton-line skeleton-bar"></div>
                                <div class="skeleton-row">
                                    <div class="skeleton-line skeleton-stat"></div>
                                    <div class="skeleton-line skeleton-stat"></div>
                                    <div class="skeleton-line skeleton-stat"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Create Goal Form -->
                        <div id="savingsCreateForm" style="display: none;">
                            <div class="savings-form-group">
                                <label>Tên mục tiêu</label>
                                <input type="text" id="savingsGoalName" placeholder="VD: Mua iPhone mới">
                            </div>
                            <div class="savings-form-group">
                                <label>Số tiền mục tiêu (VNĐ)</label>
                                <input type="text" id="savingsTargetAmount" placeholder="10.000.000" inputmode="numeric">
                            </div>
                            <div class="savings-form-group">
                                <label>Thời hạn (ngày)</label>
                                <input type="text" id="savingsDeadline" placeholder="90 hoặc 3m" inputmode="text">
                            </div>
                            <div class="savings-form-group">
                                <label>QR Code ngân hàng (tùy chọn)</label>
                                <div class="file-input-wrap">
                                    <input type="file" id="savingsQrUpload" accept="image/*">
                                    <label for="savingsQrUpload" class="file-input-label">
                                        <span class="file-input-icon">📁</span>
                                        <span class="file-input-text">Chọn ảnh QR...</span>
                                    </label>
                                </div>
                                <div id="savingsQrPreview"></div>
                            </div>
                            <div class="savings-form-group">
                                <label class="savings-toggle-label">
                                    <input type="checkbox" id="savingsChallengeEnabled">
                                    <span>Kích hoạt Daily Challenge (bảng tiết kiệm theo ngày)</span>
                                </label>
                            </div>
                            <div class="savings-form-actions">
                                <button onclick="cancelCreateGoal()" class="btn">Hủy</button>
                                <button onclick="createSavingsGoal()" class="btn btn-primary">Tạo mục tiêu</button>
                            </div>
                        </div>

                        <!-- Active Goal View -->
                        <div id="savingsActiveGoal" style="display: none;">
                            <div class="savings-goal-header">
                                <h3 id="savingsGoalTitle"></h3>
                                <div class="savings-header-actions">
                                    <button onclick="toggleSavingsHistory()" class="btn" id="savingsHistoryBtn">📊 Lịch sử</button>
                                    <button onclick="resetSavingsGoal()" class="btn">🔄 Tạo mới</button>
                                </div>
                            </div>
                            <div id="savingsHistoryPanel" style="display:none;">
                                <div id="savingsHistoryList"></div>
                            </div>

                            <div class="savings-amounts">
                                <div class="savings-amount-box">
                                    <span class="label">Đã tiết kiệm</span>
                                    <span class="value" id="savingsCurrentAmount">0 ₫</span>
                                </div>
                                <div class="savings-amount-box">
                                    <span class="label">Mục tiêu</span>
                                    <span class="value" id="savingsTargetDisplay">0 ₫</span>
                                </div>
                            </div>

                            <div class="progress-bar-container">
                                <div class="progress-bar" id="savingsProgressBar" style="width: 0%">
                                    <span class="progress-text" id="savingsProgressText">0%</span>
                                </div>
                            </div>

                            <div class="savings-stats">
                                <div class="stat-item">
                                    <span class="stat-label">Còn lại</span>
                                    <span class="stat-value" id="savingsRemaining">0 ₫</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Ngày còn lại</span>
                                    <span class="stat-value" id="savingsDaysLeft">0</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Cần/ngày</span>
                                    <span class="stat-value" id="savingsDailyTarget">0 ₫</span>
                                </div>
                            </div>

                            <div class="savings-milestones">
                                <div class="savings-section-title">🏆 Cột mốc</div>
                                <div id="savingsMilestones"></div>
                            </div>

                            <div class="savings-add-money" id="savingsAddMoneySection">
                                <div class="savings-section-title">💵 Thêm tiền</div>
                                <div class="quick-amounts">
                                    <button class="quick-btn" data-amount="50000" onclick="quickAddSavings(50000)">50k</button>
                                    <button class="quick-btn" data-amount="100000" onclick="quickAddSavings(100000)">100k</button>
                                    <button class="quick-btn" data-amount="200000" onclick="quickAddSavings(200000)">200k</button>
                                    <button class="quick-btn" data-amount="500000" onclick="quickAddSavings(500000)">500k</button>
                                </div>
                                <div class="custom-amount">
                                    <input type="text" id="savingsCustomAmount" placeholder="0" inputmode="numeric">
                                    <button onclick="addCustomSavingsAmount()" class="btn btn-primary">Thêm</button>
                                </div>
                            </div>

                            <div id="savingsQrSection" class="savings-qr-section" style="display: none;">
                                <div class="savings-section-title">📱 Chuyển khoản</div>
                                <div class="qr-container">
                                    <img id="savingsQrImage" src="" alt="QR Code">
                                </div>
                            </div>

                            <div id="savingsChallengeSection" style="display:none;">
                                <div class="savings-section-title">📅 Daily Challenge</div>
                                <div id="savingsChallengeSummary" class="challenge-summary"></div>
                                <div id="savingsChallengeGrid" class="challenge-grid"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <div id="savingsCelebrationModal" class="modal">
                <div class="modal-content celebration-content">
                    <div class="confetti">🎉🎊✨</div>
                    <h2 id="savingsCelebrationTitle"></h2>
                    <p id="savingsCelebrationMessage"></p>
                    <button onclick="closeSavingsCelebration()" class="btn btn-primary">Tiếp tục</button>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        while (wrapper.firstElementChild) {
            document.body.appendChild(wrapper.firstElementChild);
        }

        if (!document.querySelector('link[href*="savings-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'savings/savings-modal.css';
            document.head.appendChild(link);
        }

        if (typeof openSavingsModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'savings/savings-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        savingsModalLoaded = true;
    } catch (error) {
        console.error('Error loading savings modal:', error);
    }
}

async function openSavingsModalLazy() {
    await loadSavingsModal();

    const modal = document.getElementById('savingsModal');

    if (modal && modal.classList.contains('show')) {
        if (typeof closeSavingsModal === 'function') {
            closeSavingsModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        if (typeof openSavingsModal === 'function') {
            openSavingsModal();
        } else {
            modal.classList.add('show');
        }
    }
}
