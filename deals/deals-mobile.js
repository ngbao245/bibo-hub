// Mobile-specific enhancements for Deal Tracker
(function () {
    'use strict';

    // Detect mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // Add mobile class to body
        document.body.classList.add('mobile-view');

        // Optimize touch events
        document.addEventListener('DOMContentLoaded', () => {
            // Prevent double-tap zoom on buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    btn.click();
                });
            });

            // Pull to refresh
            let startY = 0;
            let isPulling = false;

            document.addEventListener('touchstart', (e) => {
                if (window.scrollY === 0) {
                    startY = e.touches[0].pageY;
                    isPulling = true;
                }
            });

            document.addEventListener('touchmove', (e) => {
                if (!isPulling) return;
                const currentY = e.touches[0].pageY;
                const diff = currentY - startY;

                if (diff > 100) {
                    // Trigger refresh
                    document.getElementById('refreshBtn')?.click();
                    isPulling = false;
                }
            });

            document.addEventListener('touchend', () => {
                isPulling = false;
            });
        });
    }

    // Add viewport meta if not exists
    if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
    }
})();
