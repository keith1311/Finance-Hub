async function fetchAndRenderWallets() {
  try {
    // 1. Fetch data from your Python API
    // const response = await fetch("http://127.0.0.1:8000/api/wallets");
    // const walletData = await response.json();

    const walletData = [
      { name: "Wallet 1" },
      { name: "Wallet 2" },
      { name: "Wallet 3" },
      { name: "Wallet 4" },
      { name: "Wallet 5" },
      { name: "Wallet 6" },
    ];

    const grid = document.getElementById("wallet-grid");
    grid.innerHTML = ""; // Clear any placeholders

    // 2. Loop through the actual database data
    const template = document.getElementById("wallet-template");

    walletData.forEach((wallet) => {
      const clone = template.content.cloneNode(true);

      // Set the data using textContent
      clone.querySelector(".name").textContent = wallet.name;

      // Append the card (NOT the grid) to the grid container
      document.getElementById("wallet-grid").appendChild(clone);
    });
  } catch (error) {
    console.error("Failed to load wallets:", error);
  }
}

// 3. Trigger the function when the page loads
window.onload = fetchAndRenderWallets;

document.querySelectorAll(".menu-btn, .manage-btn").forEach((btn) => {
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    const menu = this.nextElementSibling;
    document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
      if (m !== menu) m.classList.remove("active");
    });
    if (menu) {
      menu.classList.toggle("active");
    }
  });
});
document.addEventListener("click", function () {
  document.querySelectorAll(".dropdown-menu.active").forEach((m) => {
    m.classList.remove("active");
  });
});
document.querySelectorAll(".dropdown-menu a").forEach((item) => {
  item.addEventListener("click", function () {
    alert("Action: " + this.textContent);
    this.parentElement.classList.remove("active");
  });
});
