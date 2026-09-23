document.addEventListener('DOMContentLoaded', () => {
  // --- CAROUSEL COMPONENT ---
  const track = document.getElementById('carouselTrack');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const dotsContainer = document.getElementById('carouselDots');
  
  if (track && prevBtn && nextBtn && dotsContainer) {
    const slides = Array.from(track.children);
    let currentIndex = 0;
    let autoSlideInterval = null;
    
    function getVisibleSlidesCount() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }
    
    function getMaxIndex() {
      const visible = getVisibleSlidesCount();
      return Math.max(0, slides.length - visible);
    }
    
    function updateCarousel() {
      const maxIdx = getMaxIndex();
      if (currentIndex > maxIdx) currentIndex = maxIdx;
      
      const slideWidthPercent = 100 / getVisibleSlidesCount();
      // Calculate translate percentage
      const gapOffset = 24 * (currentIndex / slides.length);
      const translateVal = (currentIndex * slideWidthPercent);
      track.style.transform = `translateX(calc(-${translateVal}% - ${gapOffset}px))`;
      
      // Update dots
      renderDots();
    }
    
    function renderDots() {
      dotsContainer.innerHTML = '';
      const maxIdx = getMaxIndex();
      for (let i = 0; i <= maxIdx; i++) {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${i === currentIndex ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Slide group ${i + 1}`);
        dot.addEventListener('click', () => {
          currentIndex = i;
          updateCarousel();
          resetAutoSlide();
        });
        dotsContainer.appendChild(dot);
      }
    }
    
    function nextSlide() {
      const maxIdx = getMaxIndex();
      currentIndex = currentIndex >= maxIdx ? 0 : currentIndex + 1;
      updateCarousel();
    }
    
    function prevSlide() {
      const maxIdx = getMaxIndex();
      currentIndex = currentIndex <= 0 ? maxIdx : currentIndex - 1;
      updateCarousel();
    }
    
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoSlide();
    });
    
    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoSlide();
    });
    
    function startAutoSlide() {
      autoSlideInterval = setInterval(nextSlide, 5000);
    }
    
    function resetAutoSlide() {
      clearInterval(autoSlideInterval);
      startAutoSlide();
    }
    
    // Pause auto slide on hover
    track.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
    track.addEventListener('mouseleave', startAutoSlide);
    
    // Touch swipe support
    let startX = 0;
    let endX = 0;
    track.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    
    track.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      if (startX - endX > 50) {
        nextSlide();
        resetAutoSlide();
      } else if (endX - startX > 50) {
        prevSlide();
        resetAutoSlide();
      }
    }, { passive: true });
    
    window.addEventListener('resize', () => {
      updateCarousel();
    });
    
    renderDots();
    updateCarousel();
    startAutoSlide();
  }

  // --- COMMANDS FILTER TABS ---
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cmdCards = document.querySelectorAll('.cmd-card');
  
  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        
        cmdCards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // --- COPY COMMAND TO CLIPBOARD ---
  const copyButtons = document.querySelectorAll('.copy-btn');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const commandText = btn.getAttribute('data-cmd');
      if (!commandText) return;
      
      try {
        await navigator.clipboard.writeText(commandText);
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✓ Copied</span>';
        btn.style.color = '#10b981';
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    });
  });

  // --- FAQ ACCORDION ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    
    if (questionBtn && answer) {
      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        
        // Close all others
        faqItems.forEach(other => {
          other.classList.remove('open');
          const otherAns = other.querySelector('.faq-answer');
          if (otherAns) otherAns.style.maxHeight = null;
        });
        
        if (!isOpen) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 40 + 'px';
        }
      });
    }
  });

  // --- STATS COUNTER ANIMATION ---
  const statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length > 0 && 'IntersectionObserver' in window) {
    let animated = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          statNumbers.forEach(stat => {
            const target = parseInt(stat.getAttribute('data-target') || '0', 10);
            const prefix = stat.getAttribute('data-prefix') || '';
            const suffix = stat.getAttribute('data-suffix') || '';
            let count = 0;
            const step = Math.max(1, Math.floor(target / 40));
            const timer = setInterval(() => {
              count += step;
              if (count >= target) {
                count = target;
                clearInterval(timer);
              }
              stat.textContent = `${prefix}${count.toLocaleString()}${suffix}`;
            }, 30);
          });
        }
      });
    }, { threshold: 0.2 });
    
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) observer.observe(statsSection);
  }
});
