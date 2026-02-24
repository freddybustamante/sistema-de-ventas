document.addEventListener("DOMContentLoaded", async () => {
  const estadoDiv = document.getElementById("estadoLicencia");
  const contenidoVentas = document.getElementById("contenidoVentas");
  const btnVentas = document.getElementById("btnVentas");
  const overlay = document.getElementById("bloqueoLicencia"); // Para overlay

  try {
    const resp = await fetch("/api/licencia/estado");
    const data = await resp.json();

    if (data.estado === "expirado") {
      // Mostrar mensaje
      if (estadoDiv) {
        estadoDiv.className = "alert alert-danger";
        estadoDiv.textContent =
          "⚠️ Su licencia ha expirado. Debe activarla nuevamente.";
      }

      // 🔒 Opción 1: Redirigir
      // window.location.href = "licencias.html";

      // 🔒 Opción 2: Overlay
      if (overlay) {
        overlay.style.display = "block";
      }

      // Bloquear ventas en ventas-flexible.html
      if (contenidoVentas) {
        contenidoVentas.innerHTML = `
          <div class="alert alert-warning">
            Las funciones de ventas están bloqueadas hasta que renueve su licencia.<br>
            <a href="licencias.html" class="btn btn-primary mt-2">Ir a Activación</a>
          </div>
        `;
      }

      // Deshabilitar botón de ventas en index.html
      if (btnVentas) {
        btnVentas.classList.add("disabled");
        btnVentas.setAttribute("aria-disabled", "true");
      }

    } else if (data.estado === "prueba") {
      // Mostrar banner con días restantes solo en modo prueba
      if (estadoDiv) {
        estadoDiv.className = "alert alert-info";
        estadoDiv.textContent = `🔑 Licencia en modo prueba. Días restantes: ${data.diasRestantes}`;
      }

    } else if (data.estado === "activado") {
      // Ocultar banner completamente en estado activado
      if (estadoDiv) {
        estadoDiv.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Error verificando licencia:", err);
    if (estadoDiv) {
      estadoDiv.className = "alert alert-danger";
      estadoDiv.textContent =
        "No se pudo verificar la licencia. Revise conexión con el servidor.";
    }
  }
});
