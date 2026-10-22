// 共用區塊載入（layout/header.html、layout/footer.html）與全站小工具
// 載入完成後派發 layout:loaded 事件，供需要在 header/footer 就緒後才能初始化的腳本監聽

(function () {
  "use strict";

  function loadLayoutSlots() {
    var slots = document.querySelectorAll("[data-layout]");
    var pending = slots.length;

    if (pending === 0) {
      document.dispatchEvent(new CustomEvent("layout:loaded"));
      return;
    }

    slots.forEach(function (slot) {
      fetch(slot.getAttribute("data-layout"))
        .then(function (res) {
          return res.text();
        })
        .then(function (html) {
          slot.outerHTML = html;
        })
        .catch(function () {
          // 共用區塊載入失敗時保留原始插槽內容，避免整頁空白
        })
        .finally(function () {
          pending -= 1;
          if (pending === 0) {
            document.dispatchEvent(new CustomEvent("layout:loaded"));
          }
        });
    });
  }

  function initScrollTop() {
    var btn = document.getElementById("scrollTopBtn");
    if (!btn) return;

    function toggle() {
      if (window.scrollY > 480) {
        btn.classList.add("is-visible");
      } else {
        btn.classList.remove("is-visible");
      }
    }

    window.addEventListener("scroll", toggle, { passive: true });
    toggle();

    btn.addEventListener("click", function () {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  document.addEventListener("DOMContentLoaded", loadLayoutSlots);
  document.addEventListener("layout:loaded", initScrollTop);
})();

// Header 往下捲動後切換半透明白底，避免固定列文字被底下捲動內容蓋過
// 監聽 layout:loaded 才初始化，因為 header 是透過上面的 loadLayoutSlots fetch 插槽後才存在於 DOM

(function () {
  "use strict";

  function initHeaderScroll() {
    var header = document.querySelector(".siteHeader");
    if (!header) return;

    function toggle() {
      header.classList.toggle("siteHeader--scrolled", window.scrollY > 8);
    }

    window.addEventListener("scroll", toggle, { passive: true });
    toggle();
  }

  // Header「登入/註冊」按鈕：登入卡比短螢幕（如筆電）的可視高度還高，
  // 若只捲到卡片頂端，「點此註冊」常被擋在摺線下方；用絕對捲動座標
  // （而非 scrollIntoView 的相對 nearest 對齊）取「卡片頂端」與「剛好露出
  // 點此註冊」兩者較下方的位置，不論從頁面上方或下方按下都會捲到同一個
  // 絕對位置，避免捲動起點不同造成結果不一致。
  function initLoginCta() {
    var cta = document.querySelector('.siteHeader-actions a[href="#loginRegister"]');
    var card = document.querySelector(".loginCard");
    var register = document.getElementById("loginRegister");
    if (!cta || !card || !register) return;

    cta.addEventListener("click", function (event) {
      event.preventDefault();

      // 注意：這裡要用 --header-height（header 實際高度），不能用
      // scroll-padding-top——scroll-padding-top 是 header 高度再加上
      // --space-24 的額外緩衝（給一般錨點標題用），疊加上去的話卡片
      // 永遠會離 header 多一段空隙，扣不乾淨。
      var headerOffset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
      // 想讓捲動後的停留位置整體往下（少捲一點，header 跟卡片間多留空隙），
      // 調這一個數字就好，下面兩個候選目標都會跟著套用；0 = header 剛好壓在
      // 卡片上緣，數字越大、停留位置越往下（空隙越大）。
      var extraGap = 0;
      var cardTop = card.getBoundingClientRect().top + window.scrollY - headerOffset - extraGap;
      var registerBottom = register.getBoundingClientRect().bottom + window.scrollY;
      var minScrollForRegister = registerBottom - window.innerHeight - extraGap;

      window.scrollTo(0, Math.max(cardTop, minScrollForRegister));
    });
  }

  document.addEventListener("layout:loaded", initHeaderScroll);
  document.addEventListener("layout:loaded", initLoginCta);
})();

// Header 導覽列 scrollspy：依捲動位置切換 .siteNav-link 的 aria-current
// 監聽 layout:loaded 才初始化，因為 header（.siteNav）是 fetch 插槽後才存在於 DOM

(function () {
  "use strict";

  function initScrollSpy() {
    var header = document.querySelector(".siteHeader");
    var nav = document.querySelector(".siteNav");
    if (!header || !nav) return;

    var sections = Array.prototype.slice
      .call(nav.querySelectorAll(".siteNav-link"))
      .map(function (link) {
        var el = document.getElementById(link.getAttribute("href").slice(1));
        return el ? { link: link, el: el } : null;
      })
      .filter(Boolean);

    if (sections.length === 0) return;

    function setActive(target) {
      sections.forEach(function (section) {
        if (section === target) {
          section.link.setAttribute("aria-current", "page");
        } else {
          section.link.removeAttribute("aria-current");
        }
      });
    }

    function update() {
      var buffer = header.offsetHeight + 24 + 1;
      var current = sections[0];
      var atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;

      if (atBottom) {
        current = sections[sections.length - 1];
      } else {
        sections.forEach(function (section) {
          if (window.scrollY + buffer >= section.el.offsetTop) {
            current = section;
          }
        });
      }

      setActive(current);
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  document.addEventListener("layout:loaded", initScrollSpy);
})();

// 無障礙頁籤（WAI-ARIA），規則見 ACCESSIBILITY.md §13
// 本頁籤組未提供外部深連結入口，故不處理 #tab-xxx 錨點切換（§13.3 為條件式規定）

(function () {
  "use strict";

  function initTabList(tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));

    function selectTab(tab, options) {
      var moveFocus = !options || options.moveFocus !== false;

      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute("aria-selected", selected ? "true" : "false");
        t.tabIndex = selected ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) {
          panel.hidden = !selected;
        }
      });

      if (moveFocus) {
        tab.focus();
      }
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        selectTab(tab, { moveFocus: false });
      });

      tab.addEventListener("keydown", function (event) {
        var newIndex = null;

        if (event.key === "ArrowRight") {
          newIndex = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft") {
          newIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          newIndex = 0;
        } else if (event.key === "End") {
          newIndex = tabs.length - 1;
        }

        if (newIndex !== null) {
          event.preventDefault();
          selectTab(tabs[newIndex]);
        }
      });
    });
  }

  function init() {
    document.querySelectorAll('[role="tablist"]').forEach(initTabList);
  }

  document.addEventListener("layout:loaded", init);
})();

// 常見問題 Accordion：原生 <button> 已可用 Tab／Enter／Space 操作

(function () {
  "use strict";

  function init() {
    document.querySelectorAll(".faqItem-trigger").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var expanded = trigger.getAttribute("aria-expanded") === "true";
        var panel = document.getElementById(trigger.getAttribute("aria-controls"));
        trigger.setAttribute("aria-expanded", expanded ? "false" : "true");
        if (panel) panel.hidden = expanded;
      });
    });
  }

  document.addEventListener("layout:loaded", init);
})();

// 公告篩選列「階段」pill：單選群組，純前端狀態切換（無後端查詢）

(function () {
  "use strict";

  function initGroup(group) {
    var pills = Array.prototype.slice.call(group.querySelectorAll(".filterPill"));
    pills.forEach(function (pill) {
      pill.addEventListener("click", function () {
        pills.forEach(function (p) {
          p.setAttribute("aria-pressed", p === pill ? "true" : "false");
        });
      });
    });
  }

  function init() {
    document.querySelectorAll("[data-filter-group]").forEach(initGroup);

    document.querySelectorAll("[data-search-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
      });
    });
  }

  document.addEventListener("layout:loaded", init);
})();

// 首頁行事曆：可切換任意年月；僅 2026 年 9 月有靜態假資料（行程點／今天／重要期程），其他月份顯示空白日曆
// 上一個月／下一個月／回到今天皆為真正可互動按鈕；回到今天固定跳回假資料標記的 2026/9/22

(function () {
  "use strict";

  var EVENTS = {
    2: { hasEvent: true, label: "本日有相關行程，詳情請洽承辦學校" },
    7: { hasEvent: true, label: "本日有相關行程，詳情請洽承辦學校" },
    9: { hasEvent: true, label: "本日有相關行程，詳情請洽承辦學校" },
    14: { hasEvent: true, label: "本日有相關行程，詳情請洽承辦學校" },
    16: { hasEvent: true, label: "本日有相關行程，詳情請洽承辦學校" },
    18: { hasEvent: true, label: "本日有相關行程，詳情請洽承辦學校" },
    22: { isToday: true, label: "今天" },
    25: { important: true, label: "申請資料補件截止" }
  };

  var EVENTS_YEAR = 2026;
  var EVENTS_MONTH = 9; // 僅此年月套用上面的假資料，其他月份一律空白
  var TODAY_DAY = 22;
  var DEFAULT_SELECTED = 25;

  var MONTH_NAMES_ZH = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  var currentYear = EVENTS_YEAR;
  var currentMonth = EVENTS_MONTH;

  function hasEventData(year, month) {
    return year === EVENTS_YEAR && month === EVENTS_MONTH;
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getFirstWeekday(year, month) {
    return new Date(year, month - 1, 1).getDay();
  }

  function buildGrid(grid, year, month, selectedDay) {
    grid.innerHTML = "";
    grid.setAttribute("aria-label", year + "年" + month + "月 日期選擇");

    var firstWeekday = getFirstWeekday(year, month);
    var daysInMonth = getDaysInMonth(year, month);
    var useEvents = hasEventData(year, month);

    for (var i = 0; i < firstWeekday; i++) {
      var filler = document.createElement("span");
      filler.className = "calendarDate-empty";
      filler.setAttribute("aria-hidden", "true");
      grid.appendChild(filler);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var info = useEvents ? (EVENTS[day] || {}) : {};
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendarDate";
      btn.textContent = String(day);
      btn.dataset.day = String(day);
      btn.setAttribute("aria-pressed", day === selectedDay ? "true" : "false");
      if (info.hasEvent) btn.dataset.hasEvent = "true";
      if (info.isToday) btn.dataset.isToday = "true";
      if (info.important) btn.dataset.important = "true";

      var label = month + "月" + day + "日";
      if (info.isToday) label += "，今天";
      if (info.important) label += "，重要期程：" + info.label;
      else if (info.hasEvent) label += "，有行程";
      btn.setAttribute("aria-label", label);

      grid.appendChild(btn);
    }
  }

  function updateMonthHeading(monthZhEl, yearEl, announceEl, year, month) {
    if (monthZhEl) monthZhEl.textContent = MONTH_NAMES_ZH[month - 1];
    if (yearEl) yearEl.textContent = String(year);
    if (announceEl) announceEl.textContent = year + "年" + MONTH_NAMES_ZH[month - 1];
  }

  function updateAgenda(agenda, year, month, day) {
    var info = hasEventData(year, month) ? (EVENTS[day] || {}) : {};
    var dateEl = agenda.querySelector("[data-agenda-date]");
    var listEl = agenda.querySelector("[data-agenda-list]");

    if (dateEl) {
      dateEl.textContent = month + "/" + day;
    }

    if (listEl) {
      listEl.innerHTML = "";
      var item = document.createElement("li");
      item.className = "calendarAgenda-selectedItem";
      item.textContent = info.label || "本日無行程";
      listEl.appendChild(item);
    }
  }

  function init() {
    var grid = document.getElementById("calendarGrid");
    var agenda = document.getElementById("calendarAgenda");
    if (!grid || !agenda) return;

    var monthZhEl = document.querySelector(".calendarCard-monthZh");
    var yearEl = document.querySelector(".calendarCard-year");
    var announceEl = document.getElementById("calendarMonthAnnounce");
    var prevBtn = document.getElementById("calendarPrevMonth");
    var nextBtn = document.getElementById("calendarNextMonth");
    var todayBtn = document.getElementById("calendarToday");

    function renderMonth(year, month, selectedDay) {
      currentYear = year;
      currentMonth = month;
      buildGrid(grid, year, month, selectedDay);
      updateMonthHeading(monthZhEl, yearEl, announceEl, year, month);
      updateAgenda(agenda, year, month, selectedDay);
    }

    renderMonth(EVENTS_YEAR, EVENTS_MONTH, DEFAULT_SELECTED);

    grid.addEventListener("click", function (event) {
      var btn = event.target.closest(".calendarDate");
      if (!btn) return;

      grid.querySelectorAll(".calendarDate").forEach(function (d) {
        d.setAttribute("aria-pressed", "false");
      });
      btn.setAttribute("aria-pressed", "true");

      updateAgenda(agenda, currentYear, currentMonth, Number(btn.dataset.day));
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        var target = new Date(currentYear, currentMonth - 1 - 1, 1);
        renderMonth(target.getFullYear(), target.getMonth() + 1, 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        var target = new Date(currentYear, currentMonth - 1 + 1, 1);
        renderMonth(target.getFullYear(), target.getMonth() + 1, 1);
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener("click", function () {
        renderMonth(EVENTS_YEAR, EVENTS_MONTH, TODAY_DAY);
      });
    }
  }

  document.addEventListener("layout:loaded", init);
})();

// 登入卡：密碼顯示切換、圖形驗證碼重新產生（純前端展示，無後端驗證）

(function () {
  "use strict";

  function initPasswordToggle() {
    var toggle = document.getElementById("passwordToggle");
    var input = document.getElementById("loginPassword");
    if (!toggle || !input) return;

    toggle.addEventListener("click", function () {
      var isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      toggle.setAttribute("aria-pressed", isHidden ? "true" : "false");
      toggle.setAttribute("aria-label", isHidden ? "隱藏密碼" : "顯示密碼");
      toggle.querySelector("i").className = isHidden ? "bi bi-eye-slash" : "bi bi-eye";
    });
  }

  function randomCaptcha() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXY2346789";
    var out = "";
    for (var i = 0; i < 4; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function initCaptcha() {
    var display = document.getElementById("captchaCode");
    var refresh = document.getElementById("captchaRefresh");
    if (!display || !refresh) return;

    refresh.addEventListener("click", function () {
      display.textContent = randomCaptcha();
    });
  }

  function init() {
    initPasswordToggle();
    initCaptcha();
  }

  document.addEventListener("layout:loaded", init);
})();

// 註冊新帳號 modal、網站隱私權條款 modal、帳號填寫說明 tooltip
// 原生 <dialog> 負責焦點鎖定與 Esc 關閉，這裡只處理開關觸發、兩個 modal 的切換關係，
// 以及註冊表單純前端展示用的送出攔截（未接後端驗證）

(function () {
  "use strict";

  function initGenericModalBehavior() {
    document.querySelectorAll("[data-modal-open]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dialog = document.getElementById(btn.getAttribute("data-modal-open"));
        if (!dialog) return;
        var sourceDialog = btn.closest("dialog");
        if (sourceDialog && sourceDialog !== dialog) {
          sourceDialog.close();
        }
        dialog.showModal();
      });
    });

    document.querySelectorAll("[data-modal-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dialog = btn.closest("dialog");
        if (dialog) dialog.close();
      });
    });

    document.querySelectorAll("dialog.modalCard").forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) dialog.close();
      });
    });
  }

  // 點此註冊按鈕是唯一的外部入口，關閉註冊 modal 時固定把焦點還給它
  function initRegisterOpenerFocus() {
    var trigger = document.getElementById("registerTrigger");
    var dialog = document.getElementById("registerModal");
    if (!trigger || !dialog) return;

    dialog.addEventListener("close", function () {
      trigger.focus();
    });
  }

  // 隱私權條款 modal 只會從註冊 modal 內的連結開啟，關閉（取消／同意／Esc／點遮罩）
  // 一律切換回註冊 modal，不是獨立關閉到頁面
  function initPrivacyReturnFlow() {
    var registerDialog = document.getElementById("registerModal");
    var privacyDialog = document.getElementById("privacyModal");
    var agreeCheckbox = document.getElementById("registerAgree");
    var agreeBtn = document.getElementById("privacyAgreeBtn");
    if (!registerDialog || !privacyDialog) return;

    privacyDialog.addEventListener("close", function () {
      registerDialog.showModal();
    });

    if (agreeBtn && agreeCheckbox) {
      agreeBtn.addEventListener("click", function () {
        agreeCheckbox.checked = true;
        updateSubmitState();
        privacyDialog.close();
      });
    }
  }

  function updateSubmitState() {
    var checkbox = document.getElementById("registerAgree");
    var submitBtn = document.getElementById("registerSubmit");
    if (!checkbox || !submitBtn) return;
    submitBtn.setAttribute("aria-disabled", checkbox.checked ? "false" : "true");
    // 說明文字只在「目前為何不能按」時才需要被讀出，按鈕一旦可按就移除，
    // 避免已啟用的按鈕還被唸出「請先勾選同意...」造成誤導
    if (checkbox.checked) {
      submitBtn.removeAttribute("aria-describedby");
    } else {
      submitBtn.setAttribute("aria-describedby", "registerSubmitHint");
    }
  }

  function initRegisterForm() {
    var form = document.getElementById("registerForm");
    var checkbox = document.getElementById("registerAgree");
    var submitBtn = document.getElementById("registerSubmit");
    var dialog = document.getElementById("registerModal");
    if (!form || !checkbox || !submitBtn || !dialog) return;

    checkbox.addEventListener("change", updateSubmitState);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (submitBtn.getAttribute("aria-disabled") === "true") {
        checkbox.focus();
        return;
      }
      if (!form.reportValidity()) return;

      dialog.close();
      form.reset();
      updateSubmitState();
    });
  }

  function initAccountTooltip() {
    var trigger = document.getElementById("accountInfoTrigger");
    var panel = document.getElementById("accountInfoPanel");
    if (!trigger || !panel) return;

    // 點擊會把面板「釘」在開啟狀態：滑鼠移開也不關閉，直到再點一次／Esc／點外部。
    // 必須獨立於 hover 狀態記錄，不能直接讀 panel.hidden 來判斷要不要切換——
    // 滑鼠點擊按鈕前一定會先觸發 mouseenter 把面板打開，若 click 這時候再去讀
    // panel.hidden 並取反，會把 mouseenter 剛開的面板立刻關掉，造成點擊沒有反應。
    var pinnedOpen = false;

    function show() {
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }

    function hide() {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      pinnedOpen = false;
    }

    trigger.addEventListener("click", function (event) {
      event.stopPropagation();
      pinnedOpen = !pinnedOpen;
      if (pinnedOpen) {
        show();
      } else {
        hide();
      }
    });
    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("focus", show);
    trigger.addEventListener("mouseleave", function () {
      if (pinnedOpen) return;
      window.setTimeout(function () {
        if (!pinnedOpen && !panel.matches(":hover") && document.activeElement !== trigger) hide();
      }, 80);
    });
    panel.addEventListener("mouseleave", function () {
      if (!pinnedOpen) hide();
    });
    trigger.addEventListener("blur", function () {
      if (pinnedOpen) return;
      window.setTimeout(function () {
        if (!pinnedOpen && !panel.contains(document.activeElement)) hide();
      }, 0);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        hide();
        trigger.focus();
      }
    });
    document.addEventListener("click", function (event) {
      if (!panel.hidden && event.target !== trigger && !panel.contains(event.target)) {
        hide();
      }
    });
  }

  function init() {
    initGenericModalBehavior();
    initRegisterOpenerFocus();
    initPrivacyReturnFlow();
    initRegisterForm();
    initAccountTooltip();
    updateSubmitState();
  }

  document.addEventListener("layout:loaded", init);
})();

// 「最新消息」「相關法規」列表點選後開啟的公告詳情 modal
// 開關／焦點鎖定／Esc／點遮罩關閉已由上面 initGenericModalBehavior
// 處理（共用 dialog.modalCard + data-modal-close 慣例），這裡只負責帶入內容

(function () {
  "use strict";

  function initAnnouncementModal() {
    var dialog = document.getElementById("announcementModal");
    if (!dialog) return;

    var categoryEl = document.getElementById("announcementModalCategory");
    var dateEl = document.getElementById("announcementModalDate");
    var titleEl = document.getElementById("announcementModalTitle");
    var bodyEl = document.getElementById("announcementModalBody");
    var lastTrigger = null;

    document.querySelectorAll("[data-announcement-link]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();

        var row = link.closest("li");
        if (!row) return;

        var dateText = row.querySelector(".listRow-date");
        var categoryText = row.querySelector(".tagPill");
        var detail = row.querySelector("template");

        categoryEl.textContent = categoryText ? categoryText.textContent : "";
        dateEl.textContent = dateText ? dateText.textContent : "";
        titleEl.textContent = link.textContent;

        bodyEl.innerHTML = "";
        if (detail) {
          bodyEl.appendChild(detail.content.cloneNode(true));
        }

        lastTrigger = link;
        dialog.showModal();
      });
    });

    dialog.addEventListener("close", function () {
      if (lastTrigger) lastTrigger.focus();
    });
  }

  document.addEventListener("layout:loaded", initAnnouncementModal);
})();

// 重寄啟用碼 modal、忘記密碼 modal 的純前端展示用送出攔截（未接後端驗證）
// 開關／焦點鎖定／Esc／點遮罩關閉已由上面 initGenericModalBehavior 處理

(function () {
  "use strict";

  function initSimpleModalForm(formId, dialogId) {
    var form = document.getElementById(formId);
    var dialog = document.getElementById(dialogId);
    if (!form || !dialog) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;

      dialog.close();
      form.reset();
    });
  }

  function init() {
    initSimpleModalForm("resendForm", "resendModal");
    initSimpleModalForm("forgotPasswordForm", "forgotPasswordModal");
  }

  document.addEventListener("layout:loaded", init);
})();
