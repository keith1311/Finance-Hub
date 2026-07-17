async function fetchAndRenderWallets() {
  try {
    // 1. Fetch data from your Python API
    const response = await fetch("http://127.0.0.1:8000/api/renderwallets");
    const walletData = await response.json();

    const grid = document.getElementById("wallet-grid");
    grid.innerHTML = ""; // Clear any placeholders

    // 2. Loop through the actual database data
    const template = document.getElementById("wallet-template");

    walletData.forEach((wallet) => {
      const clone = template.content.cloneNode(true);

      // Set the data using textContent
      clone.querySelector(".name").textContent = wallet.name;
      clone.querySelector(".balance").textContent =
        `RM ${wallet.balance.toFixed(2)}`;

      // Append the card (NOT the grid) to the grid container
      document.getElementById("wallet-grid").appendChild(clone);
    });
  } catch (error) {
    console.error("Failed to load wallets:", error);
  }
}

async function fetchAndRenderTotalBalance() {
  try {
    // 1. Fetch data from your Python API
    const response = await fetch("http://127.0.0.1:8000/api/total-balance");
    const totalBalance = await response.json();

    document.getElementById("total-balance").textContent =
      `RM${totalBalance.toFixed(2)}`;
  } catch (error) {
    console.error("Failed to load total balance:", error);
  }
}

// 3. Trigger the function when the page loads
fetchAndRenderTotalBalance();
fetchAndRenderWallets();

document.addEventListener("click", function (e) {
  // 1. Identify if a button or a menu link was clicked
  const targetBtn = e.target.closest(".menu-btn, .manage-btn");
  const menuLink = e.target.closest(".dropdown-menu a");

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
  // 3. Handle Menu Link Clicks (Actions)
  else if (menuLink) {
    alert("Action: " + menuLink.textContent);
    // Close the menu after clicking an action
    menuLink.parentElement.classList.remove("active");
  }
  // 4. Close menus if clicking anywhere else on the page
  else {
    document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
      m.classList.remove("active");
    });
  }
});
