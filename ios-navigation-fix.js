// iOS Web App Navigation Fix
// Prevent opening Safari when navigating between pages

(function() {
    'use strict';
    
    // Check if running as standalone web app
    const isStandalone = window.navigator.standalone === true;
    
    if (!isStandalone) {
        return; // Only apply fix when running as web app
    }
    
    // Intercept all link clicks
    document.addEventListener('click', function(e) {
        let target = e.target;
        
        // Find the closest <a> tag
        while (target && target.tagName !== 'A') {
            target = target.parentNode;
        }
        
        if (!target || target.tagName !== 'A') {
            return;
        }
        
        const href = target.getAttribute('href');
        
        // Skip if no href or special cases
        if (!href || 
            href.startsWith('#') || 
            href.startsWith('javascript:') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            target.getAttribute('target') === '_blank') {
            return;
        }
        
        // Check if it's a relative URL (same domain)
        const isRelative = !href.match(/^https?:\/\//);
        const isSameDomain = href.indexOf(window.location.host) !== -1;
        
        if (isRelative || isSameDomain) {
            e.preventDefault();
            window.location.href = href;
        }
    }, false);
    
    console.log('iOS Web App navigation fix loaded');
})();
