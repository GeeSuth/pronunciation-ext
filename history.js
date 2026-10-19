/*
 * history.js - History / Review / Stats tabs.
 */
(function () {
  "use strict";
  const EH = window.EH;
  const $ = (id) => document.getElementById(id);

  let settings = EH.mergeSettings({});
  let history = [];
  let sortKey = "datetime";
  let sortAsc = false;
  let page = 1;
  let filtered = [];

  /* ------------------------------------------------------------------ *
   * Tabs
   * ------------------------------------------------------------------ */

  function showTab(name) {
    document.querySelectorAll(".eh-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".eh-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
    if (name === "review") startReview();
    if (name === "stats") renderStats();
  }

  document.querySelectorAll(".eh-tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  /* ------------------------------------------------------------------ *
   * History table
   * ------------------------------------------------------------------ */

  function reviewButtons(item) {
    const wrap = document.createElement("div");
    wrap.className = "eh-review-icons";
    settings.dictionaries
      .filter((d) => d.enabled)
      .forEach((dict) => {
        let el;
        if (dict.icon) {
          el = document.createElement("img");
          el.src = EH.runtimeGetURL(dict.icon);
          el.alt = dict.name;
          el.title = dict.name;
        } else {
          el = document.createElement("span");
          el.textContent = dict.emoji || "\uD83D\uDD16";
          el.title = dict.name;
          el.style.cursor = "pointer";
          el.style.fontSize = "16px";
        }
        el.addEventListener("click", () => {
          window.open(EH.buildUrl(dict, item.word, settings), "_blank");
        });
        wrap.appendChild(el);
      });
    return wrap;
  }

  function renderHistory() {
    const q = $("search").value.trim().toLowerCase();
    const mode = $("filter").value;

    filtered = history.filter((it) => {
      if (mode === "due" && !EH.srs.isDue(it)) return false;
      if (mode === "mastered" && !(it.srs && it.srs.reps >= 4 && (it.srs.interval || 0) >= 7)) return false;
      if (!q) return true;
      return (
        String(it.word || "").toLowerCase().includes(q) ||
        String(it.sentence || "").toLowerCase().includes(q) ||
        String(it.notes || "").toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      let av, bv;
      if (sortKey === "word") {
        av = String(a.word).toLowerCase();
        bv = String(b.word).toLowerCase();
      } else if (sortKey === "count") {
        av = a.count || 1;
        bv = b.count || 1;
      } else {
        av = a.createdAt || 0;
        bv = b.createdAt || 0;
      }
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });

    const size = settings.history.pageSize || 20;
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    if (page > pages) page = pages;
    const slice = filtered.slice((page - 1) * size, page * size);

    const tbody = $("listContainer");
    tbody.innerHTML = "";
    slice.forEach((item) => {
      const tr = document.createElement("tr");

      const wordCell = document.createElement("td");
      wordCell.innerHTML = "";
      const w = document.createElement("strong");
      w.textContent = item.word;
      wordCell.appendChild(w);
      if (settings.srs.enabled && EH.srs.isDue(item)) {
        const dot = document.createElement("span");
        dot.textContent = " \u2022 due";
        dot.style.color = "#dc3545";
        dot.style.fontSize = "11px";
        wordCell.appendChild(dot);
      }
      if (item.translation) {
        const t = document.createElement("div");
        t.style.fontSize = "12px";
        t.style.color = "#6b7280";
        t.textContent = item.translation;
        wordCell.appendChild(t);
      }
      tr.appendChild(wordCell);

      const dateCell = document.createElement("td");
      dateCell.textContent = item.datetime || "";
      tr.appendChild(dateCell);

      const countCell = document.createElement("td");
      countCell.textContent = item.count || 1;
      tr.appendChild(countCell);

      const ctxCell = document.createElement("td");
      ctxCell.className = "eh-cell-sentence";
      if (item.sentence) {
        const s = document.createElement("div");
        s.textContent = item.sentence;
        ctxCell.appendChild(s);
      }
      const noteInput = document.createElement("input");
      noteInput.className = "eh-input";
      noteInput.placeholder = "Add note...";
      noteInput.value = item.notes || "";
      noteInput.addEventListener("change", async () => {
        history = await EH.updateWord(item.id, { notes: noteInput.value });
        renderHistory();
      });
      ctxCell.appendChild(noteInput);
      tr.appendChild(ctxCell);

      const revCell = document.createElement("td");
      revCell.appendChild(reviewButtons(item));
      tr.appendChild(revCell);

      const actCell = document.createElement("td");
      const rm = document.createElement("button");
      rm.className = "remove-btn";
      rm.textContent = "Remove";
      rm.addEventListener("click", async () => {
        history = await EH.removeWord(item.id);
        renderHistory();
      });
      actCell.appendChild(rm);
      tr.appendChild(actCell);

      tbody.appendChild(tr);
    });

    $("pageInfo").textContent = "Page " + page + " / " + pages + "  (" + filtered.length + " words)";
  }

  document.querySelectorAll(".sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortAsc = !sortAsc;
      else {
        sortKey = key;
        sortAsc = true;
      }
      document.querySelectorAll("th").forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(sortAsc ? "sort-asc" : "sort-desc");
      renderHistory();
    });
  });

  $("search").addEventListener("input", () => {
    page = 1;
    renderHistory();
  });
  $("filter").addEventListener("change", () => {
    page = 1;
    renderHistory();
  });
  $("prevPage").addEventListener("click", () => {
    if (page > 1) {
      page--;
      renderHistory();
    }
  });
  $("nextPage").addEventListener("click", () => {
    page++;
    renderHistory();
  });

  $("exportCsv").addEventListener("click", async () => {
    const blob = new Blob([await EH.exportCSV()], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "english-helper.csv";
    a.click();
  });

  /* ------------------------------------------------------------------ *
   * Review (spaced repetition)
   * ------------------------------------------------------------------ */

  let queue = [];
  let current = null;
  let reviewed = 0;

  function startReview() {
    queue = settings.srs.enabled ? EH.srs.dueList(history) : history.slice();
    queue = queue.slice(0, settings.srs.newPerDay || 20);
    reviewed = 0;
    nextCard();
  }

  function nextCard() {
    $("reviewAnswer").classList.remove("show");
    if (!queue.length) {
      $("reviewEmpty").style.display = "";
      $("reviewEmpty").textContent = "All caught up. Nothing due for review right now.";
      $("reviewBody").style.display = "none";
      $("reviewProgress").textContent = "";
      return;
    }
    current = queue[0];
    $("reviewEmpty").style.display = "none";
    $("reviewBody").style.display = "";
    $("reviewWord").textContent = current.word;
    $("reviewSentence").textContent = current.sentence || "";
    $("reviewProgress").textContent = queue.length + " left in this session \u2022 " + reviewed + " reviewed";
  }

  $("revealBtn").addEventListener("click", () => {
    const ans = $("reviewAnswer");
    let trEl = document.getElementById("reviewTranslation");
    if (!trEl) {
      trEl = document.createElement("div");
      trEl.id = "reviewTranslation";
      trEl.className = "review-translation";
      ans.insertBefore(trEl, $("reviewLinks"));
    }
    trEl.innerHTML = "";
    if (current.translation) {
      trEl.style.display = "";
      const k = document.createElement("span");
      k.className = "k";
      k.textContent = EH.languageName(settings.translate.target);
      const v = document.createElement("span");
      v.className = "v";
      v.textContent = current.translation;
      trEl.appendChild(k);
      trEl.appendChild(v);
    } else {
      trEl.style.display = "none";
    }

    const links = $("reviewLinks");
    links.innerHTML = "";
    settings.dictionaries
      .filter((d) => d.enabled)
      .forEach((dict) => {
        const b = document.createElement("button");
        b.className = "eh-act";
        b.textContent = dict.name;
        b.addEventListener("click", () => window.open(EH.buildUrl(dict, current.word, settings), "_blank"));
        links.appendChild(b);
      });
    $("reviewAnswer").classList.add("show");
  });

  document.querySelectorAll(".grade").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!current) return;
      const grade = Number(btn.dataset.grade);
      history = await EH.srs.gradeWord(current.id, grade);
      queue.shift();
      reviewed++;
      if (grade === 0) queue.push(current); // "Again" comes back this session
      nextCard();
    });
  });

  /* ------------------------------------------------------------------ *
   * Stats
   * ------------------------------------------------------------------ */

  function renderStats() {
    const s = EH.computeStats(history);

    $("statsGrid").innerHTML = "";
    [
      { k: "Words", v: s.total },
      { k: "Total lookups", v: s.lookups },
      { k: "New today", v: s.learnedToday },
      { k: "Day streak", v: s.streak },
      { k: "Due now", v: s.due },
      { k: "Mastered", v: s.mastered }
    ].forEach((item) => {
      const el = document.createElement("div");
      el.className = "eh-stat";
      el.innerHTML = '<div class="v">' + item.v + '</div><div class="k">' + item.k + "</div>";
      $("statsGrid").appendChild(el);
    });

    const bars = $("statsBars");
    bars.innerHTML = "";
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(EH.todayKey(d));
    }
    const max = Math.max(1, ...days.map((k) => s.byDay[k] || 0));
    days.forEach((k) => {
      const v = s.byDay[k] || 0;
      const bar = document.createElement("div");
      bar.className = "eh-bar";
      bar.style.height = Math.round((v / max) * 100) + "%";
      bar.title = k + ": " + v;
      bar.innerHTML = v ? "<span>" + v + "</span>" : "";
      bars.appendChild(bar);
    });

    const topList = $("topList");
    topList.innerHTML = "";
    s.top.forEach((t) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + t.word + "</td><td>" + t.count + " lookups</td>";
      topList.appendChild(tr);
    });
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */

  EH.onHistoryChanged((list) => {
    history = list || [];
    renderHistory();
  });

  (async function init() {
    settings = await EH.getSettings();
    history = await EH.getHistory();
    renderHistory();
    const hash = (location.hash || "#history").slice(1);
    if (hash === "review" || hash === "stats") showTab(hash);
  })();
})();
