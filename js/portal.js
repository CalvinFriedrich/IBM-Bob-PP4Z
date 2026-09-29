(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. THEME SWITCHER & STARFIELD BACKGROUND
  // --------------------------------------------------------------------------
  var html = document.documentElement;
  var savedTheme = localStorage.getItem('banking-lab-theme');
  html.setAttribute('data-theme', savedTheme || 'dark');

  var themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = html.getAttribute('data-theme');
      var next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('banking-lab-theme', next);
    });
  }

  // Stars background rendering on dynamic canvas
  var c = document.getElementById('stars-canvas');
  var ctx = c ? c.getContext('2d') : null;
  var W, H, stars = [];

  function resizeStars() {
    if (!c) return;
    W = c.width  = window.innerWidth;
    H = c.height = Math.max(document.body.scrollHeight, window.innerHeight);
  }

  function initStars() {
    if (!c) return;
    resizeStars();
    stars = [];
    for (var i = 0; i < 150; i++) {
      stars.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        r:  Math.random() * 1.3 + 0.3,
        a:  Math.random(),
        da: (Math.random() - 0.5) * 0.005
      });
    }
  }

  function drawStars() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var starColor = isLight ? '40,100,220,' : '180,210,255,';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.a = Math.max(0.1, Math.min(1, s.a + s.da));
      if (s.a <= 0.1 || s.a >= 1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + starColor + s.a + ')';
      ctx.fill();
    }
    requestAnimationFrame(drawStars);
  }

  if (c) {
    window.addEventListener('resize', initStars);
    initStars();
    drawStars();
  }

  // --------------------------------------------------------------------------
  // 2. DYNAMIC MARKDOWN LOADER AND COMPILER (PARSER)
  // --------------------------------------------------------------------------
  var exercisesContainer = document.getElementById('exercises-container');

  // Let's load the markdown content.
  // First, we check if the markdown is already pre-loaded into window.bankingLabMarkdown
  if (window.bankingLabMarkdown) {
    parseAndRenderBankingLab(window.bankingLabMarkdown);
  } else {
    // Fallback: Fetch Banking_Lab.md from the same directory if we are running in a web server
    fetch('Banking_Lab.md')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP Error: ' + res.status);
        }
        return res.text();
      })
      .then(function (markdown) {
        parseAndRenderBankingLab(markdown);
      })
      .catch(function (err) {
        console.error('[BankingLab] Could not load Banking_Lab.md via fetch', err);
        if (exercisesContainer) {
          exercisesContainer.innerHTML = `
            <div class="box box-warn" style="padding: 24px; text-align: center;">
              <p><strong>Failed to load Banking_Lab.md.</strong></p>
              <p style="font-size: 13px; margin: 0;">Please ensure that Banking_Lab.md exists in your root folder or js/banking_lab_content.js is built correctly.</p>
            </div>
          `;
        }
      });
  }

  /**
   * Parse the Banking_Lab.md contents into separate exercise cards
   */
  function parseAndRenderBankingLab(md) {
    if (!exercisesContainer) return;
    exercisesContainer.innerHTML = ''; // Clear loading screen

    // Split markdown by ## Exercise
    var sections = md.split(/(?=##\s+Exercise\s+\d+|##\s+Summary\s+and\s+Measurable\s+Gains|##\s+Conclusion|##\s+🎓\s+Next\s+Steps|##\s+📚\s+Appendix)/gi);

    sections.forEach(function (sec, idx) {
      var trimmed = sec.trim();
      if (!trimmed) return;

      // Extract Exercise Title line
      var firstLine = trimmed.split('\n')[0].trim();
      var titleText = firstLine.replace(/^##\s+/, '').trim();
      var restOfBody = trimmed.substring(trimmed.indexOf('\n') + 1);

      // We only render Exercises or major wrap-ups as Cards
      if (firstLine.toLowerCase().includes('## exercise')) {
        // Extract the actual exercise number from the heading (e.g. "0" for "Exercise 0")
        var numMatch = firstLine.match(/Exercise\s+(\d+)/i);
        var exerciseNum = numMatch ? numMatch[1] : "0";
        
        // Strip "Exercise X:" or "Exercise X: " prefix from the card title
        var cleanTitle = titleText.replace(/^Exercise\s+\d+\s*:\s*/i, '').trim();
        
        // Check if this is Exercise 12, so we can split it into focused sub-steps (a, b, c, d)
        if (exerciseNum === "12") {
          // Exercise 12 contains introductory context, followed by:
          // ### Part A: Implementation Planning
          // ### Part B: Data Structure Modification
          // ### Part C: Search Program Development
          // ### Part D: Program Syntax Verification
          
          // Split the body into the intro section and the 4 parts
          var parts = restOfBody.split(/(?=###\s+Part\s+[A-D]\s*:\s*)/gi);
          var introText = parts[0].trim(); // Holds Objective, Context, and Exploratory prompt
          
          for (var pIdx = 1; pIdx <= 4 && pIdx < parts.length; pIdx++) {
            var partContent = parts[pIdx].trim();
            var partLine = partContent.split('\n')[0].trim();
            var partTitleText = partLine.replace(/^###\s+Part\s+[A-D]\s*:\s*/i, '').trim();
            
            // Re-construct clean sub-body containing intro context + this specific step
            var subBody = introText + "\n\n---\n\n" + partContent;
            
            // Map pIdx (1 to 4) to letters (a, b, c, d)
            var letter = String.fromCharCode(96 + pIdx); // 1->'a', 2->'b', etc.
            renderCard(exerciseNum + letter, partTitleText, subBody);
          }
        } else {
          renderCard(exerciseNum, cleanTitle, restOfBody);
        }
      } else if (firstLine.toLowerCase().includes('## summary') || firstLine.toLowerCase().includes('## conclusion') || firstLine.toLowerCase().includes('## 🎓') || firstLine.toLowerCase().includes('## 📚')) {
        renderCard(null, titleText, restOfBody);
      }
    });

    initCardToggles();
    initOnboardingModal();
  }

  /**
   * Render single expandable card
   */
  function renderCard(number, title, bodyMarkdown) {
    var card = document.createElement('div');
    
    // Dynamically assign track-X groupings based on Exercise Numbers:
    // Track 0: Ex 0 - 2 (Lab Prep, Init, Rules)
    // Track 1: Ex 3 - 4 (Metadata Scan, Inventory)
    // Track 2: Ex 5 - 7 (Coding Standards, Draw.io Diagram, Bankdata Explanation)
    // Track 3: Ex 8 - 10 (Business Rules, Variable Usage, Change Impact)
    // Track 4: Ex 11 - 12 (User Journeys, Email Search Dev)
    var trackClass = 'track-0';
    if (number !== null) {
      var num = parseInt(number, 10);
      if (num >= 0 && num <= 2) {
        trackClass = 'track-0';
      } else if (num >= 3 && num <= 4) {
        trackClass = 'track-1';
      } else if (num >= 5 && num <= 7) {
        trackClass = 'track-2';
      } else if (num >= 8 && num <= 10) {
        trackClass = 'track-3';
      } else if (num >= 11 && num <= 12) {
        trackClass = 'track-4';
      }
    } else {
      // Reference pages (Summary, Conclusion, etc.)
      trackClass = 'track-0';
    }
    
    card.className = 'bubble-card ' + trackClass;

    // Parse Markdown body into HTML via Marked library
    var bodyHTML = marked.parse(bodyMarkdown);

    // Extract appropriate mode (Agent, Z Code, Z Architect, Plan, Ask) to render badges
    var modeMatch = bodyMarkdown.match(/Bob Mode to Use[^\n]*\n+[\s*-]*\s*([^\n]+)/i);
    var modeBadgeHTML = '';
    if (modeMatch && modeMatch[1]) {
      var rawMode = modeMatch[1].trim().toLowerCase();
      var modeName = "Agent Mode";
      var modeClass = "mode-agent";
      if (rawMode.includes('z code') || rawMode.includes('z-code')) {
        modeName = "Z Code Mode";
        modeClass = "mode-zcode";
      } else if (rawMode.includes('z architect') || rawMode.includes('z-architect') || rawMode.includes('architect')) {
        modeName = "Z Architect Mode";
        modeClass = "mode-zarch";
      } else if (rawMode.includes('plan')) {
        modeName = "Plan Mode";
        modeClass = "mode-plan";
      } else if (rawMode.includes('ask')) {
        modeName = "Ask Mode";
        modeClass = "mode-agent"; // General styling
      }
      modeBadgeHTML = `<span class="mode-badge ${modeClass}">💻 ${modeName}</span>`;
    }

    var labelStr = '';
    if (number !== null) {
      var num = parseInt(number, 10);
      var trackLabel = 'Setup';
      if (num >= 0 && num <= 2) trackLabel = 'Preparation';
      else if (num >= 3 && num <= 4) trackLabel = 'Discovery & Catalog';
      else if (num >= 5 && num <= 7) trackLabel = 'Standards & Design';
      else if (num >= 8 && num <= 10) trackLabel = 'Business Rules & Analysis';
      else if (num >= 11 && num <= 12) trackLabel = 'Journeys & Implementation';
      
      labelStr = `Exercise ${number} &middot; ${trackLabel}`;
    } else {
      labelStr = 'Wrap-up Reference';
    }
    var numBadgeText = number ? number : '★';

    card.innerHTML = `
      <div class="card-summary">
        <div class="card-num-badge">${numBadgeText}</div>
        <div class="card-text">
          <div class="card-label">${labelStr}</div>
          <h3 class="card-title">${title}</h3>
        </div>
        <div class="card-chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5l5 5 5-5"/></svg>
        </div>
      </div>
      <div class="card-detail">
        <div class="card-detail-inner">
          ${modeBadgeHTML}
          <div class="parsed-content">${bodyHTML}</div>
        </div>
      </div>
    `;

    // Enhance PRE tag segments with dynamic Copy buttons
    var preBlocks = card.querySelectorAll('pre');
    preBlocks.forEach(function (pre) {
      pre.style.position = 'relative';
      var copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy code/prompt content');
      pre.appendChild(copyBtn);
    });

    exercisesContainer.appendChild(card);
  }

  // --------------------------------------------------------------------------
  // 3. INTERACTIVE TRIGGERS AND CLIPBOARD DELEGATION
  // --------------------------------------------------------------------------
  function initCardToggles() {
    var cards = document.querySelectorAll('.bubble-card');
    cards.forEach(function (card) {
      var summary = card.querySelector('.card-summary');
      if (!summary) return;

      summary.addEventListener('click', function () {
        var isOpen = card.classList.contains('open');
        cards.forEach(function (c) { c.classList.remove('open'); });
        if (!isOpen) {
          card.classList.add('open');
          setTimeout(function () {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Refresh stars heights as document expands
            if (c) resizeStars();
          }, 150);
        }
      });
    });

    // Smooth Scroll Trigger for "Get Started" CTA button
    var getStartedBtn = document.getElementById('get-started-btn');
    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', function () {
        var firstCard = document.querySelector('.bubble-card');
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Open the first card automatically for premium onboarding feel!
          setTimeout(function () {
            if (!firstCard.classList.contains('open')) {
              firstCard.querySelector('.card-summary').click();
            }
          }, 600);
        }
      });
    }

    // Delegated Event Listener for Clipboard Copy buttons
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.copy-btn');
      if (!btn) return;
      var pre = btn.closest('pre');
      if (!pre) return;

      // Extract text content excluding the copy button itself
      var codeElement = pre.querySelector('code');
      var text = codeElement ? codeElement.textContent : pre.textContent.replace('Copy', '');
      
      if (text) {
        navigator.clipboard.writeText(text.trim()).then(function () {
          markCopied(btn);
        }).catch(function () {
          // Fallback legacy copy
          var ta = document.createElement('textarea');
          ta.value = text.trim();
          ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            markCopied(btn);
          } catch (err) {}
          document.body.removeChild(ta);
        });
      }
    });
  }

  function markCopied(btn) {
    btn.textContent = '✔ Copied';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  }

  // --------------------------------------------------------------------------
  // 4. "NEW TO BOB?" ONBOARDING MODAL LOGIC
  // --------------------------------------------------------------------------
  function initOnboardingModal() {
    var overlay = document.getElementById('ntb-overlay');
    var openBtn = document.getElementById('new-to-bob-btn');
    var closeBtn = document.getElementById('ntb-close');
    var nextBtn = document.getElementById('ntb-next-btn');

    if (!overlay || !openBtn) return;

    function openModal() {
      overlay.classList.add('active');
      switchTab(1);
    }

    function closeModal() {
      overlay.classList.remove('active');
    }

    function switchTab(num) {
      var panels = overlay.querySelectorAll('.ntb-panel');
      var tabs = overlay.querySelectorAll('.ntb-tab');

      panels.forEach(function (panel) {
        panel.classList.remove('ntb-panel-active');
      });
      tabs.forEach(function (tab) {
        tab.classList.remove('ntb-tab-active');
        tab.setAttribute('aria-selected', 'false');
      });

      var targetPanel = document.getElementById('ntb-panel-' + num);
      var targetTab = document.getElementById('ntb-tab-' + num);

      if (targetPanel) targetPanel.classList.add('ntb-panel-active');
      if (targetTab) {
        targetTab.classList.add('ntb-tab-active');
        targetTab.setAttribute('aria-selected', 'true');
      }

      // Mark previous tabs as done
      tabs.forEach(function (tab) {
        var tNum = parseInt(tab.getAttribute('data-ntb-tab'), 10);
        if (tNum < num) {
          tab.classList.add('ntb-tab-done');
        } else {
          tab.classList.remove('ntb-tab-done');
        }
      });
    }

    openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        switchTab(2);
      });
    }

    // Modal background overlay click closes modal
    overlay.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-ntb-tab]');
      if (tab) {
        switchTab(parseInt(tab.getAttribute('data-ntb-tab'), 10));
        return;
      }
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Close on Escape key press
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

})();