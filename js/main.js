/* ============================================================================
   ROYAL COLOR - Main JavaScript
   Navigation, scroll animations, FAQ toggles, form handling
   ============================================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // ---------- Mobile Navigation ----------
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('open');
        });

        // Close menu when a link is clicked
        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                hamburger.classList.remove('active');
                navLinks.classList.remove('open');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (e) {
            if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
                hamburger.classList.remove('active');
                navLinks.classList.remove('open');
            }
        });
    }

    // ---------- Navbar Scroll Effect ----------
    const navbar = document.getElementById('navbar');

    function handleScroll() {
        if (!navbar) return;
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // ---------- Scroll Animations ----------
    const animatedElements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');

    if (animatedElements.length > 0) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    // Stagger animation for sibling elements
                    var parent = entry.target.parentElement;
                    var siblings = parent ? parent.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right') : [];
                    var index = Array.prototype.indexOf.call(siblings, entry.target);
                    var delay = index * 100;

                    setTimeout(function () {
                        entry.target.classList.add('visible');
                    }, delay);

                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        animatedElements.forEach(function (el) {
            observer.observe(el);
        });
    }

    // ---------- FAQ Toggles ----------
    var faqToggles = document.querySelectorAll('.faq-toggle');

    faqToggles.forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var faqItem = toggle.closest('.faq-item');
            if (!faqItem) return;
            var answer = faqItem.querySelector('.faq-answer');
            var icon = toggle.querySelector('.faq-icon');
            if (!answer) return;

            var isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';

            // Close all others
            document.querySelectorAll('.faq-answer').forEach(function (a) {
                a.style.maxHeight = '0px';
            });
            document.querySelectorAll('.faq-icon').forEach(function (i) {
                i.textContent = '+';
                i.style.transform = 'rotate(0deg)';
            });

            // Toggle current
            if (!isOpen) {
                answer.style.maxHeight = answer.scrollHeight + 'px';
                if (icon) {
                    icon.textContent = '\u2212';
                    icon.style.transform = 'rotate(180deg)';
                }
            }
        });
    });

    // ---------- Smooth Scroll for Anchor Links ----------
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var href = this.getAttribute('href');
            if (href === '#') return;
            var target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                var offset = navbar ? navbar.offsetHeight : 0;
                var top = target.getBoundingClientRect().top + window.pageYOffset - offset - 20;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        });
    });

    // ---------- Set Minimum Date for Booking ----------
    var dateInput = document.getElementById('preferredDate');
    if (dateInput) {
        var today = new Date();
        var minDate = new Date(today);
        minDate.setDate(minDate.getDate() + 1); // At least 1 day ahead
        var yyyy = minDate.getFullYear();
        var mm = String(minDate.getMonth() + 1).padStart(2, '0');
        var dd = String(minDate.getDate()).padStart(2, '0');
        dateInput.setAttribute('min', yyyy + '-' + mm + '-' + dd);
    }

});

// ---------- Booking Form Handler ----------
function handleBooking(e) {
    e.preventDefault();

    var form = document.getElementById('bookingForm');
    var firstName = document.getElementById('firstName').value.trim();
    var lastName = document.getElementById('lastName').value.trim();
    var email = document.getElementById('email').value.trim();
    var service = document.getElementById('service').value;
    var sessionType = document.getElementById('sessionType').value;

    // Basic validation
    if (!firstName || !lastName || !email || !service || !sessionType) {
        showToast('Please fill in all required fields.');
        return false;
    }

    // Email validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.');
        return false;
    }

    // Simulate sending (in production, this would POST to a server)
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    setTimeout(function () {
        // Build mailto link as fallback
        var subject = 'Booking Request - ' + service;
        var body = 'Name: ' + firstName + ' ' + lastName + '\n';
        body += 'Email: ' + email + '\n';
        body += 'Phone: ' + (document.getElementById('phone').value || 'Not provided') + '\n';
        body += 'Service: ' + service + '\n';
        body += 'Session Type: ' + sessionType + '\n';
        body += 'Preferred Date: ' + (document.getElementById('preferredDate').value || 'Flexible') + '\n';
        body += 'Preferred Time: ' + (document.getElementById('preferredTime').value || 'Flexible') + '\n';
        body += 'Message: ' + (document.getElementById('message').value || 'None') + '\n';

        // Open mailto
        window.location.href = 'mailto:royalcoloranalysis@gmail.com?subject=' +
            encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

        // Show success
        showToast('Opening your email client to send the booking request!');
        submitBtn.textContent = 'Sent!';

        setTimeout(function () {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            form.reset();
        }, 3000);
    }, 800);

    return false;
}

// ---------- Toast Notification ----------
function showToast(message, duration) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    duration = duration || 4000;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function () {
        toast.classList.remove('show');
    }, duration);
}
