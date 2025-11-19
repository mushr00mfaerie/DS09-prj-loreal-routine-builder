/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

// Use the existing selected-products list already present in the page
const selectedProductsList = document.getElementById("selectedProductsList");

// --- New: localStorage helpers and saved-list UI ---
const LOCAL_KEY = "loreal_saved_product_ids";

/* Save current selectedProducts (IDs) to localStorage */
function saveSelectedToLocalStorage() {
  try {
    const ids = selectedProducts.map((p) => String(p.id));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error("Failed to save selected products:", e);
  }
}

/* Load saved product ids from localStorage and map to full product objects */
function loadSavedFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return [];
    // map ids -> full product objects using allProducts cache
    return ids
      .map((id) => allProducts.find((p) => String(p.id) === String(id)))
      .filter(Boolean)
      .map((p) => ({
        id: String(p.id),
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
        image: p.image,
      }));
  } catch (e) {
    console.error("Failed to load saved products:", e);
    return [];
  }
}

/* Create saved-list controls (toggle show/hide + clear all) if not present */
function ensureSavedControls() {
  // if already created, return
  if (document.getElementById("savedControls")) return;

  const controls = document.createElement("div");
  controls.id = "savedControls";
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.alignItems = "center";
  controls.style.marginBottom = "8px";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.id = "savedToggle";
  toggleBtn.innerText = "Hide saved list";
  toggleBtn.style.padding = "6px 10px";
  toggleBtn.style.cursor = "pointer";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.id = "clearSaved";
  clearBtn.innerText = "Clear all";
  clearBtn.style.padding = "6px 10px";
  clearBtn.style.cursor = "pointer";

  // place controls before the saved list element
  selectedProductsList.parentNode.insertBefore(controls, selectedProductsList);
  controls.appendChild(toggleBtn);
  controls.appendChild(clearBtn);

  // toggle visibility handler
  toggleBtn.addEventListener("click", () => {
    if (selectedProductsList.style.display === "none") {
      selectedProductsList.style.display = "";
      toggleBtn.innerText = "Hide saved list";
    } else {
      selectedProductsList.style.display = "none";
      toggleBtn.innerText = "Show saved list";
    }
  });

  // clear all handler
  clearBtn.addEventListener("click", () => {
    // clear selection state and saved storage
    selectedProducts = [];
    saveSelectedToLocalStorage();

    // clear styles on visible cards (remove class instead of inline styles)
    productsContainer.querySelectorAll(".product-card").forEach((card) => {
      card.classList.remove("selected");
    });

    renderSelectedProducts();
  });
}

// keep track of selected products
let selectedProducts = [];
// cache all products so we can look up full details (category, description) by id
let allProducts = [];

// --- New: conversation history + strict system prompt ---
// System prompt: restrict assistant to only answer about the generated routine and related topics
const SYSTEM_PROMPT =
  "You are an assistant that ONLY answers questions about the generated routine or topics related to skincare, haircare, makeup, fragrance, and product usage for L'Oréal products. " +
  "If the user asks about unrelated topics, politely refuse. Use the provided product data and prior conversation history to answer. Be concise and helpful.";

const messagesHistory = [
  {
    role: "system",
    content: SYSTEM_PROMPT,
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  // cache full products list for lookups later
  allProducts = data.products;
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  // render cards with data-* attributes so we can attach behavior after rendering
  productsContainer.innerHTML = products
    .map(
      (product) => `
		<div class="product-card" data-id="${product.id}" data-name="${product.name}" data-brand="${product.brand}" data-image="${product.image}" tabindex="0" aria-describedby="desc-${product.id}">
		  <img src="${product.image}" alt="${product.name}">
		  <div class="product-info">
			<h3>${product.name}</h3>
			<p>${product.brand}</p>
		  </div>

		  <!-- description overlay (accessible, scrollable) -->
		  <div class="product-desc" id="desc-${product.id}" role="region" aria-label="${product.name} description">
		    <div class="desc-title">Product description</div>
		    <div class="desc-body">${product.description}</div>
		  </div>
		</div>
	  `
    )
    .join("");

  // After rendering, attach click handlers to toggle selection and keyboard behavior
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    const id = card.dataset.id;

    // If this product is already selected, apply the selected visual state via class
    if (selectedProducts.find((p) => String(p.id) === String(id))) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }

    card.addEventListener("click", () => {
      // look up full product by id (string vs number)
      const full = allProducts.find((p) => String(p.id) === String(id));
      const product = {
        id: String(full.id),
        name: full.name,
        brand: full.brand,
        category: full.category,
        description: full.description,
        image: full.image,
      };

      const index = selectedProducts.findIndex(
        (p) => String(p.id) === String(product.id)
      );
      if (index === -1) {
        // select
        selectedProducts.push(product);
        card.classList.add("selected");
      } else {
        // unselect
        selectedProducts.splice(index, 1);
        card.classList.remove("selected");
      }

      // update the selected-products UI and persist to localStorage
      renderSelectedProducts();
      saveSelectedToLocalStorage();
    });

    // keyboard: allow closing the overlay with Escape (by blurring the card)
    card.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        card.blur();
      }
    });
  });
}

/* Render the selected products section */
function renderSelectedProducts() {
  // render into the existing #selectedProductsList element
  const listContainer = selectedProductsList;
  if (!listContainer) return;

  // ensure controls exist (toggle + clear)
  ensureSavedControls();

  if (selectedProducts.length === 0) {
    listContainer.innerHTML = "No products selected";
    return;
  }

  // show selected items with a small remove button for each
  listContainer.innerHTML = selectedProducts
    .map(
      (p) => `
		<div class="selected-item" data-id="${p.id}" style="display:flex;align-items:center;gap:8px;margin:6px 0;">
		  <img src="${p.image}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
		  <div style="flex:1;">
			<div style="font-size:14px">${p.name}</div>
			<div style="font-size:12px;color:#666">${p.brand}</div>
		  </div>
		  <button class="remove-selected" data-id="${p.id}">Remove</button>
		</div>
	`
    )
    .join("");

  // Attach remove handlers
  listContainer.querySelectorAll(".remove-selected").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const idx = selectedProducts.findIndex((s) => s.id === id);
      if (idx !== -1) selectedProducts.splice(idx, 1);

      // remove visual selection from visible card if present
      const card = productsContainer.querySelector(
        `.product-card[data-id="${id}"]`
      );
      if (card) {
        card.classList.remove("selected");
      }

      // persist change and re-render
      saveSelectedToLocalStorage();
      renderSelectedProducts();
    });
  });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
	   where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Chat form submission handler - send full conversation history to worker,
   record user's message in UI and in messagesHistory so follow-ups are contextual */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const input = chatForm.querySelector("input");
  if (!input) return;
  const text = input.value && input.value.trim();
  if (!text) return;

  // Append the user's message to UI and to history
  appendChatMessage("user", text);
  messagesHistory.push({ role: "user", content: text });

  // clear input and show assistant is typing
  input.value = "";
  const statusEl = appendStatus("Generating response...");

  // Send full history to worker
  const WORKER_URL = "https://lorealprj2.dasherr1.workers.dev/";
  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesHistory, model: "gpt-4o" }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      removeStatus(statusEl);
      appendChatMessage(
        "assistant",
        `Error from server: ${resp.status} ${errText}`
      );
      return;
    }

    const data = await resp.json();
    const aiContent =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    removeStatus(statusEl);

    if (aiContent) {
      // store assistant reply in history and UI
      messagesHistory.push({ role: "assistant", content: aiContent });
      appendChatMessage("assistant", aiContent);
    } else {
      appendChatMessage("assistant", "No content returned from the AI.");
    }
  } catch (err) {
    removeStatus(statusEl);
    appendChatMessage(
      "assistant",
      "Failed to generate response. See console for details."
    );
    console.error("Chat submit error:", err);
  }
});

/* Generate Routine button handler */
// find the generate button in the page (replace selector if your button has a different id)
const generateBtn = document.querySelector(".generate-btn");
if (generateBtn) {
  generateBtn.addEventListener("click", async () => {
    // basic guard
    if (selectedProducts.length === 0) {
      appendChatMessage(
        "assistant",
        "Please select one or more products first."
      );
      return;
    }

    // Build a user prompt describing products — do NOT push this prompt into messagesHistory (so it doesn't show in UI)
    const productPrompt =
      "Create a concise, easy-to-follow routine using these products. Include order of use, time of day (AM/PM), and short reasons why each product is used. " +
      "Respond in plain text.\n\nProducts:\n" +
      JSON.stringify(
        selectedProducts.map((p) => ({
          name: p.name,
          brand: p.brand,
          category: p.category,
          description: p.description,
        })),
        null,
        2
      );

    // Show only a single status indicator in the chat window (no user message)
    const statusEl = appendStatus("Generating routine...");

    // Prepare messages to send: start with system (already in history) and include prior conversation for context,
    // but append the product prompt as the immediate user instruction for this request.
    const messagesToSend = [
      ...messagesHistory,
      { role: "user", content: productPrompt },
    ];

    const WORKER_URL = "https://lorealprj2.dasherr1.workers.dev/";
    try {
      const resp = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend, model: "gpt-4o" }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        removeStatus(statusEl);
        appendChatMessage(
          "assistant",
          `Error from server: ${resp.status} ${errText}`
        );
        return;
      }

      const data = await resp.json();
      const aiContent =
        data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content;

      removeStatus(statusEl);

      if (aiContent) {
        // Save assistant reply into the persistent history so follow-ups can reference it
        messagesHistory.push({ role: "assistant", content: aiContent });
        appendChatMessage("assistant", aiContent);
      } else {
        appendChatMessage(
          "assistant",
          "No content returned from the AI. Check the worker and OpenAI response."
        );
      }
    } catch (err) {
      removeStatus(statusEl);
      appendChatMessage(
        "assistant",
        "Failed to generate routine. See console for details."
      );
      console.error("Generate routine error:", err);
    }
  });
}

// --- Helper UI functions: append messages, status, scroll ---
function appendChatMessage(role, text) {
  // simple bubble layout with inline minimal styles so no CSS change is required
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${role}`;
  wrapper.style.display = "flex";
  wrapper.style.margin = "8px 0";

  const bubble = document.createElement("div");
  bubble.innerText = text;
  bubble.style.maxWidth = "100%";
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.lineHeight = "1.4";
  bubble.style.padding = "10px 12px";
  bubble.style.borderRadius = "12px";

  if (role === "user") {
    wrapper.style.justifyContent = "flex-end";
    bubble.style.background = "#000";
    bubble.style.color = "#fff";
  } else {
    // assistant
    wrapper.style.justifyContent = "flex-start";
    bubble.style.background = "#f1f1f1";
    bubble.style.color = "#111";
  }

  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return wrapper;
}

function appendStatus(text) {
  // small neutral status line used while awaiting the worker
  const el = document.createElement("div");
  el.className = "chat-status";
  el.style.margin = "8px 0";
  el.style.color = "#666";
  el.style.fontStyle = "italic";
  el.innerText = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return el;
}

function removeStatus(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

/* Initialization: load products and restore saved selections */
async function init() {
  // load products so allProducts is populated
  await loadProducts();

  // restore saved product ids into selectedProducts array
  const restored = loadSavedFromLocalStorage();
  if (restored.length > 0) {
    selectedProducts = restored;
  }

  // render selected list on startup (and any controls)
  renderSelectedProducts();

  // If a category is already selected, show its products so selection visuals apply.
  const currentCategory = categoryFilter && categoryFilter.value;
  if (currentCategory) {
    const products = allProducts.filter((p) => p.category === currentCategory);
    displayProducts(products);
  }

  // otherwise keep the existing placeholder until user selects a category
}

init();
