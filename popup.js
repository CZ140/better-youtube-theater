chrome.storage.sync.get({ sidebar: 'recs', ambient: true }, (v) => {
  document.querySelector(`input[name="sidebar"][value="${v.sidebar}"]`).checked = true;
  document.getElementById('ambient').checked = v.ambient;
});

document.querySelectorAll('input[name="sidebar"]').forEach((r) =>
  r.addEventListener('change', () => chrome.storage.sync.set({ sidebar: r.value })),
);
document.getElementById('ambient').addEventListener('change', (e) =>
  chrome.storage.sync.set({ ambient: e.target.checked }),
);
