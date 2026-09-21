const header = document.querySelector('.site-header');
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
const toast = document.querySelector('.toast');

const updateHeader = () => {
  header?.classList.toggle('scrolled', window.scrollY > 20);
};
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

navToggle?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(Boolean(open)));
});

nav?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

const showToast = message => {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
};

document.querySelectorAll('[data-share]').forEach(button => {
  button.addEventListener('click', async () => {
    const shareData = {
      title: 'Remembering Paul Roe',
      text: 'A memorial to Paul Roe — The Outback Historian, storyteller, teacher and Cornerstone co-founder.',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Memorial link copied');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Could not share this link');
    }
  });
});

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 })
  : null;

document.querySelectorAll('.reveal').forEach(el => {
  if (observer) observer.observe(el);
  else el.classList.add('visible');
});


async function loadApprovedMemories() {
  const container = document.querySelector('#approved-memories');
  if (!container) return;

  try {
    const response = await fetch('memories.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load memories');
    const memories = await response.json();

    if (!Array.isArray(memories) || memories.length === 0) return;

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'memories-card-grid';

    for (const memory of memories) {
      const article = document.createElement('article');
      article.className = 'memory-card reveal visible';

      const metaBits = [];
      if (memory.relationship) metaBits.push(memory.relationship);
      if (memory.context) metaBits.push(memory.context);

      let photo = '';
      if (memory.photo) {
        photo = `<figure class="memory-card-photo"><img src="${escapeHtml(memory.photo)}" alt="${escapeHtml(memory.photoAlt || ('Photo shared with ' + (memory.name || 'a contributor') + '’s memory of Paul'))}" loading="lazy"></figure>`;
      }

      article.innerHTML = `
        ${photo}
        <div class="memory-card-body">
          <blockquote><p>${formatMemoryText(memory.story || '')}</p></blockquote>
          <footer>
            <strong>${escapeHtml(memory.name || 'Anonymous')}</strong>
            ${metaBits.length ? `<span>${metaBits.map(escapeHtml).join(' · ')}</span>` : ''}
          </footer>
        </div>
      `;

      grid.appendChild(article);
    }

    container.appendChild(grid);
  } catch (error) {
    console.error(error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMemoryText(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

loadApprovedMemories();
