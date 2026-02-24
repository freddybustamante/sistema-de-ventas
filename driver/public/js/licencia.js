

document.addEventListener("DOMContentLoaded", async () => {
  const estadoDiv = document.getElementById("estadoLicencia");
  const bloqueoDiv = document.getElementById("bloqueoLicencia");

  try {
    const resp = await fetch("/api/licencia/estado");
    const data = await resp.json();

    if (data.estado === "expirado") {
      estadoDiv.style.display = "none"; 
      bloqueoDiv.style.display = "block";

      Swal.fire({
        icon: "error",
        title: "⛔ Licencia expirada",
        text: "Ingrese el código en la sección de Licencias para reactivar.",
        confirmButtonText: "Ir a Licencias",
        confirmButtonColor: "#d33"
      }).then(() => {
        window.location.href = "licencias.html"; // redirige al módulo de licencia
      });

    } else if (data.estado === "prueba") {
      bloqueoDiv.style.display = "none"; 
      estadoDiv.className = "alert alert-info text-center";
      estadoDiv.style.display = "block";
      estadoDiv.textContent = `🔑 Licencia en modo prueba. Días restantes: ${data.diasRestantes}`;

      Swal.fire({
        icon: "info",
        title: "Licencia en modo prueba",
        text: `Te quedan ${data.diasRestantes} días.`,
        timer: 4000,
        showConfirmButton: false
      });

    } else if (data.estado === "activado") {
      estadoDiv.style.display = "none";
      bloqueoDiv.style.display = "none";
    }
  } catch (err) {
    console.error("❌ Error verificando licencia:", err);
    Swal.fire({
      icon: "error",
      title: "Error de conexión",
      text: "No se pudo verificar la licencia.",
      confirmButtonText: "Reintentar"
    }).then(() => location.reload());
  }
});

