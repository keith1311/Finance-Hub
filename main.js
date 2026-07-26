let currentIndex = 2;

// Declare global variables (using let so they can be reassigned)
let dailyData = [];
let dailyTotal = 0.0;
let weeklyData = [];
let weeklyTotal = 0.0;
let monthlyData = [];
let monthlyTotal = 0.0;
let yearlyData = [];
let yearlyTotal = 0.0;

async function fetchAndRenderMainPage() {
  try {
    // 1. Fetch data from your Python API
    const response = await fetch("http://127.0.0.1:8000/api/render_main_page");

    // 2. Destructure into temporary constants without re-declaring global ones
    const responseData = await response.json();
    const walletData = responseData[0];
    const totalBalance = responseData[1];
    const transactionData = responseData[2];

    // 3. Update the Global variables directly (releasing them globally)
    dailyData = responseData[3];
    dailyTotal = responseData[4];
    weeklyData = responseData[5];
    weeklyTotal = responseData[6];
    monthlyData = responseData[7];
    monthlyTotal = responseData[8];
    yearlyData = responseData[9];
    yearlyTotal = responseData[10];

    currentIndex = responseData[11];

    // Update the total balance display
    document.getElementById("total-balance").textContent =
      `RM${totalBalance.toFixed(2)}`;

    renderWallets(walletData);
    renderTransactionTable(transactionData);
    adjustRightPanel();
    updateSlide();
  } catch (error) {
    console.error("Failed to load wallets:", error);
  }
}

fetchAndRenderMainPage();

function renderWallets(walletData) {
  const grid = document.getElementById("wallet-grid");
  grid.innerHTML = ""; // Clear any placeholders

  const template = document.getElementById("wallet-template");

  walletData.forEach((wallet) => {
    const clone = template.content.cloneNode(true);

    const link = clone.querySelector(".view-btn");
    link.href = `wallets.html?id=${wallet.id}`;
    link.dataset.password = wallet.password;

    link.addEventListener("click", (e) => {
      if (wallet.password !== "") {
        e.preventDefault();
        const dialog = document.getElementById("access-dialog");
        dialog.dataset.link = `wallets.html?id=${wallet.id}`;
        dialog.dataset.password = wallet.password;

        document.getElementById("access-title").innerHTML =
          `"${wallet.name}" Wallet Is Locked! <i class="fa-solid fa-lock"></i>`;
        dialog.showModal();
      }
    });

    // Set the name & pin icon
    if (wallet.pin === false) {
      clone.querySelector(".name").textContent = wallet.name;
    } else if (wallet.pin === true) {
      clone.querySelector(".name").innerHTML =
        `${wallet.name} <i class="fa-solid fa-thumbtack"></i>`;
    }

    clone.querySelector(".balance").textContent = `RM ${wallet.balance}`;

    // --- RENAME ACTION ---
    const renameLink = clone.querySelector(".rename-link");
    renameLink.addEventListener("click", (e) => {
      e.preventDefault();
      const dialog = document.getElementById("rename-dialog");
      const title = document.getElementById("rename-dialog-title");

      dialog.dataset.walletId = wallet.id;
      dialog.dataset.walletName = wallet.name;
      title.textContent = `Rename "${wallet.name}" Wallet`;
      dialog.showModal();
    });

    // --- DELETE ACTION ---
    const deleteLink = clone.querySelector(".delete-link");
    deleteLink.addEventListener("click", (e) => {
      e.preventDefault();
      const dialog = document.getElementById("delete-dialog");
      const title = document.getElementById("delete-dialog-title");

      dialog.dataset.walletId = wallet.id;
      dialog.dataset.walletName = wallet.name;
      title.textContent = `Delete "${wallet.name}" Wallet?`;
      dialog.showModal();
    });

    // --- LOCK / UNLOCK ACTION ---
    const lockLink = clone.querySelector(".lock-link");
    if (wallet.password !== "") {
      lockLink.innerHTML = '<i class="fa-solid fa-unlock"></i> Unlock';
    } else {
      lockLink.innerHTML = '<i class="fa-solid fa-lock"></i> Lock';
    }

    lockLink.addEventListener("click", (e) => {
      e.preventDefault();
      const dialog = document.getElementById("password-dialog");
      const title = document.getElementById("password-dialog-title");
      const saveButton = document.getElementById("btn-save");

      dialog.dataset.walletId = wallet.id;
      dialog.dataset.walletName = wallet.name;
      dialog.dataset.password = wallet.password;

      if (wallet.password !== "") {
        title.textContent = `Unlock "${wallet.name}" Wallet`;
        if (saveButton)
          saveButton.innerHTML =
            '<i class="fa-solid fa-unlock"></i> Unlock Wallet';
      } else {
        title.textContent = `Lock "${wallet.name}" Wallet`;
        if (saveButton)
          saveButton.innerHTML = '<i class="fa-solid fa-lock"></i> Lock Wallet';
      }
      dialog.showModal();
    });

    // --- CENSOR ACTION ---
    const censorLink = clone.querySelector(".censor-link");
    if (wallet.censor == false) {
      censorLink.innerHTML = '<i class="fa-solid fa-asterisk"></i> Censor';
    } else {
      censorLink.innerHTML = '<i class="fa-solid fa-dollar-sign"></i> Uncensor';
    }

    censorLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/censor/${wallet.id}`,
          { method: "POST" },
        );
        if (!response.ok) {
          const errorData = await response.json();
          alert(`Error: ${errorData.detail}`);
          return;
        }

        const data = await response.json();

        renderWallets(data.wallets);
      } catch (error) {
        console.error("Error updating wallet:", error);
        alert("An error occurred while saving. Please try again.");
      }
    });

    // --- HIDE ACTION ---
    const hideLink = clone.querySelector(".hide-link");
    hideLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/hide/${wallet.id}`,
          { method: "POST" },
        );
        if (!response.ok) {
          const errorData = await response.json();
          alert(`Error: ${errorData.detail}`);
          return;
        }
        const data = await response.json();

        renderWallets(data.wallets);
      } catch (error) {
        console.error("Error updating wallet:", error);
        alert("An error occurred while saving. Please try again.");
      }
    });

    // --- PIN ACTION ---
    const pinLink = clone.querySelector(".pin-link");
    if (wallet.pin == false) {
      pinLink.innerHTML = '<i class="fa-solid fa-thumbtack"></i> Pin';
    } else {
      pinLink.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Unpin';
    }

    pinLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/pin/${wallet.id}`,
          { method: "POST" },
        );
        if (!response.ok) {
          const errorData = await response.json();
          alert(`Error: ${errorData.detail}`);
          return;
        }
        const data = await response.json();

        renderWallets(data.wallets);
      } catch (error) {
        console.error("Error updating wallet:", error);
        alert("An error occurred while saving. Please try again.");
      }
    });

    grid.appendChild(clone);
  });
}
function renderTransactionTable(transactionData) {
  // Render Transaction Table
  const tableDetailsContainer = document.getElementById("table-details");

  // Clear the placeholder text
  tableDetailsContainer.innerHTML = "";

  if (transactionData.length === 0) {
    tableDetailsContainer.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No transactions found.</div>';
  } else {
    // Loop through backend data and create rows
    transactionData.forEach((tx) => {
      const rowDiv = document.createElement("div");
      // Add a class name for your row styling (e.g., flex layout matching your headers)
      rowDiv.className = "table-row-item";

      rowDiv.innerHTML = `
                <div>${tx.date}</div>
                <div>${tx.tags || "-"}</div>
                <div>${tx.category}</div>
                <div>RM ${tx.amount.toFixed(2)}</div>
                <div>${tx.wallet_name || tx.wallet_id}</div>
            `;

      tableDetailsContainer.appendChild(rowDiv);
    });
  }
}
// Keep track of the active chart instance outside the function
let activeExpenseChart = null;

function renderRightPanel(canvasData, metricsTotal) {
  const chartArea = document.getElementById("chart-area");

  if (!canvasData.labels || canvasData.labels.length === 0) {
    // If a chart already exists, destroy it before clearing the HTML area
    if (activeExpenseChart) {
      activeExpenseChart.destroy();
      activeExpenseChart = null;
    }
    chartArea.innerHTML =
      '<div style="padding: 12px; text-align: center; color: #888;">No data available.</div>';
    document.getElementById("metrics-amt").textContent =
      `RM${metricsTotal.toFixed(2)}`;
    return;
  }

  // Ensure the chart-area actually contains a canvas element
  // (re-creates it if it was previously overwritten by the "No data available" message)
  chartArea.innerHTML = '<canvas id="expenseChart"></canvas>';
  const ctx = document.getElementById("expenseChart").getContext("2d");

  // Destroy the previous chart instance if it exists
  if (activeExpenseChart) {
    activeExpenseChart.destroy();
  }

  // Create the new chart and save the reference
  activeExpenseChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: canvasData.labels,
      datasets: [
        {
          data: canvasData.data,
          backgroundColor: [
            "#3b82f6", // Blue (Groceries)
            "#10b981", // Emerald (Income)
            "#f59e0b", // Amber (Healthcare)
            "#ef4444", // Red (Bills)
            "#8b5cf6", // Violet (Food & Dining)
            "#ec4899", // Pink (Entertainment)
            "#06b6d4", // Cyan (Transport)
            "#f97316", // Orange
            "#d946ef", // Fuchsia
            "#64748b", // Slate Gray
            "#eab308", // Yellow
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: false,
      animation: {
        duration: 1500,
      },
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#cbd3da", boxWidth: 12 },
        },
      },
    },
  });

  // Update Total Amount
  document.getElementById("metrics-amt").textContent =
    `RM${metricsTotal.toFixed(2)}`;
}
//====================== Dropdown Menu Function ======================//
document.addEventListener("click", function (e) {
  // 1. Identify if a button or a menu link was clicked
  const targetBtn = e.target.closest(".menu-btn, .manage-btn");

  // 2. Handle Button Clicks (Toggle Menus)
  if (targetBtn) {
    e.stopPropagation();
    const menu = targetBtn.nextElementSibling;

    // Close all other open menus
    document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
      if (m !== menu) m.classList.remove("active");
    });

    // Toggle the targeted menu
    if (menu && menu.classList.contains("dropdown-menu")) {
      menu.classList.toggle("active");
    }
  }
  // 4. Close menus if clicking anywhere else on the page
  else {
    document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
      m.classList.remove("active");
    });
  }
});

//====================== Rename Function ======================//
const renameForm = document.getElementById("rename-form");
const renameDialog = document.getElementById("rename-dialog");
const newNameInput = document.getElementById("new-name");
const renameWarningText = document.getElementById("rename-warning-text");

// Make the submit event listener async so we can use await
renameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Grab dataset values HERE when the form is actually submitted
  const walletName = renameDialog.dataset.walletName;
  const walletId = renameDialog.dataset.walletId;

  // 1. Grab the value from input
  const newName = newNameInput.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word

  // 2. RUN YOUR JS PROCESSING / VALIDATION
  if (newName === "") {
    renameWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Name cannot be empty.';
    return;
  }

  if (newName === walletName) {
    renameWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> This is already your current wallet name.';
    newNameInput.value = "";
    return;
  }

  // 3. POST TO BACKEND (via fetch)
  try {
    const response = await fetch("http://127.0.0.1:8000/api/rename-wallet", {
      // Point to your actual rename endpoint
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletId: walletId,
        newName: newName,
      }),
    });

    // 1. Check if the response failed (e.g., status 400 or 404)
    if (!response.ok) {
      const errorData = await response.json(); // Parses {"detail": "..."}
      renameWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      newNameInput.value = "";
      return;
    }
  } catch (error) {
    console.error("Error updating wallet:", error);
    event.preventDefault(); // Stop dialog from closing if backend save failed
    alert("An error occurred while saving. Please try again.");
    return;
  }

  // 4. Clean up the input field for next time
  newNameInput.value = "";
  renameWarningText.innerHTML = "";
  renameDialog.close();
  location.reload();
});

//====================== Delete Function ======================//
async function deleteWallet() {
  const deleteDialog = document.getElementById("delete-dialog");
  const deleteDialog2 = document.getElementById("delete-dialog2");
  const walletId = deleteDialog.dataset.walletId;
  try {
    // 2. Send the POST request to your FastAPI backend
    const response = await fetch(
      "http://127.0.0.1:8000/api/delete-wallet/" + walletId,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      alert(`Error: ${errorData.detail}`);
      return;
    }

    deleteDialog2.close();
    location.reload();
  } catch (error) {
    console.error("Error updating wallet:", error);
    event.preventDefault(); // Stop dialog from closing if backend save failed
    alert("An error occurred while saving. Please try again.");
    return;
  }
}

// ====================== Access Wallet Function ======================//
const accessDialog = document.getElementById("access-dialog");
const inputPassword = document.getElementById("access-wallet");
const accessWarningText = document.getElementById("access-warning-text");
const accessForm = document.getElementById("access-form");

inputPassword.addEventListener("input", () => {
  const password = inputPassword.value.trim();

  // 1. If empty, clear text and reset style
  if (password.length === 0) {
    accessWarningText.innerHTML = "";
    accessWarningText.style.color = ""; // Resets back to your default CSS color (red)
    return;
  }

  // 2. If too short (< 8 characters)
  if (password.length < 8) {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    accessWarningText.style.color = ""; // Uses default CSS red
    return;
  }

  // 3. If valid (>= 8 characters)
  if (password.length >= 8) {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    accessWarningText.style.color = "#10b981"; // Changes text color to green (Tailwind emerald-500)
  }
});

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const actualPassword = accessDialog.dataset.password;
  const walletPage = accessDialog.dataset.link;
  const enteredValue = inputPassword.value;

  // 1. Check length
  if (enteredValue.length < 8) {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
    inputPassword.value = "";
    return;
  }

  // 2. Check if password matches
  if (enteredValue === actualPassword) {
    accessWarningText.innerHTML = "";
    accessWarningText.style.color = "";
    inputPassword.value = "";
    accessDialog.close();

    window.location.href = walletPage;
  } else {
    accessWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Incorrect password. Please try again.';
    accessWarningText.style.color = "";
    inputPassword.value = "";
    return;
  }
});

// ====================== Lock Function ======================//
const passwordForm = document.getElementById("password-form");
const lockWarningText = document.getElementById("lock-warning-text");
const passwordDialog = document.getElementById("password-dialog");
const passwordInput = document.getElementById("password");

passwordInput.addEventListener("input", () => {
  const password = passwordInput.value.trim();

  // 1. If empty, clear text and reset style
  if (password.length === 0) {
    lockWarningText.innerHTML = "";
    lockWarningText.style.color = "";
    return;
  }

  // 2. If too short (< 8 characters)
  if (password.length < 8) {
    lockWarningText.innerHTML =
      '<i class="fa-solid fa-circle-xmark"></i> Invalid Password';
    lockWarningText.style.color = "";
    return;
  }

  // 3. If valid (>= 8 characters)
  if (password.length >= 8) {
    lockWarningText.innerHTML =
      '<i class="fa-solid fa-circle-check"></i> Valid Password';
    lockWarningText.style.color = "#10b981";
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const walletId = passwordDialog.dataset.walletId;
  const currentPasswordOnWallet = passwordDialog.dataset.password; // "" if unlocked, or active password if locked
  const password = passwordInput.value.trim();

  // 1. If the wallet is locked, verify the password matches first
  if (currentPasswordOnWallet !== "") {
    if (password.length < 8) {
      lockWarningText.style.color = "";
      lockWarningText.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
      passwordInput.value = "";
      return;
    }
    if (password !== currentPasswordOnWallet) {
      lockWarningText.style.color = "";
      lockWarningText.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Incorrect Password. Please try again.';
      passwordInput.value = "";
      return;
    }
  } else {
    // 2. If the wallet is unlocked (we are locking it), enforce the 8-character minimum
    if (password.length < 8) {
      lockWarningText.style.color = "";
      lockWarningText.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation"></i> Passwords must contain a minimum of 8 characters.';
      passwordInput.value = "";
      return;
    }
  }

  // 3. Send the request to the backend once all checks pass
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/lock-wallet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletId: walletId,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      lockWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      passwordInput.value = "";
      return;
    }

    // 4. Cleanup and reload page on success
    lockWarningText.innerHTML = "";
    passwordInput.value = "";
    passwordDialog.close();
    location.reload();
  } catch (error) {
    console.error("Error updating wallet lock status:", error);
    lockWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> An error occurred. Please try again.';
  }
});

// ====================== Create Function ======================//
const createForm = document.getElementById("create-form");
const createDialog = document.getElementById("create-dialog");
const newWalletInput = document.getElementById("new-wallet");
const createWarningText = document.getElementById("create-warning-text");

// Make the submit event listener async so we can use await
createForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // 1. Grab the value from input
  const walletName = newWalletInput.value
    .trim() // Remove spaces from the very beginning and end
    .replace(/\s+/g, " ") // Replace multiple consecutive spaces in between words with a single space
    .toLowerCase() // Convert everything to lowercase first
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize the first letter of every word

  // 2. RUN YOUR JS PROCESSING / VALIDATION
  if (walletName === "") {
    createWarningText.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Name cannot be empty.';
    return;
  }

  // 3. POST TO BACKEND (via fetch)
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/create-wallet/${walletName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    // 1. Check if the response failed (e.g., status 400 or 404)
    if (!response.ok) {
      const errorData = await response.json(); // Parses {"detail": "..."}
      createWarningText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorData.detail}`;
      newWalletInput.value = "";
      return;
    }
  } catch (error) {
    console.error("Error updating wallet:", error);
    event.preventDefault(); // Stop dialog from closing if backend save failed
    alert("An error occurred while saving. Please try again.");
    return;
  }

  // 4. Clean up the input field for next time
  newWalletInput.value = "";
  createWarningText.innerHTML = "";
  createDialog.close();
  location.reload();
});

// ====================== Metrics Function ======================//
// 1. Target your sliding elements and arrow divs
const wrapper = document.getElementById("view-wrapper");
const wrapper2 = document.getElementById("view-wrapper2");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// 3. Handle Left Arrow click
prevBtn.addEventListener("click", async () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateSlide();
    adjustRightPanel();
  }
});

// 4. Handle Right Arrow click
nextBtn.addEventListener("click", async () => {
  if (currentIndex < 3) {
    currentIndex++;
    updateSlide();
    adjustRightPanel();
  }
});

// 5. Update slider position and get active value
function updateSlide() {
  const percentage = -currentIndex * 25;
  wrapper.style.transform = `translateX(${percentage}%)`;
  wrapper2.style.transform = `translateX(${percentage}%)`;

  if (currentIndex === 0) {
    prevBtn.classList.add("hidden");
  } else {
    prevBtn.classList.remove("hidden");
  }

  // If we are at the very right (Yearly), hide the next button
  if (currentIndex === 3) {
    nextBtn.classList.add("hidden");
  } else {
    nextBtn.classList.remove("hidden");
  }
}

function adjustRightPanel() {
  if (currentIndex === 0) {
    renderRightPanel(dailyData, dailyTotal);
  } else if (currentIndex === 1) {
    renderRightPanel(weeklyData, weeklyTotal);
  } else if (currentIndex === 2) {
    renderRightPanel(monthlyData, monthlyTotal);
  } else if (currentIndex === 3) {
    renderRightPanel(yearlyData, yearlyTotal);
  } else {
    // Fixed: Replaced Python string formatting with JavaScript template literal
    console.error(`Error: Invalid currentIndex of ${currentIndex}`);
    alert(`Error: Invalid slide index (${currentIndex})`);
  }
}
