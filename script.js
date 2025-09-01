// Enhanced JavaScript for ArmanLeads.com
// Medical-grade performance and accessibility implementation

(function() {
    'use strict';

    // Performance optimizations
    const supportsPassive = (() => {
        let supportsPassive = false;
        try {
            const opts = Object.defineProperty({}, 'passive', {
                get() { supportsPassive = true; }
            });
            window.addEventListener('testPassive', null, opts);
            window.removeEventListener('testPassive', null, opts);
        } catch (e) {}
        return supportsPassive;
    })();

    const passiveIfSupported = supportsPassive ? { passive: true } : false;

    // Enhanced utility functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Better throttle with trailing invocation
    function throttleWithTrailing(fn, limit) {
        let lastCall = 0;
        let scheduled = null;
        return function(...args) {
            const now = Date.now();
            const remaining = limit - (now - lastCall);
            const context = this;
            if (remaining <= 0) {
                if (scheduled) {
                    clearTimeout(scheduled);
                    scheduled = null;
                }
                lastCall = now;
                fn.apply(context, args);
            } else if (!scheduled) {
                scheduled = setTimeout(() => {
                    lastCall = Date.now();
                    scheduled = null;
                    fn.apply(context, args);
                }, remaining);
            }
        };
    }

    // Use requestAnimationFrame for scroll visuals
    function onScrollVisual(cb) {
        let ticking = false;
        return function (e) {
            if (!ticking) {
                requestAnimationFrame(() => {
                    cb(e);
                    ticking = false;
                });
                ticking = true;
            }
        };
    }

    // Helper to lazy load non-critical features
    function whenIdle(fn) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(fn, {timeout: 2000});
        } else {
            setTimeout(fn, 1000);
        }
    }

    // Focus trap utility for modals
    const FOCUSABLE = 'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])';
    function trapFocus(container, start = true) {
        const focusable = Array.from(container.querySelectorAll(FOCUSABLE));
        if (!focusable.length) return () => {};
        const first = focusable[0], last = focusable[focusable.length - 1];
        function handleTab(e) {
            if (e.key !== 'Tab') return;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        if (start) document.addEventListener('keydown', handleTab);
        return () => document.removeEventListener('keydown', handleTab);
    }

    // Intersection Observer utility with fallback
    function createIntersectionObserver(callback, options = {}) {
        const defaultOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        
        if (!('IntersectionObserver' in window)) {
            return {
                observe: (element) => {
                    setTimeout(() => callback([{ target: element, isIntersecting: true }]), 100);
                },
                unobserve: () => {},
                disconnect: () => {}
            };
        }

        return new IntersectionObserver(callback, { ...defaultOptions, ...options });
    }

    // Enhanced error handling with robust telemetry
    function handleError(error, context='unknown') {
        try {
            const payload = {
                ts: new Date().toISOString(),
                context,
                message: error && error.message ? error.message : String(error),
                stack: error && error.stack ? error.stack : null,
                url: location.href,
                userAgent: navigator.userAgent
            };
            
            console.error(`ArmanLeads Error [${context}]:`, error);
            
            // Send to analytics if configured
            if (window.gtag && typeof window.gtag === 'function') {
                try {
                    window.gtag('event', 'exception', {
                        description: `${context}: ${payload.message}`,
                        fatal: false
                    });
                } catch (e) {
                    console.warn('Analytics error:', e);
                }
            }
            
            // Best-effort server log via beacon
            if (navigator.sendBeacon) {
                try {
                    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                    navigator.sendBeacon('/_errlog', blob);
                } catch (e) {
                    console.warn('Beacon error:', e);
                }
            } else {
                // Fallback: fetch async (do not block)
                fetch('/_errlog', { 
                    method: 'POST', 
                    body: JSON.stringify(payload), 
                    headers: {'Content-Type': 'application/json'}, 
                    keepalive: true 
                }).catch(() => {});
            }
        } catch (e) {
            console.error('Error while handling error', e);
        }
    }

    // 1. Enhanced Preloader with proper cleanup
    function initPreloader() {
        const pre = document.getElementById('preloader');
        if (!pre) return () => {};
        
        let isHidden = false;
        
        const hide = () => {
            if (isHidden) return;
            isHidden = true;
            pre.setAttribute('aria-hidden', 'true');
            pre.classList.add('fade-out');
            // cleanup listeners
            window.removeEventListener('load', onLoad);
            setTimeout(() => {
                if (pre && pre.parentNode) {
                    pre.remove();
                }
            }, 400);
            document.documentElement.classList.add('page-loaded');
        };
        
        function onLoad() { hide(); }
        
        if (document.readyState === 'complete') {
            setTimeout(hide, 500);
        } else {
            window.addEventListener('load', onLoad, passiveIfSupported);
        }
        
        // Safety timeout
        setTimeout(hide, 3000);
        
        return () => {
            window.removeEventListener('load', onLoad);
            if (!isHidden) hide();
        };
    }

    // 2. Enhanced sticky navbar with scroll direction detection
    function initStickyNavbar() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return () => {};
        
        let lastY = window.scrollY;
        
        function onScroll() {
            const y = window.scrollY;
            navbar.classList.toggle('scrolled', y > 50);
            
            if (y > lastY && y > 120) {
                // scrolling down
                navbar.classList.add('nav-up');
                navbar.classList.remove('nav-down');
            } else {
                // scrolling up
                navbar.classList.add('nav-down');
                navbar.classList.remove('nav-up');
            }
            lastY = y;
        }
        
        const wrappedScroll = onScrollVisual(throttleWithTrailing(onScroll, 120));
        window.addEventListener('scroll', wrappedScroll, passiveIfSupported);
        
        // Initial check
        wrappedScroll();
        
        return () => window.removeEventListener('scroll', wrappedScroll);
    }

    // 3. Enhanced mobile navigation with focus trap and accessibility
    function initMobileNav() {
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.getElementById('nav-menu');
        if (!navToggle || !navMenu) return () => {};

        let previouslyFocused = null;
        let trapCleanup = null;

        function openMenu() {
            previouslyFocused = document.activeElement;
            navToggle.setAttribute('aria-expanded', 'true');
            navMenu.classList.add('active');
            document.body.classList.add('modal-open');
            navMenu.setAttribute('aria-hidden', 'false');
            
            // Focus first focusable element
            const first = navMenu.querySelector(FOCUSABLE);
            if (first) first.focus();
            trapCleanup = trapFocus(navMenu, true);
        }

        function closeMenu() {
            navToggle.setAttribute('aria-expanded', 'false');
            navMenu.classList.remove('active');
            document.body.classList.remove('modal-open');
            navMenu.setAttribute('aria-hidden', 'true');
            if (trapCleanup) trapCleanup();
            if (previouslyFocused) previouslyFocused.focus();
        }

        // Toggle functionality
        navToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (navMenu.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close on outside click
        const docClick = (e) => {
            if (navMenu.classList.contains('active') && 
                !navMenu.contains(e.target) && 
                !navToggle.contains(e.target)) {
                closeMenu();
            }
        };
        document.addEventListener('click', docClick);

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                closeMenu();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Close on nav link click (mobile only)
        const navLinks = navMenu.querySelectorAll('a[href^="#"]');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 767) {
                    setTimeout(closeMenu, 150);
                }
            });
        });

        // Close menu on resize if mobile menu is open
        const handleResize = debounce(() => {
            if (navMenu.classList.contains('active') && window.innerWidth > 767) {
                closeMenu();
            }
        }, 250);

        window.addEventListener('resize', handleResize);

        return () => {
            document.removeEventListener('click', docClick);
            document.removeEventListener('keydown', escapeHandler);
            window.removeEventListener('resize', handleResize);
        };
    }

    // 4. Enhanced smooth navigation with robust active link detection
    function initSmoothNavigation() {
        const navbar = document.getElementById('navbar');
        const links = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
        const sections = links.map(l => document.querySelector(l.getAttribute('href'))).filter(Boolean);
        if (!sections.length) return () => {};

        let navbarHeight = navbar ? navbar.offsetHeight : 80;
        const visibleRatio = new Map();

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                visibleRatio.set(entry.target.id, entry.intersectionRatio);
            });
            
            // Pick max visibility
            let activeId = null, max = 0;
            visibleRatio.forEach((ratio, id) => {
                if (ratio > max) { 
                    max = ratio; 
                    activeId = id; 
                }
            });
            
            links.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${activeId}`);
            });
        }, {
            root: null,
            rootMargin: `-${navbarHeight}px 0px -40% 0px`,
            threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
        });

        sections.forEach(s => observer.observe(s));
        
        // Update on resize
        const onResize = debounce(() => { 
            navbarHeight = navbar ? navbar.offsetHeight : 80; 
        }, 200);
        window.addEventListener('resize', onResize, passiveIfSupported);

        // Smooth click handler
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                const target = document.querySelector(href);
                if (!target) return;
                e.preventDefault();
                const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - navbarHeight - 12);
                window.scrollTo({ top, behavior: 'smooth' });
            });
        });

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', onResize);
        };
    }

    // 5. Enhanced business type selector with proper semantics
    function initBusinessTypeSelector() {
        const wrapper = document.querySelector('.business-types');
        const businessTypeInput = document.getElementById('business-type');
        if (!wrapper || !businessTypeInput) return () => {};
        
        wrapper.setAttribute('role', 'radiogroup');
        
        wrapper.addEventListener('click', (e) => {
            const card = e.target.closest('.business-type-card');
            if (!card) return;
            select(card);
        });

        wrapper.addEventListener('keydown', (e) => {
            const card = e.target.closest('.business-type-card');
            if (!card) return;
            
            if (e.key === 'Enter' || e.key === ' ') { 
                e.preventDefault(); 
                select(card); 
            }
            
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const cards = Array.from(wrapper.querySelectorAll('.business-type-card'));
                const idx = cards.indexOf(card);
                const next = e.key === 'ArrowRight' 
                    ? (idx + 1) % cards.length 
                    : (idx - 1 + cards.length) % cards.length;
                if (cards[next]) {
                    cards[next].focus();
                }
            }
        });

        function select(card) {
            Array.from(wrapper.querySelectorAll('.business-type-card')).forEach(c => {
                c.classList.remove('active');
                c.setAttribute('aria-checked', 'false');
                c.setAttribute('tabindex', '-1');
                c.setAttribute('role', 'radio');
            });
            card.classList.add('active');
            card.setAttribute('aria-checked', 'true');
            card.setAttribute('tabindex', '0');
            businessTypeInput.value = card.dataset.type || 'dental';
            card.focus();
        }

        // Initialize
        const active = wrapper.querySelector('.business-type-card.active') || wrapper.querySelector('.business-type-card');
        if (active) select(active);

        return () => {};
    }

    // 6. Bulletproof contact form with comprehensive UX improvements
    function initContactForm() {
        const form = document.getElementById('contact-form');
        if (!form) return () => {};
        
        const submitBtn = form.querySelector('.btn-submit');
        const successMessage = document.getElementById('form-success');

        // Create error region for accessibility
        const errorRegion = document.createElement('div');
        errorRegion.setAttribute('role', 'status');
        errorRegion.setAttribute('aria-live', 'polite');
        errorRegion.className = 'form-error-region';
        errorRegion.style.cssText = 'color: #ef4444; margin-bottom: 1rem; font-size: 0.9rem; display: none;';
        form.prepend(errorRegion);

        let lastSubmit = 0;

        function setError(msg) {
            errorRegion.innerText = msg;
            errorRegion.style.display = 'block';
            errorRegion.classList.add('show');
        }
        
        function clearError() {
            errorRegion.innerText = '';
            errorRegion.style.display = 'none';
            errorRegion.classList.remove('show');
        }

        function validate() {
            clearError();
            const required = form.querySelectorAll('[required]');
            
            for (const field of required) {
                if (!field.value.trim()) {
                    field.setAttribute('aria-invalid', 'true');
                    field.focus();
                    setError('Please complete all required fields.');
                    return false;
                } else {
                    field.setAttribute('aria-invalid', 'false');
                }
                
                if (field.type === 'email') {
                    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!re.test(field.value.trim())) {
                        field.setAttribute('aria-invalid', 'true');
                        field.focus();
                        setError('Please enter a valid email address.');
                        return false;
                    }
                }
            }
            return true;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Rate limiting
            if (Date.now() - lastSubmit < 5000) {
                setError('Please wait a few seconds before trying again.');
                return;
            }
            
            if (!validate()) return;
            
            // Check honeypot
            const honeypot = form.querySelector('input[name="website_url"]');
            if (honeypot && honeypot.value) {
                return; // Silent fail for bots
            }
            
            lastSubmit = Date.now();
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            const formData = new FormData(form);
            formData.append('timestamp', new Date().toISOString());

            try {
                if (!navigator.onLine) {
                    // Save to localStorage for retry
                    try {
                        localStorage.setItem('pendingForm', JSON.stringify(Object.fromEntries(formData)));
                        setError('You appear offline. We saved your submission and will retry automatically when online.');
                    } catch (storageError) {
                        setError('Connection issue. Please try again or email hello@armanleads.com');
                    }
                    throw new Error('offline');
                }

                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                const json = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(json.error || `Server error: ${response.status}`);
                }

                // Success handling
                if (successMessage) {
                    successMessage.classList.add('show');
                    successMessage.setAttribute('role', 'status');
                    successMessage.setAttribute('aria-live', 'polite');
                    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                form.reset();
                
                // Reset business type selection
                const firstCard = document.querySelector('.business-type-card');
                if (firstCard) {
                    firstCard.click();
                }
                
                // Analytics
                if (window.gtag) {
                    window.gtag('event', 'lead', { method: 'audit-form' });
                }
                
                // Optional: persist to lightweight CRM by beacon
                try {
                    navigator.sendBeacon('/log-form', JSON.stringify({ 
                        action: 'submitted', 
                        timestamp: new Date().toISOString() 
                    }));
                } catch (err) { /* ignore */ }
                
                // Hide success message after 10 seconds
                setTimeout(() => {
                    if (successMessage) {
                        successMessage.classList.remove('show');
                    }
                }, 10000);
                
            } catch (error) {
                if (error.message !== 'offline') {
                    setError('Error sending form. Please try again or email hello@armanleads.com');
                }
                handleError(error, 'Form Submission');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        // Retry pending saved form when back online
        const onlineHandler = async () => {
            const pending = localStorage.getItem('pendingForm');
            if (!pending) return;
            try {
                const data = JSON.parse(pending);
                // Send via sendBeacon as best-effort
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(form.action, new URLSearchParams(data).toString());
                }
                localStorage.removeItem('pendingForm');
            } catch (e) { 
                console.warn('Retry failed', e); 
            }
        };
        
        window.addEventListener('online', onlineHandler);

        return () => {
            window.removeEventListener('online', onlineHandler);
        };
    }

    // 7. Enhanced Calendly modal with focus trap and prefill
    function initCalendlyModal() {
        const trigger = document.getElementById('calendly-trigger');
        const modal = document.getElementById('calendly-modal');
        const iframe = document.getElementById('calendly-iframe');
        const closeButtons = modal ? modal.querySelectorAll('[data-close-modal]') : [];
        const loadingElement = modal ? modal.querySelector('.calendly-loading') : null;
        
        if (!trigger || !modal || !iframe) return () => {};

        let isModalOpen = false;
        let trapCleanup = null;
        let previouslyFocused = null;

        function openModal() {
            previouslyFocused = document.activeElement;
            isModalOpen = true;
            modal.classList.add('active');
            document.body.classList.add('modal-open');
            modal.setAttribute('aria-hidden', 'false');

            // Build prefill params
            const name = document.getElementById('name')?.value || '';
            const email = document.getElementById('email')?.value || '';
            
            if (!iframe.src) {
                let src = 'https://calendly.com/vrmvn0/meeting';
                const params = new URLSearchParams();
                if (name) params.set('name', name);
                if (email) params.set('email', email);
                if (params.toString()) src += `?${params.toString()}`;
                iframe.src = src;

                // Handle iframe load
                iframe.addEventListener('load', () => {
                    if (loadingElement) {
                        loadingElement.style.display = 'none';
                    }
                });

                // Handle iframe error
                iframe.addEventListener('error', () => {
                    if (loadingElement) {
                        loadingElement.innerHTML = `
                            <div style="text-align: center; padding: 2rem;">
                                <p>Unable to load calendar. Please contact us directly.</p>
                                <a href="mailto:hello@armanleads.com" style="color: var(--color-accent-dark);">hello@armanleads.com</a>
                            </div>
                        `;
                    }
                });

                // Timeout for loading
                setTimeout(() => {
                    if (loadingElement && loadingElement.style.display !== 'none') {
                        loadingElement.innerHTML = `
                            <div style="text-align: center;">
                                <p>Taking longer than expected...</p>
                                <p><a href="mailto:hello@armanleads.com" style="color: var(--color-accent-dark);">Contact us directly</a></p>
                            </div>
                        `;
                    }
                }, 10000);
            }

            // Focus trap
            trapCleanup = trapFocus(modal);
        }

        function closeModal() {
            isModalOpen = false;
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            modal.setAttribute('aria-hidden', 'true');
            if (trapCleanup) trapCleanup();
            if (previouslyFocused) previouslyFocused.focus();
        }

        // Event listeners
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });

        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                closeModal();
            });
        });

        // Close on Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                closeModal();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Listen for Calendly postMessage events (booking complete)
        const messageHandler = (e) => {
            try {
                if (e.data && typeof e.data === 'string' && e.data.indexOf('calendly') !== -1) {
                    // Check for known booking event strings
                    if (e.data.match(/event.*calendly.*(event_scheduled|event_type_viewed)/i)) {
                        if (window.gtag) window.gtag('event', 'calendly_booked');
                        closeModal();
                    }
                }
            } catch (err) { /* ignore */ }
        };
        window.addEventListener('message', messageHandler);

        // Initialize modal state
        modal.setAttribute('aria-hidden', 'true');

        return () => {
            document.removeEventListener('keydown', escapeHandler);
            window.removeEventListener('message', messageHandler);
        };
    }

    // 8. Scroll animations with classes and reduced motion respect
    function initScrollAnimations() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
        
        const items = document.querySelectorAll('.card, .service-card, .approach-card, .portfolio-card, .pricing-card, .faq-item');
        if (items.length === 0) return () => {};

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.08
        };

        const observer = createIntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, observerOptions);

        items.forEach(item => {
            observer.observe(item);
        });

        return () => observer.disconnect();
    }

    // 9. Analytics hooks and conversion tracking
    function initAnalytics() {
        // Event delegation for tracking
        const trackingHandler = (e) => {
            const btn = e.target.closest('[data-track]');
            if (!btn) return;
            
            const action = btn.dataset.track;
            if (window.gtag) {
                window.gtag('event', action, { event_category: 'site_action' });
            }
            
            // Lightweight fallback beacon
            try { 
                navigator.sendBeacon('/_track', JSON.stringify({ 
                    action, 
                    url: location.href, 
                    ts: Date.now() 
                })); 
            } catch(e) {}
        };

        document.addEventListener('click', trackingHandler);

        return () => {
            document.removeEventListener('click', trackingHandler);
        };
    }

    // 10. Error handling and recovery
    function initErrorHandling() {
        const errorHandler = (e) => {
            handleError(e.error || e, 'Global Error');
        };

        const rejectionHandler = (e) => {
            handleError(e.reason || e, 'Unhandled Promise Rejection');
            e.preventDefault(); // Prevent console error
        };

        window.addEventListener('error', errorHandler);
        window.addEventListener('unhandledrejection', rejectionHandler);

        return () => {
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('unhandledrejection', rejectionHandler);
        };
    }

    // Initialize everything when DOM is ready
    function init() {
        try {
            const cleanupFunctions = [];
            
            // Initialize error handling first
            const errorCleanup = initErrorHandling();
            cleanupFunctions.push(errorCleanup);
            
            // Critical features first
            const preloaderCleanup = initPreloader();
            cleanupFunctions.push(preloaderCleanup);
            
            const navbarCleanup = initStickyNavbar();
            cleanupFunctions.push(navbarCleanup);
            
            const mobileNavCleanup = initMobileNav();
            cleanupFunctions.push(mobileNavCleanup);
            
            const smoothNavCleanup = initSmoothNavigation();
            cleanupFunctions.push(smoothNavCleanup);
            
            const businessTypeCleanup = initBusinessTypeSelector();
            cleanupFunctions.push(businessTypeCleanup);
            
            const contactFormCleanup = initContactForm();
            cleanupFunctions.push(contactFormCleanup);
            
            const calendlyCleanup = initCalendlyModal();
            cleanupFunctions.push(calendlyCleanup);
            
            const analyticsCleanup = initAnalytics();
            cleanupFunctions.push(analyticsCleanup);

            // Non-critical features when browser is idle
            whenIdle(() => {
                const animationCleanup = initScrollAnimations();
                if (animationCleanup) cleanupFunctions.push(animationCleanup);
            });

            // Mark as initialized
            document.body.setAttribute('data-js-initialized', 'true');
            
            console.log('ArmanLeads: All scripts initialized successfully');
            
            // Expose cleanup functions
            window.ArmanLeadsCleanup = () => {
                cleanupFunctions.forEach(fn => { 
                    try { 
                        if (typeof fn === 'function') fn(); 
                    } catch(e) {
                        console.warn('Cleanup error:', e);
                    } 
                });
            };
            
        } catch (error) {
            handleError(error, 'Initialization');
        }
    }

    // Run initialization with proper timing
    function startInit() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            // DOM is already ready
            init();
        }
    }

    // Start initialization
    startInit();

    // Expose utilities for debugging and external use
    window.ArmanLeads = {
        version: '2.2.0',
        init: init,
        utils: {
            debounce,
            throttleWithTrailing,
            handleError,
            trapFocus,
            onScrollVisual,
            whenIdle
        }
    };

})();
