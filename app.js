/**
 * بيتزا قوطة — منطق الموقع
 * ---------------------------------------------------------------------------
 * الملف بيقرأ بيانات المطعم من config.js والمنيو من menu-data.js.
 * مفيش أي طلب بيتأكد تلقائيًا: احنا بنجهز رسالة واتساب للمراجعة والإرسال.
 */
(() => {
  "use strict";

  const config = window.QOUTA_CONFIG;
  const menu = window.QOUTA_MENU;

  if (!config || !menu || !config.restaurant) {
    console.error("لم يتم تحميل إعدادات بيتزا قوطة أو بيانات المنيو.");
    return;
  }

  const CART_STORAGE_KEY = "qouta_cart_v1";
  const DRAFT_STORAGE_KEY = "qouta_order_draft_v1";
  const MAX_QTY = 99;

  const restaurant = config.restaurant;
  const menuSettings = config.menu || {};
  const pricesConfirmed = Boolean(menuSettings.pricesConfirmed);
  const currency = menuSettings.currency || "ج.م";

  const categories = Array.isArray(menu.categories) ? menu.categories : [];
  const items = Array.isArray(menu.items) ? menu.items : [];
  const addons = Array.isArray(menu.addons) ? menu.addons : [];

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const addonsById = new Map(addons.map((addon) => [addon.id, addon]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  const orderTypeLabels = {
    delivery: "توصيل",
    pickup: "استلام من المطعم",
    "dine-in": "جلوس داخل المطعم"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const dom = {
    header: $("#siteHeader"),
    mobileMenu: $("#mobileMenu"),
    mobileMenuToggle: $("[data-open-menu]"),
    itemDialog: $("#itemDialog"),
    itemDialogCategory: $("#itemDialogCategory"),
    itemDialogTitle: $("#itemDialogTitle"),
    itemDialogDescription: $("#itemDialogDescription"),
    itemDialogImage: $("#itemDialogImage"),
    itemAddonsWrap: $("#itemAddonsWrap"),
    itemAddons: $("#itemAddons"),
    itemQuantity: $("#itemQuantity"),
    itemDialogPrice: $("#itemDialogPrice"),
    addItemButton: $("#addItemButton"),
    cartDialog: $("#cartDialog"),
    cartScroll: $(".cart-scroll"),
    cartEmpty: $("#cartEmpty"),
    cartFilled: $("#cartFilled"),
    cartReviewStep: $("#cartReviewStep"),
    checkoutStep: $("#checkoutStep"),
    cartItems: $("#cartItems"),
    cartFooter: $("#cartFooter"),
    cartTotal: $("#cartTotal"),
    cartStepKicker: $("#cartStepKicker"),
    cartTitle: $("#cartTitle"),
    cartHeadNote: $("#cartHeadNote"),
    cartReviewActions: $("#cartReviewActions"),
    cartCheckoutActions: $("#cartCheckoutActions"),
    finishOrderButton: $("#finishOrderButton"),
    cancelOrderButton: $("#cancelOrderButton"),
    backToCartButton: $("#backToCartButton"),
    whatsappOrder: $("#whatsappOrder"),
    orderForm: $("#orderForm"),
    customerName: $("#customerName"),
    nameField: $("#nameField"),
    nameError: $("#customerNameError"),
    customerPhone: $("#customerPhone"),
    phoneField: $("#phoneField"),
    phoneError: $("#customerPhoneError"),
    deliveryAddress: $("#deliveryAddress"),
    addressField: $("#addressField"),
    addressError: $("#addressError"),
    orderNotes: $("#orderNotes"),
    menuTabs: $("#menuTabs"),
    menuGrid: $("#menuGrid"),
    menuCount: $("#menuCount"),
    reviewsList: $("#reviewsList"),
    reviewsEmpty: $("#reviewsEmpty"),
    reviewForm: $("#reviewForm"),
    reviewName: $("#reviewName"),
    ratingStars: $("#ratingStars"),
    reviewRatingValue: $("#reviewRatingValue"),
    reviewText: $("#reviewText"),
    reviewFormError: $("#reviewFormError"),
    reviewDraftPreview: $("#reviewDraftPreview"),
    reviewDraftText: $("#reviewDraftText"),
    copyReviewButton: $("#copyReviewButton"),
    toast: $("#toast")
  };

  const state = {
    filter: "all",
    activeItemId: null,
    modalQty: 1,
    modalAddonIds: new Set(),
    cart: sanitizeCart(readStorage(CART_STORAGE_KEY, [])),
    cartStep: "review"
  };

  let toastTimer = null;

  /* -----------------------------------------------------------------------
     أدوات مساعدة
     ----------------------------------------------------------------------- */

  function escapeHtml(value) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return String(value ?? "").replace(/[&<>"']/g, (character) => map[character]);
  }

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* التخزين المحلي ممكن يكون متوقف في بعض المتصفحات. */
    }
  }

  function removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      /* التخزين المحلي ممكن يكون متوقف في بعض المتصفحات. */
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        /* نجرّب الطريقة القديمة تحت. */
      }
    }

    try {
      const temporaryField = document.createElement("textarea");
      temporaryField.value = text;
      temporaryField.setAttribute("readonly", "");
      temporaryField.style.position = "fixed";
      temporaryField.style.insetInlineStart = "-9999px";
      temporaryField.style.opacity = "0";
      document.body.appendChild(temporaryField);
      temporaryField.select();
      const copied = document.execCommand("copy");
      temporaryField.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function isValidPhone(value) {
    const digits = phoneDigits(value);
    return digits.length >= 10 && digits.length <= 15;
  }

  function formatNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "0";
    return new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 }).format(numericValue);
  }

  function formatMoney(value) {
    return `${formatNumber(value)} ${currency}`;
  }

  function getItem(itemId) {
    return itemsById.get(itemId) || null;
  }

  function getCategory(categoryId) {
    return categoriesById.get(categoryId) || null;
  }

  function getAddonsForItem(item) {
    if (!item || !Array.isArray(item.addonIds)) return [];
    return item.addonIds
      .map((addonId) => addonsById.get(addonId))
      .filter((addon) => addon && (!Array.isArray(addon.categories) || addon.categories.includes(item.category)));
  }

  function calcLineTotal(entry) {
    const item = getItem(entry.itemId);
    if (!item) return 0;

    const addonsTotal = (entry.addonIds || []).reduce((total, addonId) => {
      const addon = addonsById.get(addonId);
      return total + (addon ? Number(addon.price) || 0 : 0);
    }, 0);

    return ((Number(item.price) || 0) + addonsTotal) * entry.qty;
  }

  function countCartItems() {
    return state.cart.reduce((total, entry) => total + entry.qty, 0);
  }

  function buildCartKey(itemId, addonIds) {
    return `${itemId}::${[...addonIds].sort().join(",")}`;
  }

  function normalizeQuantity(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(MAX_QTY, Math.max(1, parsed));
  }

  function sanitizeCart(rawCart) {
    if (!Array.isArray(rawCart)) return [];

    const merged = new Map();

    rawCart.forEach((rawEntry) => {
      if (!rawEntry || !rawEntry.itemId) return;
      const item = getItem(rawEntry.itemId);
      if (!item) return;

      const availableAddons = getAddonsForItem(item);
      const availableAddonIds = new Set(availableAddons.map((addon) => addon.id));
      const addonIds = Array.isArray(rawEntry.addonIds)
        ? [...new Set(rawEntry.addonIds.filter((addonId) => availableAddonIds.has(addonId)))]
        : [];

      const qty = normalizeQuantity(rawEntry.qty);
      const key = buildCartKey(item.id, addonIds);

      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.qty = Math.min(MAX_QTY, existing.qty + qty);
      } else {
        merged.set(key, { itemId: item.id, qty, addonIds });
      }
    });

    return Array.from(merged.values());
  }

  function saveCart() {
    writeStorage(CART_STORAGE_KEY, state.cart);
  }

  function buildWhatsAppUrl(message) {
    const number = String(restaurant.phone.whatsapp || "").replace(/\D/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function showToast(message) {
    if (!dom.toast) return;
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 2800);
  }

  function syncScrollLock() {
    const hasOpenDialog =
      Boolean(dom.mobileMenu && dom.mobileMenu.open) ||
      Boolean(dom.itemDialog && dom.itemDialog.open) ||
      Boolean(dom.cartDialog && dom.cartDialog.open);

    document.body.classList.toggle("no-scroll", hasOpenDialog);
  }

  /* -----------------------------------------------------------------------
     بيانات المطعم والروابط العامة
     ----------------------------------------------------------------------- */

  function syncRestaurantDetails() {
    $$("a[href^='tel:']").forEach((link) => {
      link.href = `tel:${restaurant.phone.tel}`;
    });

    $$("[data-phone-display]").forEach((element) => {
      element.textContent = restaurant.phone.display;
    });

    $$("[data-address-line1]").forEach((element) => {
      element.textContent = restaurant.address.line1;
    });

    $$("[data-address-line2]").forEach((element) => {
      element.textContent = restaurant.address.line2;
    });

    $$("[data-address-full]").forEach((element) => {
      element.textContent = `${restaurant.address.line1}، ${restaurant.address.line2}`;
    });

    $$("[data-locality]").forEach((element) => {
      element.textContent = `${restaurant.address.locality} – ${restaurant.address.region}`;
    });

    $$("a[href*='maps.app.goo.gl']").forEach((link) => {
      link.href = restaurant.map.url;
    });

    $$("[data-google-review-link]").forEach((link) => {
      link.href = restaurant.map.url;
    });

    const mapFrame = $(".map-card iframe");
    if (mapFrame && restaurant.map.embedUrl) {
      mapFrame.src = restaurant.map.embedUrl;
    }

    const ratingValue = Number(restaurant.rating.value) || 0;
    const ratingCount = Number(restaurant.rating.count) || 0;
    const ratingPercent = Math.min(100, Math.max(0, (ratingValue / 5) * 100));

    $$("[data-rating-value]").forEach((element) => {
      element.textContent = String(ratingValue);
    });

    $$("[data-rating-count]").forEach((element) => {
      element.textContent = formatNumber(ratingCount);
    });

    $$(".stars").forEach((starsElement) => {
      starsElement.setAttribute("aria-label", `${ratingValue} من 5`);
      const fill = $(".stars__fill", starsElement);
      if (fill) fill.style.setProperty("--rating", `${ratingPercent}%`);
    });

    const whatssappRatingLabel = $(".hero__rating");
    if (whatssappRatingLabel) {
      whatssappRatingLabel.setAttribute(
        "aria-label",
        `تقييم ${ratingValue} من 5 بناءً على ${formatNumber(ratingCount)} مراجعة كما ورد في بيانات المطعم`
      );
    }

    const currentYear = $("#currentYear");
    if (currentYear) {
      currentYear.textContent = String(config.year || new Date().getFullYear());
    }
  }

  function wireWhatsAppLinks() {
    const messageOverrides = {
      inquiry: "مرحبًا بيتزا قوطة 👋\nعندي استفسار عن المنيو والطلبات. ممكن تساعدوني؟",
      feedback: "مرحبًا بيتزا قوطة 👋\nعندي ملاحظة أو اقتراح بخصوص المطعم."
    };

    $$("[data-wa-generic]").forEach((link) => {
      const key = link.getAttribute("data-wa-generic");
      const message = messageOverrides[key] || config.order.genericWhatsappMessage;
      link.href = buildWhatsAppUrl(message);
      link.target = "_blank";
      link.rel = "noopener";
    });
  }

  function applyVisibilityFlags() {
    const isDemo = Boolean(menuSettings.isDemo);
    const photosAreIllustrative = Boolean(menuSettings.photosAreIllustrative);

    $$("[data-demo-only]").forEach((element) => {
      element.hidden = !isDemo;
    });

    $$("[data-photo-only]").forEach((element) => {
      element.hidden = !photosAreIllustrative;
    });

    $$("[data-demo-price-only]").forEach((element) => {
      element.hidden = pricesConfirmed;
    });

    $$("[data-real-price-only]").forEach((element) => {
      element.hidden = !pricesConfirmed;
    });
  }

  /* -----------------------------------------------------------------------
     المنيو
     ----------------------------------------------------------------------- */

  function menuPriceMarkup(price) {
    return `<span class="price-value">${formatNumber(price)} <small>${escapeHtml(currency)}</small></span>`;
  }

  function renderMenuTabs() {
    if (!dom.menuTabs) return;

    dom.menuTabs.innerHTML = categories
      .map(
        (category, index) => `
          <button
            class="menu-tab"
            type="button"
            data-filter="${escapeHtml(category.id)}"
            aria-pressed="${index === 0 ? "true" : "false"}"
          >${escapeHtml(category.name)}</button>
        `
      )
      .join("");
  }

  function createMenuRow(item, index) {
    const priceDemo = pricesConfirmed ? "" : `<span class="demo-tag demo-tag--row">سعر تجريبي</span>`;
    const imageAlt = `${item.imageAlt || item.name}${menuSettings.photosAreIllustrative ? " — صورة توضيحية" : ""}`;

    return `
      <article
        class="menu-row"
        data-category="${escapeHtml(item.category)}"
        data-item-id="${escapeHtml(item.id)}"
        style="--row-index: ${index % 10}"
      >
        <div class="menu-row__media">
          <img
            src="${escapeHtml(item.image)}"
            alt="${escapeHtml(imageAlt)}"
            width="640"
            height="480"
            loading="lazy"
            decoding="async"
          >
        </div>
        <div class="menu-row__content">
          <div class="menu-row__info">
            <h4>${escapeHtml(item.name)}</h4>
            <p>${escapeHtml(item.description || "")}</p>
          </div>
          <div class="menu-row__side">
            <div class="menu-row__price">
              ${priceDemo}
              ${menuPriceMarkup(item.price)}
            </div>
            <button
              class="menu-add"
              type="button"
              data-order-item="${escapeHtml(item.id)}"
              aria-label="أضف ${escapeHtml(item.name)} إلى الأوردر"
              title="أضف ${escapeHtml(item.name)}"
            >
              <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderMenu() {
    if (!dom.menuGrid) return;

    const groups = categories
      .filter((category) => category.id !== "all")
      .map((category, groupIndex) => {
        const categoryItems = items.filter((item) => item.category === category.id);
        if (!categoryItems.length) return "";

        return `
          <section
            class="menu-group"
            data-menu-category="${escapeHtml(category.id)}"
            aria-label="${escapeHtml(category.name)}"
          >
            <header class="menu-group__head">
              <div class="menu-group__title">
                <span class="menu-group__number">${formatNumber(groupIndex + 1).padStart(2, "0")}</span>
                <h3>${escapeHtml(category.name)}</h3>
              </div>
              <span class="menu-group__count">${formatNumber(categoryItems.length)} ${
                categoryItems.length === 1 ? "صنف" : "أصناف"
              }</span>
            </header>
            <div class="menu-group__rows">
              ${categoryItems.map((item, index) => createMenuRow(item, index)).join("")}
            </div>
          </section>
        `;
      })
      .join("");

    dom.menuGrid.innerHTML = groups;
    renderMenuTabs();
    applyMenuFilter("all", { rerenderCount: true });
  }

  function applyMenuFilter(filterId, options = {}) {
    const activeCategory = categoriesById.get(filterId);
    const resolvedFilter = activeCategory ? filterId : "all";
    state.filter = resolvedFilter;

    let visibleRows = 0;

    $$(".menu-group", dom.menuGrid).forEach((group) => {
      const isVisible = resolvedFilter === "all" || group.dataset.menuCategory === resolvedFilter;
      group.hidden = !isVisible;
      if (isVisible) visibleRows += group.querySelectorAll(".menu-row").length;
    });

    $$(".menu-tab", dom.menuTabs).forEach((tab) => {
      tab.setAttribute("aria-pressed", String(tab.dataset.filter === resolvedFilter));
    });

    if (dom.menuCount && options.rerenderCount !== false) {
      dom.menuCount.innerHTML = `<strong>${formatNumber(visibleRows)}</strong> ${
        visibleRows === 1 ? "صنف" : "أصناف"
      }`;
    }
  }

  function handleFilterClick(event) {
    const tab = event.target.closest("[data-filter]");
    if (!tab || !dom.menuTabs.contains(tab)) return;
    applyMenuFilter(tab.dataset.filter);
  }

  function handleMenuGridClick(event) {
    const orderButton = event.target.closest("[data-order-item]");
    if (!orderButton) return;
    openItemDialog(orderButton.getAttribute("data-order-item"));
  }

  function getSelectedModalAddons() {
    return items
      .length
      ? [...state.modalAddonIds]
          .map((addonId) => addonsById.get(addonId))
          .filter(Boolean)
      : [];
  }

  function updateModalPrice() {
    const item = getItem(state.activeItemId);
    if (!item) return;

    const addonsTotal = getSelectedModalAddons().reduce(
      (total, addon) => total + (Number(addon.price) || 0),
      0
    );

    const total = ((Number(item.price) || 0) + addonsTotal) * state.modalQty;
    if (dom.itemDialogPrice) dom.itemDialogPrice.textContent = formatMoney(total);
    if (dom.itemQuantity) dom.itemQuantity.textContent = String(state.modalQty);
    if (dom.addItemButton) {
      dom.addItemButton.disabled = false;
      dom.addItemButton.innerHTML = `
        <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>
        ضيف للطلب
      `;
    }
  }

  function renderModalAddons(item) {
    const itemAddons = getAddonsForItem(item);

    if (!dom.itemAddonsWrap || !dom.itemAddons) return;

    if (!itemAddons.length) {
      dom.itemAddonsWrap.hidden = true;
      dom.itemAddons.innerHTML = "";
      return;
    }

    dom.itemAddonsWrap.hidden = false;
    dom.itemAddons.innerHTML = itemAddons
      .map(
        (addon) => `
          <label class="addon-option">
            <input type="checkbox" value="${escapeHtml(addon.id)}" data-addon-id>
            <span class="addon-option__check">
              <svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>
            </span>
            <span class="addon-option__name">${escapeHtml(addon.name)}</span>
            <span class="addon-option__price">+ ${formatMoney(addon.price)}</span>
          </label>
        `
      )
      .join("");
  }

  function openItemDialog(itemId) {
    const item = getItem(itemId);
    if (!item || !dom.itemDialog) return;

    const category = getCategory(item.category);
    state.activeItemId = item.id;
    state.modalQty = 1;
    state.modalAddonIds = new Set();

    if (dom.itemDialogImage) {
      dom.itemDialogImage.src = item.image;
      dom.itemDialogImage.alt = `${item.imageAlt || item.name}${
        menuSettings.photosAreIllustrative ? " — صورة توضيحية" : ""
      }`;
    }
    if (dom.itemDialogTitle) dom.itemDialogTitle.textContent = item.name;
    if (dom.itemDialogDescription) dom.itemDialogDescription.textContent = item.description || "";
    if (dom.itemDialogCategory) dom.itemDialogCategory.textContent = category ? category.name : "منيو قوطة";

    renderModalAddons(item);
    updateModalPrice();

    if (!dom.itemDialog.open) dom.itemDialog.showModal();
    syncScrollLock();
  }

  function closeItemDialog() {
    if (dom.itemDialog && dom.itemDialog.open) dom.itemDialog.close();
  }

  function handleModalAddonChange(event) {
    const input = event.target.closest("[data-addon-id]");
    if (!input) return;

    if (input.checked) {
      state.modalAddonIds.add(input.value);
    } else {
      state.modalAddonIds.delete(input.value);
    }
    updateModalPrice();
  }

  function handleModalQuantity(event) {
    const button = event.target.closest("[data-modal-qty]");
    if (!button) return;

    const difference = Number(button.getAttribute("data-modal-qty")) || 0;
    state.modalQty = Math.min(MAX_QTY, Math.max(1, state.modalQty + difference));
    updateModalPrice();
  }

  function addActiveItemToCart() {
    const item = getItem(state.activeItemId);
    if (!item) return;

    const addonIds = [...state.modalAddonIds];
    const key = buildCartKey(item.id, addonIds);
    const existingEntry = state.cart.find(
      (entry) => buildCartKey(entry.itemId, entry.addonIds) === key
    );

    if (existingEntry) {
      existingEntry.qty = Math.min(MAX_QTY, existingEntry.qty + state.modalQty);
    } else {
      state.cart.push({
        itemId: item.id,
        qty: state.modalQty,
        addonIds
      });
    }

    saveCart();
    state.cartStep = "review";
    renderCart();

    if (dom.itemDialog && dom.itemDialog.open) dom.itemDialog.close();
    openCartDialog();
  }

  /* -----------------------------------------------------------------------
     السلة والطلب
     ----------------------------------------------------------------------- */

  function calcCartTotal() {
    return state.cart.reduce((total, entry) => total + calcLineTotal(entry), 0);
  }

  function updateCartCounters() {
    const count = countCartItems();
    const displayCount = count > 99 ? "99+" : String(count);

    $$(".js-cart-count").forEach((counter) => {
      counter.textContent = displayCount;
      counter.dataset.count = String(count);
      counter.setAttribute("aria-hidden", "true");
    });

    $$(".js-open-cart").forEach((button) => {
      button.setAttribute(
        "aria-label",
        count > 0 ? `افتح طلبك، ${formatNumber(count)} ${count === 1 ? "صنف" : "أصناف"}` : "افتح طلبك"
      );
    });
  }

  function cartItemMarkup(entry) {
    const item = getItem(entry.itemId);
    if (!item) return "";

    const key = buildCartKey(entry.itemId, entry.addonIds);
    const selectedAddons = (entry.addonIds || [])
      .map((addonId) => addonsById.get(addonId))
      .filter(Boolean);
    const addonsText = selectedAddons.length
      ? `+ ${selectedAddons.map((addon) => escapeHtml(addon.name)).join("، ")}`
      : "";
    const itemTotal = calcLineTotal(entry);

    return `
      <article class="cart-item" data-cart-key="${escapeHtml(key)}">
        <div class="cart-item__image">
          <img src="${escapeHtml(item.image)}" alt="" width="160" height="180" loading="lazy" decoding="async">
        </div>
        <div class="cart-item__body">
          <div class="cart-item__heading">
            <h4>${escapeHtml(item.name)}</h4>
            <button
              class="remove-item"
              type="button"
              data-cart-action="remove"
              aria-label="احذف ${escapeHtml(item.name)} من الطلب"
            >
              <svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>
            </button>
          </div>
          ${addonsText ? `<p class="cart-item__addons">${addonsText}</p>` : ""}
          <div class="cart-item__bottom">
            <span class="cart-item__price">
              ${formatMoney(itemTotal)}
              ${pricesConfirmed ? "" : "<small>(تجريبي)</small>"}
            </span>
            <div class="stepper stepper--small">
              <button
                type="button"
                data-cart-action="decrease"
                aria-label="تقليل كمية ${escapeHtml(item.name)}"
                ${entry.qty <= 1 ? "disabled" : ""}
              >
                <svg class="icon" aria-hidden="true"><use href="#i-minus"></use></svg>
              </button>
              <output aria-label="الكمية">${entry.qty}</output>
              <button
                type="button"
                data-cart-action="increase"
                aria-label="زيادة كمية ${escapeHtml(item.name)}"
              >
                <svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderCart() {
    if (!dom.cartItems) return;

    const hasItems = state.cart.length > 0;
    if (!hasItems) state.cartStep = "review";

    const isCheckoutStep = hasItems && state.cartStep === "checkout";

    if (dom.cartEmpty) dom.cartEmpty.hidden = hasItems;
    if (dom.cartFilled) dom.cartFilled.hidden = !hasItems;
    if (dom.cartFooter) dom.cartFooter.hidden = !hasItems;
    if (dom.cartReviewStep) dom.cartReviewStep.hidden = !hasItems || isCheckoutStep;
    if (dom.checkoutStep) dom.checkoutStep.hidden = !hasItems || !isCheckoutStep;
    if (dom.cartReviewActions) dom.cartReviewActions.hidden = !hasItems || isCheckoutStep;
    if (dom.cartCheckoutActions) dom.cartCheckoutActions.hidden = !hasItems || !isCheckoutStep;

    if (dom.cartStepKicker) {
      dom.cartStepKicker.textContent = hasItems
        ? `أوردر ويب سايت • الخطوة ${isCheckoutStep ? "2" : "1"} من 2`
        : "أوردر ويب سايت";
    }

    if (dom.cartTitle) {
      dom.cartTitle.textContent = !hasItems
        ? "طلبك"
        : isCheckoutStep
          ? "بيانات الطلب"
          : "مراجعة الأوردر";
    }

    if (dom.cartHeadNote) {
      dom.cartHeadNote.textContent = !hasItems
        ? "اختار أصنافك من المنيو الأول."
        : isCheckoutStep
          ? "اكتب اسم العميل ورقم التليفون، وأضف العنوان لو الطلب توصيل."
          : "راجع الأصناف، وبعدها اضغط إنهاء الأوردر أو إلغاء الأوردر.";
    }

    if (dom.cartItems) {
      dom.cartItems.innerHTML = state.cart.map(cartItemMarkup).join("");
    }

    if (dom.cartTotal) dom.cartTotal.textContent = formatMoney(calcCartTotal());

    updateCartCounters();
    updateWhatsAppOrderLink();
  }

  function handleCartItemsClick(event) {
    const actionButton = event.target.closest("[data-cart-action]");
    if (!actionButton) return;

    const cartRow = actionButton.closest("[data-cart-key]");
    if (!cartRow) return;

    const key = cartRow.getAttribute("data-cart-key");
    const entryIndex = state.cart.findIndex(
      (entry) => buildCartKey(entry.itemId, entry.addonIds) === key
    );

    if (entryIndex < 0) return;

    const action = actionButton.getAttribute("data-cart-action");
    const entry = state.cart[entryIndex];

    if (action === "increase") {
      entry.qty = Math.min(MAX_QTY, entry.qty + 1);
    } else if (action === "decrease") {
      entry.qty = Math.max(1, entry.qty - 1);
    } else if (action === "remove") {
      state.cart.splice(entryIndex, 1);
    }

    saveCart();
    renderCart();
  }

  function openCartDialog() {
    if (!dom.cartDialog) return;

    renderCart();
    syncOrderTypeUi();
    updateWhatsAppOrderLink();

    if (!dom.cartDialog.open) dom.cartDialog.showModal();

    if (dom.cartScroll) dom.cartScroll.scrollTop = 0;
    syncScrollLock();
  }

  function closeCartDialog() {
    if (dom.cartDialog && dom.cartDialog.open) dom.cartDialog.close();
  }

  function goToCheckoutStep() {
    if (!state.cart.length) return;

    state.cartStep = "checkout";
    renderCart();

    if (dom.cartScroll) dom.cartScroll.scrollTop = 0;
    if (dom.customerName) dom.customerName.focus({ preventScroll: true });
  }

  function goToReviewStep() {
    state.cartStep = "review";
    renderCart();

    if (dom.cartScroll) dom.cartScroll.scrollTop = 0;
    if (dom.finishOrderButton) dom.finishOrderButton.focus({ preventScroll: true });
  }

  function resetCheckoutForm() {
    if (dom.customerName) dom.customerName.value = "";
    if (dom.customerPhone) dom.customerPhone.value = "";
    if (dom.deliveryAddress) dom.deliveryAddress.value = "";
    if (dom.orderNotes) dom.orderNotes.value = "";

    if (dom.orderForm) {
      $$("input[name='orderType']", dom.orderForm).forEach((input) => {
        input.checked = input.value === "delivery";
      });
    }

    clearNameError();
    clearPhoneError();
    clearAddressError();
    removeStorage(DRAFT_STORAGE_KEY);
    syncOrderTypeUi();
  }

  function cancelOrder() {
    if (!state.cart.length) return;

    const confirmed = window.confirm("متأكد إنك عايز تلغي الأوردر وتمسح كل الأصناف؟");
    if (!confirmed) return;

    state.cart = [];
    state.cartStep = "review";
    saveCart();
    resetCheckoutForm();
    renderCart();
    closeCartDialog();
    showToast("تم إلغاء الأوردر وحذف الأصناف.");
  }

  function getSelectedOrderType() {
    const checkedType = dom.orderForm
      ? $("input[name='orderType']:checked", dom.orderForm)
      : null;
    return checkedType ? checkedType.value : "delivery";
  }

  function syncOrderTypeUi() {
    const orderType = getSelectedOrderType();
    const isDelivery = orderType === "delivery";

    if (dom.addressField) dom.addressField.hidden = !isDelivery;
    if (dom.deliveryAddress) {
      dom.deliveryAddress.setAttribute("aria-required", String(isDelivery));
    }

    if (!isDelivery) clearAddressError();
  }

  function setFieldError(field, errorElement) {
    if (!field || !errorElement) return null;
    field.classList.add("has-error");
    errorElement.hidden = false;
    const control = field.querySelector("input, textarea");
    if (control) control.setAttribute("aria-invalid", "true");
    return control;
  }

  function clearFieldError(field, errorElement) {
    if (!field || !errorElement) return;
    field.classList.remove("has-error");
    errorElement.hidden = true;
    const control = field.querySelector("input, textarea");
    if (control) control.setAttribute("aria-invalid", "false");
  }

  function clearNameError() {
    clearFieldError(dom.nameField, dom.nameError);
  }

  function clearPhoneError() {
    clearFieldError(dom.phoneField, dom.phoneError);
  }

  function clearAddressError() {
    clearFieldError(dom.addressField, dom.addressError);
  }

  function saveOrderDraft() {
    if (!dom.orderForm) return;

    writeStorage(DRAFT_STORAGE_KEY, {
      name: dom.customerName ? dom.customerName.value : "",
      phone: dom.customerPhone ? dom.customerPhone.value : "",
      orderType: getSelectedOrderType(),
      address: dom.deliveryAddress ? dom.deliveryAddress.value : "",
      notes: dom.orderNotes ? dom.orderNotes.value : ""
    });
  }

  function hydrateOrderDraft() {
    if (!dom.orderForm) return;

    const draft = readStorage(DRAFT_STORAGE_KEY, {});
    const allowedTypes = Object.keys(orderTypeLabels);

    if (dom.customerName && typeof draft.name === "string") {
      dom.customerName.value = draft.name;
    }
    if (dom.customerPhone && typeof draft.phone === "string") {
      dom.customerPhone.value = draft.phone;
    }
    if (dom.orderNotes && typeof draft.notes === "string") {
      dom.orderNotes.value = draft.notes;
    }
    if (dom.deliveryAddress && typeof draft.address === "string") {
      dom.deliveryAddress.value = draft.address;
    }

    const desiredType = allowedTypes.includes(draft.orderType) ? draft.orderType : "delivery";
    $$("input[name='orderType']", dom.orderForm).forEach((input) => {
      input.checked = input.value === desiredType;
    });

    syncOrderTypeUi();
  }

  function getOrderFormValues() {
    return {
      name: dom.customerName ? dom.customerName.value.trim() : "",
      phone: dom.customerPhone ? dom.customerPhone.value.trim() : "",
      orderType: getSelectedOrderType(),
      address: dom.deliveryAddress ? dom.deliveryAddress.value.trim() : "",
      notes: dom.orderNotes ? dom.orderNotes.value.trim() : ""
    };
  }

  function buildOrderMessage() {
    const values = getOrderFormValues();
    const lines = [];
    const typeLabel = orderTypeLabels[values.orderType] || orderTypeLabels.delivery;

    lines.push(config.order.messageTitle || "أوردر ويب سايت");
    lines.push("");
    lines.push(config.order.introMessage);
    lines.push("");

    if (values.name) lines.push(`👤 الاسم: ${values.name}`);
    if (values.phone) lines.push(`📞 رقم التليفون: ${values.phone}`);

    lines.push(`🍽️ نوع الطلب: ${typeLabel}`);

    if (values.orderType === "delivery" && values.address) {
      lines.push(`📍 عنوان التوصيل: ${values.address}`);
    }

    lines.push("");
    lines.push("🛒 الأصناف:");

    state.cart.forEach((entry, index) => {
      const item = getItem(entry.itemId);
      if (!item) return;

      lines.push(`${index + 1}. ${item.name} × ${entry.qty}`);

      const selectedAddons = (entry.addonIds || [])
        .map((addonId) => addonsById.get(addonId))
        .filter(Boolean)
        .map((addon) => addon.name);

      if (selectedAddons.length) {
        lines.push(`   ➕ إضافات: ${selectedAddons.join("، ")}`);
      }
    });

    if (values.notes) {
      lines.push("");
      lines.push(`📝 ملاحظات: ${values.notes}`);
    }

    lines.push("");

    if (pricesConfirmed) {
      lines.push(`🧾 الإجمالي: ${formatMoney(calcCartTotal())}`);
    } else {
      lines.push("🧾 الأسعار هتتأكد مع المطعم.");
    }

    lines.push("");
    lines.push(config.order.closingNote);

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function updateWhatsAppOrderLink() {
    if (!dom.whatsappOrder) return;

    if (!state.cart.length) {
      dom.whatsappOrder.href = buildWhatsAppUrl(config.order.genericWhatsappMessage);
      return;
    }

    dom.whatsappOrder.href = buildWhatsAppUrl(buildOrderMessage());
  }

  function validateOrder() {
    if (!state.cart.length) return false;

    const values = getOrderFormValues();
    const needsAddress = values.orderType === "delivery";
    let firstInvalidControl = null;

    if (values.name.length < 2) {
      const nameControl = setFieldError(dom.nameField, dom.nameError);
      if (!firstInvalidControl) firstInvalidControl = nameControl;
    } else {
      clearNameError();
    }

    if (!isValidPhone(values.phone)) {
      const phoneControl = setFieldError(dom.phoneField, dom.phoneError);
      if (!firstInvalidControl) firstInvalidControl = phoneControl;
    } else {
      clearPhoneError();
    }

    if (needsAddress && values.address.length < 5) {
      const addressControl = setFieldError(dom.addressField, dom.addressError);
      if (!firstInvalidControl) firstInvalidControl = addressControl;
    } else {
      clearAddressError();
    }

    if (firstInvalidControl) {
      firstInvalidControl.focus({ preventScroll: false });
      firstInvalidControl.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }

    return true;
  }

  function handleWhatsAppOrderClick(event) {
    if (state.cartStep !== "checkout") {
      event.preventDefault();
      goToCheckoutStep();
      return;
    }

    if (!validateOrder()) {
      event.preventDefault();
      return;
    }

    // نعيد بناء الرسالة لحظة الضغط لضمان وجود أحدث بيانات النموذج.
    updateWhatsAppOrderLink();
  }

  function handleOrderFormUpdate(event) {
    const target = event.target;

    if (target && target.name === "customerName") {
      clearNameError();
    }

    if (target && target.name === "customerPhone") {
      clearPhoneError();
    }

    if (target && target.name === "deliveryAddress") {
      clearAddressError();
    }

    if (target && target.name === "orderType") {
      syncOrderTypeUi();
    }

    saveOrderDraft();
    updateWhatsAppOrderLink();
  }

  function handleCartGoMenu() {
    closeCartDialog();
    const menuSection = $("#menu");
    if (menuSection) {
      window.setTimeout(() => {
        menuSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }

  /* -----------------------------------------------------------------------
     التقييمات
     ----------------------------------------------------------------------- */

  function getReviewRating() {
    if (!dom.reviewForm) return 0;
    const selected = $("input[name='reviewRating']:checked", dom.reviewForm);
    return selected ? Number(selected.value) : 0;
  }

  function syncRatingStars(rating) {
    if (!dom.ratingStars) return;

    $$(".rating-star", dom.ratingStars).forEach((label) => {
      const value = Number($("input", label)?.value || 0);
      label.classList.toggle("is-selected", value > 0 && value <= rating);
    });

    if (dom.reviewRatingValue) {
      dom.reviewRatingValue.textContent = rating
        ? `${formatNumber(rating)} من 5 نجوم`
        : "اختار عدد النجوم";
    }
  }

  function clearReviewFormError() {
    if (dom.reviewFormError) dom.reviewFormError.hidden = true;
  }

  function handleReviewRatingChange(event) {
    if (!event.target.matches("input[name='reviewRating']")) return;
    syncRatingStars(Number(event.target.value));
    clearReviewFormError();
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();

    if (!dom.reviewForm) return;

    const rating = getReviewRating();
    const reviewText = dom.reviewText ? dom.reviewText.value.trim() : "";
    const reviewerName = dom.reviewName ? dom.reviewName.value.trim() : "";

    if (!rating || reviewText.length < 5) {
      if (dom.reviewFormError) dom.reviewFormError.hidden = false;

      if (!rating && dom.ratingStars) {
        const firstStarInput = $("input[name='reviewRating']", dom.reviewForm);
        if (firstStarInput) firstStarInput.focus();
      } else if (dom.reviewText) {
        dom.reviewText.focus();
      }
      return;
    }

    clearReviewFormError();

    const stars = `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
    const draftLines = [reviewText, "", `${stars} (${formatNumber(rating)}/5)`];

    if (reviewerName) draftLines.push(`— ${reviewerName}`);

    const draft = draftLines.join("\n");

    if (dom.reviewDraftText) dom.reviewDraftText.value = draft;
    if (dom.reviewDraftPreview) dom.reviewDraftPreview.hidden = false;

    const copied = await copyText(draft);
    showToast(
      copied
        ? "تم نسخ نص التقييم. افتح Google Maps والصقه في تعليقك."
        : "نص التقييم جاهز. انسخه من الصندوق وافتح Google Maps."
    );

    if (dom.reviewDraftPreview) {
      dom.reviewDraftPreview.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function handleCopyReview() {
    if (!dom.reviewDraftText) return;

    const copied = await copyText(dom.reviewDraftText.value);
    showToast(copied ? "تم نسخ نص التقييم." : "تعذر النسخ التلقائي. حدد النص وانسخه يدويًا.");
  }

  function renderReviews() {
    const verifiedReviews = Array.isArray(config.reviews)
      ? config.reviews.filter(
          (review) =>
            review &&
            typeof review.name === "string" &&
            review.name.trim() &&
            typeof (review.text || review.comment) === "string" &&
            (review.text || review.comment).trim()
        )
      : [];

    if (!dom.reviewsList || !dom.reviewsEmpty) return;

    if (!verifiedReviews.length) {
      dom.reviewsList.hidden = true;
      dom.reviewsEmpty.hidden = false;
      return;
    }

    dom.reviewsEmpty.hidden = true;
    dom.reviewsList.hidden = false;
    dom.reviewsList.innerHTML = verifiedReviews
      .map((review) => {
        const numericRating = Number(review.rating);
        const hasRating = Number.isFinite(numericRating) && numericRating >= 1 && numericRating <= 5;
        const roundedRating = hasRating ? Math.round(numericRating) : 0;
        const stars = hasRating
          ? `<span class="review-item__stars" aria-label="${numericRating} من 5">${"★".repeat(
              roundedRating
            )}${"☆".repeat(5 - roundedRating)}</span>`
          : "";

        return `
          <article class="review-item">
            <div class="review-item__head">
              <strong class="review-item__name">${escapeHtml(review.name)}</strong>
              ${stars}
            </div>
            ${review.date ? `<p class="review-item__meta">${escapeHtml(review.date)}</p>` : ""}
            <p>${escapeHtml(review.text || review.comment)}</p>
          </article>
        `;
      })
      .join("");
  }

  /* -----------------------------------------------------------------------
     التنقل والواجهة
     ----------------------------------------------------------------------- */

  function openMobileMenu() {
    if (!dom.mobileMenu) return;
    if (!dom.mobileMenu.open) dom.mobileMenu.showModal();
    if (dom.mobileMenuToggle) dom.mobileMenuToggle.setAttribute("aria-expanded", "true");
    syncScrollLock();
  }

  function closeMobileMenu() {
    if (dom.mobileMenu && dom.mobileMenu.open) dom.mobileMenu.close();
  }

  function initSectionNavigation() {
    if (!dom.header) return;

    const navLinks = $$(".main-nav .nav-link");
    const sections = navLinks
      .map((link) => {
        const href = link.getAttribute("href");
        return href && href.startsWith("#") ? $(href) : null;
      })
      .filter(Boolean);

    let frameRequested = false;

    const update = () => {
      frameRequested = false;
      dom.header.classList.toggle("is-scrolled", window.scrollY > 12);

      if (!sections.length) return;

      const isAtPageBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      const marker = window.scrollY + Math.max(140, window.innerHeight * 0.26);
      let activeSection = sections[0];

      if (isAtPageBottom) {
        activeSection = sections[sections.length - 1];
      } else {
        sections.forEach((section) => {
          if (section.offsetTop <= marker) activeSection = section;
        });
      }

      navLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${activeSection.id}`;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    const requestUpdate = () => {
      if (frameRequested) return;
      frameRequested = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("load", requestUpdate, { once: true });
    update();
  }

  function initRevealAnimations() {
    const elements = $$(".reveal");
    if (!elements.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -6% 0px"
      }
    );

    elements.forEach((element) => observer.observe(element));
  }

  function bindEvents() {
    if (dom.menuTabs) dom.menuTabs.addEventListener("click", handleFilterClick);
    if (dom.menuGrid) dom.menuGrid.addEventListener("click", handleMenuGridClick);

    if (dom.itemDialog) {
      dom.itemDialog.addEventListener("click", (event) => {
        if (event.target.closest("[data-modal-qty]")) {
          handleModalQuantity(event);
          return;
        }
        if (event.target === dom.itemDialog) closeItemDialog();
      });
    }

    $$("[data-close-item]").forEach((button) => {
      button.addEventListener("click", closeItemDialog);
    });

    if (dom.itemAddons) dom.itemAddons.addEventListener("change", handleModalAddonChange);
    if (dom.addItemButton) dom.addItemButton.addEventListener("click", addActiveItemToCart);

    if (dom.cartItems) dom.cartItems.addEventListener("click", handleCartItemsClick);

    $$("[data-close-cart]").forEach((button) => {
      button.addEventListener("click", closeCartDialog);
    });

    if (dom.cartDialog) {
      dom.cartDialog.addEventListener("click", (event) => {
        if (event.target === dom.cartDialog) closeCartDialog();
      });
    }

    $$("[data-cart-go-menu]").forEach((button) => {
      button.addEventListener("click", handleCartGoMenu);
    });

    if (dom.orderForm) {
      dom.orderForm.addEventListener("input", handleOrderFormUpdate);
      dom.orderForm.addEventListener("change", handleOrderFormUpdate);
      dom.orderForm.addEventListener("submit", (event) => event.preventDefault());
    }

    if (dom.whatsappOrder) {
      dom.whatsappOrder.addEventListener("click", handleWhatsAppOrderClick);
    }

    if (dom.finishOrderButton) {
      dom.finishOrderButton.addEventListener("click", goToCheckoutStep);
    }

    if (dom.cancelOrderButton) {
      dom.cancelOrderButton.addEventListener("click", cancelOrder);
    }

    if (dom.backToCartButton) {
      dom.backToCartButton.addEventListener("click", goToReviewStep);
    }

    if (dom.reviewForm) {
      dom.reviewForm.addEventListener("submit", handleReviewSubmit);
      dom.reviewForm.addEventListener("input", clearReviewFormError);
    }

    if (dom.ratingStars) {
      dom.ratingStars.addEventListener("change", handleReviewRatingChange);
    }

    if (dom.copyReviewButton) {
      dom.copyReviewButton.addEventListener("click", handleCopyReview);
    }

    $$(".js-open-cart").forEach((button) => {
      button.addEventListener("click", openCartDialog);
    });

    if (dom.mobileMenuToggle) {
      dom.mobileMenuToggle.addEventListener("click", openMobileMenu);
    }

    if (dom.mobileMenu) {
      dom.mobileMenu.addEventListener("click", (event) => {
        if (event.target.closest("[data-close-menu]")) {
          closeMobileMenu();
          return;
        }
        if (event.target === dom.mobileMenu) closeMobileMenu();
      });

      dom.mobileMenu.addEventListener("close", () => {
        if (dom.mobileMenuToggle) dom.mobileMenuToggle.setAttribute("aria-expanded", "false");
        syncScrollLock();
      });
    }

    [dom.itemDialog, dom.cartDialog].forEach((dialog) => {
      if (!dialog) return;
      dialog.addEventListener("close", syncScrollLock);
    });
  }

  /* -----------------------------------------------------------------------
     التشغيل
     ----------------------------------------------------------------------- */

  function init() {
    applyVisibilityFlags();
    syncRestaurantDetails();
    wireWhatsAppLinks();
    renderMenu();
    renderReviews();
    hydrateOrderDraft();
    renderCart();
    bindEvents();
    initSectionNavigation();
    initRevealAnimations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
